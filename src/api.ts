/**
 * Thin facade over @crossly/sdk for the tool handlers.
 *
 * Every tool calls one of `apiGet` / `apiPost` / `apiPatch` / `apiDelete`
 * with a raw path; we delegate to the SDK's escape-hatch `raw.request` so
 * the SDK owns auth, timeouts, fetch impl, error envelope, and the
 * `Idempotency-Key` header. Tool files don't need to know.
 *
 * Re-exporting these wrapper functions instead of asking each tool to talk
 * directly to the SDK keeps the diff minimal — adding/removing endpoints
 * doesn't ripple through.
 */
import { createClient, CrosslyConfigError, type CrosslyClient } from '@crossly/sdk';

const PAT = process.env.CROSSLY_PAT;
const BASE_URL = process.env.CROSSLY_API_BASE_URL;

let _client: CrosslyClient | null = null;

/**
 * Supply the client instead of building one from the environment.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────
 * The tool registry in `tools/` is the only complete, machine-readable
 * description of this API — name, description, JSON Schema and handler for
 * every endpoint. `@crossly/cli` drives the SAME registry so that a command
 * exists for every tool without anyone maintaining a second list.
 *
 * It cannot use the env-built client: a CLI authenticates with a token from
 * `crossly login` held in its own config, against whichever base URL that
 * session was for. Before this, the only way in was to mutate
 * `process.env.CROSSLY_PAT` at startup and hope nothing else read it.
 *
 * Call before the first tool runs. The MCP server itself never calls this and
 * keeps the env path unchanged.
 */
export function configureClient(client: CrosslyClient): void {
  _client = client;
}

function getClient(): CrosslyClient {
  if (_client) return _client;
  if (!PAT || !PAT.startsWith('crossly_pat_')) {
    throw new CrosslyConfigError(
      'CROSSLY_PAT env var is required and must start with "crossly_pat_". ' +
        'Mint one in the Crossly web app at Settings → Personal Access Tokens, ' +
        'then pass it via the `env` block of your MCP client config.',
    );
  }
  _client = createClient({
    pat: PAT,
    baseUrl: BASE_URL,
    userAgent: '@crossly/mcp/0.1.0',
  });
  return _client;
}

export function requirePat(): string {
  // Forces a config check at startup so the host's error popup is useful
  // before any tool call runs.
  getClient();
  return PAT!;
}

export function apiGet<T = unknown>(path: string, query?: Record<string, unknown>): Promise<T> {
  return getClient().raw.request<T>({ method: 'GET', path, query });
}

export function apiPost<T = unknown>(path: string, body: unknown, idempotencyKey?: string): Promise<T> {
  return getClient().raw.request<T>({ method: 'POST', path, body, idempotencyKey });
}

export function apiPatch<T = unknown>(path: string, body: unknown, idempotencyKey?: string): Promise<T> {
  return getClient().raw.request<T>({ method: 'PATCH', path, body, idempotencyKey });
}

export function apiPut<T = unknown>(path: string, body: unknown, idempotencyKey?: string): Promise<T> {
  return getClient().raw.request<T>({ method: 'PUT', path, body, idempotencyKey });
}

export function apiDelete<T = unknown>(
  path: string,
  idempotencyKey?: string,
  query?: Record<string, unknown>,
): Promise<T> {
  return getClient().raw.request<T>({ method: 'DELETE', path, query, idempotencyKey });
}
