import { apiGet, apiPost } from '../../api.js';
import { ToolDef } from '../types.js';

export const cosmAttestations: ToolDef[] = [
  {
    name: 'list_cosm_attestations',
    description:
      'Published Merkle commitments \u2014 what somebody can CHECK instead of trusting '
      + 'Crossly. `cosm_emission` commits an epoch of activity claims (so emission can be '
      + 'confirmed never to exceed committed real activity); `cbx_liability` commits every '
      + 'balance (the half of proof-of-reserve usually hand-waved). '
      + 'ALWAYS REPORT `anchoredAt`. Null means the root is computed and stored but NOT on '
      + 'chain, so it is a database row the operator could edit. Describing an unanchored '
      + 'commitment as proof is the one misstatement this feature cannot survive.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['cosm_emission', 'cbx_liability'],
          description: 'Filter to one kind.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 200,
          default: 50,
          description: 'How many commitments, newest first. Default 50.',
        },
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const query: Record<string, string> = {};
      if (args.kind) query.kind = String(args.kind);
      if (args.limit !== undefined) query.limit = String(args.limit);
      return apiGet('/v1/cosm/attestations', Object.keys(query).length ? query : undefined);
    },
  },
  {
    name: 'get_cosm_attestation_proof',
    description:
      "A Merkle inclusion proof for one subject against a published root. Returns the "
      + 'canonical leaf, the sibling path, and the root. '
      + 'Tell the user they can verify it THEMSELVES and how: sha256 the leaf with a 0x00 '
      + 'prefix, fold each proof step with a 0x01 prefix, order each pair '
      + 'lexicographically, compare to the root. Do not present the `verified` field as '
      + 'the proof \u2014 it is our own check, and the point of the feature is that they do '
      + 'not have to take our word for it. '
      + 'A 409 means the underlying data no longer reproduces the published root. That is '
      + 'a disclosure event, not a retryable error.',
    inputSchema: {
      type: 'object',
      properties: {
        commitmentId: {
          type: 'string',
          description:
            'The published commitment to prove against, from list_cosm_attestations. '
            + 'Check its `anchoredAt` — an unanchored root is not yet proof of anything.',
        },
        subjectId: {
          type: 'string',
          description:
            'The CBX subject to prove membership for, within that commitment.',
        },
      },
      required: ['commitmentId', 'subjectId'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet(
        `/v1/cosm/attestations/${encodeURIComponent(String(args.commitmentId))}/proof`,
        { subjectId: String(args.subjectId) },
      ),
  },
  {
    name: 'record_cosm_manual_anchor',
    description:
      'Record the chain signature for a commitment that was anchored BY HAND. '
      + 'AN OPS TOOL, NOT A TRUST BOUNDARY. It writes a signature somebody else '
      + 'produced; it does not verify that the signature anchors this root, and it does '
      + 'not send a transaction. A wrong value recorded here produces a commitment that '
      + 'LOOKS anchored and is not — which is strictly worse than `anchoredAt: null`, '
      + 'because null is honest. '
      + 'Do not call this to "mark something done", and never on a signature a user '
      + 'supplied without independently confirming it on chain first. Automated '
      + 'anchoring needs an RPC and a dedicated attest key; until those exist this is '
      + 'the manual path and it should be used rarely and deliberately.',
    inputSchema: {
      type: 'object',
      properties: {
        commitmentId: {
          type: 'string',
          description: 'The commitment to mark, from list_cosm_attestations.',
        },
        chainSignature: {
          type: 'string',
          description:
            'The transaction signature that anchored this exact root, 64-128 chars. '
            + 'Confirm it on chain before recording it — nothing here checks it.',
        },
      },
      required: ['commitmentId', 'chainSignature'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { commitmentId, ...body } = args as {
        commitmentId: string;
        chainSignature: string;
      };
      return apiPost(
        `/v1/cosm/attestations/${encodeURIComponent(commitmentId)}/anchor`,
        body,
      );
    },
  },
];
