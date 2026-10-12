import { apiGet, apiPost } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

export const customersTools: ToolDef[] = [
  {
    name: 'list_customers',
    description:
      "Aggregated customer view — groups the seller's orders by lower(buyer_username) so the same buyer " +
      'on multiple platforms shows as one row. Returns normalizedHandle, platforms[], totalOrders, totalSpent, ' +
      'lastOrderAt, firstOrderAt, plus avatarUrl, displayName and bestRating ({value 0-5, count, platform} or null) ' +
      'from their marketplace buyer profiles. Sorted by totalOrders DESC then totalSpent DESC — repeat buyers first.',
    inputSchema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Case-insensitive substring match on buyer username. Omit to list everyone.',
        },
        page: {
          type: 'integer',
          minimum: 1,
          default: 1,
          description:
            '1-indexed page of the aggregated customer list (offset = (page-1)*limit). Default 1. Rows are ' +
            'aggregated buyers, not orders.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 25,
          description:
            'Customers per page. Default 25; the server clamps anything above 100 down to 100 rather than ' +
            'erroring.',
        },
      },
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet('/v1/customers', {
        search: args.search,
        page: args.page,
        limit: args.limit,
      }),
  },
  {
    name: 'get_customer',
    description:
      'Fetch one buyer (by normalized handle) plus their recent 50 orders across all platforms. ' +
      'Use this to look up a repeat buyer before sending a message or to investigate a dispute history. ' +
      'Also returns `contact` — email, name, phone and the most recent shipping address, each resolved ' +
      'from the latest order that carried it. Fields are null when the marketplace does not share them ' +
      'with sellers, which is most of them; eBay is the one that reliably does. ' +
      'Also returns `profiles` — one per platform the buyer ordered on: displayName, avatarUrl, profileUrl, ' +
      'rating/ratingCount (0-5 stars where the marketplace has them), feedbackScore, positivePercent, memberSince, ' +
      'location, verified, badges, plus source (order | profile_fetch | crossly) and fetchStatus (ok | unsupported | ' +
      'not_found | error); null fields mean the marketplace did not share them. And `stats` over ALL of their ' +
      'orders (not just the 50 shown): totalOrders, totalSpent, avgOrderValue, first/lastOrderAt, ' +
      'daysSinceLastOrder, platformsCount, cancelledCount, returnsCount, disputesCount, messagesCount, ' +
      'offersCount, repeatBuyer.',
    inputSchema: {
      type: 'object',
      properties: {
        handle: {
          type: 'string',
          description: 'Normalized (lowercase) buyer handle from list_customers.',
        },
      },
      required: ['handle'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet(`/v1/customers/${encodeURIComponent((args.handle as string).toLowerCase())}`),
  },
  {
    name: 'refresh_customer_profile',
    description:
      "Re-read a buyer's marketplace profiles now (avatar, rating, feedback, member-since) on every platform they " +
      'ordered on, skipping the 7-day freshness window. Asynchronous: returns which platforms were queued; call ' +
      'get_customer a little later to see the refreshed `profiles`. Platforms with no readable profile still ' +
      'refresh what their orders carry. Rate-limited per seller (10/minute). Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        handle: {
          type: 'string',
          description: 'Normalized (lowercase) buyer handle from list_customers.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['handle'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, handle } = args as { handle: string; idempotencyKey?: string };
      return apiPost(
        `/v1/customers/${encodeURIComponent(handle.toLowerCase())}/refresh-profile`,
        {},
        idempotencyKey,
      );
    },
  },
  {
    name: 'customers_bulk_delete',
    description:
      "Bulk-blocklist customer handles. Customers aren't a CRUD table — they aggregate from orders — so 'delete' means " +
      "'hide this handle from the customers view and stop future aggregation'. Existing orders rows are untouched. Pass " +
      'an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        handles: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 500,
          description:
            'Buyer handles to blocklist — the `normalizedHandle` values from list_customers. 1-500 per call, ' +
            'each 1-200 characters. Lowercased server-side, so casing does not matter, and the same handle is ' +
            'blocklisted across every platform it traded on (that is what "normalized" means here). Re-sending ' +
            'an already-blocklisted handle is a no-op, not an error. Existing orders rows are never touched.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['handles'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/customers/bulk-delete', body, idempotencyKey);
    },
  },
  {
    name: 'customers_bulk_export',
    description:
      'Export aggregated customer rows for a list of handles as CSV. Returns the CSV text body — caller should treat as a string. ' +
      'Pass an idempotencyKey for cache-replay safety.',
    inputSchema: {
      type: 'object',
      properties: {
        handles: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 2000,
          description:
            'Buyer handles to export — `normalizedHandle` values from list_customers. 1-2000 per call, each ' +
            '1-200 characters; lowercased server-side. Output columns are handle, platforms (pipe-separated), ' +
            'total_orders, total_spent, last_order, first_order. Handles with no matching order are simply ' +
            'absent from the CSV rather than an error, so a short file means unmatched handles, not a failure.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['handles'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/customers/bulk-export', body, idempotencyKey);
    },
  },
];
