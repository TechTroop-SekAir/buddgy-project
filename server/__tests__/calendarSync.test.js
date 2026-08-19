'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// Mock every external boundary — Google, Claude, and the DB — docs/INTEGRATIONS.md §
// Failure Handling / docs/TESTING.md § Mocking Policy requires mocked externals in CI.
const mockEventsList = jest.fn();
jest.mock('googleapis', () => ({
  google: { calendar: () => ({ events: { list: (...args) => mockEventsList(...args) } }) },
}));

const mockGetAuthedClient = jest.fn();
jest.mock('../services/googleCalendarService', () => ({
  getAuthedClient: (...args) => mockGetAuthedClient(...args),
}));

const mockClassifyEventCostLikelihood = jest.fn();
jest.mock('../services/claudeService', () => ({
  classifyEventCostLikelihood: (...args) => mockClassifyEventCostLikelihood(...args),
}));

const mockFindOrCreate = jest.fn();
const mockUpdate = jest.fn();
jest.mock('../models', () => ({
  PlannedExpense: {
    findOrCreate: (...args) => mockFindOrCreate(...args),
    update: (...args) => mockUpdate(...args),
  },
  sequelize: {
    transaction: async (fn) => fn({}),
  },
}));

const AppError = require('../utils/AppError');
const { syncPlannedExpenses, classifyGoogleApiError } = require('../services/calendarSyncService');

const AUTHED_USER_ID = 1;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAuthedClient.mockResolvedValue({ fake: 'client' });
  mockClassifyEventCostLikelihood.mockResolvedValue([]);
});

describe('syncPlannedExpenses', () => {
  it('upserts an amount-bearing event as likely without calling the classifier', async () => {
    mockEventsList.mockResolvedValue({
      data: {
        items: [{ id: 'evt-1', summary: 'Rent ₪4500', start: { date: '2026-09-01' } }],
      },
    });
    mockFindOrCreate.mockResolvedValue([{}, true]);

    const result = await syncPlannedExpenses(AUTHED_USER_ID);

    expect(result).toEqual({ newEvents: 1, likelyCostly: 1 });
    expect(mockClassifyEventCostLikelihood).not.toHaveBeenCalled();
    expect(mockFindOrCreate.mock.calls[0][0].defaults).toMatchObject({ cost_likelihood: 'likely' });
    // Scoped by user_id — google_event_id alone is not unique across users
    // (Google reuses one event id for every attendee of a shared event).
    expect(mockFindOrCreate.mock.calls[0][0].where).toEqual({
      user_id: AUTHED_USER_ID,
      google_event_id: 'evt-1',
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('keeps an amount-less event and classifies it via a single batched Claude call', async () => {
    mockEventsList.mockResolvedValue({
      data: {
        items: [
          { id: 'evt-1', summary: 'חתונה של דנה', start: { date: '2026-09-01' } },
          { id: 'evt-2', summary: 'Standup', start: { date: '2026-09-02' } },
        ],
      },
    });
    mockClassifyEventCostLikelihood.mockResolvedValue([
      { google_event_id: 'evt-1', likely_costly: true },
      { google_event_id: 'evt-2', likely_costly: false },
    ]);
    mockFindOrCreate.mockResolvedValue([{}, true]);

    const result = await syncPlannedExpenses(AUTHED_USER_ID);

    expect(result).toEqual({ newEvents: 2, likelyCostly: 1 });
    expect(mockClassifyEventCostLikelihood).toHaveBeenCalledTimes(1);
    expect(mockClassifyEventCostLikelihood).toHaveBeenCalledWith(AUTHED_USER_ID, [
      { google_event_id: 'evt-1', title: 'חתונה של דנה' },
      { google_event_id: 'evt-2', title: 'Standup' },
    ]);
    expect(mockFindOrCreate.mock.calls[0][0].defaults).toMatchObject({ cost_likelihood: 'likely' });
    expect(mockFindOrCreate.mock.calls[1][0].defaults).toMatchObject({ cost_likelihood: 'unlikely' });
  });

  it('leaves events unknown when the classifier fails, without failing the sync', async () => {
    mockEventsList.mockResolvedValue({
      data: { items: [{ id: 'evt-1', summary: 'חתונה של דנה', start: { date: '2026-09-01' } }] },
    });
    mockClassifyEventCostLikelihood.mockRejectedValue(new AppError('unprocessable: ai parse failed', 422));
    mockFindOrCreate.mockResolvedValue([{}, true]);

    const result = await syncPlannedExpenses(AUTHED_USER_ID);

    expect(result).toEqual({ newEvents: 1, likelyCostly: 0 });
    expect(mockFindOrCreate.mock.calls[0][0].defaults).toMatchObject({ cost_likelihood: 'unknown' });
  });

  it('refreshes an already-known event without incrementing newEvents', async () => {
    mockEventsList.mockResolvedValue({
      data: { items: [{ id: 'evt-1', summary: 'Rent ₪4500', start: { date: '2026-09-01' } }] },
    });
    mockFindOrCreate.mockResolvedValue([{ is_dismissed: false, is_confirmed: false }, false]);

    const result = await syncPlannedExpenses(AUTHED_USER_ID);

    expect(result).toEqual({ newEvents: 0, likelyCostly: 1 });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    // Scoped by user_id so one user's re-sync can never update another
    // user's row for the same shared event id.
    expect(mockUpdate.mock.calls[0][1].where).toEqual({
      user_id: AUTHED_USER_ID,
      google_event_id: 'evt-1',
    });
  });

  it('does not overwrite cost_likelihood on a dismissed row when re-syncing', async () => {
    mockEventsList.mockResolvedValue({
      data: { items: [{ id: 'evt-1', summary: 'Standup', start: { date: '2026-09-02' } }] },
    });
    mockClassifyEventCostLikelihood.mockResolvedValue([{ google_event_id: 'evt-1', likely_costly: true }]);
    mockFindOrCreate.mockResolvedValue([{ is_dismissed: true, is_confirmed: false }, false]);

    await syncPlannedExpenses(AUTHED_USER_ID);

    expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty('cost_likelihood');
  });

  it('does not overwrite cost_likelihood on a confirmed row when re-syncing', async () => {
    mockEventsList.mockResolvedValue({
      data: { items: [{ id: 'evt-1', summary: 'Standup', start: { date: '2026-09-02' } }] },
    });
    mockClassifyEventCostLikelihood.mockResolvedValue([{ google_event_id: 'evt-1', likely_costly: true }]);
    mockFindOrCreate.mockResolvedValue([{ is_dismissed: false, is_confirmed: true }, false]);

    await syncPlannedExpenses(AUTHED_USER_ID);

    expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty('cost_likelihood');
  });

  it('maps a 401 from events.list to a client-safe reconnect error', async () => {
    mockEventsList.mockRejectedValue(Object.assign(new Error('invalid_grant'), { code: 401 }));

    await expect(syncPlannedExpenses(AUTHED_USER_ID)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Google Calendar access was revoked. Please reconnect.',
    });
  });

  it('maps a 403 from events.list to a client-safe reconnect error', async () => {
    mockEventsList.mockRejectedValue(Object.assign(new Error('forbidden'), { response: { status: 403 } }));

    await expect(syncPlannedExpenses(AUTHED_USER_ID)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Google Calendar access was revoked. Please reconnect.',
    });
  });

  it('maps a 429 from events.list to a client-safe rate-limit error', async () => {
    mockEventsList.mockRejectedValue(Object.assign(new Error('quota exceeded'), { code: 429 }));

    await expect(syncPlannedExpenses(AUTHED_USER_ID)).rejects.toMatchObject({
      statusCode: 429,
      message: 'Google Calendar is rate-limited. Try again shortly.',
    });
  });

  it('maps any other events.list failure to a client-safe 502', async () => {
    mockEventsList.mockRejectedValue(Object.assign(new Error('backend error'), { code: 500 }));

    await expect(syncPlannedExpenses(AUTHED_USER_ID)).rejects.toMatchObject({
      statusCode: 502,
      message: 'Google Calendar is temporarily unavailable. Try again shortly.',
    });
  });

  it('passes an AppError from getAuthedClient through unreclassified', async () => {
    mockGetAuthedClient.mockRejectedValue(new AppError('Google Calendar access was revoked. Please reconnect.', 401));

    await expect(syncPlannedExpenses(AUTHED_USER_ID)).rejects.toMatchObject({ statusCode: 401 });
    expect(mockEventsList).not.toHaveBeenCalled();
  });
});

describe('classifyGoogleApiError', () => {
  it('passes an existing AppError through untouched', () => {
    const original = new AppError('custom', 418);
    expect(classifyGoogleApiError(original)).toBe(original);
  });
});
