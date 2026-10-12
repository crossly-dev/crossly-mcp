import { apiDelete, apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Vault Markets: Grade -> Vault -> List on Crossly, and unit evidence (api
 * routes/v1/write/vault-markets-grade-to-vault.ts). One raw card is booked
 * into a Grading Run returning to the vault; once it is graded and stored,
 * the user confirms a price and only then is a shelf ask placed on the
 * Crossly order book. Never call confirm_vault_grade_to_vault_list without the
 * user stating the price and agreeing to it for the grade the unit has.
 */
const flowId = { type: 'string', description: 'The Grade to Vault flow id (uuid), from list_vault_grade_to_vault or start_vault_grade_to_vault.' };
const vaultItemId = { type: 'string', description: 'The vault unit id (uuid).' };
const missMode = {
  type: 'string',
  enum: ['roll_over', 'release'],
  description: 'If the run misses its minimum: "roll_over" = move the card into the next open run at this tier (the default); "release" = take it out of grading.',
};

export const vaultMarketsGradeToVaultTools: ToolDef[] = [
  {
    name: 'list_vault_grade_to_vault',
    description: 'Your Grade to Vault flows, newest first, each brought up to date: step (picked, grading, in_vault, listed, ended), what to do next, the grading submission, the unit and its grade, the market for it (mark and best bid, from the book), and the ask once listed.',
    inputSchema: {
      type: 'object',
      properties: { live: { type: 'boolean', description: 'true = only flows still going (picked, grading or in_vault).' } },
      additionalProperties: false,
    },
    handler: (args) => {
      const { live } = args as { live?: boolean };
      return apiGet('/v1/vault-markets/grade-to-vault', live ? { live: '1' } : {});
    },
  },
  {
    name: 'list_vault_grade_to_vault_candidates',
    description: 'What Grade to Vault can start on: raw inventory items matched to a catalogue item, and raw vault units on the grading hub shelf. Also says whether Grading Runs are open (and which env is missing when not).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/grade-to-vault/candidates', {}),
  },
  {
    name: 'start_vault_grade_to_vault',
    description: 'Start Grade to Vault on one raw card. With runId the grading slot is booked at once (free; the saved card is charged only if the run locks). Nothing is listed until the user confirms a price after the grade. Returns the flow.',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', enum: ['inventory', 'vault_unit'], description: '"inventory" = a raw card from your inventory, mailed to the grading hub; "vault_unit" = a raw unit already on the grading hub shelf.' },
        inventoryItemId: { type: 'string', description: 'Inventory item id (uuid). Required when source is "inventory".' },
        vaultItemId: { type: 'string', description: 'Vault unit id (uuid). Required when source is "vault_unit".' },
        runId: { type: 'string', description: 'Grading Run id (uuid), from list_grading_runs: books the slot at once.' },
        declaredValueCents: { type: 'integer', minimum: 0, maximum: 100_000_000, description: 'What the card is worth, in cents of US dollars, for the grader tier limit and insurance. Required to book an inventory card.' },
        targetPriceCents: { type: 'integer', minimum: 1, maximum: 100_000_000, description: 'The price the user has in mind, in cents of US dollars. Remembered and shown after the grade; never placed on the book by itself.' },
        prescreen: { type: 'boolean', description: 'true = a person checks centering and surface before the grader sees it, for a fee.' },
        missMode,
      },
      required: ['source'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { source, inventoryItemId, vaultItemId: unitId, runId, declaredValueCents, targetPriceCents, prescreen, missMode: miss } = args as {
        source: string; inventoryItemId?: string; vaultItemId?: string; runId?: string; declaredValueCents?: number; targetPriceCents?: number; prescreen?: boolean; missMode?: string;
      };
      return apiPost('/v1/vault-markets/grade-to-vault', { source, inventoryItemId, vaultItemId: unitId, runId, declaredValueCents, targetPriceCents, prescreen, missMode: miss });
    },
  },
  {
    name: 'get_vault_grade_to_vault',
    description: 'One Grade to Vault flow, brought up to date with its grading submission and vault unit.',
    inputSchema: { type: 'object', properties: { flowId }, required: ['flowId'], additionalProperties: false },
    handler: (args) => {
      const { flowId: id } = args as { flowId: string };
      return apiGet(`/v1/vault-markets/grade-to-vault/${encodeURIComponent(id)}`, {});
    },
  },
  {
    name: 'book_vault_grade_to_vault',
    description: 'Book (or re-book after a failure) the grading slot of a flow still at "picked". The slot is free; the saved card is charged only if the run locks. Answers 503 naming GRADING_HUB_ADDRESS when runs are not open.',
    inputSchema: {
      type: 'object',
      properties: {
        flowId,
        runId: { type: 'string', description: 'Grading Run id (uuid), from list_grading_runs.' },
        declaredValueCents: { type: 'integer', minimum: 0, maximum: 100_000_000, description: 'What the card is worth, in cents of US dollars. Default: what the flow was started with.' },
        prescreen: { type: 'boolean', description: 'true = a person checks centering and surface first, for a fee.' },
        missMode,
      },
      required: ['flowId', 'runId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { flowId: id, runId, declaredValueCents, prescreen, missMode: miss } = args as { flowId: string; runId: string; declaredValueCents?: number; prescreen?: boolean; missMode?: string };
      return apiPost(`/v1/vault-markets/grade-to-vault/${encodeURIComponent(id)}/book`, { runId, declaredValueCents, prescreen, missMode: miss });
    },
  },
  {
    name: 'mark_vault_grade_to_vault_shipped',
    description: 'The user mailed the card to the grading hub (an inventory card, once its run locked and the label was issued).',
    inputSchema: {
      type: 'object',
      properties: { flowId, tracking: { type: 'string', description: 'The carrier tracking number, if the user has one.' } },
      required: ['flowId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { flowId: id, tracking } = args as { flowId: string; tracking?: string };
      return apiPost(`/v1/vault-markets/grade-to-vault/${encodeURIComponent(id)}/shipped`, { tracking: tracking ?? null });
    },
  },
  {
    name: 'confirm_vault_grade_to_vault_list',
    description: 'The user explicitly confirms an asking price for the grade the unit came back with; one shelf ask is then placed on the Crossly order book. Pre-trade risk, the price band and the ID line apply. Only call this after the user has seen the grade and stated and agreed to the price.',
    inputSchema: {
      type: 'object',
      properties: {
        flowId,
        priceCents: { type: 'integer', minimum: 1, maximum: 100_000_000, description: 'The asking price the user confirmed, in cents of US dollars.' },
        gradeKey: { type: 'string', description: 'The grade the unit has (the flow gradeKey). The price is confirmed for this grade; a different one is refused.' },
        confirm: { type: 'boolean', enum: [true], description: 'Must be true: the user explicitly confirmed this price.' },
      },
      required: ['flowId', 'priceCents', 'gradeKey', 'confirm'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { flowId: id, priceCents, gradeKey, confirm } = args as { flowId: string; priceCents: number; gradeKey: string; confirm: boolean };
      return apiPost(`/v1/vault-markets/grade-to-vault/${encodeURIComponent(id)}/list`, { priceCents, gradeKey, confirm });
    },
  },
  {
    name: 'keep_vault_grade_to_vault',
    description: 'Keep the graded unit in the vault without listing it. The flow ends; it can be listed any time from the vault.',
    inputSchema: { type: 'object', properties: { flowId }, required: ['flowId'], additionalProperties: false },
    handler: (args) => {
      const { flowId: id } = args as { flowId: string };
      return apiPost(`/v1/vault-markets/grade-to-vault/${encodeURIComponent(id)}/keep`, {});
    },
  },
  {
    name: 'cancel_vault_grade_to_vault',
    description: 'Stop a flow before the card goes to the grader (still picked, or its slot only reserved: nothing was charged).',
    inputSchema: { type: 'object', properties: { flowId }, required: ['flowId'], additionalProperties: false },
    handler: (args) => {
      const { flowId: id } = args as { flowId: string };
      return apiPost(`/v1/vault-markets/grade-to-vault/${encodeURIComponent(id)}/cancel`, {});
    },
  },
  {
    name: 'get_vault_unit_evidence',
    description: 'Evidence on a vault unit: its 3D scans (model, texture, listing photos, measured size) and its grade report (grader, grade, cert number, whether the grader record agrees, hub intake photos), and whether each was linked at intake or added by the owner. No owner identity.',
    inputSchema: { type: 'object', properties: { vaultItemId }, required: ['vaultItemId'], additionalProperties: false },
    handler: (args) => {
      const { vaultItemId: id } = args as { vaultItemId: string };
      return apiGet(`/v1/vault-markets/units/${encodeURIComponent(id)}/evidence`, {});
    },
  },
  {
    name: 'add_vault_unit_scan',
    description: 'Add a finished scan the user made (of the same catalogue item) to their vault unit. It is shown as added by the owner, not as intake evidence.',
    inputSchema: {
      type: 'object',
      properties: { vaultItemId, captureId: { type: 'string', description: 'The scan capture id (uuid) from the scan screen.' } },
      required: ['vaultItemId', 'captureId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { vaultItemId: id, captureId } = args as { vaultItemId: string; captureId: string };
      return apiPost(`/v1/vault-markets/units/${encodeURIComponent(id)}/evidence/scans`, { captureId });
    },
  },
  {
    name: 'remove_vault_unit_scan',
    description: 'Take back a scan the user added to their vault unit. Evidence linked at intake stays.',
    inputSchema: {
      type: 'object',
      properties: { vaultItemId, evidenceId: { type: 'string', description: 'The evidence row id (uuid) of the scan, from get_vault_unit_evidence.' } },
      required: ['vaultItemId', 'evidenceId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { vaultItemId: id, evidenceId } = args as { vaultItemId: string; evidenceId: string };
      return apiDelete(`/v1/vault-markets/units/${encodeURIComponent(id)}/evidence/${encodeURIComponent(evidenceId)}`);
    },
  },
];
