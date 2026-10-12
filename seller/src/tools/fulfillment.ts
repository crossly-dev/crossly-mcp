import { apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Fulfillment: carrier pickups and SCAN forms for labelled orders.
 *
 * Tools whose actions use DIFFERENT HTTP methods dispatch through functions
 * declared above the array, so the v1-parity scanner cannot cross them.
 */

const enc = encodeURIComponent;

function pickup(args: Record<string, unknown>): Promise<unknown> {
  const a = args as {
    action: 'ready' | 'book' | 'list';
    orderIds?: string[]; date?: string; minTime?: string; maxTime?: string;
    address?: Record<string, unknown>; instructions?: string; idempotencyKey?: string;
  };
  if (a.action === 'ready') return apiGet('/v1/orders/pickup-ready');
  if (a.action === 'list') return apiGet('/v1/orders/pickups');
  return apiPost('/api/v1/orders/pickups', {
    orderIds: a.orderIds, date: a.date, minTime: a.minTime, maxTime: a.maxTime, address: a.address, instructions: a.instructions,
  }, a.idempotencyKey);
}

function scanForms(args: Record<string, unknown>): Promise<unknown> {
  const a = args as { action: 'create' | 'list' | 'get'; id?: string; orderIds?: string[]; shipDate?: string; idempotencyKey?: string };
  if (a.action === 'create') return apiPost('/api/v1/orders/scan-forms', { orderIds: a.orderIds, shipDate: a.shipDate }, a.idempotencyKey);
  if (a.action === 'get') {
    if (!a.id) return Promise.reject(new Error('id is required for get'));
    return apiGet(`/v1/orders/scan-forms/${enc(a.id)}`);
  }
  return apiGet('/v1/orders/scan-forms');
}

export const fulfillmentTools: ToolDef[] = [
  {
    name: 'carrier_pickup',
    description:
      'Carrier pickups for orders with a purchased Shippo label. ready: which orders a courier can collect, by carrier. '
      + 'book: orderIds (one carrier), date YYYY-MM-DD, minTime/maxTime HH:MM (at least an hour, up to 14 days ahead), optional address and '
      + 'instructions; returns the carrier confirmation number. list: booked pickups. orders:write to book.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['ready', 'book', 'list'], description: 'ready = labelled orders a courier can collect, by carrier; book = schedule a pickup (orderIds, date, minTime, maxTime); list = booked pickups, newest first.' },
        orderIds: { type: 'array', items: { type: 'string' }, description: 'book: 1-100 order ids (uuid), all on the same carrier.' },
        date: { type: 'string', description: 'book: pickup date, YYYY-MM-DD, up to 14 days ahead.' },
        minTime: { type: 'string', description: 'book: window start, HH:MM; the window must be at least an hour.' },
        maxTime: { type: 'string', description: 'book: window end, HH:MM.' },
        address: { type: 'object', description: 'book: optional pickup address { street1, city, state, zip, country? (2-letter) }.' },
        instructions: { type: 'string', description: 'book: optional note for the courier ("side door"), up to 200 characters.' },
        idempotencyKey: { type: 'string', description: 'book: sent as the Idempotency-Key header. Stable per intent so a retry cannot book twice.' },
      },
      required: ['action'],
    },
    handler: (args) => pickup(args),
  },
  {
    name: 'scan_forms',
    description:
      'SCAN forms: one barcode the counter scans once, so every parcel gets its acceptance scan. create: optional orderIds (default: every '
      + 'label not yet on a form) and shipDate; one form per carrier account and ship-from address. Forms build asynchronously, so call get '
      + 'until status is ready and documentUrl is the printable PDF. list: recent forms. orders:write to create.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'list', 'get'], description: 'create = build SCAN forms for unscanned labels; list = recent forms, newest first; get = one form, re-read from the carrier until its PDF is ready (id).' },
        id: { type: 'string', description: 'get: the SCAN form id (uuid).' },
        orderIds: { type: 'array', items: { type: 'string' }, description: 'create: 1-500 order ids (uuid) to cover; omit for every label not yet on a form.' },
        shipDate: { type: 'string', description: 'create: optional ship date, YYYY-MM-DD.' },
        idempotencyKey: { type: 'string', description: 'create: sent as the Idempotency-Key header. Stable per intent so a retry cannot create duplicate forms.' },
      },
      required: ['action'],
    },
    handler: (args) => scanForms(args),
  },
];
