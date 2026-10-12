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
        marketplaces: {
          type: 'array',
          items: { type: 'string' },
          description:
            'eBay only: the sites to import, e.g. ["EBAY_GB"]. One eBay account can list each item on several ' +
            'sites (ebay.co.uk, ebay.com, ebay.com.au…), each copy its own listing. Call list_import_sites first; ' +
            'when it returns more than one site, ask the seller which to import. Omit for every site.',
        },
        listOnCrossly: {
          type: 'boolean',
          description:
            'Also list everything the import brings in on the Crossly marketplace, once each item’s details ' +
            'have finished coming over. Recommended: an imported listing already has what a listing needs.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['platform'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiPost(
        '/v1/imports',
        {
          platform: args.platform,
          ...(Array.isArray(args.marketplaces) && args.marketplaces.length ? { marketplaces: args.marketplaces } : {}),
          ...(args.listOnCrossly === true ? { listOnCrossly: true } : {}),
        },
        args.idempotencyKey as string | undefined,
      ),
  },
  {
    name: 'list_import_sites',
    description:
      "Which sites a connected account's listings are on, with counts (eBay: ebay.co.uk, ebay.com, ebay.com.au… — " +
      'one item per site, each its own listing). Use before start_import: if more than one site comes back, ask ' +
      "the seller which to import (often only their home site is the master; the others are copies).",
    inputSchema: {
      type: 'object',
      properties: { platform: { type: 'string', description: 'Platform ID. Default ebay.' } },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/imports/sites', { platform: (args.platform as string | undefined) ?? 'ebay' }),
  },
];
