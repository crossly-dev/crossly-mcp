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
        platform: {
          type: 'string',
          description:
            'Cookie-track platform id — one of "poshmark", "mercari", "facebook", "depop", "grailed", "vinted", ' +
            '"whatnot", "vestiaire", "offerup", "curtsy" (the integrationType:"cookie" entries in shared PLATFORMS). ' +
            'OAuth/API-track ids (ebay, etsy, shopify, amazon, …) are not connected this way — use oauth_init_url. ' +
            'The server revives the first archived/needs_reauth row on this platform and validates it with one real ' +
            'authed call; it never creates a row, so a platform the extension has never synced returns status=no_row_yet.',
        },
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
        platform: {
          type: 'string',
          description:
            'Platform id whose ACTIVE account rows should all be archived — any id in shared PLATFORMS, but in ' +
            'practice a cookie-track one ("poshmark", "mercari", "facebook", "depop", "grailed", "vinted", ' +
            '"whatnot", "vestiaire", "offerup", "curtsy"). This archives EVERY slot on that platform; to drop one ' +
            'OAuth connection when the seller has several, use disconnect_oauth_connection instead. Returns ' +
            '{ archived: <row count> }, and { archived: 0 } when nothing was active.',
        },
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
        id: {
          type: 'string',
          format: 'uuid',
          description:
            'UUID of the OAuth connection row (platform_connections) as returned by list_oauth_connections. This is ' +
            'NOT a platform id and NOT the cookie account-slot id from list_platform_accounts — passing either 404s.',
        },
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
        platform: {
          type: 'string',
          description:
            'Platform id whose `availability` in shared PLATFORMS is "request_only" — today "etsy", "stockx", ' +
            '"tiktok_shop", "instagram_shop", "wix", "tcgplayer", "amazon", "walmart". The route accepts any string ' +
            'and only emails ops the interest, so an already-live id (ebay, shopify, …) silently does nothing useful.',
        },
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
        platform: {
          type: 'string',
          description:
            'Platform id to backfill — any id in shared PLATFORMS, API-track (ebay, etsy, shopify, …) or ' +
            'cookie-track (poshmark, mercari, depop, …). An unknown id is rejected with 400 unknown_platform. ' +
            'The chosen window is saved on the user either way, but only cookie-track platforms and the ' +
            'API-track platforms that have a backfill implementation actually fire an import right now.',
        },
        days: {
          type: ['integer', 'null'],
          description:
            'How far back to import, in DAYS (not months). null = all time, no limit; 0 = none, skip the backfill ' +
            'entirely; a positive integer = that many days back, capped at 3650 (10 years). Required — the server ' +
            'has no default and rejects a missing value. Saved as the user\'s settings.historyImportDays.',
        },
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
        platform: {
          type: 'string',
          description:
            'API-track (OAuth) platform id. The builder knows: "ebay", "etsy", "shopify", "amazon", "bigcommerce", ' +
            '"reverb", "squarespace", "stockx", "tiktok_shop", "wix", "instagram_shop", "bonanza", "woocommerce", ' +
            '"walmart". Anything else — including every cookie-track id (poshmark, mercari, depop, …) — returns 400 ' +
            'unsupported_platform. Per-platform quirks: "shopify" also needs `shop`; "etsy" additionally returns a ' +
            'correlationId (PKCE); "bonanza" returns oneShot:true and the URL is single-use; "woocommerce" needs a ' +
            'siteUrl this tool does not expose, so it returns 400 missing_site_url; "walmart" returns ' +
            '{ status: "request_only", requestUrl, message } instead of a URL.',
        },
        shop: {
          type: 'string',
          description:
            'Shopify ONLY, and required there: the seller\'s myshopify host, e.g. "mystore.myshopify.com" (no ' +
            'scheme, no trailing slash). Omitting it on shopify returns 400 missing_shop. Ignored by every other platform.',
        },
        region: {
          type: 'string',
          description:
            'Amazon ONLY, optional: which Seller Central consent host to send the seller to — "na" (default, ' +
            'sellercentral.amazon.com), "eu" (sellercentral-europe) or "fe" (sellercentral-japan). Ignored by every ' +
            'other platform.',
        },
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
        host: {
          type: 'string',
          description:
            'IMAP server hostname, e.g. "imap.gmail.com" or "outlook.office365.com". Hostname only — no scheme, ' +
            'no port, no trailing slash. Required and must be non-empty.',
        },
        port: {
          type: 'integer',
          description:
            'IMAP port number — normally 993, the implicit-TLS port. The server always connects with TLS on ' +
            '(secure: true), so the plaintext/STARTTLS port 143 will fail to connect. Positive integer, required.',
        },
        username: {
          type: 'string',
          description:
            'IMAP login, normally the full email address. Also stored as the connection\'s emailAddress, which is ' +
            'what the sale-fallback scanner shows and matches on. Required and must be non-empty.',
        },
        password: {
          type: 'string',
          description:
            'IMAP password. For Gmail/Outlook this must be an APP-SPECIFIC password, not the account password ' +
            '(both providers reject plain-password IMAP logins). Stored encrypted at rest with the ' +
            'JWT_SECRET-derived key and never returned by any read tool. Required and must be non-empty.',
        },
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
        id: {
          type: 'string',
          description:
            'UUID of the IMAP connection row to edit, from list_email_connections. Scoped to your own user — an ' +
            'id you do not own 404s.',
        },
        host: {
          type: 'string',
          description:
            'New IMAP server hostname (e.g. "imap.gmail.com"), hostname only. Omit to leave the stored host unchanged.',
        },
        port: {
          type: 'integer',
          description:
            'New IMAP port — normally 993 (implicit TLS); the connection is always made with TLS on, so 143 will ' +
            'fail. Positive integer. Omit to leave the stored port unchanged.',
        },
        username: {
          type: 'string',
          description:
            'New IMAP login, normally the full email address. Updating this also rewrites the connection\'s ' +
            'emailAddress. Omit to leave unchanged.',
        },
        password: {
          type: 'string',
          description:
            'New IMAP password (an app-specific password for Gmail/Outlook), re-encrypted at rest on save. Omit — ' +
            'or send an empty string — to keep the stored password; there is no way to read the existing one back.',
        },
        isActive: {
          type: 'boolean',
          description:
            'Whether the sale-fallback scanner should keep polling this mailbox. false pauses it without deleting ' +
            'the row (imap_delete is the destructive option). Omit to leave unchanged.',
        },
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
        id: {
          type: 'string',
          description:
            'UUID of the IMAP connection row to delete, from list_email_connections. Hard delete (the row is gone, ' +
            'not archived) and scoped to your own user — an id you do not own 404s. To pause a mailbox instead, ' +
            'call imap_update with isActive=false.',
        },
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
        host: {
          type: 'string',
          description:
            'IMAP server hostname to dial, e.g. "imap.gmail.com". Hostname only — no scheme or port. Required.',
        },
        port: {
          type: 'integer',
          description:
            'IMAP port to dial — normally 993. The test always connects with TLS on, so 143 will fail even when ' +
            'the credentials are good. Positive integer, required.',
        },
        username: {
          type: 'string',
          description: 'IMAP login to test, normally the full email address. Required and must be non-empty.',
        },
        password: {
          type: 'string',
          description:
            'IMAP password to test — an app-specific password for Gmail/Outlook. NOT persisted by this call: the ' +
            'server connects, logs out and discards it. A bad credential comes back as 422 imap_connection_failed ' +
            'with the server\'s own message.',
        },
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
        platform: {
          type: 'string',
          description:
            'Platform id whose connection preferences to patch. Both supported fields are quota settings, so in ' +
            'practice this is "ebay" (Etsy tracks month-to-date fees rather than a quota). 404s with ' +
            'connection_not_found if you have no connection row on that platform.',
        },
        connectionId: {
          type: 'string',
          description:
            'Optional UUID of ONE OAuth connection row (from list_oauth_connections) to scope the update to. Omit ' +
            'and every connection you hold on that platform is updated — pass it when the seller has more than one ' +
            'eBay/Etsy connection and only one should change.',
        },
        freeListingTier: {
          type: ['integer', 'null'],
          description:
            'eBay zero-insertion-fee allowance as a COUNT OF LISTINGS per calendar month — the store-subscription ' +
            'tiers are 250, 1000, 10000, 25000, 100000. Must be a positive integer, or null to clear the manual ' +
            'override (the next limits read then auto-detects it from the seller\'s eBay Store subscription and ' +
            're-persists it). Omit to leave unchanged.',
        },
        respectFreeQuota: {
          type: 'boolean',
          description:
            'When true, a crosspost that would push the seller past freeListingTier for the month is refused with ' +
            '402 and has to be explicitly confirmed; when false (the column default) crossposting is never blocked ' +
            'by the quota. Omit to leave unchanged.',
        },
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
