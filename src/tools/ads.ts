import { apiGet, apiPost, apiPut } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Offsite ads — promoting a merchant's items on external ad networks.
 *
 * Separate from the CBX tools because it is a separate product: the
 * budget is denominated in CBX and managed by the `*_cbx_ad_credit`
 * tools, while these cover networks, creative, attribution and policy.
 *
 * ── WHAT AN AGENT MUST NOT MISREPRESENT ───────────────────────────────
 * This feature asks a merchant to hand over discretion over their money
 * to a party whose interests only partly overlap with theirs. Three
 * things are true and must be stated accurately if a merchant asks:
 *
 *   OPT-IN ONLY. Off unless the merchant turns it on, and nothing
 *   enables it on their behalf. Never describe it as default or
 *   automatic.
 *
 *   MEDIA IS PASS-THROUGH AT COST, with a separate disclosed management
 *   fee. `mediaCostCents` versus `managementFeeCents` in the report
 *   answers "how much of my budget reached the auction", and that is a
 *   question the merchant is entitled to a straight answer to.
 *
 *   THE RETURN FLOOR IS A STOP, NOT A GUARANTEE. Below it, spend
 *   auto-pauses. Do NOT present `minReturnBps` as a promised return —
 *   nobody can honestly promise ad performance.
 *
 * ── SPILLOVER ─────────────────────────────────────────────────────────
 * When a click a merchant funded converts on somebody ELSE's item,
 * Crossly captured value they paid for. It is recorded as spillover and
 * a share is credited back to them in advertising credit. If a merchant
 * asks why their conversion count is lower than their click volume
 * suggests, spillover is usually the answer and the credit-back is the
 * other half of it.
 */
export const adsTools: ToolDef[] = [
  {
    name: 'get_offsite_ads_settings',
    description:
      'The merchant\'s offsite-ads opt-in and terms. Offsite ads spend their CBX advertising '
      + 'budget on external networks — Google, Meta and similar — at Crossly\'s discretion; '
      + 'their item gets promoted and the traffic lands on Crossly. '
      + 'OFF unless they turned it on. `networkWired` false means no ad network is connected '
      + 'yet, so campaigns will refuse rather than silently spend nothing. '
      + '`autoPausedReason` is worth reading aloud when present — it says why spending '
      + 'stopped.',
    inputSchema: { type: 'object', properties: {} },
    handler: () => apiGet('/v1/ads/offsite'),
  },
  {
    name: 'set_offsite_ads',
    description:
      'Turn offsite ads on or off, and set the terms. THE MERCHANT\'S DECISION — confirm they '
      + 'actually want it before enabling, and never enable it as a side effect of another '
      + 'request. '
      + '`maxOffsiteShareBps` caps how much of their budget may leave the platform. '
      + '`minReturnBps` is the floor below which spend AUTO-PAUSES: 20000 means $2 of '
      + 'attributed revenue per $1 spent over the window. Present it as a stop, never as a '
      + 'promised return. '
      + 'Toggling either way clears any existing auto-pause, so turning it back on does not '
      + 'inherit a pause from months ago.',
    inputSchema: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          description:
            'Whether offsite ads may run. The merchant decides this; nothing else sets it.',
        },
        maxOffsiteShareBps: {
          type: 'integer',
          description:
            'Ceiling on the share of their ad budget that may go offsite, in basis points. '
            + '5000 = at most half.',
        },
        minReturnBps: {
          type: 'integer',
          description:
            'Attributed revenue floor as basis points of spend. Below this over the window, '
            + 'offsite spend auto-pauses and the rest reverts to on-platform. A stop, not a '
            + 'guarantee.',
        },
        returnWindowDays: {
          type: 'integer',
          description: 'Days of history the return floor is measured over.',
        },
        allowedNetworks: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Networks the merchant will allow: google, meta, tiktok, reddit, pinterest. '
            + 'Omit or leave empty to allow all eligible ones.',
        },
      },
      required: ['enabled'],
    },
    handler: (args) => apiPut('/v1/ads/offsite', args),
  },
  {
    name: 'get_offsite_ads_report',
    description:
      'What the merchant\'s offsite budget bought — INCLUDING the misses. Spend, impressions '
      + 'and clicks are reported whether or not anything converted, because a report showing '
      + 'only conversions cannot be audited. '
      + 'When summarising, give spend AND conversions rather than only the wins. '
      + '`mediaCostCents` versus `managementFeeCents` is how much reached the auction versus '
      + 'Crossly\'s fee. '
      + '`spilloverConversions` is sales their ads produced on OTHER sellers\' items, and '
      + '`spilloverCreditedCents` is what came back to them for it. '
      + '`returnBps` is attributed revenue as basis points of spend — compare it with their '
      + '`minReturnBps` floor to explain a pause.',
    inputSchema: {
      type: 'object',
      properties: {
        sinceDays: {
          type: 'integer',
          description: 'Days of history to report. Defaults to 30.',
        },
      },
    },
    handler: (args) => {
      const { sinceDays } = args as { sinceDays?: number };
      const q = sinceDays ? `?sinceDays=${sinceDays}` : '';
      return apiGet(`/v1/ads/offsite/report${q}`);
    },
  },
  {
    name: 'check_offsite_ads_eligibility',
    description:
      'Whether an item can run offsite, and why not. Reasons: not_opted_in, auto_paused, '
      + 'network_not_allowed, category_not_allowlisted, no_adapter, no_budget. '
      + 'The category check is an ALLOWLIST, so an unclassified category is NOT eligible — '
      + 'that is deliberate, not a bug to work around. Ad networks suspend the whole ACCOUNT '
      + 'over a prohibited item, and that account is shared across every merchant using this, '
      + 'so one listing could cost all of them the feature. Do not suggest bypassing it.',
    inputSchema: {
      type: 'object',
      properties: {
        network: {
          type: 'string',
          enum: ['google', 'meta', 'tiktok', 'reddit', 'pinterest'],
          description: 'Which network the item would run on.',
        },
        category: {
          type: 'string',
          description: "The item's category, checked against the platform allowlist.",
        },
      },
      required: ['network', 'category'],
    },
    handler: (args) => {
      const { network, category } = args as { network: string; category: string };
      const q = new URLSearchParams({ network, category });
      return apiGet(`/v1/ads/offsite/eligibility?${q.toString()}`);
    },
  },
  {
    name: 'resume_offsite_ads',
    description:
      'Clear an auto-pause and resume offsite spend. Returns 409 when not actually paused. '
      + 'Read `autoPausedReason` from the settings first: resuming without changing anything '
      + 'usually just trips the floor again over the next window, so it is worth telling the '
      + 'merchant what tripped it before spending more of their money.',
    inputSchema: { type: 'object', properties: {} },
    handler: () => apiPost('/v1/ads/offsite/resume', {}),
  },
  {
    name: 'create_offsite_ads_campaign',
    description:
      'Launch an offsite campaign for an item. SPENDS THE MERCHANT\'S AD BUDGET on an '
      + 'external network. '
      + 'Creative is built from the structured fields passed here — title, condition as '
      + 'recorded, price, image. Do NOT embellish them: an ad saying "mint", "authenticated" '
      + 'or "rare" when the listing says none of those is a misrepresentation Crossly '
      + 'authored, and it is the SELLER who takes the buyer dispute, the return and the '
      + 'feedback. Pass the listing\'s own values verbatim. '
      + 'Refuses with 403 when no ad network is wired, rather than returning a campaign that '
      + 'does not exist.',
    inputSchema: {
      type: 'object',
      properties: {
        network: {
          type: 'string',
          enum: ['google', 'meta', 'tiktok', 'reddit', 'pinterest'],
          description: 'Which network to run on.',
        },
        listingId: {
          type: 'string',
          description: 'The Crossly listing being promoted, when there is one.',
        },
        category: {
          type: 'string',
          description:
            "The item's category. Checked against the platform allowlist before anything "
            + 'is created.',
        },
        title: {
          type: 'string',
          description: "The listing's title, verbatim. Do not rewrite or embellish it.",
        },
        condition: {
          type: 'string',
          description:
            "The condition as the listing records it, verbatim. Omit if the listing has "
            + 'none — do not infer one.',
        },
        priceCents: {
          type: 'integer',
          description: "The listing's price in CENTS.",
        },
        imageUrl: {
          type: 'string',
          description: "URL of the listing's primary image.",
        },
        landingUrl: {
          type: 'string',
          description: 'Where the click lands. Should be the listing page on Crossly.',
        },
        dailyBudgetCents: {
          type: 'integer',
          description:
            'Daily cap in CENTS. Drawn from the merchant\'s CBX ad budget; media is passed '
            + 'through at cost with a separate management fee.',
        },
      },
      required: ['network', 'category', 'title', 'priceCents', 'landingUrl', 'dailyBudgetCents'],
    },
    handler: (args) => apiPost('/v1/ads/offsite/campaigns', args),
  },
];
