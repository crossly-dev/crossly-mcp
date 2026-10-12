import { apiGet, apiPost } from '../../api.js';
import { ToolDef } from '../types.js';

export const cbxRewardDisbursements: ToolDef[] = [
  {
    name: 'get_cbx_disbursement_progress',
    description:
      'How close each disbursement rule is to firing — safe to show users. A climbing counter '
      + 'toward a known number is why this uses cadence-plus-threshold rather than a pure '
      + 'threshold: people can see the pool rising and know roughly when the next community '
      + 'event is possible. `nextEligibleAt` is the earliest a rule can fire again.',
    inputSchema: { type: 'object', properties: {} },
    handler: () => apiGet('/v1/cbx/disbursement-progress'),
  },
  {
    name: 'check_cbx_disbursement_rule',
    description:
      'Evaluate a disbursement rule now, firing it if every gate passes. Gates in order: '
      + 'cadence, threshold, coverage — `outcome` names the one that stopped it. '
      + 'A missing or stale treasury snapshot declines on `coverage`, because unknown coverage '
      + 'is not healthy coverage. '
      + 'Firing opens a campaign in PREVIEWED state; it still needs approval and execution, so '
      + 'this does not pay anybody. Send dryRun to evaluate without writing anything.',
    inputSchema: {
      type: 'object',
      properties: {
        ruleId: {
          type: 'string',
          description: 'The disbursement rule to evaluate.',
        },
        dryRun: {
          type: 'boolean',
          description:
            'Evaluate the gates and report the outcome without opening a campaign or '
            + 'writing anything.',
        },
      },
      required: ['ruleId'],
    },
    handler: (args) => {
      const { ruleId, ...body } = args as { ruleId: string; dryRun?: boolean };
      return apiPost(`/v1/cbx/disbursement-rules/${encodeURIComponent(ruleId)}/check`, body);
    },
  },
  {
    name: 'get_cbx_ad_credit_ledger',
    description:
      'Movements on a merchant\'s CBX ad credit — purchases, spends and grants. '
      + 'This is GRANTED balance: in-platform spend ONLY and NEVER withdrawable, unlike '
      + 'the earned cashback balance. If somebody asks to cash out ad credit, the answer '
      + 'is that it is not that kind of balance, and that is deliberate rather than a '
      + 'missing feature. '
      + 'Spend is recorded AT COST for offsite media — media and management fee are '
      + 'separate lines, so `mediaCostCents` against `managementFeeCents` answers "how '
      + 'much of my budget actually reached the auction". '
      + 'Amounts are STRINGS of base units; never use float arithmetic.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/cbx/ad-credit/ledger'),
  },
  {
    name: 'list_cbx_disbursement_rules',
    description:
      'Threshold rules that fire community distributions from the EVENTS POOL. '
      + 'Read this before `check_cbx_disbursement_rule`, which needs a ruleId. '
      + 'Each rule decides WHEN only — firing opens a campaign that still needs preview, '
      + 'approval and execution, so a rule being over its threshold does not mean money '
      + 'has moved. '
      + 'Never describe these as paying holders or stakers: a distribution decided by its '
      + 'own recipients is a dividend, and the beneficiary set is closed against exactly '
      + 'that. Use `get_cbx_disbursement_progress` for how close each is to firing.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/cbx/disbursement-rules'),
  },
  {
    name: 'create_cbx_disbursement_rule',
    description:
      'Create a threshold rule that fires a community distribution. '
      + 'APPLIES TO THE EVENTS POOL ONLY, never free reserve surplus — reserve surplus '
      + 'funds the next accrual without touching the market, so distributing it would '
      + 'force buying the same tokens back at spread plus MEV. '
      + '`checkCadenceHours` bounds how often it can fire even when the pool is over the '
      + 'line. That matters: a pure threshold fires at an unpredictable moment, and the '
      + 'pool jumps most right after a lapse sweep — precisely when engagement was worst. '
      + 'The rule decides WHEN only. It cannot move value on its own.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Human-readable rule name.' },
        thresholdBaseUnits: {
          type: 'string',
          description:
            'Events-pool size at which the rule may fire, as a STRING of base units '
            + '(never a float).',
        },
        distributeBps: {
          type: 'integer',
          description:
            'Share of the pool to distribute when it fires, in basis points. Omit for '
            + 'the default.',
        },
        checkCadenceHours: {
          type: 'integer',
          description:
            'Minimum hours between firings, even while over threshold. Omit for the '
            + 'default.',
        },
        requireCoverageBps: {
          type: 'integer',
          description:
            'Minimum reserve coverage, in basis points, before firing is allowed. A '
            + 'missing or stale treasury snapshot declines — unknown coverage is not '
            + 'healthy coverage.',
        },
        metric: {
          type: 'string',
          description:
            'Which activity metric ranks recipients. Read the rules list for the values '
            + 'in use rather than guessing one.',
        },
        lookbackDays: {
          type: 'integer',
          description: 'Window the metric is measured over.',
        },
        maxRecipients: {
          type: 'integer',
          description: 'Cap on how many subjects a single firing pays.',
        },
      },
      required: ['name', 'thresholdBaseUnits'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/cbx/disbursement-rules', args),
  },
  {
    name: 'set_cbx_disbursement_rule_active',
    description:
      'Enable or disable a disbursement rule. Disabling stops it firing and changes '
      + 'nothing already distributed — there is no unwind.',
    inputSchema: {
      type: 'object',
      properties: {
        ruleId: {
          type: 'string',
          description: 'From list_cbx_disbursement_rules.',
        },
        isActive: {
          type: 'boolean',
          description: 'True to enable, false to disable.',
        },
      },
      required: ['ruleId', 'isActive'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { ruleId, ...body } = args as { ruleId: string; isActive: boolean };
      return apiPost(`/v1/cbx/disbursement-rules/${encodeURIComponent(ruleId)}/active`, body);
    },
  },
];
