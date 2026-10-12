import { apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Product passports (V27): NFC / QR tags on physical items that open their
 * provenance on Crossly. Seller tool `passports` registers them (SELLER
 * token, listings scopes); buyer tool `product_passport` reads and claims.
 *
 * Tools dispatch through functions declared above the array, so the
 * v1-parity scanner cannot cross GET and POST actions.
 */

const enc = encodeURIComponent;
const need = (v: unknown, what: string): string => {
  if (typeof v !== 'string' || !v) throw new Error(`${what} is required for this action`);
  return enc(v);
};

function sellerPassports(args: Record<string, unknown>): Promise<unknown> {
  const a = args as { action: string; id?: string; platformListingId?: string; tagUid?: string; locked?: boolean };
  if (a.action === 'register') return apiPost('/v1/passports', { platformListingId: a.platformListingId, ...(a.tagUid ? { tagUid: a.tagUid } : {}) });
  if (a.action === 'revoke') return apiPost(`/v1/passports/${need(a.id, "id")}/revoke`, {});
  if (a.action === 'bind_tag') return apiPost(`/v1/passports/${need(a.id, "id")}/tag`, { tagUid: need(a.tagUid, 'tagUid'), ...(a.locked !== undefined ? { locked: a.locked } : {}), written: true });
  return apiGet('/v1/passports', a.platformListingId ? { platformListingId: a.platformListingId } : {});
}

function buyerPassport(args: Record<string, unknown>): Promise<unknown> {
  const a = args as { action: string; code?: string; tagUid?: string };
  if (a.action === 'claim') return apiPost(`/v1/buyer/passports/${need(a.code, "code")}/claim`, a.tagUid ? { tagUid: a.tagUid } : {});
  return apiGet(`/v1/buyer/passports/${need(a.code, "code")}`);
}

export const passportTools: ToolDef[] = [
  {
    name: 'passports',
    description: "Seller: product passports for Crossly listings you sell. register returns a code and the URL to write to an NFC tag (NDEF URI) or print as a QR — optionally binding the tag's UID; list shows them (optionally for one listing); revoke cancels a lost or misprinted tag before the item sells. After a sale the passport follows the item's receipts: it cannot be transferred on its own. Needs listings:read / listings:write.",
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'register', 'bind_tag', 'revoke'], description: 'list: your passports. register: issue one for a listing. bind_tag: bind it to the NFC tag you wrote its nfcUrl to. revoke: cancel one before the item sells.' },
        platformListingId: { type: 'string', description: 'register (required) / list (optional filter): the Crossly platform listing id.' },
        tagUid: { type: 'string', description: "register: the NFC tag's UID as hex (4, 7 or 10 bytes, colons optional), to bind the passport to that physical tag." },
        id: { type: 'string', description: 'bind_tag / revoke: the passport id (from list).' },
        locked: { type: 'boolean', description: 'bind_tag: the tag was made read-only after writing.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    handler: (args) => sellerPassports(args),
  },
  {
    name: 'product_passport',
    description: "Buyer: what a product passport tag opens — the item, whether it was authenticated, owners on Crossly and since when (never who or for how much), and whether it is in its current owner's hands. claim marks it so, and only works for the item's current owner (the buyer of its latest sale). get needs buyer:catalog:read, claim buyer:activity:write.",
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['get', 'claim'], description: 'get: read the passport. claim: as the current owner, mark it in your hands.' },
        code: { type: 'string', description: 'The passport code — the last part of the tag URL /shop/passport/<code>.' },
        tagUid: { type: 'string', description: "claim: the tag's UID if your reader reports it; checked against the tag the passport was bound to." },
      },
      required: ['action', 'code'],
      additionalProperties: false,
    },
    handler: (args) => buyerPassport(args),
  },
];
