/**
 * Listings tools — re-export shim.
 *
 * Split into `listings/` when describing every bulk argument pushed the
 * single file past the 650-line cap. `listingsTools` is unchanged: same
 * name, same order, same path templates (v1-parity.test.ts scans the tool
 * files as text, and it walks this directory recursively).
 *
 *   core.ts       one listing at a time — CRUD, crosspost, delist,
 *                 import-by-url, magic-fill, drift discrepancies
 *   bulk.ts       /v1/listings/bulk-* fan-out + the hydrated by-ids fetch
 *   discovery.ts  facets, id materialization, SKU + duplicate checks
 *   ai-image.ts   BYOK AI listing photos (generate / preview prompt / image provider)
 *   _shared.ts    argument blocks reused across the bulk tools
 */
import { listingsCore } from './listings/core.js';
import { listingsBulk } from './listings/bulk.js';
import { listingsDiscovery } from './listings/discovery.js';
import { listingsAiImage } from './listings/ai-image.js';
import { ToolDef } from './types.js';

export const listingsTools: ToolDef[] = [
  ...listingsCore,
  ...listingsBulk,
  ...listingsDiscovery,
  ...listingsAiImage,
];
