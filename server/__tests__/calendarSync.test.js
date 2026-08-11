'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// Mock every external boundary — Google, and the DB — docs/INTEGRATIONS.md §
// Failure Handling / docs/TESTING.md § Mocking Policy requires mocked externals in CI.
const mockEventsList = jest.fn();
jest.mock('googleapis', () => ({
  google: { calendar: () => ({ events: { list: (...args) => mockEventsList(...args) } }) },
}));

const mockGetAuthedClient = jest.fn();
jest.mock('../services/googleCalendarService', () => ({
  getAuthedClient: (...args) => mockGetAuthedClient(...args),
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
});

describe('syncPlannedExpenses', () => {
  it('upserts events with a parseable amount and counts only the new ones', async () => {
    mockEventsList.mockResolvedValue({
      data: {
        items: [
          { id: 'evt-1', summary: 'Rent ₪4500', start: { date: '2026-09-01' } },
          { id: 'evt-2', summary: 'Lunch with no amount', start: { date: '2026-09-02' } },
        ],
      },
    });
    mockFindOrCreate.mockResolvedValue([{}, true]);

    const result = await syncPlannedExpenses(AUTHED_USER_ID);

    expect(result).toEqual({ newEvents: 1 });
    expect(mockFindOrCreate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('refreshes an already-known event without incrementing newEvents', async () => {
    mockEventsList.mockResolvedValue({
      data: { items: [{ id: 'evt-1', summary: 'Rent ₪4500', start: { date: '2026-09-01' } }] },
    });
    mockFindOrCreate.mockResolvedValue([{}, false]);

    const result = await syncPlannedExpenses(AUTHED_USER_ID);

    expect(result).toEqual({ newEvents: 0 });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
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
