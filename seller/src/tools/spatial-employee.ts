import { apiGet, apiPut } from '../api.js';
import { IDEMPOTENCY_PROP, PAGINATION_PROPS, ToolDef } from './types.js';

/**
 * The shop employee in a spatial room — settings and cost.
 *
 * ── THERE IS NO engage TOOL, AND THERE MUST NEVER BE ─────────────────
 * The internal API has `engage`/`disengage`; neither is published on /v1 and
 * neither is wrapped here. An engagement is an in-world signal a room emits as
 * it is drawn for a real visitor, and sending one OPENS A BILLABLE SESSION:
 * the seller is charged in COSM per engaged customer-minute. A model that
 * could emit them would be able to bill a seller for conversations that never
 * happened — and a model that decides to "test the employee" in a loop would
 * do exactly that, in good faith, at a per-minute rate. The capability is
 * absent from the surface rather than discouraged in prose, because prose is
 * not a permission system.
 *
 * The descriptions below therefore spend their words on the two things a model
 * gets wrong here instead: that the signing secret is handed over ONCE and
 * cannot be re-read, and that a mid-window total is a floor rather than a
 * final bill.
 */
const SCENE_ID_PROP = {
  type: 'string',
  description:
    'The room\'s scene id, from list_spatial_scenes. NOT a public slug — the two are '
    + 'different identifiers and do not substitute for one another. The room must belong to '
    + 'this account; somebody else\'s answers 404, exactly as a room that does not exist does.',
} as const;

const WINDOW_PROPS = {
  since: {
    type: 'string',
    description:
      'ISO 8601 start of the reporting window. Defaults to 30 days before `until`. The window '
      + 'may span at most 366 days — a longer one is refused with 400 rather than quietly '
      + 'shortened, so never widen a range to "get everything".',
  },
  until: {
    type: 'string',
    description: 'ISO 8601 end of the reporting window. Defaults to now.',
  },
} as const;

export const spatialEmployeeTools: ToolDef[] = [
  {
    name: 'get_spatial_employee_config',
    description:
      'How the shop employee in one of this seller\'s rooms is configured: whether it is on, '
      + 'its name and avatar, how it is driven, and its rule list. '
      + '`config: null` means the room has never had an employee configured — that is NOT the '
      + 'same as one that exists and is switched off (`enabled: false`), and reporting it as '
      + '"disabled" would be wrong. '
      + 'THE SIGNING SECRET IS NOT HERE AND CANNOT BE FETCHED. `hasAgentSecret` is a boolean '
      + 'saying one exists; the value itself is encrypted at rest and is returned exactly once, '
      + 'by the save that minted it. If the user has lost it, the only remedy is to rotate — '
      + 'which invalidates the old one — so say that rather than looking for a read path. '
      + '`suspendedAt` non-null means the employee was taken off the floor because a COSM '
      + 'charge was refused; `suspendedReason` says which, and saving the config again clears '
      + 'it. A room this account does not own answers 404.',
    inputSchema: {
      type: 'object',
      properties: { sceneId: SCENE_ID_PROP },
      required: ['sceneId'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet('/v1/spatial/employee/config', { sceneId: args.sceneId as string }),
  },
  {
    name: 'save_spatial_employee_config',
    description:
      'Create or replace the shop employee in one of this seller\'s rooms. THIS IS A FULL '
      + 'REPLACE, NOT A PATCH: every field is written from what you send, so call '
      + 'get_spatial_employee_config first and send it back changed, or you will silently wipe '
      + 'settings you did not mention. '
      + 'An employee costs COSM while it is ENGAGED with a customer — per customer, per started '
      + 'minute — so switching one on commits the seller to ongoing spend. One standing in an '
      + 'empty shop costs nothing. Confirm before enabling one they did not ask for. '
      + 'RULES CANNOT GRANT ANYTHING. `do.offerId` is a key into the seller\'s own offers and '
      + 'the server prices it; there is no field anywhere in a rule that carries an amount or a '
      + 'percentage, so an employee can propose a discount it has no power to give. Do not '
      + 'promise the user a rule that sets a price. '
      + '`displayName` and `do.line` must be printable ASCII — they are drawn in the 3D room '
      + 'from a fixed glyph atlas, so a curly quote or an emoji is refused with a 400 rather '
      + 'than rewritten. Write plain ASCII in the first place. '
      + 'THE SECRET COMES BACK ONCE. If this call mints a signing secret — you passed '
      + 'rotateSecret, or you set an agent endpoint on a room that had none — the response '
      + 'carries `secret`. SHOW IT TO THE USER IN THAT REPLY. No endpoint will ever return it '
      + 'again. Pass idempotencyKey if you might retry, or a retried rotation mints a second '
      + 'secret and invalidates the one you just showed them. '
      + 'Saving also CLEARS a suspension, putting a paused employee back on the floor.',
    inputSchema: {
      type: 'object',
      properties: {
        sceneId: SCENE_ID_PROP,
        enabled: {
          type: 'boolean',
          description:
            'Whether the employee is on the floor. True commits the seller to COSM spend '
            + 'whenever a visitor engages it.',
        },
        displayName: {
          type: 'string',
          maxLength: 48,
          description:
            'Shown above the employee. 1-48 PRINTABLE ASCII characters — it is 3D text from a '
            + 'fixed glyph atlas, and anything outside that renders as a box.',
        },
        brainKind: {
          type: 'string',
          enum: ['idle', 'rules', 'agent'],
          description:
            'idle = stands there (a legitimate choice). rules = evaluate `rules` in order, '
            + 'first match wins. agent = POST each event to `agentEndpointUrl` and do what it '
            + 'answers; that requires the URL to be set.',
        },
        avatarKey: {
          type: 'string',
          description:
            'Which humanoid mesh, e.g. "humanoid". Lowercase letters, digits, - and _ only.',
        },
        rules: {
          type: 'array',
          maxItems: 12,
          description:
            'Ordered rule list, first match wins, at most 12. Each is '
            + '{ when, afterSeconds?, do: { act, line?, offerId?, itemId? } }. `when` is one of '
            + 'entered, lingered, inspected, added_to_cart, leaving_with_cart, asked. `act` is '
            + 'one of approach, say, offer, point, idle. An `offer` act needs `offerId`. '
            + 'Anything outside those vocabularies is a 400 — do not invent trigger names.',
          items: { type: 'object' },
        },
        agentEndpointUrl: {
          type: ['string', 'null'],
          description:
            'Your own HTTPS endpoint, which OUR servers call with each event. It is resolved '
            + 'and checked against private address space BEFORE it is stored, so a hostname '
            + 'that answers with an internal address is refused here with a sentence. Null '
            + 'clears it.',
        },
        rotateSecret: {
          type: 'boolean',
          description:
            'Mint a fresh signing secret and return it in THIS response only. It replaces the '
            + 'old one immediately, so an agent still verifying with the previous secret breaks '
            + 'the moment this lands — rotate deliberately, not as a precaution.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['sceneId', 'enabled', 'displayName', 'brainKind'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiPut(
        '/v1/spatial/employee/config',
        {
          sceneId: args.sceneId,
          enabled: args.enabled,
          displayName: args.displayName,
          brainKind: args.brainKind,
          ...(typeof args.avatarKey === 'string' ? { avatarKey: args.avatarKey } : {}),
          ...(Array.isArray(args.rules) ? { rules: args.rules } : {}),
          ...(args.agentEndpointUrl !== undefined
            ? { agentEndpointUrl: args.agentEndpointUrl }
            : {}),
          ...(typeof args.rotateSecret === 'boolean'
            ? { rotateSecret: args.rotateSecret }
            : {}),
        },
        args.idempotencyKey as string | undefined,
      ),
  },
  {
    name: 'get_spatial_employee_usage',
    description:
      'What this seller\'s shop employees COST over a period, one row per room, with the window '
      + 'totalled under `meta.totals`. Use this to answer "what am I being charged for the '
      + 'employee". '
      + 'HOW TO READ IT: `billedCents` is COSM cents actually charged and is the figure to '
      + 'report. `burnBaseUnits` and `poolBaseUnits` are COSM base units as STRINGS because '
      + 'they are 64-bit integers — do not parse them as JS numbers and do not add them to '
      + 'billedCents, they are the same money expressed twice (half destroyed, half moved to a '
      + 'reward pool). '
      + 'A TOTAL READ MID-CONVERSATION IS A FLOOR, NOT A FINAL BILL: `openConversations` are '
      + 'running right now and contribute zero to every money field until they settle. Say so '
      + 'when `openNow` is above zero rather than presenting the number as final. '
      + '`unpaidConversations` SETTLED WITHOUT PAYMENT — the seller was short of COSM, or COSM '
      + 'is not live on this deployment — and each one also suspended the employee in that '
      + 'room. That is not a debt, is never retried, and must not be described as money owed. '
      + 'Rooms with no conversations in the window are ABSENT rather than listed as zero, so an '
      + 'empty `data` means nobody talked to an employee, not that the feature is off.',
    inputSchema: {
      type: 'object',
      properties: { ...WINDOW_PROPS },
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet('/v1/spatial/employee/usage', {
        ...(typeof args.since === 'string' ? { since: args.since } : {}),
        ...(typeof args.until === 'string' ? { until: args.until } : {}),
      }),
  },
  {
    name: 'list_spatial_employee_sessions',
    description:
      'The itemised bill behind get_spatial_employee_usage: one row per customer-conversation, '
      + 'newest first. Use it when a seller disputes a figure — each row carries the interval '
      + 'it was priced from, so a total can be checked by hand. '
      + '`engagedMs` is SERVER-measured from two timestamps the server wrote; nothing in this '
      + 'feature lets a client report its own duration. It is NULL, not zero, while a '
      + 'conversation is still running — a null there means "still talking", never "free". '
      + '`settledAt` null with `endedAt` set means billing has not run yet; `unpaidReason` set '
      + 'means it ran and moved nothing. '
      + 'NO ROW NAMES THE CUSTOMER. Billing is per customer, but no visitor identity is '
      + 'published on this surface — do not tell the user you can find out who they were '
      + 'talking to.',
    inputSchema: {
      type: 'object',
      properties: {
        ...WINDOW_PROPS,
        sceneId: {
          type: 'string',
          description: 'Narrow to one room. Must be a room this account owns, or 404.',
        },
        unpaidOnly: {
          type: 'boolean',
          description: 'Only the conversations that settled without payment.',
        },
        ...PAGINATION_PROPS,
      },
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet('/v1/spatial/employee/sessions', {
        ...(typeof args.since === 'string' ? { since: args.since } : {}),
        ...(typeof args.until === 'string' ? { until: args.until } : {}),
        ...(typeof args.sceneId === 'string' ? { sceneId: args.sceneId } : {}),
        ...(args.unpaidOnly === true ? { unpaidOnly: true } : {}),
        ...(args.page !== undefined ? { page: args.page } : {}),
        ...(args.limit !== undefined ? { limit: args.limit } : {}),
      }),
  },
];
