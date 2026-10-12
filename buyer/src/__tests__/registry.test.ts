/**
 * The registry's contract.
 *
 * Two frontends read this list — the MCP server and @crossly/buyer-cli — so a
 * malformed entry does not break one thing, it breaks both, and it breaks them
 * at the point an agent or a user is already mid-task. Cheap to assert here.
 */
import { describe, it, expect } from 'vitest';
import { ALL_TOOLS, TOOL_INDEX } from '../registry.js';

describe('registry shape', () => {
  it('has the 30 buyer tools (15 + the shopping agent tools + 8 vault reads)', () => {
    expect(ALL_TOOLS).toHaveLength(30);
  });

  it('has no duplicate tool names', () => {
    // The index is a Map, so a duplicate would silently drop a tool rather
    // than error — the surviving one wins and the other is simply gone.
    const names = ALL_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    expect(TOOL_INDEX.size).toBe(ALL_TOOLS.length);
  });

  it('gives every tool a usable JSON Schema', () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.inputSchema.type, tool.name).toBe('object');
      expect(typeof tool.inputSchema.properties, tool.name).toBe('object');
      // additionalProperties:false is what makes an agent's typo an error
      // instead of a silently ignored argument.
      expect(tool.inputSchema.additionalProperties, tool.name).toBe(false);
    }
  });

  it('only marks a field required if it is actually declared', () => {
    // A required key with no matching property is unsatisfiable: the agent
    // cannot pass it, so the tool can never be called successfully.
    for (const tool of ALL_TOOLS) {
      for (const key of tool.inputSchema.required ?? []) {
        expect(Object.keys(tool.inputSchema.properties), `${tool.name}.${key}`).toContain(key);
      }
    }
  });

  it('describes every tool and every argument', () => {
    // The description IS the interface for an agent — an undescribed argument
    // is one it will guess at.
    for (const tool of ALL_TOOLS) {
      expect(tool.description.length, tool.name).toBeGreaterThan(30);
      for (const [key, spec] of Object.entries(tool.inputSchema.properties)) {
        const desc = (spec as { description?: string }).description;
        expect(desc, `${tool.name}.${key} has no description`).toBeTruthy();
      }
    }
  });

  it('has a callable handler for each tool', () => {
    for (const tool of ALL_TOOLS) {
      expect(typeof tool.handler, tool.name).toBe('function');
    }
  });
});

describe('it cannot spend money', () => {
  it('exposes no tool that completes a purchase', () => {
    // Load-bearing, not decorative. An agent that believes it can buy will
    // tell a user it did. If a checkout tool is ever added, that has to be a
    // deliberate decision that also updates this test — not something that
    // arrives inside an unrelated refactor.
    // Match on the VERB, not a substring. `list_my_purchases` contains
    // "purchase" and is a read — the first naive version of this test failed
    // on it, which is the correct outcome for a badly-specified assertion.
    // What matters is what the tool DOES, and that is the leading verb.
    const verbs = ALL_TOOLS.map((t) => t.name.split('_')[0]);
    for (const forbidden of ['checkout', 'pay', 'purchase', 'buy', 'charge', 'order']) {
      expect(verbs, `a tool whose verb is "${forbidden}"`).not.toContain(forbidden);
    }
  });

  it('says so in the quote tool, where the temptation is', () => {
    const quote = TOOL_INDEX.get('quote_my_cart');
    expect(quote).toBeDefined();
    expect(quote!.description).toMatch(/without charging|not charge|does not charge/i);
  });
});

describe('it targets the buyer API only', () => {
  it('names no seller-side concept in a tool name', () => {
    // A stray seller tool in this registry would be unreachable (wrong token)
    // and would advertise a capability the server does not have.
    const names = ALL_TOOLS.map((t) => t.name);
    for (const sellerish of ['crosspost', 'delist', 'listing_create', 'submit_tracking']) {
      expect(names.some((n) => n.includes(sellerish)), `found ${sellerish}`).toBe(false);
    }
  });
});
