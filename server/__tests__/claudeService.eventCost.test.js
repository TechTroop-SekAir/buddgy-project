'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';

const mockGenerateObject = jest.fn();

// Mock at the `ai` boundary — never a live call from CI (docs/INTEGRATIONS.md § Failure
// Handling). classifyEventCostLikelihood has no HTTP route of its own (it's called
// internally from calendarSyncService), so it's exercised directly rather than via supertest.
jest.mock('ai', () => ({ generateObject: (...args) => mockGenerateObject(...args) }));
jest.mock('@ai-sdk/anthropic', () => ({ createAnthropic: () => () => 'mock-model' }));

const mockAiCallCreate = jest.fn();
jest.mock('../models', () => ({
  AiCall: { create: (...args) => mockAiCallCreate(...args) },
}));

const { classifyEventCostLikelihood } = require('../services/claudeService');

const AUTHED_USER_ID = 1;

beforeEach(() => {
  jest.clearAllMocks();
  mockAiCallCreate.mockResolvedValue({ id: 1 });
});

describe('classifyEventCostLikelihood', () => {
  it('returns [] and never calls the model for an empty batch', async () => {
    const result = await classifyEventCostLikelihood(AUTHED_USER_ID, []);

    expect(result).toEqual([]);
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });

  it('returns the model classification for each event, logging a successful ai_calls row', async () => {
    mockGenerateObject.mockResolvedValue({
      object: {
        events: [
          { google_event_id: 'evt-1', likely_costly: true },
          { google_event_id: 'evt-2', likely_costly: false },
        ],
      },
    });

    const result = await classifyEventCostLikelihood(AUTHED_USER_ID, [
      { google_event_id: 'evt-1', title: 'חתונה של דנה' },
      { google_event_id: 'evt-2', title: 'Standup' },
    ]);

    expect(result).toEqual([
      { google_event_id: 'evt-1', likely_costly: true },
      { google_event_id: 'evt-2', likely_costly: false },
    ]);
    expect(mockAiCallCreate).toHaveBeenCalledWith({ user_id: AUTHED_USER_ID, kind: 'event_cost', succeeded: true });
  });

  it('drops a result whose google_event_id was not in the requested batch', async () => {
    mockGenerateObject.mockResolvedValue({
      object: {
        events: [
          { google_event_id: 'evt-1', likely_costly: true },
          { google_event_id: 'not-requested', likely_costly: true },
        ],
      },
    });

    const result = await classifyEventCostLikelihood(AUTHED_USER_ID, [{ google_event_id: 'evt-1', title: 'x' }]);

    expect(result).toEqual([{ google_event_id: 'evt-1', likely_costly: true }]);
  });

  it('throws a 422 AppError and logs a failed ai_calls row when the model call fails', async () => {
    mockGenerateObject.mockRejectedValue(new Error('upstream timeout'));

    await expect(
      classifyEventCostLikelihood(AUTHED_USER_ID, [{ google_event_id: 'evt-1', title: 'x' }])
    ).rejects.toMatchObject({ statusCode: 422, message: 'unprocessable: ai parse failed' });
    expect(mockAiCallCreate).toHaveBeenCalledWith({ user_id: AUTHED_USER_ID, kind: 'event_cost', succeeded: false });
  });
});
