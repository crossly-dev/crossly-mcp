import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

/**
 * The unit story (api routes/v1/write/vault-markets-unit-story.ts): one
 * timeline per vault unit, oldest first. Its holder sees all of it; anyone
 * else only while the holder's public vault profile is on. People are named
 * only while their own public profile is on; the rest are "A collector".
 * Only a sale carries money, in integer cents of US dollars.
 */
export const vaultMarketsUnitStoryTools: ToolDef[] = [
  {
    name: 'get_vault_unit_story',
    description: "One vault unit's story, oldest first: intake (with scan and grade evidence when it has some), grades, owners, sales at their prices (priceCents, cents of US dollars), loans, pledges, Hall of Grails exhibitions, receipt-token exports and redemptions, and each warehouse-receipt hash-chain step re-verified on read (chain.ok). Also the holder, the current mark, badges and counts. Yours in full; someone else's only while their public vault profile is on (otherwise not found).",
    inputSchema: { type: 'object', properties: { vaultItemId: { type: 'string', format: 'uuid', description: 'The vault unit id (a vault item id).' } }, required: ['vaultItemId'], additionalProperties: false },
    handler: (args) => { const { vaultItemId } = args as { vaultItemId: string }; return apiGet(`/v1/vault-markets/units/${encodeURIComponent(vaultItemId)}/story`); },
  },
  {
    name: 'list_vault_position_units',
    description: "The vault units of one of your positions that you hold (a leveraged long's collateral), each with a link to its story.",
    inputSchema: { type: 'object', properties: { positionId: { type: 'string', format: 'uuid', description: 'The position id.' } }, required: ['positionId'], additionalProperties: false },
    handler: (args) => { const { positionId } = args as { positionId: string }; return apiGet(`/v1/vault-markets/positions/${encodeURIComponent(positionId)}/units`); },
  },
];
