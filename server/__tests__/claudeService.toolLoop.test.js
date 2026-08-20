'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';

const mockGenerateText = jest.fn();
const mockStepCountIs = jest.fn((n) => ({ type: 'stepCount', n }));

// Mock at the `ai` boundary, same as claudeService.eventCost.test.js — never
// a live call from CI (docs/INTEGRATIONS.md § Failure Handling). generateObject
// is unused here but claudeService.js destructures it at module load, so it
// must exist on the mock.
jest.mock('ai', () => ({
  generateObject: jest.fn(),
  generateText: (...args) => mockGenerateText(...args),
  stepCountIs: (...args) => mockStepCountIs(...args),
}));
jest.mock('@ai-sdk/anthropic', () => ({ createAnthropic: () => () => 'mock-model' }));

const mockAiCallCreate = jest.fn();
jest.mock('../models', () => ({
  AiCall: { create: (...args) => mockAiCallCreate(...args) },
}));

const { runToolLoop } = require('../services/claudeService');

beforeEach(() => {
  jest.clearAllMocks();
  mockAiCallCreate.mockResolvedValue({ id: 1 });
});

describe('runToolLoop', () => {
  it('calls generateText with the given system/prompt/tools and a default step-cap stopWhen', async () => {
    mockGenerateText.mockResolvedValue({ toolCalls: [] });
    const tools = { some_tool: {} };

    await runToolLoop({ system: 'sys', prompt: 'hi', tools });

    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    const call = mockGenerateText.mock.calls[0][0];
    expect(call.system).toBe('sys');
    expect(call.prompt).toBe('hi');
    expect(call.tools).toBe(tools);
    expect(mockStepCountIs).toHaveBeenCalledWith(3);
    expect(call.stopWhen).toEqual({ type: 'stepCount', n: 3 });
  });

  it('passes through a caller-supplied stopWhen unchanged, without applying the default', async () => {
    mockGenerateText.mockResolvedValue({ toolCalls: [] });
    const customStopWhen = ['custom-condition'];

    await runToolLoop({ system: 'sys', prompt: 'hi', tools: {}, stopWhen: customStopWhen });

    expect(mockGenerateText.mock.calls[0][0].stopWhen).toBe(customStopWhen);
    expect(mockStepCountIs).not.toHaveBeenCalled();
  });

  it('sets abortSignal and a default maxOutputTokens', async () => {
    mockGenerateText.mockResolvedValue({ toolCalls: [] });

    await runToolLoop({ system: 'sys', prompt: 'hi', tools: {} });

    const call = mockGenerateText.mock.calls[0][0];
    expect(call.abortSignal).toBeInstanceOf(AbortSignal);
    expect(call.maxOutputTokens).toBe(2048);
  });

  it('honors a caller-supplied maxOutputTokens', async () => {
    mockGenerateText.mockResolvedValue({ toolCalls: [] });

    await runToolLoop({ system: 'sys', prompt: 'hi', tools: {}, maxOutputTokens: 999 });

    expect(mockGenerateText.mock.calls[0][0].maxOutputTokens).toBe(999);
  });

  it('never calls logAiCall / AiCall.create itself, on success', async () => {
    mockGenerateText.mockResolvedValue({ toolCalls: [{ toolName: 'x', input: {} }] });

    await runToolLoop({ system: 'sys', prompt: 'hi', tools: {} });

    expect(mockAiCallCreate).not.toHaveBeenCalled();
  });

  it('propagates a generateText rejection uncaught, without calling AiCall.create', async () => {
    mockGenerateText.mockRejectedValue(new Error('upstream timeout'));

    await expect(runToolLoop({ system: 'sys', prompt: 'hi', tools: {} })).rejects.toThrow('upstream timeout');
    expect(mockAiCallCreate).not.toHaveBeenCalled();
  });
});
