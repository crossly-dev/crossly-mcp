import { apiDelete, apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Buyer parity W7 tools: audio listing summaries (accessibility), protection
 * plans (extended warranties bought at checkout).
 *
 * Dispatches through a function declared above the array, so the v1-parity
 * scanner cannot cross GET and POST actions.
 */

const enc = encodeURIComponent;
const need = (v: unknown, what: string): string => {
  if (typeof v !== 'string' || !v) throw new Error(`${what} is required for this action`);
  return enc(v);
};

function audioSummary(args: Record<string, unknown>): Promise<unknown> {
  const a = args as { action: string; slug?: string };
  if (a.action === 'generate') return apiPost(`/v1/buyer/listings/${need(a.slug, "slug")}/audio-summary`, {});
  return apiGet(`/v1/buyer/listings/${need(a.slug, "slug")}/audio-summary`);
}

function protectionPlans(args: Record<string, unknown>): Promise<unknown> {
  const a = args as { action: string; id?: string };
  if (a.action === 'cancel') return apiPost(`/v1/buyer/protection-plans/${need(a.id, "id")}/cancel`, {});
  return apiGet('/v1/buyer/protection-plans');
}

function tryOn(args: Record<string, unknown>): Promise<unknown> {
  const a = args as { action: string; slug?: string; id?: string; reuseLastPhoto?: boolean; confirmSelfAdult?: boolean };
  switch (a.action) {
    case 'availability': return apiGet(`/v1/buyer/listings/${need(a.slug, "slug")}/try-on`);
    case 'history': return apiGet('/v1/buyer/try-ons');
    case 'delete': return apiDelete(`/v1/buyer/try-ons/${need(a.id, "id")}`);
    case 'render':
      if (a.confirmSelfAdult !== true) throw new Error('confirmSelfAdult must be true: the photo is of the buyer and they are 18 or older');
      if (!a.reuseLastPhoto) throw new Error('From MCP, render reuses the buyer’s last try-on photo (reuseLastPhoto: true); add a new photo in the Crossly app or site');
      return apiPost(`/v1/buyer/listings/${need(a.slug, "slug")}/try-on`, { reuseLastPhoto: true, confirmSelfAdult: true });
    default: throw new Error(`Unknown action ${a.action}`);
  }
}

export const buyerW7Tools: ToolDef[] = [
  {
    name: 'usdc_checkout',
    description: "Whether Crossly takes USDC for an order (Stripe stablecoin payments on Solana, Ethereum, Base or Polygon, settled in USD) and the per-order limit in cents. Paying with USDC needs the buyer's own wallet, so it is done in the Crossly checkout in a browser (choose Pay with USDC), never by an agent. Needs buyer:catalog:read.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/buyer/checkout/usdc'),
  },
  {
    name: 'try_on',
    description: "AI virtual try-on of a wearable listing on the buyer's own photo. availability says whether the listing qualifies (wearable, has a photo; never intimates/swimwear/sleepwear) and whether the image model is configured; render re-uses the buyer's last try-on photo (new photos are added in the Crossly app or site) and returns the AI-generated image — confirmSelfAdult must be true; capped per day; history lists past renders; delete removes one (id) or everything ('all'). Needs buyer:catalog:read for availability, buyer:activity:read/write otherwise.",
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['availability', 'render', 'history', 'delete'], description: 'availability: can this listing be tried on. render: make a try-on. history: past try-ons. delete: remove one or all.' },
        slug: { type: 'string', description: 'availability / render: the listing slug, as in /shop/<slug>.' },
        id: { type: 'string', description: "delete: a try-on id from history, or 'all' to delete every photo and result." },
        reuseLastPhoto: { type: 'boolean', description: "render: must be true — use the buyer's most recent try-on photo." },
        confirmSelfAdult: { type: 'boolean', description: 'render: must be true — the photo is of the buyer and they are 18 or older.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    handler: (args) => tryOn(args),
  },
  {
    name: 'protection_plans',
    description: "The buyer's protection plans (extended warranties, insured by Crossly's partner) bought at checkout via checkout's protectionPlanId. list shows status (paid = filing with the insurer, active = contract issued, cancelled), term, coverage, premium and refund in cents; cancel refunds what the insurer says is refundable to the card. list needs buyer:orders:read, cancel buyer:orders:write.",
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'cancel'], description: 'list: every plan. cancel: cancel one (id) and refund the refundable premium.' },
        id: { type: 'string', description: 'cancel: the plan id (from list).' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    handler: (args) => protectionPlans(args),
  },
  {
    name: 'listing_audio_summary',
    description: "A spoken summary of a listing, for accessibility. get returns the text (built only from the listing's own fields and the seller's description — never invented) and the recording's URL when one exists; generate records it with the configured speech provider (cached per listing version; errors naming TTS_API_KEY when none is configured). Needs buyer:catalog:read.",
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['get', 'generate'], description: 'get: the summary text and any existing recording. generate: record it now (or return the cached recording of the current text).' },
        slug: { type: 'string', description: 'The listing slug, as in /shop/<slug>.' },
      },
      required: ['action', 'slug'],
      additionalProperties: false,
    },
    handler: (args) => audioSummary(args),
  },
];
