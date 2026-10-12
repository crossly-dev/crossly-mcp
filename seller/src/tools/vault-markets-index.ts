import { apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Vault Markets index methodology and governance (api routes/v1/write/vault-markets-index.ts;
 * docs/VAULT-INDEX-METHODOLOGY.md): the method with its version, the review
 * calendar, index events and the expert-judgment log, published levels
 * (daily closes or model estimates; provisional or settlement series),
 * members as of a day, committee minutes, consultations and complaints.
 * Every level comes from the Crossly order book; below the data gate the
 * data is empty and the notice says "Not enough Crossly trades". Model
 * levels are labelled estimates with a 95% band and an n, never a price.
 */
const SLUG = { type: 'string', description: 'The index slug (from list_vault_markets_indexes), e.g. "composite" or "blue-chip-50".' } as const;
const DAY = (what: string) => ({ type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: `${what} (YYYY-MM-DD).` }) as const;
const NONE = { type: 'object', properties: {}, additionalProperties: false } as const;
const EVENT_KIND = {
  type: 'string',
  enum: ['add', 'delete', 'rebalance', 'method', 'correction', 'halt'],
  description: 'Optional filter: "add"/"delete" = a key joins or leaves; "rebalance" = a quarterly review; "method" = a method change or retirement; "correction" = a restatement or voided trade; "halt" = calculation halted or resumed.',
} as const;
const ID = { type: 'string', description: 'The consultation id (from list_vault_markets_index_consultations).' } as const;

export const vaultMarketsIndexTools: ToolDef[] = [
  {
    name: 'get_vault_markets_index_methodology',
    description: 'The index method in machine-readable form with its semver version: inputs (eligible Crossly trades and A/B marks only), weightings and caps, the family and screens, the engines and their publication gate, revisions and the settlement series, the review calendar, governance and limitations.',
    inputSchema: NONE,
    handler: () => apiGet('/v1/vault-markets/index-methodology', {}),
  },
  {
    name: 'get_vault_markets_index_calendar',
    description: 'The next four quarterly index reviews: reference day (2nd Friday of Mar/Jun/Sep/Dec), announcement day, last close under the old membership and effective day. June and December also review the Blue-chip 50.',
    inputSchema: NONE,
    handler: () => apiGet('/v1/vault-markets/index-calendar', {}),
  },
  {
    name: 'list_vault_markets_index_events',
    description: 'Index events, newest first, each with when it was announced, when it takes effect, the detail (keys added / deleted, restated days) and the reason. Give `slug` for one index; omit it for all.',
    inputSchema: {
      type: 'object',
      properties: { slug: SLUG, kind: EVENT_KIND, limit: { type: 'integer', minimum: 1, maximum: 200, default: 50, description: 'How many events (1-200). Default 50.' } },
      additionalProperties: false,
    },
    handler: (args) => {
      const { slug, kind, limit } = args as { slug?: string; kind?: string; limit?: number };
      return apiGet(slug ? `/v1/vault-markets/indexes/${encodeURIComponent(slug)}/events` : '/v1/vault-markets/index-events', { kind, limit });
    },
  },
  {
    name: 'list_vault_markets_index_judgments',
    description: 'The expert-judgment log: every Index Committee action (halt, resume, exclude a key, void a trade, restate, retire) with its written reason. There is no mark override.',
    inputSchema: NONE,
    handler: () => apiGet('/v1/vault-markets/index-judgments', {}),
  },
  {
    name: 'get_vault_markets_index_levels',
    description: 'An index\'s published levels. engine "chain" (default) = daily closes; "tpd" / "repeat_sales" = weekly (else monthly) model estimates with a 95% band and n (labelled estimates, never a price). series "settlement" = each value as first published, never restated; "provisional" (default) may be restated for 8 weeks. Below the data gate the data is empty and meta.notice says so.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: SLUG,
        series: { type: 'string', enum: ['provisional', 'settlement'], description: '"provisional" (default) or "settlement".' },
        engine: { type: 'string', enum: ['chain', 'tpd', 'repeat_sales'], description: '"chain" (default), "tpd" (time-product-dummy) or "repeat_sales".' },
        frequency: { type: 'string', enum: ['weekly', 'monthly'], description: 'Model engines only; omit to take weekly, falling back to monthly.' },
        from: DAY('First day'),
        to: DAY('Last day'),
      },
      required: ['slug'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { slug, ...q } = args as { slug: string; series?: string; engine?: string; frequency?: string; from?: string; to?: string };
      return apiGet(`/v1/vault-markets/indexes/${encodeURIComponent(slug)}/level-series`, q);
    },
  },
  {
    name: 'get_vault_markets_index_members',
    description: 'The members of an index on a day with weights, frozen shares, moves and contributions. For a past day: that day\'s members (effective-dated, no look-ahead), the inputs stored with its close and each member\'s effective dates.',
    inputSchema: { type: 'object', properties: { slug: SLUG, asOf: DAY('The day; default today') }, required: ['slug'], additionalProperties: false },
    handler: (args) => {
      const { slug, asOf } = args as { slug: string; asOf?: string };
      return apiGet(`/v1/vault-markets/indexes/${encodeURIComponent(slug)}/members`, { asOf });
    },
  },
  {
    name: 'list_vault_markets_index_minutes',
    description: 'Published Index Committee minutes, newest first: attendees (names and roles), quorum, agenda, minutes and decisions.',
    inputSchema: NONE,
    handler: () => apiGet('/v1/vault-markets/index-committee/minutes', {}),
  },
  {
    name: 'list_vault_markets_index_consultations',
    description: 'Consultations on index method changes (each open at least 30 days), newest first.',
    inputSchema: { type: 'object', properties: { status: { type: 'string', enum: ['open', 'closed', 'adopted', 'withdrawn'], description: 'Optional filter by consultation state: "open" = still taking comments (at least 30 days), "adopted" = the proposed method change was accepted and takes effect on its effective day, "withdrawn" = the proposal was pulled, "closed" = ended with no change. Leave out for all.' } }, additionalProperties: false },
    handler: (args) => apiGet('/v1/vault-markets/index-consultations', { status: (args as { status?: string }).status }),
  },
  {
    name: 'get_vault_markets_index_consultation',
    description: 'One consultation: proposal, from/to version, dates, outcome and the public comments.',
    inputSchema: { type: 'object', properties: { id: ID }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiGet(`/v1/vault-markets/index-consultations/${encodeURIComponent(id)}`, {});
    },
  },
  {
    name: 'comment_on_vault_markets_index_consultation',
    description: 'Comment on an open consultation (5 to 5,000 characters; up to 5 per person). Published without your name. Returns { ok }.',
    inputSchema: { type: 'object', properties: { id: ID, body: { type: 'string', minLength: 5, maxLength: 5000, description: 'Your comment.' } }, required: ['id', 'body'], additionalProperties: false },
    handler: (args) => {
      const { id, body } = args as { id: string; body: string };
      return apiPost(`/v1/vault-markets/index-consultations/${encodeURIComponent(id)}/comments`, { body });
    },
  },
  {
    name: 'file_vault_markets_index_complaint',
    description: 'File a complaint about an index or the method; every complaint is answered (see list_vault_markets_index_complaints). Returns { id, status, createdAt }.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { ...SLUG, description: 'Optional: the index it is about.' },
        subject: { type: 'string', minLength: 3, maxLength: 200, description: 'One line.' },
        body: { type: 'string', minLength: 10, maxLength: 10000, description: 'What is wrong, with days and keys where you can.' },
      },
      required: ['subject', 'body'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/vault-markets/index-complaints', args),
  },
  {
    name: 'list_vault_markets_index_complaints',
    description: 'Your index complaints and their answers, newest first.',
    inputSchema: NONE,
    handler: () => apiGet('/v1/vault-markets/index-complaints', {}),
  },
];
