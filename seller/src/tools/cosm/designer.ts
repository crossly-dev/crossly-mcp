import { apiGet, apiPost } from '../../api.js';
import { ToolDef } from '../types.js';

// ── Designer surface ──────────────────────────────────────────────
//
// Publishing terms, opening a design to the chain, and the mint state
// machine. An agent driving these is acting for a DESIGNER, and two
// of them are irreversible in ways worth stating in the tool text
// rather than a doc it will not read: a chain unlock burns COSM, and
// a confirmed materialisation retires the in-world copy for good.

export const cosmDesigner: ToolDef[] = [
  {
    name: 'get_cosm_designer_terms',
    description:
      'The published terms for a design: resale rules, the price window, the secondary '
      + 'royalty and any collaborator splits. Also reports the platform rates the designer '
      + 'does NOT control, and whether the terms are enforceable on chain. Report that last '
      + 'field honestly — inside Crossly every rule is enforced, but a third-party '
      + 'marketplace honours a royalty voluntarily at best, so never tell a designer their '
      + 'royalty is guaranteed everywhere.',
    inputSchema: {
      type: 'object',
      properties: {
        cosmeticId: { type: 'string', description: 'The design to read terms for.' },
      },
      required: ['cosmeticId'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet('/v1/cosm/designer/terms', { cosmeticId: String(args.cosmeticId) }),
  },
  {
    name: 'publish_cosm_designer_terms',
    description:
      'Publish terms for a design. NEVER an edit: every call creates a new VERSION, and a '
      + 'copy already sold under an earlier version keeps those terms forever — so this '
      + 'cannot be used to change the deal on copies already out there. Designer-only. '
      + 'Collaborator splits are shares of the ROYALTY, not of the sale price, and may total '
      + 'at most 100%; the remainder stays with the designer. A total above 100% is REFUSED '
      + 'rather than scaled down.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: { type: 'string', description: 'The designer, as a CBX subject.' },
        cosmeticId: { type: 'string', description: 'The design these terms govern.' },
        resaleAllowed: {
          type: 'boolean',
          description: 'Whether holders may resell a copy in the COSM auction house.',
        },
        maxResaleBaseUnits: {
          type: ['string', 'null'],
          description: 'Upper bound on a resale ask, in COSM base units. Null clears it.',
        },
        minResaleBaseUnits: {
          type: ['string', 'null'],
          description: 'Lower bound on a resale ask, in COSM base units. Null clears it.',
        },
        secondaryRoyaltyBps: {
          type: 'integer',
          description: "The designer's cut of a RESALE, in basis points. Capped by the platform.",
        },
        splits: {
          type: 'array',
          description:
            'Collaborators, each taking a share OF THE ROYALTY. Shares total at most 10000 bps.',
          items: {
            type: 'object',
            properties: {
              recipientSubjectId: { type: 'string' },
              shareBps: { type: 'integer' },
              memo: { type: ['string', 'null'] },
            },
            required: ['recipientSubjectId', 'shareBps'],
            additionalProperties: false,
          },
        },
      },
      required: ['subjectId', 'cosmeticId'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/cosm/designer/terms', args),
  },
  {
    name: 'unlock_cosm_design_for_chain',
    description:
      'Burn COSM to make a design mintable on chain. THE FEE IS DESTROYED, not collected, '
      + 'and this is not reversible — confirm the designer means to do it. Idempotent: a '
      + 'second call returns the existing unlock WITHOUT charging again, so a retry is safe. '
      + 'Limited editions only; an open edition has no scarcity for a token to attest. Once '
      + 'unlocked, ANY holder may take their own copy on chain, not just the designer.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: { type: 'string', description: 'The designer, as a CBX subject.' },
        cosmeticId: { type: 'string', description: 'The design to unlock.' },
      },
      required: ['subjectId', 'cosmeticId'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/cosm/designer/chain-unlock', args),
  },
  {
    name: 'set_cosm_design_chain_auto_unlock',
    description:
      'Opt a design in or out of the FREE chain unlock a popular limited design earns '
      + '(on by default; 25 holders with half the edition out, or 10 resales, or 40 in use). '
      + 'Designer-only. Answers the popularity of the design toward the bar.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: { type: 'string', description: 'The designer, as a CBX subject.' },
        cosmeticId: { type: 'string', description: 'The design.' },
        enabled: { type: 'boolean', description: 'true = may unlock free when popular; false = never.' },
      },
      required: ['subjectId', 'cosmeticId', 'enabled'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/cosm/designer/chain-auto-unlock', args),
  },
  {
    name: 'submit_cosm_design_for_review',
    description:
      'Submit a user-authored design for moderation. Refuses a design with no preview image '
      + 'HERE rather than at approval, so the designer learns what is missing while they can '
      + 'still fix it. Submitting twice returns the EXISTING pending review rather than '
      + 'queueing a second one — do not treat a repeat call as a new submission.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: { type: 'string', description: 'The designer, as a CBX subject.' },
        cosmeticId: { type: 'string', description: 'The design to submit.' },
      },
      required: ['subjectId', 'cosmeticId'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/cosm/designer/submit-for-review', args),
  },
  {
    name: 'materialise_cosm_copy',
    description:
      'Lock a copy and return an UNSIGNED mint transaction for the holder to sign. This does '
      + 'NOT take the copy on chain and does NOT void it — the holder still has to sign, and '
      + 'you must then call confirm_cosm_materialisation once the chain reaches FINALIZED '
      + 'commitment, or release_cosm_materialisation if they closed the prompt. The lock '
      + 'expires on its own, so an abandoned request is not a copy held hostage. '
      + 'destinationOwner must be the HOLDER\'S OWN wallet — the platform never custodies '
      + 'the NFT.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: { type: 'string', description: 'The holder, as a CBX subject.' },
        ownershipId: { type: 'string', description: 'The specific copy to take on chain.' },
        destinationOwner: {
          type: 'string',
          description: "The holder's own Solana wallet address. Never a platform wallet.",
        },
      },
      required: ['subjectId', 'ownershipId', 'destinationOwner'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/cosm/designer/materialise', args),
  },
  {
    name: 'confirm_cosm_materialisation',
    description:
      'Record a confirmed mint and RETIRE the in-world copy, in one transaction. Only call '
      + 'this after verifying the transaction at FINALIZED commitment — an NFT recorded '
      + 'against a transaction that never landed cannot be recalled, and the copy it retired '
      + 'is gone. Idempotent on an already-confirmed request, so a retry after a timeout is '
      + 'safe.',
    inputSchema: {
      type: 'object',
      properties: {
        mintRequestId: { type: 'string', description: 'From materialise_cosm_copy.' },
        mintAddress: { type: 'string', description: 'The minted asset address.' },
        txSig: { type: 'string', description: 'The finalized transaction signature.' },
      },
      required: ['mintRequestId', 'mintAddress', 'txSig'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/cosm/designer/materialise/confirm', args),
  },
  {
    name: 'release_cosm_materialisation',
    description:
      'Release a mint lock that was never signed. The ordinary outcome of somebody closing a '
      + 'wallet prompt, and it leaves the copy EXACTLY as it was — nothing is lost and it can '
      + 'be retried. Refuses a request that has already minted, because releasing one would '
      + 'unlock a copy that is on chain.',
    inputSchema: {
      type: 'object',
      properties: {
        mintRequestId: { type: 'string', description: 'The request to release.' },
        reason: { type: 'string', description: 'Why, for the audit trail. 1-200 characters.' },
      },
      required: ['mintRequestId', 'reason'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/cosm/designer/materialise/release', args),
  },
  {
    name: 'get_cosm_copy_state',
    description:
      'Where a copy currently is: "held" (in-world, wearable, listable for COSM), "minting" '
      + '(locked while a mint is in flight) or "materialised" (an NFT in the holder wallet). '
      + 'A copy is in exactly ONE of these, never two — both at once would mean one edition '
      + 'with two owners who can each prove it. Check this before offering to list or wear an '
      + 'item.',
    inputSchema: {
      type: 'object',
      properties: {
        ownershipId: { type: 'string', description: 'The copy to locate.' },
      },
      required: ['ownershipId'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet('/v1/cosm/designer/copy-state', { ownershipId: String(args.ownershipId) }),
  },
  {
    name: 'get_cosm_designer_earnings',
    description:
      'What a designer has earned, in BOTH denominations. COSM royalties come from '
      + 'COSM-priced sales; cash earnings come from cash-priced sales and are funded by the '
      + 'buyer payment itself. The two are never converted into one another and COSM is never '
      + 'cashed out — so report them as two separate figures and never add them together or '
      + 'quote a dollar value for the COSM half.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: { type: 'string', description: 'The designer, as a CBX subject.' },
      },
      required: ['subjectId'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet('/v1/cosm/designer/earnings', { subjectId: String(args.subjectId) }),
  },
];
