import { apiDelete, apiGet, apiPatch, apiPost } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

export const accountsTools: ToolDef[] = [
  {
    name: 'list_platform_accounts',
    description:
      'List the seller\'s connected marketplace accounts (one row per slot — sellers can have multiple eBay/ ' +
      'Poshmark accounts e.g. for a side-hustle vs primary store). Each row has platform, label, username, ' +
      'connection status ("connected" / "needs_reauth" / "expired"), and lastSyncedAt. Check this before ' +
      'attempting crosspost_listing — if a platform isn\'t connected, the job will fail.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    handler: () => apiGet('/v1/accounts'),
  },
  {
    name: 'add_platform_account',
    description:
      'Add a new platform account slot. This does NOT perform OAuth — for API platforms (eBay/Etsy/Shopify) ' +
      'the user must complete OAuth in the web UI; for cookie platforms (Poshmark/Mercari/etc.) they must log ' +
      'in via the browser extension. This tool just creates the slot record. ' +
      'NOTE: extra slots beyond the user\'s plan limit may incur overage billing — set acceptOverage=true to ' +
      'acknowledge that explicitly. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          description: 'Platform slug, e.g. "poshmark", "mercari", "ebay", "etsy", "shopify", "depop", "grailed", "vinted", "whatnot", "vestiaire", "facebook", "offerup".',
        },
        label: {
          type: 'string',
          maxLength: 60,
          description: 'Optional human-friendly label, e.g. "Main store" or "Vintage hustle".',
        },
        acceptOverage: {
          type: 'boolean',
          default: false,
          description: 'Set true to opt in to overage billing when adding beyond plan limit. The endpoint refuses otherwise.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['platform'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/accounts', body, idempotencyKey);
    },
  },
  {
    name: 'remove_platform_account',
    description:
      'Disconnect a platform account slot. For API platforms this also revokes the stored OAuth token. ' +
      'Active listings on that account remain published on the marketplace itself (we can no longer manage them). ' +
      'CONFIRM with the user — they\'ll need to re-OAuth or re-extension-login to reconnect. ' +
      'Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Account slot UUID from list_platform_accounts.' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiDelete(
        `/v1/accounts/${encodeURIComponent(args.id as string)}`,
        args.idempotencyKey as string | undefined,
      ),
  },

  // ── Presence + per-platform limits ─────────────────────────────────────
  {
    name: 'extension_online',
    description:
      "Check whether the browser extension is currently online. Returns { online: boolean }. Cookie-platform jobs only " +
      "drain while the extension is online — use this to decide whether to crosspost now or queue. The extension writes a " +
      "60s-TTL heartbeat key, so a 'true' result means it pinged in the last minute.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/connections/extension-online'),
  },
  {
    name: 'list_email_connections',
    description:
      'List IMAP + email-OAuth connections (Gmail / Outlook / IMAP). Used by the IMAP sale-fallback scanner and the inbox ' +
      'triage system.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/connections/email'),
  },
  {
    name: 'get_platform_limits',
    description:
      'Per-platform listing-limit summary — eBay free-tier usage + Etsy month-to-date fees. Pass connection_id to scope to ' +
      'one connection (matches the per-account settings dialog).',
    inputSchema: {
      type: 'object',
      properties: {
        connection_id: { type: 'string', description: 'Optional eBay/Etsy platformConnections row id.' },
      },
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet('/v1/platforms/limits', {
        connection_id: args.connection_id,
      }),
  },

  // ── Connection lifecycle (cookie + OAuth) ──────────────────────────────
  {
    name: 'connect_platform',
    description:
      'Revive or initiate a connection for a cookie platform. If an active row already exists, returns status=already_active. ' +
      'If an archived row exists, it gets revived. Otherwise returns status=no_row_yet (the extension must finish first ' +
      'sync). Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: { type: 'string' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['platform'],
      additionalProperties: false,
    },
    handler: (args) => {
      const platform = args.platform as string;
      return apiPost(
        `/v1/platform-accounts/${encodeURIComponent(platform)}/connect`,
        {},
        args.idempotencyKey as string | undefined,
      );
    },
  },
  {
    name: 'disconnect_platform',
    description:
      "Archive every active account row for a platform. Releases the proxy reservation, decrements overage billing, fires " +
      "the platform.disconnected automation trigger. Pass an idempotencyKey on retries.",
    inputSchema: {
      type: 'object',
      properties: {
        platform: { type: 'string' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['platform'],
      additionalProperties: false,
    },
    handler: (args) => {
      const platform = args.platform as string;
      return apiPost(
        `/v1/platform-accounts/${encodeURIComponent(platform)}/disconnect`,
        {},
        args.idempotencyKey as string | undefined,
      );
    },
  },
  {
    name: 'disconnect_oauth_connection',
    description:
      'Disconnect a specific OAuth connection row by its connection id (NOT the by-platform path). Use when a seller ' +
      'has multiple connections on the same platform — list_oauth_connections first to find the id. Sets is_active=false ' +
      'and nulls out the stored tokens. Returns { success: true }. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiDelete(
        `/v1/connections/by-id/${encodeURIComponent(args.id as string)}`,
        args.idempotencyKey as string | undefined,
      ),
  },
  {
    name: 'request_platform_access',
    description:
      'Express interest in a "request_only" platform (the ones where access is gated by partner approval — Walmart, ' +
      'Bonanza, Newegg, etc.). Records the user\'s intent so the team can batch-request approvals. Returns ' +
      '{ requested: true }. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: { type: 'string' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['platform'],
      additionalProperties: false,
    },
    handler: (args) => {
      const platform = args.platform as string;
      return apiPost(
        `/v1/connections/${encodeURIComponent(platform)}/request`,
        {},
        args.idempotencyKey as string | undefined,
      );
    },
  },
  {
    name: 'set_history_import_window',
    description:
      'Set how far back to backfill order history + active listings for a platform, and run it now. Call this once ' +
      "a platform connects (list_platform_accounts / list_oauth_connections shows initialLedgerAt/listingsImportedAt " +
      'null for a pending row) — it both saves the choice and immediately fires the backfill for any pending accounts ' +
      'on that platform. days: null = All time (no limit), 0 = None (skip entirely), a positive integer = days back. ' +
      'Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: { type: 'string' },
        days: { type: ['integer', 'null'] },
        ...IDEMPOTENCY_PROP,
      },
      required: ['platform', 'days'],
      additionalProperties: false,
    },
    handler: (args) => {
      const platform = args.platform as string;
      return apiPost(
        `/v1/platform-accounts/${encodeURIComponent(platform)}/history-import`,
        { days: args.days },
        args.idempotencyKey as string | undefined,
      );
    },
  },
  {
    name: 'refresh_account_status',
    description:
      'Run on-demand healthchecks across every cookie account. Each one calls the platform\'s getMe equivalent — a 200 marks ' +
      'the account active; a 401/403 marks it needs_reauth and pushes a WebSocket event. Returns one row per checked ' +
      "account. Pass an idempotencyKey on retries.",
    inputSchema: {
      type: 'object',
      properties: { ...IDEMPOTENCY_PROP },
      additionalProperties: false,
    },
    handler: (args) =>
      apiPost('/v1/platform-accounts/refresh-status', {}, args.idempotencyKey as string | undefined),
  },
  {
    name: 'oauth_init_url',
    description:
      'Get the OAuth authorize URL for an API-track platform (eBay / Shopify / Amazon / Reverb / Squarespace / StockX / ' +
      "TikTok Shop / Wix / Instagram Shop / BigCommerce). Hand this URL to the user to complete OAuth in their browser. " +
      'Shopify requires a `shop` parameter (mystore.myshopify.com). Amazon accepts a `region` parameter (na/eu/fe). Returns ' +
      '400 for platforms that need browser-session OAuth (Etsy, Bonanza, WooCommerce).',
    inputSchema: {
      type: 'object',
      properties: {
        platform: { type: 'string' },
        shop: { type: 'string', description: 'Required for Shopify.' },
        region: { type: 'string', description: 'Optional for Amazon (na/eu/fe).' },
      },
      required: ['platform'],
      additionalProperties: false,
    },
    handler: (args) => {
      const platform = args.platform as string;
      const query: Record<string, unknown> = {};
      if (args.shop) query.shop = args.shop;
      if (args.region) query.region = args.region;
      return apiGet(`/v1/oauth/${encodeURIComponent(platform)}/init`, query);
    },
  },

  // ── IMAP CRUD ──────────────────────────────────────────────────────────
  {
    name: 'imap_create',
    description:
      'Add an IMAP mailbox connection. Password is encrypted at rest with the JWT_SECRET-derived key. Used by the IMAP ' +
      "sale-fallback scanner. Pass an idempotencyKey on retries.",
    inputSchema: {
      type: 'object',
      properties: {
        host: { type: 'string' },
        port: { type: 'integer' },
        username: { type: 'string' },
        password: { type: 'string' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['host', 'port', 'username', 'password'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/connections/email/imap', body, idempotencyKey);
    },
  },
  {
    name: 'imap_update',
    description:
      'Edit an IMAP mailbox connection. Any field may be PATCHed (host/port/username/password/isActive). Pass an ' +
      'idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        host: { type: 'string' },
        port: { type: 'integer' },
        username: { type: 'string' },
        password: { type: 'string' },
        isActive: { type: 'boolean' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, idempotencyKey, ...body } = args as Record<string, unknown> & {
        id: string;
        idempotencyKey?: string;
      };
      return apiPatch(`/v1/connections/email/imap/${encodeURIComponent(id)}`, body, idempotencyKey);
    },
  },
  {
    name: 'imap_delete',
    description: 'Remove an IMAP mailbox connection by id. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiDelete(
        `/v1/connections/email/imap/${encodeURIComponent(args.id as string)}`,
        args.idempotencyKey as string | undefined,
      ),
  },
  {
    name: 'imap_test',
    description:
      'Validate IMAP credentials by attempting a connect+logout WITHOUT persisting them. Returns success/422. Use this ' +
      'before imap_create to avoid storing bad creds.',
    inputSchema: {
      type: 'object',
      properties: {
        host: { type: 'string' },
        port: { type: 'integer' },
        username: { type: 'string' },
        password: { type: 'string' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['host', 'port', 'username', 'password'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/connections/email/imap/test', body, idempotencyKey);
    },
  },

  // ── Per-platform preferences ───────────────────────────────────────────
  {
    name: 'update_platform_preferences',
    description:
      'Update per-platform connection preferences. Currently supported fields: freeListingTier (nullable int), ' +
      "respectFreeQuota (bool). Pass connectionId to scope to a single eBay/Etsy connection when the seller has multiple. " +
      'Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: { type: 'string' },
        connectionId: { type: 'string', description: 'Optional — scopes the update to one connection row.' },
        freeListingTier: { type: ['integer', 'null'] },
        respectFreeQuota: { type: 'boolean' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['platform'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { platform, connectionId, idempotencyKey, ...body } = args as Record<string, unknown> & {
        platform: string;
        connectionId?: string;
        idempotencyKey?: string;
      };
      const path = `/v1/platforms/${encodeURIComponent(platform)}/preferences${
        connectionId ? `?connection_id=${encodeURIComponent(connectionId)}` : ''
      }`;
      return apiPatch(path, body, idempotencyKey);
    },
  },
];
