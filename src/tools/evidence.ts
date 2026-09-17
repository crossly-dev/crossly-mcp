import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

/**
 * The evidence bundle for an order.
 *
 * Every description here spends its words on how to READ the result, because
 * the failure mode for an agent handling a dispute is not fetching the wrong
 * data — it is over-reading what it fetched. Absence is not proof, a crease is
 * not a thief, and a 2xx is not a verdict.
 */
export const evidenceTools: ToolDef[] = [
  {
    name: 'get_order_evidence',
    description:
      'Everything recorded about how an order was packed and how it arrived: the packing ' +
      'video with its attestation verdict, the seal comparison, the buyer\'s arrival-condition ' +
      'state and photos, and the serials that shipped. ' +
      'HOW TO READ IT: absence is absence — an empty section means nothing was recorded, NOT ' +
      'that nothing happened, and must never be reported as evidence against anyone. ' +
      'capture.verdict `unusable` means the recording does not stand up as a single unedited ' +
      'take and should be treated as if there were no video. ' +
      'seal.verdict reaches `opened` ONLY on a replaced seal; `suspect` means drift or creases, ' +
      'which a crushed parcel or a lawful customs inspection produces just as readily. ' +
      'A serial\'s `strength` says when it was recorded relative to the sale — `weak` means it ' +
      'first appeared after the item shipped, so it answers much less than it looks like it does. ' +
      'The packing video evidences CONTENTS; the seal evidences CUSTODY. Neither substitutes ' +
      'for the other, and a seller who sealed an empty box produces a flawless seal chain.',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string' },
      },
      required: ['orderId'],
      additionalProperties: false,
    },
    handler: (args) => apiGet(`/v1/orders/${encodeURIComponent(args.orderId as string)}/evidence`),
  },
];
