import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

/**
 * 3D scan tools.
 *
 * Read only. Frames come from a camera a person is holding, so an agent cannot
 * produce a capture — and letting one START a capture would spend generation
 * budget with nobody present.
 *
 * The descriptions lean hard on one fact, because a model will otherwise report
 * it as a bug: a capture can be `ready` with NO mesh, and that is the normal,
 * cheap, intended outcome for most items.
 */
export const scanTools: ToolDef[] = [
  {
    name: 'list_scan_captures',
    description:
      'List the seller\'s 3D capture sessions, newest first. `status` is capturing, uploaded, '
      + 'processing, ready, failed or rejected, and `rejectReason` explains a refusal in the '
      + 'words the seller saw. IMPORTANT: a capture with status "ready" and no mesh is NORMAL '
      + 'and not an error — most items are textured onto a shape their category already fixes, '
      + 'which costs nothing and looks the same. Only report a problem for "failed" or '
      + '"rejected". When an item that WOULD have had geometry generated did not, '
      + '`generationSkipped` says why, in the words the seller saw — out of the monthly '
      + 'allowance, too few genuinely different angles to reconstruct from, or they had '
      + 'already had a model built from this same object. That is still a SUCCESSFUL '
      + 'capture: photos and a textured model exist. Suggest the fix it names rather than '
      + 'describing it as a failure. Requires the listings:read scope.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filter to one status, e.g. "rejected" to see what needs redoing.',
        },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 25, description: 'Rows to return.' },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/scan/captures', args as Record<string, unknown>),
  },

  {
    name: 'check_scan_models',
    description:
      'Return the items that ALREADY have a 3D model. Ask by catalogue variant '
      + '(variantIds), by the inventory rows the seller owns (inventoryItemIds), or '
      + 'both; at least one is required. Use it before suggesting a seller scan '
      + 'anything — ids that come back ABSENT are the ones worth capturing. '
      + 'The two are different kinds of answer. A catalogue model belongs to the PRODUCT '
      + 'and is shared, so a hit means their listing gets it immediately with nothing to '
      + 'capture because somebody else already paid to generate it. An inventory model '
      + 'belongs to ONE of their rows, because an object with no catalogue identity — a '
      + 'lamp, a one-off — is not a product anyone else can claim. '
      + '`longestEdgeMm` is set only when a capture MEASURED the item against something '
      + 'of known size; null means the mesh has correct proportions but no real-world '
      + 'scale, which is normal and not a defect. Max 200 ids of each per call. '
      + 'Requires catalog:read.',
    inputSchema: {
      type: 'object',
      properties: {
        variantIds: {
          type: 'array',
          items: { type: 'string' },
          maxItems: 200,
          description: 'Catalogue variant ids to check.',
        },
        inventoryItemIds: {
          type: 'array',
          items: { type: 'string' },
          maxItems: 200,
          description: "The seller's own inventory item ids to check.",
        },
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const { variantIds, inventoryItemIds } = args as {
        variantIds?: string[]; inventoryItemIds?: string[];
      };
      const query: Record<string, unknown> = {};
      if (variantIds?.length) query.variantIds = variantIds.slice(0, 200).join(',');
      if (inventoryItemIds?.length) {
        query.inventoryItemIds = inventoryItemIds.slice(0, 200).join(',');
      }
      return apiGet('/v1/scan/models', query);
    },
  },
];
