import { apiGet, apiPut } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Your vault in AR and in your world home (api routes/v1/write/vault-markets-home.ts):
 * "Show my vault" stands chosen vault units in display cases in the caller
 * Crossly World home, each visible to visitors or not; "See it in your room"
 * reads a unit as an AR model. Display only: nothing moves and no price appears.
 */
export const vaultMarketsHomeTools: ToolDef[] = [
  {
    name: 'get_vault_markets_home_units',
    description: 'The caller vault units and their Crossly World home: each unit (vaultItemId, title, grade, imageUrl, bookKey, inHome, visitors), the home (slug, privacy, path), max units one home shows, how many are shown and how many visitors see, and a note on who sees what. No prices.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/home/units', {}),
  },
  {
    name: 'show_vault_units_in_home',
    description: 'Show exactly these vault units in the caller Crossly World home. Units left out come out of their cases; units already standing stay put; new ones go into a free display case. Returns placed, unplaced (the home is full) and refused (with why). Display only. Ask the user before calling, and which units visitors may see.',
    inputSchema: {
      type: 'object',
      properties: {
        units: {
          type: 'array',
          description: 'Every unit to show (from get_vault_markets_home_units). An empty list takes the whole vault out of the home.',
          items: {
            type: 'object',
            properties: {
              vaultItemId: { type: 'string', description: 'The vault unit id.' },
              visitors: { type: 'boolean', description: 'true: people who may enter the home see this unit; false (default): only the caller sees it.' },
            },
            required: ['vaultItemId'],
            additionalProperties: false,
          },
        },
      },
      required: ['units'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { units } = args as { units: Array<{ vaultItemId: string; visitors?: boolean }> };
      return apiPut('/v1/vault-markets/home/units', { units: units.map((u) => ({ vaultItemId: u.vaultItemId, visitors: u.visitors === true })) });
    },
  },
  {
    name: 'get_vault_unit_ar_model',
    description: 'A vault unit as an AR model for "See it in your room": title, model (a path under /models without .glb, real size), scanUrl (its own captured mesh, when it has one), imageUrl, bookKey and backPath. The page to open on a phone is https://crossly.net/ar/vault-<id>. The caller own units always; somebody else only while they show it to visitors.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'The vault unit id.' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiGet(`/v1/vault-markets/units/${encodeURIComponent(id)}/ar`, {});
    },
  },
];
