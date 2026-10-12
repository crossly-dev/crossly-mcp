import { apiDelete, apiGet, apiPatch, apiPost } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

export const taxTools: ToolDef[] = [
  {
    name: 'list_mileage',
    description:
      "List the seller's mileage entries (sourcing trips, store runs, etc.). Use this for tax-prep " +
      'questions or to audit a year of driving.',
    inputSchema: {
      type: 'object',
      properties: {
        year: {
          type: 'integer',
          description:
            'Calendar tax year to scope to, as a 4-digit integer (e.g. 2025) — NOT a date string. ' +
            'Caveat: /v1/mileage accepts this but does not currently filter on it; entries come back ' +
            'newest-first across all years, so filter on each row\'s `date` yourself, or call ' +
            'get_mileage_summary for a per-year total.',
        },
        page: {
          type: 'integer',
          minimum: 1,
          default: 1,
          description:
            '1-indexed page number (offset = (page-1)*limit). Increment to walk older entries; ' +
            'rows are ordered by trip date, newest first. Default 1.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 200,
          default: 100,
          description:
            'Mileage entries per page. Default 100; the server hard-caps it at 200 (a larger value ' +
            'is silently clamped, not rejected).',
        },
      },
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet('/v1/mileage', { year: args.year, page: args.page, limit: args.limit }),
  },
  {
    name: 'get_mileage_summary',
    description:
      'Annual mileage summary: total miles + the IRS standard-mileage deduction in USD. Use for "how much ' +
      'can I deduct for driving this year?" Returns `{ year, ratePerMile, totalMiles, deduction, entryCount }`.',
    inputSchema: {
      type: 'object',
      properties: {
        year: {
          type: 'integer',
          description:
            'US calendar tax year as a 4-digit integer (e.g. 2025) — NOT a date string. Selects the ' +
            'Jan 1 - Dec 31 window the trips are summed over AND the IRS standard business-mileage ' +
            'rate applied (2024: $0.67/mi, 2025 and 2026: $0.70/mi; unknown years fall back to the ' +
            'last known $0.70/mi). Defaults to the current calendar year. The returned `deduction` ' +
            'is USD dollars, not cents.',
        },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/mileage/summary', { year: args.year }),
  },
  {
    name: 'get_schedule_c',
    description:
      "Generate a Schedule C summary for the seller's reselling business for a tax year. Returns the JSON " +
      'shape that maps 1:1 to IRS Form Schedule C: gross receipts, returns + allowances, net sales, all 5 ' +
      'expense lines (platform fees, shipping, COGS, mileage), and net profit (Line 31). Use when the user ' +
      'asks "how much did I net in 2024" or for end-of-year prep. PDF / CSV downloads are only on the web ' +
      'app, not the API surface — flag that to the user if asked.',
    inputSchema: {
      type: 'object',
      properties: {
        year: {
          type: 'integer',
          description:
            'US calendar tax year as a 4-digit integer (e.g. 2024) — NOT a date string. Selects the ' +
            'Jan 1 - Dec 31 window every Schedule C line is computed over (IRS Form 1040 Schedule C, ' +
            'US sole-proprietor scheme). Defaults to the PREVIOUS calendar year, since that is the ' +
            'one being filed. All money in the response is USD dollars, not cents.',
        },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/tax/schedule-c', { year: args.year }),
  },
  {
    name: 'log_mileage',
    description:
      "Log a business mileage trip — a sourcing run, a post-office drop, a thrift haul. The deduction is " +
      "computed from the year's IRS rate at read time, so do NOT pass a dollar amount; miles and a purpose " +
      "are what matter. Ask the user for the purpose in their own words: it is what substantiates the " +
      "deduction if they are ever asked to.",
    inputSchema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description:
            'Trip date as an ISO calendar date, exactly YYYY-MM-DD (e.g. "2025-03-14"). A timestamp ' +
            'or any other format is rejected by the server regex. This date alone decides which tax ' +
            'year the trip lands in for get_mileage_summary / get_schedule_c.',
        },
        miles: {
          type: 'number',
          description:
            'Distance driven, in MILES (not kilometres, and never a dollar figure — the deduction is ' +
            'derived from the year\'s IRS rate at read time). Must be > 0 and <= 10000; decimals are ' +
            'fine (e.g. 12.4).',
        },
        purpose: {
          type: 'string',
          description:
            "Why the trip was made, in the seller's own words, e.g. 'sourcing at Goodwill' — this is " +
            'the substantiation if the deduction is ever questioned. Required, 1-200 characters.',
        },
        startLocation: {
          type: 'string',
          description:
            'Optional free-text origin of the trip (e.g. "Home" or "123 Main St, Austin TX"). Max 200 ' +
            'characters. Not geocoded and not used to compute miles — purely a record for the audit trail.',
        },
        endLocation: {
          type: 'string',
          description:
            'Optional free-text destination of the trip (e.g. "Goodwill on Burnet"). Max 200 characters. ' +
            'Not geocoded and not used to compute miles.',
        },
        notes: {
          type: 'string',
          description:
            'Optional free-text memo kept with the entry (context, receipts, who was along). Max 2000 ' +
            'characters. Does not affect the deduction.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['date', 'miles', 'purpose'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/mileage', args),
  },
  {
    name: 'update_mileage',
    description:
      "Amend a logged trip. Only the fields you pass change. Use list_mileage first to get the id — and " +
      "show the user the current values before editing a tax record.",
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Mileage entry UUID from list_mileage.' },
        date: {
          type: 'string',
          description:
            'New trip date, exactly YYYY-MM-DD (e.g. "2025-03-14"). Omit to leave unchanged. Changing ' +
            'it can move the trip into a different tax year, which restates that year\'s deduction.',
        },
        miles: {
          type: 'number',
          description:
            'New distance in MILES (not kilometres, never dollars); > 0 and <= 10000, decimals allowed. ' +
            'Omit to leave unchanged. Replaces the old value — it is not added to it.',
        },
        purpose: {
          type: 'string',
          description:
            'New business purpose, 1-200 characters. Omit to leave unchanged. This is the text that ' +
            'substantiates the deduction, so prefer the seller\'s own wording.',
        },
        startLocation: {
          type: 'string',
          description: 'New free-text trip origin, max 200 characters. Omit to leave unchanged.',
        },
        endLocation: {
          type: 'string',
          description: 'New free-text trip destination, max 200 characters. Omit to leave unchanged.',
        },
        notes: {
          type: 'string',
          description: 'New free-text memo, max 2000 characters. Omit to leave unchanged.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, ...body } = args as Record<string, unknown>;
      return apiPatch(`/v1/mileage/${encodeURIComponent(id as string)}`, body);
    },
  },
  {
    name: 'delete_mileage',
    description:
      "Delete a logged trip. IRREVERSIBLE, and it is a tax record rather than a draft — confirm with the " +
      "user, quoting the date/miles/purpose, before calling this.",
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description:
            'UUID of the mileage entry to delete, from list_mileage. Must belong to the calling ' +
            'seller — another user\'s id 404s. Deleting removes the trip from every later ' +
            'get_mileage_summary and get_schedule_c for that tax year.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => apiDelete(`/v1/mileage/${encodeURIComponent(args.id as string)}`),
  },
];
