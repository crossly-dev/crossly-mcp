import { apiDelete, apiGet, apiPost } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

/**
 * The Crossly DAO — staked CBX decides what the events pool funds.
 *
 * ── THE ONE RULE AN AGENT MUST NOT HELP ANYBODY AROUND ────────────────
 * A VOTE CAN NEVER DIRECT FUNDS TO THE VOTERS. `beneficiaryKind` is a
 * closed set — community_event, grant, charity, marketing, policy — with
 * no stakers, no holders, no airdrop and no distribution option, in this
 * schema, in the route, in the service and in a database CHECK.
 *
 * If somebody asks for a proposal that pays out to holders, to stakers,
 * to "the community" as a balance credit, or to themselves, the answer is
 * that this mechanism cannot express it. Do not reach for `grant` with
 * the electorate as the grantee, or `community_event` for an event whose
 * benefit is a token distribution — that is the same thing wearing a
 * different label, and a distribution decided by its own recipients is a
 * dividend whatever it is called. THE DAO DECIDES WHAT TO FUND, NEVER WHO
 * GETS PAID.
 *
 * ── NO TOOL HERE MOVES MONEY, AND THAT IS NOT AN OVERSIGHT ────────────
 * A passed proposal sets a STATUS. Disbursing goes through a campaign
 * with a preview and a human approval, and there is no execute or
 * disburse endpoint on this surface at all. Never tell somebody a passed
 * proposal has been funded — it has been AUTHORISED.
 *
 * ── VOTING POWER IS FROZEN AT OPEN ────────────────────────────────────
 * Weight is staked size x tenure, snapshotted when the proposal opens.
 * Staking after seeing a proposal grants NO vote on it, and the quorum
 * denominator never recomputes. If somebody asks how to acquire weight
 * for a live vote, there is no way: that is the acquire-vote-sell attack
 * and closing it is the point.
 *
 * Any single voter is capped at 10% of total weight however much they
 * hold. Note the direction — the cap is on WEIGHT, not on who may
 * propose. Proposing is open above a small stake threshold on purpose:
 * restricting proposals to large holders is the intuitive whale defence
 * and the wrong one, because it hands the agenda to exactly the
 * concentration it was meant to contain.
 *
 * ── PARTICIPATION IS NOT A YIELD ──────────────────────────────────────
 * Voting earns nothing. Proposing earns nothing. Staking multiplies a
 * COSM earn RATE on activity and grants governance weight; it pays no
 * return on the stake itself. If somebody is weighing a stake as an
 * investment, that framing is wrong and worth correcting.
 *
 * ── AMOUNTS ARE STRINGS OF BASE UNITS ─────────────────────────────────
 * `requestedBaseUnits` and every power figure are strings, because a
 * JSON number loses precision past 2^53. Never do float arithmetic on
 * them. CBX decimals are per-merchant config, so read them from the CBX
 * config rather than assuming a count before converting for display.
 */
export const daoTools: ToolDef[] = [
  {
    name: 'list_dao_proposals',
    description:
      'The DAO proposal queue. `meta` carries every threshold — minimum weight to '
      + 'propose and to vote, the in-flight and monthly limits, the default window, and '
      + 'the closed list of `beneficiaryKinds` — so a refusal can be explained BEFORE '
      + 'attempting it. Read this first rather than discovering a limit from an error. '
      + '`totalVotingPower` is the frozen quorum denominator, captured when the proposal '
      + 'opened; it does not track current stake and is not supposed to. '
      + 'Power figures are strings of base units.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['draft', 'open', 'passed', 'rejected', 'vetoed', 'expired', 'executed'],
          description:
            'Filter by status. `expired` means quorum was never met — nobody turned up; '
            + '`rejected` means the room voted no. They are different outcomes.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 200,
          default: 50,
          description: 'How many proposals. Default 50.',
        },
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const query: Record<string, string> = {};
      if (args.status !== undefined) query.status = String(args.status);
      if (args.limit !== undefined) query.limit = String(args.limit);
      return apiGet('/v1/dao/proposals', Object.keys(query).length ? query : undefined);
    },
  },
  {
    name: 'create_dao_proposal',
    description:
      'Raise a DAO proposal. It starts as a DRAFT and is not voted on until '
      + '`open_dao_proposal` is called — so creating one is safe and reversible. '
      + '`beneficiaryKind` IS A CLOSED SET and there is deliberately no stakers, holders, '
      + 'airdrop or distribution option. A proposal whose beneficiaries are the voters is '
      + 'a self-payment and this surface cannot express one; do not attempt it under '
      + '`grant` or `community_event` either. '
      + 'A `policy` proposal requests no funds and MUST omit `requestedBaseUnits`; every '
      + 'other kind must supply it, except a `charity` proposal with a `charityGoal`, whose '
      + 'amount is the pile of users’ gifts when it is announced. '
      + 'Requires staked CBX above `minProposeWeight`, one in-flight proposal at a time, '
      + 'and a capped number per month — read those from `list_dao_proposals` meta first. '
      + 'Those limits bound a denial of attention rather than of service.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: {
          type: 'string',
          description: 'The CBX subject id raising this. Must be a subject you own.',
        },
        title: { type: 'string', description: 'Short title (3-200 chars).' },
        body: {
          type: 'string',
          description:
            'The proposal itself (10-20000 chars). Write it expecting to be read by '
            + 'people deciding how to vote — what is being funded, why, and what happens '
            + 'if it passes.',
        },
        beneficiaryKind: {
          type: 'string',
          enum: ['community_event', 'grant', 'charity', 'marketing', 'policy'],
          description:
            'Who benefits. CLOSED SET — every option names somebody OTHER than the '
            + 'electorate. `policy` changes a rule and requests no funds.',
        },
        beneficiaryNote: {
          type: 'string',
          description:
            'Who specifically — the named grantee, charity, or event audience. Max 2000 '
            + 'chars.',
        },
        requestedBaseUnits: {
          type: 'string',
          description:
            'CBX requested, as a STRING of base units (never a float). Required for every '
            + 'kind except `policy`, which must omit it.',
        },
        quorumBps: {
          type: 'integer',
          minimum: 1,
          maximum: 10000,
          description:
            'Turnout required, in basis points of frozen total power. Omit for the default.',
        },
        passThresholdBps: {
          type: 'integer',
          minimum: 1,
          maximum: 10000,
          description:
            'Approval required, in basis points of DECISIVE votes (abstentions excluded). '
            + 'Omit for the default.',
        },
        charityGoal: {
          type: 'object',
          description:
            'Charity proposals only: the Crossly Cares cause this would fund. `charitySlug` is a '
            + 'vetted charity or `crossly-cares` for a program the charity runs itself.',
          properties: {
            charitySlug: { type: 'string' },
            title: { type: 'string', description: '3-120 chars.' },
            mission: { type: 'string', description: 'What the money does, 10-2000 chars.' },
            targetCents: { type: 'integer', minimum: 100, description: 'Dollar target in cents.' },
            endsAt: { type: 'string', description: 'Optional ISO end date.' },
          },
          required: ['charitySlug', 'title', 'mission', 'targetCents'],
          additionalProperties: false,
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['subjectId', 'title', 'body', 'beneficiaryKind'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args;
      return apiPost(
        '/v1/dao/proposals',
        body,
        idempotencyKey === undefined ? undefined : String(idempotencyKey),
      );
    },
  },
  {
    name: 'open_dao_proposal',
    description:
      'Put YOUR OWN draft to a binding vote. This is the irreversible step — a draft can '
      + 'be withdrawn, an open proposal runs its window and gets a result. '
      + 'ONLY THE PROPOSER MAY OPEN THEIR DRAFT. Opening commits something to a vote in '
      + 'their name, so authorship and that decision belong together; passing another '
      + "subject's id is refused. "
      + 'Opening SNAPSHOTS per-subject voting power and freezes the quorum denominator. '
      + 'Nothing recomputes either afterwards — that is what stops acquiring weight after '
      + 'seeing a proposal. Anybody who wanted to vote must already be staked. '
      + 'Refuses when nobody holds enough staked CBX to vote, because opening then would '
      + 'guarantee a failed quorum and waste the window.',
    inputSchema: {
      type: 'object',
      properties: {
        proposalId: { type: 'string', description: 'The draft proposal id.' },
        subjectId: {
          type: 'string',
          description: 'The proposer. Must match the subject that created the draft.',
        },
        votingDays: {
          type: 'integer',
          minimum: 1,
          maximum: 60,
          description: 'Window length in days. Omit for `defaultVotingDays`.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['proposalId', 'subjectId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { proposalId, idempotencyKey, ...body } = args;
      return apiPost(
        `/v1/dao/proposals/${encodeURIComponent(String(proposalId))}/open`,
        body,
        idempotencyKey === undefined ? undefined : String(idempotencyKey),
      );
    },
  },
  {
    name: 'withdraw_dao_proposal',
    description:
      'Withdraw your own DRAFT. DRAFTS ONLY — withdrawing an open proposal would discard '
      + 'votes already cast, which is the proposer overruling the electorate. An open '
      + 'proposal runs its window and gets a result; if somebody wants a live proposal '
      + 'stopped, the honest answer is that it cannot be. '
      + 'This exists so the one-in-flight limit is not a trap: without it a typo would '
      + 'lock somebody out of governance until the draft expired.',
    inputSchema: {
      type: 'object',
      properties: {
        proposalId: { type: 'string', description: 'The DRAFT proposal id.' },
        subjectId: {
          type: 'string',
          description: 'The proposer. Must match the subject that created the draft.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['proposalId', 'subjectId'],
      additionalProperties: false,
    },
    handler: (args) =>
      // See the note in cosm.ts: (path, idempotencyKey?, query?), no body.
      apiDelete(
        `/v1/dao/proposals/${encodeURIComponent(String(args.proposalId))}`,
        args.idempotencyKey === undefined ? undefined : String(args.idempotencyKey),
        { subjectId: String(args.subjectId) },
      ),
  },
  {
    name: 'cast_dao_vote',
    description:
      'Cast or change a vote while the window is open. '
      + 'Weight comes from the snapshot taken when the proposal OPENED, so staking '
      + 'afterwards grants no vote on it — the returned `weight` is that frozen figure, '
      + 'not current stake. A single voter contributes at most 10% of total weight '
      + 'however much they hold. '
      + 'Changing your mind is an UPDATE, not a second vote (`changed` tells you which '
      + 'happened); a unique index makes double-counting impossible regardless. '
      + 'ABSTAIN counts toward turnout and NOT toward approval — it lets somebody help a '
      + 'proposal clear quorum without taking a side, which is the whole reason it is '
      + 'offered. Voting earns nothing.',
    inputSchema: {
      type: 'object',
      properties: {
        proposalId: { type: 'string', description: 'An OPEN proposal id.' },
        subjectId: {
          type: 'string',
          description: 'The voting CBX subject. Must be one you own and must be staked.',
        },
        choice: {
          type: 'string',
          enum: ['for', 'against', 'abstain'],
          description:
            '`abstain` counts toward quorum but not toward approval — use it to help a '
            + 'vote reach turnout without endorsing it.',
        },
        reason: {
          type: 'string',
          description: 'Optional public rationale, max 2000 chars.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['proposalId', 'subjectId', 'choice'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { proposalId, idempotencyKey, ...body } = args;
      return apiPost(
        `/v1/dao/proposals/${encodeURIComponent(String(proposalId))}/vote`,
        body,
        idempotencyKey === undefined ? undefined : String(idempotencyKey),
      );
    },
  },
  {
    name: 'get_dao_tally',
    description:
      'The live count on a proposal. '
      + '`turnoutBps` is cast power over the FROZEN total and INCLUDES abstentions. '
      + '`approvalBps` is FOR over decisive votes and EXCLUDES them. Reporting either as '
      + 'the other is the easiest way to misstate a result. '
      + '`passed` reflects the arithmetic, not a final status — a window still open can '
      + 'change, and finalising is what records an outcome. '
      + 'A proposal that misses quorum finalises as `expired` rather than `rejected`: '
      + '"nobody turned up" and "the room said no" are different, and a proposer deserves '
      + 'to know which happened.',
    inputSchema: {
      type: 'object',
      properties: {
        proposalId: { type: 'string', description: 'The proposal id.' },
      },
      required: ['proposalId'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet(`/v1/dao/proposals/${encodeURIComponent(String(args.proposalId))}/tally`),
  },
  {
    name: 'finalise_dao_proposal',
    description:
      'Close a proposal whose window has passed and record the outcome. Normally '
      + 'unnecessary — an hourly sweep does it — and exposed so a result can be published '
      + 'immediately rather than waiting for a tick. '
      + 'FINALISING RECORDS AN OUTCOME AND NOTHING ELSE. A passed proposal sets a status; '
      + 'disbursing still requires a campaign with a preview and a human approval. Never '
      + 'report a passed proposal as funded — it is AUTHORISED, and nothing on this '
      + 'surface can move value.',
    inputSchema: {
      type: 'object',
      properties: {
        proposalId: { type: 'string', description: 'The proposal id.' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['proposalId'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiPost(
        `/v1/dao/proposals/${encodeURIComponent(String(args.proposalId))}/finalise`,
        {},
        args.idempotencyKey === undefined ? undefined : String(args.idempotencyKey),
      ),
  },
  {
    name: 'veto_dao_proposal',
    description:
      'OPERATOR BLOCK on a proposal. Needs a `treasury`-scoped key, not the `campaign` '
      + 'scope the rest of this surface uses — overriding a community vote is a heavier '
      + 'act than participating in one. '
      + 'THERE IS NO MATCHING POWER TO PASS, deliberately. A veto exists for the illegal '
      + 'and the ruinous. A power to pass would make every vote advisory theatre, because '
      + 'the outcome would always be whatever the operator preferred; an operator who can '
      + 'only say no cannot manufacture an outcome. '
      + 'The reason is MANDATORY, stored, and public. An unexplained veto is '
      + 'indistinguishable from disliking the result, which is precisely what would '
      + 'destroy confidence in the mechanism — write it expecting to be read. Do not '
      + 'invoke this to resolve a disagreement about the merits.',
    inputSchema: {
      type: 'object',
      properties: {
        proposalId: { type: 'string', description: 'The proposal id to block.' },
        reason: {
          type: 'string',
          description:
            'Why, in 10-2000 chars. Stored and public. State the specific legal or '
            + 'solvency problem, not a preference.',
        },
        vetoedByUserId: {
          type: 'string',
          description: 'The operator user accountable for the block.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['proposalId', 'reason', 'vetoedByUserId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { proposalId, idempotencyKey, ...body } = args;
      return apiPost(
        `/v1/dao/proposals/${encodeURIComponent(String(proposalId))}/veto`,
        body,
        idempotencyKey === undefined ? undefined : String(idempotencyKey),
      );
    },
  },
];
