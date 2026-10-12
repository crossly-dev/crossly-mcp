import { apiGet, apiPut } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

/**
 * Where the seller ships from and to on Crossly, and per-listing customs.
 * Backed by GET/PUT /v1/storefront/shipping and PUT /v1/listings/:id/customs.
 */
export const storefrontShippingTools: ToolDef[] = [
  {
    name: 'get_storefront_shipping',
    description:
      "Read the seller's Crossly shipping setup: the storefront shipping policy (handling time, domestic and " +
      'international services, and the international scope — enabled, shipsTo, excludes) and the default ship-from ' +
      "address. The ship-from country decides what counts as domestic. shippingPolicy is null when never set (Crossly's " +
      '$5-per-item default applies); shipFrom is null when the seller has no default address.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/storefront/shipping'),
  },
  {
    name: 'update_storefront_shipping',
    description:
      "Set the seller's Crossly shipping policy and/or default ship-from address (send either or both). Ship-to " +
      'scope lives in shippingPolicy.international: domestic only = { enabled: false }; selected countries = ' +
      "{ enabled: true, shipsTo: ['GB','CA'] }; worldwide except = { enabled: true, shipsTo: 'worldwide', excludes: " +
      "['RU'] }. Codes are ISO 3166-1 alpha-2; unknown codes are dropped and embargoed destinations (CU, IR, KP, SY) " +
      'are removed from a ship-to list. A ship-from address is checked per country (400 with the failing fields) and ' +
      'refused with 422 when the origin is under sanctions. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        shippingPolicy: {
          type: ['object', 'null'],
          description:
            'The WHOLE storefront shipping policy — it replaces the stored one, so read it first with ' +
            'get_storefront_shipping and send every key you want to keep; null clears it. Shape: { handlingTimeDays ' +
            "1-30, domestic { costType 'flat'|'calculated'|'free', flatRateCents, additionalItemCents, carriers " +
            "['USPS'|'UPS'|'FedEx'|'DHL'] (min 1), services[] }, international { costType 'flat'|'calculated'|'free'|" +
            "'not_offered', enabled, shipsTo 'worldwide'|string[], excludes string[], services[], importChargesNote }, " +
            'localPickup boolean, packageInfo { weightOz, lengthIn, widthIn, heightIn } }. A service is { id, name, ' +
            "costType, flatRateCents, additionalItemCents, minDays, maxDays, speed 'standard'|'expedited'|'overnight' }. " +
            'Every *Cents value is integer CENTS (2500 = $25.00). Omit to leave the policy unchanged.',
        },
        shipFrom: {
          type: 'object',
          description:
            "Replaces the seller's default ship-from address: { fullName, company?, street1, street2?, city, state?, " +
            "zip?, country?, phone? }. country is ISO alpha-2 and defaults to 'US'. Whether state and zip are required " +
            'depends on the country: US needs a state and a 5-digit or ZIP+4 code, GB a postcode but no county, Hong ' +
            'Kong neither. Postal codes come back in canonical form (sw1a1aa → SW1A 1AA). Omit to leave it unchanged.',
        },
        ...IDEMPOTENCY_PROP,
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPut('/v1/storefront/shipping', body, idempotencyKey);
    },
  },
  {
    name: 'set_listing_customs',
    description:
      "Set a listing's customs data: HS tariff code, country of origin, and countries this item must not ship to on " +
      'Crossly (a buyer there cannot check it out, even when the storefront ships to that country). Only the fields ' +
      'you send change; null clears hsCode / countryOfOrigin and [] clears restrictedCountries. restrictedCountries ' +
      'needs the listing to be on Crossly already (409 otherwise). Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        listingId: {
          type: 'string',
          description: 'UUID of the Crossly listing (the master listing id from list_listings), owned by the caller; 404 otherwise.',
        },
        hsCode: {
          type: ['string', 'null'],
          description:
            'Harmonized System tariff code, 6 to 10 digits; dots and spaces are allowed and stripped ("6109.10.00" → ' +
            '"61091000"). Printed on customs forms for international labels. null clears it.',
        },
        countryOfOrigin: {
          type: ['string', 'null'],
          description: "Where the item was made, ISO 3166-1 alpha-2 (e.g. 'CN', 'IT'). null clears it.",
        },
        restrictedCountries: {
          type: 'array',
          items: { type: 'string' },
          description:
            "ISO alpha-2 codes this one item must not ship to (e.g. ['AU'] for an item Australian customs bans). " +
            'Replaces the whole list; unknown codes are dropped; [] clears it.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['listingId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { listingId, idempotencyKey, ...body } = args as Record<string, unknown> & {
        listingId: string;
        idempotencyKey?: string;
      };
      return apiPut(`/v1/listings/${encodeURIComponent(listingId)}/customs`, body, idempotencyKey);
    },
  },
];
