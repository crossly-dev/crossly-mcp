import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

export const actionLogTools: ToolDef[] = [
  {
    name: 'list_action_log',
    description:
      'List the action log — the durable, queryable record of every action the seller or the system took across ' +
      'marketplaces (list / delist / update / crosspost / connect / cookie-sync / send-message / send-offer / ' +
      'submit-tracking / check-status / …). Answers "what happened": who, which item, which platform, ' +
      'success or failure, how long it took. Use this to debug a failed crosspost, audit recent activity, or find ' +
      'the event id you need before pulling its wire calls with get_action_log_calls. Filter by platform, action, ' +
      'category (listing|connection|session|offer|order|inventory|auth|account|…), status ' +
      '(pending|success|failure|partial|skipped), source, target, and a since/until created_at window. Newest first.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: { type: 'string', description: 'Restrict to one marketplace, e.g. "poshmark".' },
        action: { type: 'string', description: 'Verb slug, e.g. "list", "delist", "crosspost", "cookie_sync".' },
        category: { type: 'string', description: 'Coarse bucket, e.g. "listing", "connection", "offer", "order".' },
        status: {
          type: 'string',
          description: 'One of pending | success | failure | partial | skipped. Use "failure" to find what broke.',
        },
        source: { type: 'string', description: 'Where it originated: web | mobile | api | sdk | mcp | worker | …' },
        targetType: { type: 'string', description: 'What it operated on: listing | inventory_item | order | …' },
        targetId: { type: 'string', description: 'Restrict to one target id.' },
        since: { type: 'string', description: 'ISO timestamp — only events at/after this (inclusive).' },
        until: { type: 'string', description: 'ISO timestamp — only events before this (exclusive).' },
        limit: { type: 'integer', minimum: 1, maximum: 200, default: 50, description: 'Rows to return (1-200).' },
        offset: { type: 'integer', minimum: 0, default: 0, description: 'Rows to skip (for paging).' },
      },
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet('/v1/action-log', {
        platform: args.platform,
        action: args.action,
        category: args.category,
        status: args.status,
        source: args.source,
        targetType: args.targetType,
        targetId: args.targetId,
        since: args.since,
        until: args.until,
        limit: args.limit,
        offset: args.offset,
      }),
  },
  {
    name: 'action_log_facets',
    description:
      'Distinct platforms / actions / categories present in the seller\'s action log over the last 90 days. Call ' +
      'this first to discover valid filter values before querying list_action_log.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/action-log/facets'),
  },
  {
    name: 'get_action_log_event',
    description:
      'Fetch one action-log event by UUID — the full semantic record: request/result summaries, status, http status, ' +
      'error class/message, latency, target, and metadata. Use before get_action_log_calls to see the high-level ' +
      'outcome of an action.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Event UUID from list_action_log.' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => apiGet(`/v1/action-log/${encodeURIComponent(args.id as string)}`),
  },
  {
    name: 'get_action_log_calls',
    description:
      'Fetch the outbound platform HTTP calls under one action-log event (oldest first). Answers "what was sent / ' +
      'what went wrong": url, method, status code, latency, redacted request + response body excerpts, error ' +
      'class/message, and the proxy + recipe/hash used. This is the wire-level detail for debugging a failed ' +
      'marketplace action — pass the event id from list_action_log.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Event UUID from list_action_log.' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => apiGet(`/v1/action-log/${encodeURIComponent(args.id as string)}/calls`),
  },
];
