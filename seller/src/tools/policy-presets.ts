import { apiDelete, apiGet, apiPatch, apiPost } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

export const policyPresetsTools: ToolDef[] = [
  {
    name: 'list_policy_presets',
    description:
      "List the seller's reusable policy presets (return / shipping / payment policy blobs applied when publishing " +
      'listings). Optional `kind` filter narrows to one of return / shipping / payment.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['return', 'shipping', 'payment'],
          description:
            'Filter to one policy family. "return" = returns accepted, return window, who pays return shipping, ' +
            'refund method, restocking fee. "shipping" = handling time, domestic/international cost type, carriers, ' +
            'local pickup, package dimensions. "payment" = immediate-pay requirement, accepted payment methods, ' +
            'payment instructions. Omit to get all three families; results come back sorted by kind then name.',
        },
      },
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet('/v1/policy-presets', { kind: args.kind }),
  },
  {
    name: 'create_policy_preset',
    description:
      'Create a policy preset. kind picks which policy family it belongs to (return / shipping / payment). policy is the ' +
      'opaque policy blob the platform layer already understands. Setting isDefault=true clears any other default for the ' +
      "same (user, kind) tuple — there's at most one default per kind. Pass an idempotencyKey on retries.",
    inputSchema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['return', 'shipping', 'payment'],
          description:
            'Which policy family this preset belongs to, and therefore which blob shape `policy` must carry. ' +
            '"return" = returns accepted / window / who pays return shipping / refund method / restocking fee. ' +
            '"shipping" = handling time / domestic + international cost type / carriers / local pickup / package size. ' +
            '"payment" = immediate-pay requirement / accepted methods / instructions. Required, and effectively ' +
            'immutable: update_policy_preset cannot move a preset to another family — delete and recreate instead.',
        },
        name: {
          type: 'string',
          maxLength: 100,
          description:
            "Seller-facing label for this preset, 1-100 chars (e.g. '30-day returns, buyer pays'). It is what the " +
            'listing form shows in the policy picker, and the publish adapters reuse it as the NAME of the native ' +
            "policy template they create-or-reuse on eBay/Etsy — so make it distinctive per (kind, settings).",
        },
        policy: {
          type: 'object',
          description:
            'The policy body itself. Stored opaquely as JSONB — the server validates nothing inside it, so the shape ' +
            'must match `kind`: return → { returnsAccepted, returnPeriodDays 14|30|60|180, returnShippingCostPayer ' +
            "'BUYER'|'SELLER', refundMethod 'MONEY_BACK'|'MERCHANDISE_CREDIT', restockingFeePercent 0|10|15|20, " +
            'description, internationalOverride }; shipping → { handlingTimeDays, domestic/international { costType ' +
            "'flat'|'calculated'|'free'|'not_offered', flatRateCents, additionalItemCents, carriers[] }, localPickup, " +
            'packageInfo { weightOz, lengthIn, widthIn, heightIn } }; payment → { immediatePayRequired, ' +
            'acceptedMethods[], paymentInstructions }. Every *Cents key inside a shipping policy is integer CENTS ' +
            '(495 = $4.95), and restockingFeePercent is a percent, not a fraction. Defaults to {} if omitted.',
        },
        isDefault: {
          type: 'boolean',
          default: false,
          description:
            'true makes this the preset auto-selected on new listings of its kind, and clears the flag on every other ' +
            'preset of the same kind for this user — there is at most one default per (user, kind). Presets are ' +
            'apply-and-fill: selecting one copies its values onto the listing at publish time, it does not become a ' +
            'storefront setting, so flipping the default never changes an already-published listing. Default false.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['kind', 'name', 'policy'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/policy-presets', body, idempotencyKey);
    },
  },
  {
    name: 'update_policy_preset',
    description:
      'Update a policy preset (PATCH). Any subset of name / policy / isDefault may be supplied. Setting isDefault=true ' +
      'clears any other default for the same kind. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description:
            'UUID of the preset to update, as returned by list_policy_presets. This is a CROSSLY preset id, not a ' +
            "platform-native policy id — a `native:<platform>:<id>` sentinel from an imported eBay/Etsy policy is not " +
            'a preset and is rejected here. Must belong to the calling user; 404 otherwise. The preset\'s `kind` is ' +
            'fixed at creation and cannot be changed through this call.',
        },
        name: {
          type: 'string',
          maxLength: 100,
          description:
            'New seller-facing label, 1-100 chars. Omit to leave it unchanged. Renaming changes the name the publish ' +
            'adapters use when creating-or-reusing the matching native policy template on eBay/Etsy, so a rename can ' +
            'cause the next publish to create a new native template rather than reuse the old one.',
        },
        policy: {
          type: 'object',
          description:
            'Replacement policy body for this preset\'s kind — the whole blob is REPLACED, not deep-merged, so send ' +
            'every key you want to keep. Same shapes as create_policy_preset: return → { returnsAccepted, ' +
            "returnPeriodDays, returnShippingCostPayer, refundMethod, restockingFeePercent, internationalOverride }; " +
            'shipping → { handlingTimeDays, domestic/international { costType, flatRateCents, additionalItemCents, ' +
            'carriers[] }, localPickup, packageInfo }; payment → { immediatePayRequired, acceptedMethods[], ' +
            'paymentInstructions }. Shipping *Cents values are integer CENTS (495 = $4.95). Omit to leave unchanged.',
        },
        isDefault: {
          type: 'boolean',
          description:
            'true makes this the auto-selected preset for its kind and clears the flag on every other preset of the ' +
            'same kind (at most one default per (user, kind)); false just clears it on this one. Because presets are ' +
            'apply-and-fill, this only affects which values get copied onto FUTURE listings — listings already ' +
            'published keep the policy they were given. Omit to leave unchanged.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, idempotencyKey, ...body } = args as Record<string, unknown> & {
        id: string;
        idempotencyKey?: string;
      };
      return apiPatch(`/v1/policy-presets/${encodeURIComponent(id)}`, body, idempotencyKey);
    },
  },
  {
    name: 'delete_policy_preset',
    description: 'Delete a policy preset by id. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description:
            'UUID of the preset to delete, from list_policy_presets; must belong to the calling user. The delete is ' +
            'silent and idempotent — an id that is already gone (or was never yours) still returns ok:true rather ' +
            'than 404. Deleting only removes the reusable Crossly preset: because presets are apply-and-fill, ' +
            'listings already published with it keep the policy values they were given, and any native eBay/Etsy ' +
            'policy template created from it stays on that platform.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiDelete(
        `/v1/policy-presets/${encodeURIComponent(args.id as string)}`,
        args.idempotencyKey as string | undefined,
      ),
  },
];
