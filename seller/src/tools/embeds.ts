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
      'Mint a publishable key for embedding a storefront on a site the seller controls. What gets embedded is the '
      + 'seller\'s own active listings plus a "buy" affordance — the embed NEVER takes payment: it can start a '
      + 'checkout, which always completes on Crossly with the shopper present, so no card details ever touch the '
      + 'host page. allowedOrigins is the security boundary, but only once it is set: leaving it empty allows ANY '
      + 'origin. Pass exact origins ("https://shop.example.com"), never paths or wildcards, and never a domain the '
      + 'seller has not confirmed is theirs. Requires accounts:write.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description:
            'Label for the seller\'s own benefit — which site this key is pasted into, e.g. "marketing site" or '
            + '"my Squarespace shop". 1-120 chars, required. Not shown to shoppers and not part of the credential.',
        },
        allowedOrigins: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Origins permitted to embed the storefront with this key, e.g. ["https://shop.example.com"]. Compared '
            + 'scheme+host+port, case-insensitively, with any path or trailing slash stripped (a bare '
            + '"shop.example.com" is read as https). AN EMPTY OR OMITTED LIST ALLOWS ANY ORIGIN — that is the '
            + 'deliberate default, because a seller embedding on a platform whose domain they do not control has no '
            + 'stable origin to name. So this is the security boundary only once it is non-empty: name every origin '
            + 'the seller actually controls rather than leaving it blank, and never add a domain they have not '
            + 'confirmed is theirs. An unparseable entry rejects the whole call rather than being dropped.',
        },
        environment: {
          type: 'string',
          enum: ['live', 'test'],
          default: 'live',
          description:
            'A LABEL, not a sandbox. It is baked into the key string (crossly_pk_live_… vs crossly_pk_test_…) and '
            + 'returned on reads so the seller can tell a staging key from a production one; nothing in the API '
            + 'branches on it. A "test" key reads the same real catalogue and starts the same real checkout as a '
            + '"live" one — do not treat it as a safe playground. Defaults to "live".',
        },
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
