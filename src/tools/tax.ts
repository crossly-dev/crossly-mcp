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
        year: { type: 'integer', description: 'Filter to a specific year (e.g. 2025).' },
        page: { type: 'integer', minimum: 1, default: 1 },
        limit: { type: 'integer', minimum: 1, maximum: 200, default: 100 },
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
          description: 'Tax year. Defaults to the current calendar year.',
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
          description: 'Tax year (default: previous calendar year).',
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
        date: { type: 'string', description: 'Trip date, ISO YYYY-MM-DD.' },
        miles: { type: 'number', description: 'Distance driven.' },
        purpose: { type: 'string', description: "Why the trip was made, e.g. 'sourcing at Goodwill'." },
        startLocation: { type: 'string' },
        endLocation: { type: 'string' },
        notes: { type: 'string' },
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
        date: { type: 'string' },
        miles: { type: 'number' },
        purpose: { type: 'string' },
        startLocation: { type: 'string' },
        endLocation: { type: 'string' },
        notes: { type: 'string' },
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
      properties: { id: { type: 'string' }, ...IDEMPOTENCY_PROP },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => apiDelete(`/v1/mileage/${encodeURIComponent(args.id as string)}`),
  },
];
