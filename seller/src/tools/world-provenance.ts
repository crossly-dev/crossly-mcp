import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

/** Provenance trails in Crossly World: where the caller's purchases were found. Read-only. */
export const worldProvenanceTools: ToolDef[] = [
  {
    name: 'get_world_provenance',
    description:
      'Provenance trails in Crossly World: where each of the caller\'s purchases was found in the world (a shop room, a window, a pop-up stall, a Space, a drop, a room auction), ' +
      'newest first, each with a line like "Found at The Sneaker Vault, Oct 2026". Read-only.',
    inputSchema: {
      type: 'object',
      properties: { listingIds: { type: 'array', items: { type: 'string' }, maxItems: 200, description: 'Only these platform listing ids (optional).' } },
      additionalProperties: false,
    },
    handler: (args: Record<string, unknown>) => apiGet('/v1/world/provenance', Array.isArray(args.listingIds) && args.listingIds.length ? { listingIds: args.listingIds.join(',') } : {}),
  },
];
