/**
 * Tool argument descriptions — a ratchet, not a clean bill of health.
 *
 * ── WHY THIS IS NOT ALL-OR-NOTHING ───────────────────────────────────
 * 374 of 771 arguments across 149 of the 287 tools had no description when
 * this was written. Failing the build on all of them would mean either
 * disabling the check or writing 374 descriptions in one sitting, and both of
 * those produce worse descriptions than doing it gradually.
 *
 * So: a recorded baseline that may only go DOWN, plus zero tolerance on the
 * category where a guess is actually expensive.
 *
 * For an MCP tool the description IS the interface. An undescribed argument is
 * one the model infers from the name, and it infers confidently.
 */
import { describe, it, expect } from 'vitest';
import { ALL_TOOLS } from '../registry.js';

interface Prop {
  description?: string;
  type?: unknown;
  enum?: unknown[];
}

function undescribed(): Array<{ tool: string; prop: string; spec: Prop }> {
  const out: Array<{ tool: string; prop: string; spec: Prop }> = [];
  for (const tool of ALL_TOOLS) {
    for (const [prop, spec] of Object.entries(tool.inputSchema.properties ?? {})) {
      if (!(spec as Prop)?.description) out.push({ tool: tool.name, prop, spec: spec as Prop });
    }
  }
  return out;
}

/**
 * Anything that carries an amount of money.
 *
 * Zero tolerance, because the API mixes units: `original_price` is
 * decimal(10,2) DOLLARS while `original_price_cents` is an integer of CENTS.
 * A name alone does not settle it, and the wrong guess is a 100x error in a
 * number that becomes somebody's asking price.
 */
const MONEY = /cents$|price|amount|cost|fee|payout|total|balance/i;

describe('money arguments always state their unit', () => {
  it('has no undescribed money field', () => {
    const offenders = undescribed()
      .filter((u) => MONEY.test(u.prop))
      .map((u) => `${u.tool}.${u.prop}`);

    expect(
      offenders,
      `money arguments with no unit stated:\n  ${offenders.join('\n  ')}`,
    ).toEqual([]);
  });

  it('says DOLLARS or CENTS, not just "price"', () => {
    // A description that repeats the field name is not a description. The one
    // thing a caller cannot infer is the unit, so require it explicitly.
    const vague: string[] = [];
    for (const tool of ALL_TOOLS) {
      for (const [prop, spec] of Object.entries(tool.inputSchema.properties ?? {})) {
        const desc = (spec as Prop)?.description;
        if (!desc || !MONEY.test(prop)) continue;
        if (!/dollar|cent|USD|currency|percent|%/i.test(desc)) {
          vague.push(`${tool.name}.${prop}`);
        }
      }
    }
    expect(vague, `money arguments whose description never names a unit:\n  ${vague.join('\n  ')}`)
      .toEqual([]);
  });
});

describe('description coverage ratchet', () => {
  /**
   * Baseline measured 2026-09-15, after describing the money fields and after
   * the 15 buyer tools moved out to @crossly/buyer-mcp.
   * This number may only go DOWN. If a change adds undescribed arguments the
   * test fails; if it describes some, lower the baseline in the same commit.
   */
  const BASELINE = 347;

  it(`has no more than ${BASELINE} undescribed arguments`, () => {
    const count = undescribed().length;
    expect(
      count,
      count > BASELINE
        ? `${count - BASELINE} newly undescribed argument(s). Describe them — for an ` +
          'MCP tool the description is the interface.'
        : '',
    ).toBeLessThanOrEqual(BASELINE);
  });

  it('reminds us to lower the baseline when it improves', () => {
    const count = undescribed().length;
    expect(
      count,
      `Coverage improved to ${count}. Lower BASELINE in this file to lock it in.`,
    ).toBeGreaterThanOrEqual(BASELINE - 5);
  });
});

describe('enums explain their values', () => {
  it('lists how many enum arguments still need prose', () => {
    // Not a failure: an enum at least tells the model what is legal, which a
    // bare string does not. Recorded so the number is visible and can be
    // driven down deliberately.
    const bare = undescribed().filter((u) => Array.isArray(u.spec.enum));
    // eslint-disable-next-line no-console
    console.log(`  [tool-descriptions] ${bare.length} enum argument(s) have no prose`);
    expect(bare.length).toBeLessThanOrEqual(28);
  });
});
