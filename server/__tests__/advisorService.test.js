'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';

// advisorService.js never touches `ai`/`@ai-sdk/anthropic` directly — it
// only calls through claudeService.js's exports (see claudeService.js's
// module.exports comment), so mocking `../services/claudeService` wholesale
// is enough to insulate this file from `ai`'s ESM-only build, same pattern
// every controller-adjacent test already uses.
const mockRunToolLoop = jest.fn();
const mockLogAiCall = jest.fn().mockResolvedValue(undefined);
jest.mock('../services/claudeService', () => ({
  runToolLoop: (...args) => mockRunToolLoop(...args),
  logAiCall: (...args) => mockLogAiCall(...args),
  stepCountIs: (n) => ({ type: 'stepCount', n }),
  hasToolCall: (name) => ({ type: 'hasToolCall', name }),
}));

const mockEnvelopeList = jest.fn();
jest.mock('../services/envelopeService', () => ({ list: (...args) => mockEnvelopeList(...args) }));

const mockForecastGet = jest.fn();
jest.mock('../services/forecastService', () => ({ get: (...args) => mockForecastGet(...args) }));

const mockTransactionList = jest.fn();
jest.mock('../services/transactionService', () => ({ list: (...args) => mockTransactionList(...args) }));

const { ask } = require('../services/advisorService');

const USER_ID = 1;
const EMPTY_FORECAST = {
  projectedBalanceAgorot: 0,
  atRiskEnvelopes: [],
  recommendation: null,
  totalActualSpentAgorot: 0,
  totalPlannedExpensesAgorot: 0,
  totalEndOfMonthSpendAgorot: 0,
  missingAmountPlannedExpenses: [],
};

function verdictResult(input) {
  return { toolCalls: [{ toolName: 'provide_verdict', input }] };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLogAiCall.mockResolvedValue(undefined);
  mockEnvelopeList.mockResolvedValue([]);
  mockForecastGet.mockResolvedValue(EMPTY_FORECAST);
  mockTransactionList.mockResolvedValue([]);
});

describe('advisorService.ask', () => {
  it('computes amountAgorot and projectedBalanceAfterAgorot in JS from the model-supplied shekel amount', async () => {
    mockForecastGet.mockResolvedValue({ ...EMPTY_FORECAST, projectedBalanceAgorot: 100000 });
    mockRunToolLoop.mockResolvedValue(
      verdictResult({ verdict: 'in_budget', amount_shekels: 400, suggested_envelope_id: null, cut_shekels: null })
    );

    const result = await ask(USER_ID, 'Can I spend 400 NIS?');

    expect(result.amountAgorot).toBe(40000);
    expect(result.projectedBalanceAfterAgorot).toBe(60000); // 100000 - 40000
  });

  it('computes projectedBalanceAfterAgorot as the current forecast balance for a pure status question (no amount)', async () => {
    mockForecastGet.mockResolvedValue({ ...EMPTY_FORECAST, projectedBalanceAgorot: 55000 });
    mockRunToolLoop.mockResolvedValue(
      verdictResult({ verdict: 'in_budget', amount_shekels: null, suggested_envelope_id: null, cut_shekels: null })
    );

    const result = await ask(USER_ID, 'How much is left in Groceries?');

    expect(result.amountAgorot).toBeNull();
    expect(result.projectedBalanceAfterAgorot).toBe(55000);
    expect(result.explanationKey).toBe('advisor.reply.inBudgetStatus');
  });

  it('rejects a suggested_envelope_id not present in the caller-owned envelope list', async () => {
    mockEnvelopeList.mockResolvedValue([{ id: 7, name: 'Food', monthly_budget_agorot: 100000, spent_agorot: 0 }]);
    mockRunToolLoop.mockResolvedValue(
      verdictResult({ verdict: 'over_budget', amount_shekels: 400, suggested_envelope_id: 999, cut_shekels: 100 })
    );

    const result = await ask(USER_ID, 'unbudgeted 400 NIS');

    expect(result.suggestion).toBeNull();
    expect(result.explanationKey).toBe('advisor.reply.overBudgetNoSuggestion');
  });

  it('accepts a suggested_envelope_id that is present, converting cut_shekels to agorot', async () => {
    mockEnvelopeList.mockResolvedValue([{ id: 7, name: 'Entertainment', monthly_budget_agorot: 50000, spent_agorot: 10000 }]);
    mockRunToolLoop.mockResolvedValue(
      verdictResult({ verdict: 'over_budget', amount_shekels: 400, suggested_envelope_id: 7, cut_shekels: 120 })
    );

    const result = await ask(USER_ID, 'unbudgeted 400 NIS');

    expect(result.suggestion).toEqual({ envelopeId: 7, envelopeName: 'Entertainment', cutAgorot: 12000 });
    expect(result.explanationKey).toBe('advisor.reply.overBudgetWithSuggestion');
  });

  it.each([
    ['near_limit', 100, null, 'advisor.reply.nearLimit'],
    ['in_budget', 100, null, 'advisor.reply.inBudget'],
    ['in_budget', null, null, 'advisor.reply.inBudgetStatus'],
  ])('maps verdict=%s amount=%s suggestion=%s to %s', async (verdict, amountShekels, suggestedId, expectedKey) => {
    mockRunToolLoop.mockResolvedValue(
      verdictResult({ verdict, amount_shekels: amountShekels, suggested_envelope_id: suggestedId, cut_shekels: null })
    );

    const result = await ask(USER_ID, 'question');

    expect(result.explanationKey).toBe(expectedKey);
  });

  it('does not throw with zero envelopes, and logs a successful ai_calls row', async () => {
    mockRunToolLoop.mockResolvedValue(
      verdictResult({ verdict: 'in_budget', amount_shekels: null, suggested_envelope_id: null, cut_shekels: null })
    );

    await expect(ask(USER_ID, 'anything')).resolves.toBeDefined();
    expect(mockLogAiCall).toHaveBeenCalledWith(USER_ID, 'budget_advisor', true);
  });

  it('throws a 422 AppError and logs a failed ai_calls row when the loop exhausts its steps without a provide_verdict call', async () => {
    mockRunToolLoop.mockResolvedValue({ toolCalls: [] });

    await expect(ask(USER_ID, 'question')).rejects.toMatchObject({
      statusCode: 422,
      message: 'unprocessable: ai parse failed',
    });
    expect(mockLogAiCall).toHaveBeenCalledWith(USER_ID, 'budget_advisor', false);
  });

  it('throws a 422 AppError and logs a failed ai_calls row when runToolLoop itself rejects', async () => {
    mockRunToolLoop.mockRejectedValue(new Error('timeout'));

    await expect(ask(USER_ID, 'question')).rejects.toMatchObject({ statusCode: 422 });
    expect(mockLogAiCall).toHaveBeenCalledWith(USER_ID, 'budget_advisor', false);
  });

  it("get_recent_transactions tool returns a recoverable error for an out-of-range envelope id, rather than throwing", async () => {
    mockEnvelopeList.mockResolvedValue([{ id: 7, name: 'Food', monthly_budget_agorot: 100000, spent_agorot: 0 }]);
    let capturedTools;
    mockRunToolLoop.mockImplementation(async ({ tools }) => {
      capturedTools = tools;
      return verdictResult({ verdict: 'in_budget', amount_shekels: null, suggested_envelope_id: null, cut_shekels: null });
    });

    await ask(USER_ID, 'question');

    const badResult = await capturedTools.get_recent_transactions.execute({ envelope_id: 999 });
    expect(badResult).toEqual({ error: expect.stringContaining('unknown envelope_id') });
    expect(mockTransactionList).not.toHaveBeenCalled();

    const goodResult = await capturedTools.get_recent_transactions.execute({ envelope_id: 7 });
    expect(mockTransactionList).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ envelopeId: 7 }));
    expect(goodResult).toEqual({ transactions: [] });
  });

  it('resolves the current month in YYYY-MM-01 format when calling envelopeService/forecastService', async () => {
    mockRunToolLoop.mockResolvedValue(
      verdictResult({ verdict: 'in_budget', amount_shekels: null, suggested_envelope_id: null, cut_shekels: null })
    );

    await ask(USER_ID, 'question');

    expect(mockEnvelopeList).toHaveBeenCalledWith(USER_ID, expect.stringMatching(/^\d{4}-\d{2}-01$/));
    expect(mockForecastGet).toHaveBeenCalledWith(USER_ID, expect.stringMatching(/^\d{4}-\d{2}-01$/));
  });
});
