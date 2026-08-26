'use strict';

// resolveVerdict.js is pure/I/O-free — see its own header comment — so
// these tests need no mocks. Direct unit coverage for pickCutEnvelope, the
// deterministic (JS-owned) cut-source pick that replaced the inert
// `temperature: 0` + prompt-only tie-break approach (docs/features/AGENTS.md
// § Agent 1 "Deterministic cut pick").
const { resolveVerdict, pickCutEnvelope } = require('../services/advisor/resolveVerdict');

const EMPTY_FORECAST = { projectedBalanceAgorot: 0, atRiskEnvelopes: [], recommendation: null };

function envelope(id, name, budgetAgorot, spentAgorot) {
  return { id, name, monthly_budget_agorot: budgetAgorot, spent_agorot: spentAgorot };
}

function idsOf(envelopes) {
  return new Set(envelopes.map((e) => e.id));
}

describe('pickCutEnvelope', () => {
  it('excludes an essential-blocklisted envelope even with the most headroom', () => {
    const envelopes = [envelope(1, 'Rent', 500000, 0), envelope(2, 'Entertainment', 10000, 2000)];
    const winner = pickCutEnvelope({ envelopes, modelPickId: 1, validEnvelopeIds: idsOf(envelopes) });
    expect(winner.id).toBe(2);
  });

  it('excludes an envelope with zero or negative headroom', () => {
    const envelopes = [envelope(1, 'Entertainment', 10000, 10000), envelope(2, 'Shopping', 10000, 12000)];
    const winner = pickCutEnvelope({ envelopes, modelPickId: null, validEnvelopeIds: idsOf(envelopes) });
    expect(winner).toBeNull();
  });

  it('prefers a discretionary-keyword envelope over an unmatched one with more headroom', () => {
    const envelopes = [envelope(1, 'General expenses', 100000, 0), envelope(2, 'Dining out', 50000, 40000)];
    const winner = pickCutEnvelope({ envelopes, modelPickId: null, validEnvelopeIds: idsOf(envelopes) });
    expect(winner.id).toBe(2); // Dining out: 10000 headroom, but discretionary-tagged, beats General's 100000
  });

  it('within a tier, prefers the envelope with the most headroom', () => {
    const envelopes = [envelope(1, 'Dining out', 80000, 60000), envelope(2, 'Shopping', 60000, 10000)]; // headroom 20000 vs 50000
    const winner = pickCutEnvelope({ envelopes, modelPickId: null, validEnvelopeIds: idsOf(envelopes) });
    expect(winner.id).toBe(2);
  });

  it("honors the model's pick when it falls inside the exact tie group (same tier, identical headroom)", () => {
    const envelopes = [envelope(1, 'Dining out', 80000, 60000), envelope(2, 'Entertainment', 70000, 50000)]; // both headroom 20000
    const winner = pickCutEnvelope({ envelopes, modelPickId: 2, validEnvelopeIds: idsOf(envelopes) });
    expect(winner.id).toBe(2);
  });

  it("ignores the model's pick when it falls outside the tie group (worse tier)", () => {
    const envelopes = [envelope(1, 'Dining out', 80000, 60000), envelope(2, 'General expenses', 70000, 50000)]; // both headroom 20000, only #1 is discretionary-tagged
    const winner = pickCutEnvelope({ envelopes, modelPickId: 2, validEnvelopeIds: idsOf(envelopes) });
    expect(winner.id).toBe(1);
  });

  it("ignores the model's pick when it falls outside the tie group (less headroom)", () => {
    const envelopes = [envelope(1, 'Dining out', 80000, 40000), envelope(2, 'Shopping', 60000, 50000)]; // headroom 40000 vs 10000
    const winner = pickCutEnvelope({ envelopes, modelPickId: 2, validEnvelopeIds: idsOf(envelopes) });
    expect(winner.id).toBe(1);
  });

  it('falls back to the lowest id when the model pick is null/invalid and candidates tie', () => {
    const envelopes = [envelope(3, 'Dining out', 80000, 60000), envelope(1, 'Entertainment', 70000, 50000)]; // both headroom 20000
    const winner = pickCutEnvelope({ envelopes, modelPickId: null, validEnvelopeIds: idsOf(envelopes) });
    expect(winner.id).toBe(1);
  });

  it('falls back to the code pick when the model pick is not a valid envelope id', () => {
    const envelopes = [envelope(7, 'Entertainment', 100000, 0)];
    const winner = pickCutEnvelope({ envelopes, modelPickId: 999, validEnvelopeIds: idsOf(envelopes) });
    expect(winner.id).toBe(7);
  });

  it('returns null when there is no valid candidate at all', () => {
    const winner = pickCutEnvelope({ envelopes: [], modelPickId: null, validEnvelopeIds: new Set() });
    expect(winner).toBeNull();
  });

  it('is stable: different model picks (including null) over identical envelope data yield the identical winner (Bug 2 regression)', () => {
    const envelopes = [envelope(1, 'Dining out', 80000, 60000), envelope(2, 'Shopping', 60000, 42000)]; // headroom 20000 vs 18000
    const validEnvelopeIds = idsOf(envelopes);
    const winners = [1, 2, 999, null].map(
      (modelPickId) => pickCutEnvelope({ envelopes, modelPickId, validEnvelopeIds }).id
    );
    expect(new Set(winners).size).toBe(1);
    expect(winners[0]).toBe(1); // Dining out has more headroom, so it wins even when the model votes for Shopping (id 2)
  });
});

describe('resolveVerdict (cutAgorot integration with pickCutEnvelope)', () => {
  it('caps cutAgorot at the winning envelope\'s own headroom and returns null suggestion when cutAgorot is 0', () => {
    const envelopes = [envelope(1, 'Entertainment', 50000, 40000)]; // headroom 10000
    const validEnvelopeIds = idsOf(envelopes);

    const overBudget = resolveVerdict({
      answer: { verdict: 'over_budget', amount_shekels: 400, suggested_envelope_id: 1, reasoning_text: null }, // 40000 agorot shortfall
      envelopes,
      validEnvelopeIds,
      forecast: EMPTY_FORECAST,
    });
    expect(overBudget.suggestion).toEqual({ envelopeId: 1, envelopeName: 'Entertainment', cutAgorot: 10000 });

    const noShortfall = resolveVerdict({
      answer: { verdict: 'in_budget', amount_shekels: null, suggested_envelope_id: 1, reasoning_text: null },
      envelopes,
      validEnvelopeIds,
      forecast: EMPTY_FORECAST,
    });
    expect(noShortfall.suggestion).toBeNull();
  });
});
