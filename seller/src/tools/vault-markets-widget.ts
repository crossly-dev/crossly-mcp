import { apiDelete, apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Phone home-screen widgets for Vault Markets (api routes/v1/write/
 * vault-markets-widget.ts): the small summary a widget shows, and the widget
 * tokens (one per phone) that read it without the person session. Prices are
 * from the Crossly order book and carry their mark quality.
 */
const ID = { type: 'string', description: 'The widget token id (a UUID from list_vault_widget_tokens).' };

export const vaultMarketsWidgetTools: ToolDef[] = [
  {
    name: 'get_vault_widget_summary',
    description: 'The home-screen widget summary: vault portfolio value at the mark (cents of US dollars) with its move since the previous marks and the share on reliable A/B marks, the three biggest movers among what you hold (or the market movers when you hold nothing), and one watchlist key with a 14-day sparkline. Each price carries its mark quality: A or B reliable, C indicative, none unmarked.',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Optional book key from your watchlist to show (variantId:condition:grade, grade "-" when raw). Without it, or when it is not on your watchlist, your newest watch is shown.' },
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const { key } = args as { key?: string };
      return apiGet('/v1/vault-markets/widget/summary', key ? { key } : {});
    },
  },
  {
    name: 'list_vault_widget_tokens',
    description: 'The phones showing the Vault Markets home-screen widget: each widget token with its id, name (the phone), public prefix, when it was made and last used. The secret is never shown again.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/widget/tokens', {}),
  },
  {
    name: 'mint_vault_widget_token',
    description: 'Make a widget token for one phone. It can read the widget summary and nothing else, and is returned once. The same deviceName and installId replace that phone earlier token. At most five phones.',
    inputSchema: {
      type: 'object',
      properties: {
        deviceName: { type: 'string', description: 'What the phone is called, for example "iPhone 15". Shown back in the list only.' },
        installId: { type: 'string', description: 'A stable random id for the app install, 6 to 64 letters, digits or dashes.' },
      },
      required: ['deviceName', 'installId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { deviceName, installId } = args as { deviceName: string; installId: string };
      return apiPost('/v1/vault-markets/widget/tokens', { deviceName, installId });
    },
  },
  {
    name: 'revoke_vault_widget_token',
    description: 'Turn the home-screen widget off on one phone: revokes that widget token at once. Only widget tokens can be revoked with this tool.',
    inputSchema: { type: 'object', properties: { id: ID }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiDelete(`/v1/vault-markets/widget/tokens/${encodeURIComponent(id)}`);
    },
  },
  {
    name: 'revoke_all_vault_widget_tokens',
    description: 'Turn the home-screen widget off on every phone: revokes all your widget tokens. Returns how many were revoked.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiDelete('/v1/vault-markets/widget/tokens'),
  },
];
