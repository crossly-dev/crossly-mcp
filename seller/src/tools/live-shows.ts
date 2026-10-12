import { apiGet, apiPost, apiPut } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Live shows (W8a): the buyer side (lineup, "sold here" replay moment, one
 * box per show, gifts sent) and the seller side (set a lineup, ship a show box
 * with one label). Dispatches through functions declared above the array, so
 * the v1-parity scanner cannot cross GET / PUT / POST actions.
 */

const enc = encodeURIComponent;
const need = (v: unknown, what: string): string => {
  if (typeof v !== 'string' || !v) throw new Error(`${what} is required for this action`);
  return enc(v);
};

function buyerLive(args: Record<string, unknown>): Promise<unknown> {
  const a = args as { action: string; streamId?: string; purchaseId?: string };
  switch (a.action) {
    case 'lineup': return apiGet(`/v1/buyer/live-streams/${need(a.streamId, "streamId")}/lineup`);
    case 'moment': return apiGet(`/v1/buyer/purchases/${need(a.purchaseId, "purchaseId")}/live-moment`);
    case 'shipments': return apiGet('/v1/buyer/live-shipments');
    case 'gifts_sent': return apiGet('/v1/buyer/gifts/sent');
    default: throw new Error(`Unknown action ${a.action}`);
  }
}

function sellerLive(args: Record<string, unknown>): Promise<unknown> {
  const a = args as { action: string; streamId?: string; shipmentId?: string; platformListingIds?: string[]; status?: string; trackingNumber?: string; carrier?: string };
  switch (a.action) {
    case 'set_lineup': return apiPut(`/v1/live-streams/${need(a.streamId, "streamId")}/lineup`, { platformListingIds: a.platformListingIds ?? [] });
    case 'shipments': return apiGet('/v1/live-shipments', { ...(a.streamId ? { streamId: a.streamId } : {}), ...(a.status ? { status: a.status } : {}) });
    case 'buy_label': return apiPost(`/v1/live-shipments/${need(a.shipmentId, "shipmentId")}/label`, {});
    case 'ship': return apiPost(`/v1/live-shipments/${need(a.shipmentId, "shipmentId")}/ship`, { trackingNumber: a.trackingNumber, ...(a.carrier ? { carrier: a.carrier } : {}) });
    default: throw new Error(`Unknown action ${a.action}`);
  }
}

export const liveShowTools: ToolDef[] = [
  {
    name: 'live_show_buyer',
    description: "Buyer side of live shows: lineup lists what a show will sell, in order, with prices and availability; moment says which show a purchase was bought in and the offset in seconds into its replay where it sold (null if not bought live); shipments lists the buyer's one-box-per-show shipments (postage charged once, the rest refunded when it ships); gifts_sent lists items sent as gifts with teaser/opened/thank-you status. Needs buyer:catalog:read (lineup) or buyer:orders:read.",
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['lineup', 'moment', 'shipments', 'gifts_sent'], description: 'lineup: a show’s items in order. moment: where a purchase sold in a replay. shipments: your show boxes. gifts_sent: gifts you sent.' },
        streamId: { type: 'string', description: 'lineup: the live show id.' },
        purchaseId: { type: 'string', description: 'moment: the purchase id (from your orders).' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    handler: (args) => buyerLive(args),
  },
  {
    name: 'live_show_seller',
    description: "Seller side of live shows: set_lineup orders your Crossly listings into a show's lineup (buyers see it before joining; a lineup item sold during the show is recorded at its replay moment); shipments lists each buyer's box of orders from one show; buy_label buys ONE label rated for the whole box; ship marks the box shipped with your own tracking. Shipping a box refunds the buyer's postage on every order but the most expensive one. Needs listings:write (lineup) or orders:read / orders:write.",
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['set_lineup', 'shipments', 'buy_label', 'ship'], description: 'set_lineup: replace a show’s lineup. shipments: list show boxes. buy_label: one label for a box. ship: ship a box with your own tracking.' },
        streamId: { type: 'string', description: 'set_lineup (required) / shipments (optional filter): the live show id.' },
        platformListingIds: { type: 'array', items: { type: 'string' }, description: 'set_lineup: your Crossly platform listing ids, in selling order (max 200).' },
        status: { type: 'string', enum: ['open', 'shipped'], description: 'shipments: open = still to ship, shipped = done.' },
        shipmentId: { type: 'string', description: 'buy_label / ship: the show box id (from shipments).' },
        trackingNumber: { type: 'string', description: 'ship: the tracking number of the label you used.' },
        carrier: { type: 'string', description: 'ship: the carrier (e.g. USPS, UPS).' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    handler: (args) => sellerLive(args),
  },
];
