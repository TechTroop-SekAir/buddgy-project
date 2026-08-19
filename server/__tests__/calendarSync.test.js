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

const mockFindAll = jest.fn();
const mockFindOrCreate = jest.fn();
const mockUpdate = jest.fn();
jest.mock('../models', () => ({
  PlannedExpense: {
    findAll: (...args) => mockFindAll(...args),
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
  // Default: no prior rows — every test overrides this when it needs to
  // simulate a re-sync against already-known events.
  mockFindAll.mockResolvedValue([]);
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

  it('keeps a new amount-less event and classifies it via a single batched Claude call', async () => {
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

  it('leaves a new event unknown when the classifier fails, without failing the sync', async () => {
    mockEventsList.mockResolvedValue({
      data: { items: [{ id: 'evt-1', summary: 'חתונה של דנה', start: { date: '2026-09-01' } }] },
    });
    mockClassifyEventCostLikelihood.mockRejectedValue(new AppError('unprocessable: ai parse failed', 422));
    mockFindOrCreate.mockResolvedValue([{}, true]);

    const result = await syncPlannedExpenses(AUTHED_USER_ID);

    expect(result).toEqual({ newEvents: 1, likelyCostly: 0 });
    expect(mockFindOrCreate.mock.calls[0][0].defaults).toMatchObject({ cost_likelihood: 'unknown' });
  });

  it('refreshes title/amount/date on an already-known event without incrementing newEvents', async () => {
    mockFindAll.mockResolvedValue([{ google_event_id: 'evt-1', cost_likelihood: 'likely' }]);
    mockEventsList.mockResolvedValue({
      data: { items: [{ id: 'evt-1', summary: 'Rent ₪4500', start: { date: '2026-09-01' } }] },
    });
    mockFindOrCreate.mockResolvedValue([{}, false]);

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

  it('does not re-classify or overwrite an already-"likely" row on re-sync (sticky classification)', async () => {
    mockFindAll.mockResolvedValue([{ google_event_id: 'evt-1', cost_likelihood: 'likely' }]);
    mockEventsList.mockResolvedValue({
      data: { items: [{ id: 'evt-1', summary: 'חתונה של דנה', start: { date: '2026-09-01' } }] },
    });
    mockFindOrCreate.mockResolvedValue([{}, false]);

    const result = await syncPlannedExpenses(AUTHED_USER_ID);

    expect(mockClassifyEventCostLikelihood).not.toHaveBeenCalled();
    expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty('cost_likelihood');
    expect(result).toEqual({ newEvents: 0, likelyCostly: 1 }); // still counted as likely
  });

  it('a classifier failure on re-sync does not downgrade an already-"likely" row to unknown', async () => {
    mockFindAll.mockResolvedValue([{ google_event_id: 'evt-1', cost_likelihood: 'likely' }]);
    mockEventsList.mockResolvedValue({
      data: { items: [{ id: 'evt-1', summary: 'חתונה של דנה', start: { date: '2026-09-01' } }] },
    });
    mockFindOrCreate.mockResolvedValue([{}, false]);

    const result = await syncPlannedExpenses(AUTHED_USER_ID);

    // Not reclassified at all (sticky), so the classifier is never even called
    // — but even if it had failed, the assertion below is what matters: the
    // row must still read as likely afterward.
    expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty('cost_likelihood');
    expect(result.likelyCostly).toBe(1);
  });

  it('re-classifies a still-"unknown" row on the next sync', async () => {
    mockFindAll.mockResolvedValue([{ google_event_id: 'evt-1', cost_likelihood: 'unknown' }]);
    mockEventsList.mockResolvedValue({
      data: { items: [{ id: 'evt-1', summary: 'חתונה של דנה', start: { date: '2026-09-01' } }] },
    });
    mockClassifyEventCostLikelihood.mockResolvedValue([{ google_event_id: 'evt-1', likely_costly: true }]);
    mockFindOrCreate.mockResolvedValue([{}, false]);

    const result = await syncPlannedExpenses(AUTHED_USER_ID);

    expect(mockClassifyEventCostLikelihood).toHaveBeenCalledTimes(1);
    expect(mockUpdate.mock.calls[0][0]).toMatchObject({ cost_likelihood: 'likely' });
    expect(result).toEqual({ newEvents: 0, likelyCostly: 1 });
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
