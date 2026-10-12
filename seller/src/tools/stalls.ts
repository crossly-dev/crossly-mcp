import { apiGet, apiPatch, apiPost } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

/**
 * Pop-up stalls in Crossly World — a seller rents a curb spot on a street for a
 * day, or a spot at a Night Market (Fridays 19:00-23:00 New York) / Swap Meet
 * (Sundays 13:00-17:00), showing up to 6 of their live listings. Paid up front
 * on the saved card, Crossly Bucks or CBX (a privately owned spot takes CBX
 * only). Cancel before it opens for a full refund; final once open.
 */
const RAIL = { type: 'string', enum: ['card', 'bucks', 'cbx'], description: 'How to pay: card (your saved card), bucks (Crossly Bucks) or cbx.' } as const;

export const stallsTools: ToolDef[] = [
  {
    name: 'list_street_stalls',
    description:
      'Today\'s pop-up stalls on a street (e.g. main-street): each stall\'s seller, awning, sign and live listings, plus ' +
      'meta.free — the spots still free today (and for tonight\'s Night Market or Sunday\'s Swap Meet) with their price in cents.',
    inputSchema: {
      type: 'object',
      properties: { street: { type: 'string', description: 'Street slug, e.g. main-street.' } },
      required: ['street'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { street } = args as { street: string };
      return apiGet(`/v1/streets/${encodeURIComponent(street)}/stalls`, {});
    },
  },
  {
    name: 'list_street_events',
    description: 'Current and upcoming Night Markets and Swap Meets on a street, soonest first, with their ids (for booking an event stall).',
    inputSchema: {
      type: 'object',
      properties: { street: { type: 'string', description: 'Street slug.' } },
      required: ['street'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { street } = args as { street: string };
      return apiGet(`/v1/streets/${encodeURIComponent(street)}/events`, {});
    },
  },
  {
    name: 'quote_stall',
    description:
      'Quote a stall: line items in cents, the rails the spot accepts, and whether it is bookable. Either unit=day with ' +
      'start (YYYY-MM-DD, street time New York) and days, or unit=event with eventIds from list_street_events.',
    inputSchema: {
      type: 'object',
      properties: {
        street: { type: 'string', description: 'Street slug, e.g. main-street.' },
        spot: { type: 'integer', description: 'Spot index from list_street_stalls meta.free.' },
        unit: { type: 'string', enum: ['day', 'event'], description: 'day = whole days (08:00-18:00 street time); event = Night Market / Swap Meet occurrences.' },
        start: { type: 'string', description: 'YYYY-MM-DD (unit=day).' },
        days: { type: 'integer', minimum: 1, description: 'Days (unit=day).' },
        eventIds: { type: 'array', items: { type: 'string' }, description: 'Street event ids (unit=event).' },
      },
      required: ['street', 'spot'],
      additionalProperties: false,
    },
    handler: (args) => {
      const a = args as { street: string; spot: number; unit?: 'day' | 'event'; start?: string; days?: number; eventIds?: string[] };
      const query: Record<string, unknown> = { street: a.street, spot: a.spot, unit: a.unit ?? 'day' };
      if (a.unit === 'event') query.events = (a.eventIds ?? []).join(',');
      else {
        if (a.start) query.start = a.start;
        if (a.days != null) query.days = a.days;
      }
      return apiGet('/v1/stalls/quote', query);
    },
  },
  {
    name: 'list_my_stalls',
    description: 'Your stall bookings, newest first, with status, what you paid and were refunded, and visits / offers / sales while the stall was up.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/stalls/mine', {}),
  },
  {
    name: 'book_stall',
    description:
      'Book AND PAY for a pop-up stall (quote_stall first). Charged now on the chosen rail. Needs a full-access token and ' +
      'an idempotencyKey (derive it from street + spot + dates; reuse it on retries).',
    inputSchema: {
      type: 'object',
      properties: {
        street: { type: 'string', description: 'Street slug, e.g. main-street.' },
        spotIndex: { type: 'integer', description: 'Spot index from list_street_stalls meta.free.' },
        rail: RAIL,
        unit: { type: 'string', enum: ['day', 'event'], description: 'day = whole days (needs startDate + days); event = street events (needs eventIds).' },
        startDate: { type: 'string', description: 'YYYY-MM-DD (unit=day).' },
        days: { type: 'integer', minimum: 1, description: 'unit=day.' },
        eventIds: { type: 'array', items: { type: 'string' }, description: 'unit=event.' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['street', 'spotIndex', 'rail', 'unit', 'idempotencyKey'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/stalls/book', body, idempotencyKey);
    },
  },
  {
    name: 'update_stall',
    description: 'Change a booked stall before or while it is up: listingIds (up to 6 of your live listings), awning { colour, pattern }, sign text, attendant on/off.',
    inputSchema: {
      type: 'object',
      properties: {
        bookingId: { type: 'string', description: 'Stall booking id (list_my_stalls).' },
        listingIds: { type: 'array', items: { type: 'string' }, maxItems: 6, description: 'Up to 6 of your live listing ids, shown in this order; sold ones are swapped for your next live listing automatically.' },
        awning: {
          type: 'object',
          description: 'Awning colour and pattern.',
          properties: {
            colour: { type: 'string', enum: ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'cream', 'charcoal'] },
            pattern: { type: 'string', enum: ['solid', 'stripe', 'scallop', 'check'] },
          },
          required: ['colour', 'pattern'],
        },
        sign: { type: ['string', 'null'], description: 'Up to 32 printable ASCII characters.' },
        attendant: { type: 'boolean', description: 'true = an AI attendant answers questions at the stall.' },
      },
      required: ['bookingId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { bookingId, ...body } = args as Record<string, unknown> & { bookingId: string };
      return apiPatch(`/v1/stalls/bookings/${encodeURIComponent(bookingId)}`, body);
    },
  },
  {
    name: 'cancel_stall',
    description: 'Cancel a stall before it opens: a full refund on the rail it was paid on. Refused once it has opened.',
    inputSchema: {
      type: 'object',
      properties: { bookingId: { type: 'string', description: 'Stall booking id (list_my_stalls).' }, ...IDEMPOTENCY_PROP },
      required: ['bookingId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { bookingId, idempotencyKey } = args as { bookingId: string; idempotencyKey?: string };
      return apiPost(`/v1/stalls/bookings/${encodeURIComponent(bookingId)}/cancel`, {}, idempotencyKey);
    },
  },
];
