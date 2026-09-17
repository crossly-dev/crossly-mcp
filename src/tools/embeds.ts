import { apiGet, apiPost, apiDelete } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Publishable keys for the embeddable storefront.
 *
 * The descriptions lean on one distinction, because it is the thing an agent
 * will otherwise get wrong: a publishable key is MANAGED here with a normal
 * PAT, and it is a separate, weaker credential used by a browser on an
 * allow-listed origin. It is not an API token and must never be treated as
 * one — and `allowedOrigins` is the entire security boundary around it.
 */
export const embedsTools: ToolDef[] = [
  {
    name: 'list_publishable_keys',
    description:
      'List the seller\'s publishable keys — the credentials pasted into their own website to embed a Crossly '
      + 'storefront. Returns each key IN FULL, which is correct: a publishable key is published in public HTML, so '
      + 'it is not a secret. It is NOT an API token — it cannot read orders, cannot take payment and only works '
      + 'from its allow-listed origins. Requires the accounts:read scope.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/embeds/keys', {}),
  },

  {
    name: 'create_publishable_key',
    description:
      'Mint a publishable key for embedding a storefront on a site the seller controls. '
      + 'allowedOrigins IS the security boundary: a key with none cannot be used at all, and a key carrying an '
      + 'origin the seller does not own lets that site embed their catalogue. Pass exact origins '
      + '("https://shop.example.com"), never paths or wildcards, and never a domain the seller has not confirmed '
      + 'is theirs. Use environment "test" for anything not on a production site. Requires accounts:write.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'What this key is for, e.g. "marketing site".' },
        allowedOrigins: {
          type: 'array',
          items: { type: 'string' },
          description: 'Exact origins, scheme included. The key is unusable without at least one.',
        },
        environment: { type: 'string', enum: ['live', 'test'], default: 'live' },
      },
      required: ['name'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/embeds/keys', args as Record<string, unknown>),
  },

  {
    name: 'revoke_publishable_key',
    description:
      'Revoke a publishable key. IMMEDIATE AND IRREVERSIBLE — any page still serving this key stops rendering the '
      + 'storefront the moment this returns. If the seller is rotating rather than removing, mint the replacement '
      + 'and get it deployed BEFORE revoking the old one. Requires accounts:write.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Publishable key id (not the key itself).' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiDelete(`/v1/embeds/keys/${encodeURIComponent(id)}`);
    },
  },
];
