/**
 * Thin facade over @crossly/buyer-sdk for the tool handlers.
 *
 * Tools call `apiGet` / `apiPost` / `apiDelete` with a raw path and let the
 * SDK own auth, timeouts, the error envelope and the Idempotency-Key header.
 *
 * ── WHY A BUYER TOKEN, NOT A PAT ─────────────────────────────────────
 * The seller MCP server reads `CROSSLY_PAT`. This one must not: a seller PAT
 * does not authenticate the Buyer API, and an agent handed the wrong kind gets
 * a 403 with nothing pointing at the cause. The env var is named differently
 * on purpose so the two servers can be configured side by side in one MCP host
 * without either quietly picking up the other's credential.
 */
import {
  createBuyerClient,
  CrosslyBuyerConfigError,
  type CrosslyBuyerClient,
} from '@crossly/buyer-sdk';

const TOKEN = process.env.CROSSLY_BUYER_TOKEN;
const BASE_URL = process.env.CROSSLY_API_BASE_URL;

let _client: CrosslyBuyerClient | null = null;

/**
 * Supply the client instead of building one from the environment.
 *
 * `@crossly/buyer-cli` drives this same registry so a command exists for every
 * tool without a second list. It cannot use the env-built client: a CLI
 * authenticates with a token from `crossly-buyer login` held in its own config.
 * Call before the first tool runs; the MCP server never calls it.
 */
export function configureClient(client: CrosslyBuyerClient): void {
  _client = client;
}

function getClient(): CrosslyBuyerClient {
  if (_client) return _client;
  if (!TOKEN) {
    throw new CrosslyBuyerConfigError(
      'CROSSLY_BUYER_TOKEN is required. This is a BUYER OAuth token (crossly_oat_…) ' +
        'carrying buyer:* scopes — not a seller Personal Access Token. Obtain one by ' +
        'sending the shopper through the Crossly consent screen, then pass it via the ' +
        '`env` block of your MCP client config.',
    );
  }
  _client = createBuyerClient({ token: TOKEN, ...(BASE_URL ? { baseUrl: BASE_URL } : {}) });
  return _client;
}

/**
 * Fail fast at startup with a message the host's error popup can show, rather
 * than on the agent's first tool call where it reads as a broken tool.
 */
export function requireToken(): void {
  getClient();
}

function clean(query?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!query) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export function apiGet(path: string, query?: Record<string, unknown>): Promise<unknown> {
  return getClient().http.request({ method: 'GET', path, query: clean(query) });
}

export function apiPost(
  path: string,
  body?: unknown,
  idempotencyKey?: string,
): Promise<unknown> {
  return getClient().http.request({ method: 'POST', path, body, idempotencyKey });
}

export function apiDelete(path: string): Promise<unknown> {
  return getClient().http.request({ method: 'DELETE', path });
}
