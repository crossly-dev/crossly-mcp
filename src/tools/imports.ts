import { apiGet, apiPost } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

export const importsTools: ToolDef[] = [
  {
    name: 'list_imports',
    description:
      "List the seller's import jobs (one per 'pull all my Poshmark listings' run, etc.). Use this to check " +
      'progress of an in-flight import, or to audit what has been imported in the past.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/imports'),
  },
  {
    name: 'get_import',
    description:
      'Get the status + counts of a single import job. Status values: queued | running | completed | ' +
      'failed | cancelled. `importedCount` / `skippedCount` / `errorCount` track per-listing outcomes.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Import job UUID.' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => apiGet(`/v1/imports/${encodeURIComponent(args.id as string)}`),
  },
  {
    name: 'start_import',
    description:
      "Kick off an import of the seller's existing listings from a connected platform. Creates inventory " +
      'items + listing records for every existing listing on that platform, deduping by SKU or platform listing ' +
      'ID. Best for onboarding flows ("import everything I have on Poshmark"). Returns immediately with a job ' +
      'id; poll with get_import or list_imports.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          description:
            'Platform ID — one of poshmark, mercari, depop, grailed, vinted, whatnot, vestiaire, offerup, curtsy, facebook, ebay, etsy, shopify, amazon, walmart.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['platform'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiPost(
        '/v1/imports',
        { platform: args.platform },
        args.idempotencyKey as string | undefined,
      ),
  },
];
