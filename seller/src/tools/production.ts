import { apiGet, apiPost, apiPatch } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

/**
 * The four axes a landed cost is estimated from, shared by `estimate_production_cost`
 * and `set_design_spec` so an estimate and the spec it was quoted against cannot
 * describe the object differently.
 */
const SPEC_PROPS = {
  category: {
    type: 'string',
    enum: ['tee', 'hoodie', 'outerwear', 'headwear', 'pants', 'pins', 'jewelry', 'bag', 'socks', 'belt', 'eyewear', 'sneakers', 'slides', 'figure_resin', 'figure_vinyl', 'other'],
    description:
      'What the physical piece IS. It selects the factory cost template — FOB band, tooling, sample cost, worst-case US ' +
      'duty rate, freight, and the minimum edition the category can be run at. Apparel: `tee`, `hoodie`, `outerwear`, ' +
      '`pants`, `headwear`, `socks`, `belt`. Accessories: `pins`, `jewelry`, `bag`, `eyewear`. Footwear: `sneakers`, ' +
      '`slides` — heavy tooling and a 200–300 unit minimum. Collectibles: `figure_resin` (minimum 50), `figure_vinyl` ' +
      '(minimum 500). `other` is a mid-priced generic template — use it only when nothing else fits.',
  },
  materialTier: {
    type: 'string',
    enum: ['standard', 'premium', 'luxury'],
    description:
      'Materials grade, applied as a multiplier on the per-unit factory cost: `standard` ×1.0 (blanks, stock trims), ' +
      '`premium` ×1.5 (heavier/better fabric, branded hardware), `luxury` ×2.2 (top-end materials).',
  },
  complexity: {
    type: 'string',
    enum: ['simple', 'moderate', 'complex'],
    description:
      'How hard the piece is to build, a second multiplier on the per-unit factory cost: `simple` ×1.0 (few panels, ' +
      'few operations), `moderate` ×1.3, `complex` ×1.7 (many panels, linings, multi-step finishing).',
  },
  packaging: {
    type: 'string',
    enum: ['poly', 'box', 'premium_box'],
    description:
      'Packaging tier, added straight onto the per-unit factory cost: `poly` = a polybag (+$0.20 a unit), `box` = a ' +
      'plain box (+$2.00 a unit), `premium_box` = custom printed and finished box (+$5.00 a unit).',
  },
  customHardware: {
    type: 'boolean',
    description: 'True if the piece needs bespoke hardware or moulds (zippers, buckles, outsoles). Raises the one-time tooling line by 50%.',
  },
} as const;

/**
 * Proof-of-Demand physical production — a digital design graduates into a
 * limited physical run once its on-platform earnings cover the run's cost.
 * Browse runs, accept terms as a designer, buy a limited unit.
 */
export const productionTools: ToolDef[] = [
  {
    name: 'list_production_ballot',
    description:
      'The production ballot: designs waiting for a physical run, most backed first, with your own votes and whether you may vote ' +
      '(voters must have bought on Crossly). The order is the queue factory quotes are sourced in; funding still decides a run.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/production/ballot', {}),
  },
  {
    name: 'vote_production_design',
    description: 'Back (support: true) or take back your vote on a design on the production ballot. One vote per person per design.',
    inputSchema: {
      type: 'object',
      properties: { candidateId: { type: 'string', description: 'The ballot entry id (candidateId).' }, support: { type: 'boolean', description: 'true to back the design, false to take your vote back.' } },
      required: ['candidateId', 'support'],
      additionalProperties: false,
    },
    handler: (a: Record<string, unknown>) =>
      apiPost(`/v1/production/candidates/${encodeURIComponent(String(a.candidateId))}/vote`, { support: Boolean(a.support) }),
  },
  {
    name: 'get_listing_provenance',
    description: 'Crossly provenance behind a shop listing: how many owners it has had on Crossly and since when (never who or for how much). Null when it was not bought here.',
    inputSchema: { type: 'object', properties: { slug: { type: 'string', description: 'The shop listing slug.' } }, required: ['slug'], additionalProperties: false },
    handler: (a: Record<string, unknown>) => apiGet(`/v1/shop/listings/${encodeURIComponent(String(a.slug))}/provenance`, {}),
  },
  {
    name: 'relist_purchase',
    description:
      'Sell it again: create a DRAFT listing of something you bought on Crossly, from its purchase receipt, carrying that receipt so the ' +
      'next buyer inherits its provenance. Idempotent per receipt. Price and publish the draft afterwards.',
    inputSchema: { type: 'object', properties: { receiptId: { type: 'string', description: 'The purchase receipt id of the item you bought on Crossly (your collection lists it).' } }, required: ['receiptId'], additionalProperties: false },
    handler: (a: Record<string, unknown>) => apiPost(`/v1/receipts/${encodeURIComponent(String(a.receiptId))}/relist`, {}),
  },
  {
    name: 'list_production_runs',
    description:
      'Browse open limited-edition PHYSICAL runs — designs that proved enough demand that their earnings funded a real production run.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/production/runs', {}),
  },
  {
    name: 'list_production_candidates',
    description: 'Your designs that have graduated toward a physical run (yours to accept terms on).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/production/candidates', {}),
  },
  {
    name: 'accept_production_terms',
    description:
      'Accept a graduated design\'s production terms: edition size, unit cost, retail price, and optional NFT-holder access (priority + holder price).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Production candidate UUID.' },
        editionSize: {
          type: 'integer',
          minimum: 1,
          maximum: 10000,
          description:
            'How many physical units this run makes, 1–10000. Must be at least the category\'s factory minimum ' +
            '(`minMoq` from estimate_production_cost) or the call is rejected.',
        },
        unitCostCents: {
          type: 'integer',
          minimum: 0,
          description:
            'Fallback per-unit landed cost in US CENTS (integer). 4999 means $49.99. Used ONLY when the design has no ' +
            'production spec to estimate from — with a spec set the server computes the unit cost itself and this is ignored.',
        },
        retailPriceCents: {
          type: 'integer',
          minimum: 0,
          description: 'Public per-unit retail price in US CENTS (integer). 8500 means $85.00, not $8,500.',
        },
        designerRoyaltyBps: {
          type: 'integer',
          minimum: 0,
          maximum: 10000,
          description:
            'Your royalty per unit sold, in BASIS POINTS of the sale price — not cents and not a percent: 0–10000, ' +
            'where 100 bps = 1% and 1000 bps = 10%. Omit to keep the rate already on the candidate.',
        },
        holderPriority: { type: 'boolean', description: 'Reserve the run for NFT holders.' },
        holderPriceCents: {
          type: 'integer',
          minimum: 0,
          description:
            'Discounted per-unit price for holders of the design\'s NFT, in US CENTS (integer). 6500 means $65.00. ' +
            'Omit or send null for no holder-specific price.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id', 'editionSize', 'unitCostCents', 'retailPriceCents'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, idempotencyKey, ...body } = args as Record<string, unknown> & { id: string; idempotencyKey?: string };
      return apiPost(`/v1/production/candidates/${encodeURIComponent(id)}/accept`, body, idempotencyKey);
    },
  },
  {
    name: 'purchase_production_unit',
    description: 'Buy a limited-edition unit of a physical run. Holder pricing applies automatically. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Run (production candidate) UUID.' },
        paymentRef: { type: 'string', description: 'The captured payment reference from checkout.' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, idempotencyKey, paymentRef } = args as { id: string; idempotencyKey?: string; paymentRef?: string };
      return apiPost(`/v1/production/runs/${encodeURIComponent(id)}/purchase`, { paymentRef }, idempotencyKey);
    },
  },
  {
    name: 'list_production_lines',
    description: 'Your production-lines dashboard: each graduated design with its candidate, run and inventory.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/production/lines', {}),
  },
  {
    name: 'list_production_drops',
    description: 'Limited-edition physical units you own, with their fulfillment (ship/track/deliver) status.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/production/drops', {}),
  },
  {
    name: 'estimate_production_cost',
    description: 'Estimate a run\'s landed cost from a spec + edition size. Overshoots deliberately (these are estimates).',
    inputSchema: {
      type: 'object',
      properties: {
        ...SPEC_PROPS,
        editionSize: {
          type: 'integer',
          minimum: 1,
          maximum: 10000,
          description:
            'Units in the hypothetical run, 1–10000. The one-off lines (tooling, samples, QC) spread across it, so the ' +
            'per-unit landed cost falls as it rises. The response\'s `minMoq` is the floor the category can actually be run at.',
        },
      },
      required: ['category', 'materialTier', 'complexity', 'packaging', 'editionSize'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { editionSize, ...spec } = args as Record<string, unknown> & { editionSize: number };
      return apiPost('/v1/production/estimate', { spec, editionSize });
    },
  },
  {
    name: 'get_production_earnings',
    description: 'Your CBX earnings from physical production: lifetime royalties, current CBX balance, recent credits, and the lines they came from.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/production/earnings', {}),
  },
  {
    name: 'get_design_prefs',
    description: 'Read a design\'s production preferences (spec, brief, opt-out).',
    inputSchema: {
      type: 'object',
      properties: {
        cosmeticId: { type: 'string', description: 'UUID of the Crossly cosmetic (the digital design) whose production preferences you want.' },
      },
      required: ['cosmeticId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { cosmeticId } = args as { cosmeticId: string };
      return apiGet(`/v1/production/designs/${encodeURIComponent(cosmeticId)}/prefs`, {});
    },
  },
  {
    name: 'set_design_spec',
    description: 'Set a design\'s production spec (category, materials, complexity, packaging). Run cost self-determines from this.',
    inputSchema: {
      type: 'object',
      properties: {
        cosmeticId: {
          type: 'string',
          description: 'UUID of the Crossly cosmetic (the digital design) to set the spec on. Must be a design you created.',
        },
        ...SPEC_PROPS,
      },
      required: ['cosmeticId', 'category', 'materialTier', 'complexity', 'packaging'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { cosmeticId, ...spec } = args as Record<string, unknown> & { cosmeticId: string };
      return apiPost(`/v1/production/designs/${encodeURIComponent(cosmeticId)}/spec`, spec);
    },
  },
  {
    name: 'set_design_brief',
    description: 'Set a design\'s production brief — the designer\'s IRL direction (materials, finish, colorway, box, reference images).',
    inputSchema: {
      type: 'object',
      properties: {
        cosmeticId: {
          type: 'string',
          description: 'UUID of the Crossly cosmetic (the digital design) whose brief you are setting. Must be a design you created.',
        },
        materials: {
          type: 'string',
          description: 'Prose: the materials you want used, e.g. "14oz heavyweight cotton, YKK hardware". Up to 500 characters.',
        },
        finish: {
          type: 'string',
          description: 'Prose: finishing and treatment, e.g. "garment-dyed, enzyme wash, soft-enamel pins". Up to 500 characters.',
        },
        colorway: {
          type: 'string',
          description: 'Prose: the colours and where each one goes, e.g. "bone body, forest rib, gold foil hit". Up to 500 characters.',
        },
        packaging: {
          type: 'string',
          description:
            'Prose packaging direction for the factory (box, hangtag, insert, COA), up to 500 characters. This is ' +
            'narrative only — the packaging TIER that drives cost is the `packaging` enum on set_design_spec.',
        },
        dimensions: {
          type: 'string',
          description: 'Prose: size or scale direction, e.g. "8in figure" or "S–3XL, boxy fit". Up to 200 characters.',
        },
        notes: { type: 'string', description: 'Any other direction for the factory. Up to 4000 characters.' },
        referenceImageUrls: {
          type: 'array',
          items: { type: 'string' },
          maxItems: 20,
          description: 'Up to 20 absolute image URLs the factory should work from — references, mockups, colour chips.',
        },
      },
      required: ['cosmeticId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { cosmeticId, ...brief } = args as Record<string, unknown> & { cosmeticId: string };
      return apiPost(`/v1/production/designs/${encodeURIComponent(cosmeticId)}/brief`, brief);
    },
  },
  {
    name: 'set_design_consent',
    description: 'Opt a design in or out of physical production.',
    inputSchema: {
      type: 'object',
      properties: {
        cosmeticId: { type: 'string', description: 'UUID of the Crossly cosmetic (the digital design) to opt in or out. Must be a design you created.' },
        optOut: {
          type: 'boolean',
          description: 'True bars this design from ever graduating to a physical run; false opts it back in.',
        },
      },
      required: ['cosmeticId', 'optOut'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { cosmeticId, optOut } = args as { cosmeticId: string; optOut: boolean };
      return apiPost(`/v1/production/designs/${encodeURIComponent(cosmeticId)}/consent`, { optOut });
    },
  },
  {
    name: 'list_production_pos',
    description: 'OPS ONLY (admin PAT): list purchase orders, optionally for a single candidate.',
    inputSchema: {
      type: 'object',
      properties: {
        candidateId: {
          type: 'string',
          description: 'Production-candidate (run) UUID to scope to. Omit to list every PO, newest first.',
        },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/production/pos', args as Record<string, unknown>),
  },
  {
    name: 'reconcile_production_po',
    description: 'OPS ONLY (admin PAT): reconcile a PO\'s actuals against the original landed-cost estimate.',
    inputSchema: {
      type: 'object',
      properties: {
        poId: { type: 'string', description: 'Purchase-order UUID to reconcile against the estimate it was greenlit on.' },
      },
      required: ['poId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { poId } = args as { poId: string };
      return apiGet(`/v1/production/pos/${encodeURIComponent(poId)}/reconcile`, {});
    },
  },
  {
    name: 'create_production_po',
    description: 'OPS ONLY (admin PAT): open a purchase order for a candidate.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Candidate UUID.' } }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiPost(`/v1/production/candidates/${encodeURIComponent(id)}/po`, {});
    },
  },
  {
    name: 'update_production_po',
    description: 'OPS ONLY (admin PAT): update a PO — supplier, freight mode, per-line actuals, QC and status. actualLandedCents recomputes.',
    inputSchema: {
      type: 'object',
      properties: {
        poId: { type: 'string', description: 'Purchase-order UUID to patch. Only the fields you send change.' },
        supplierName: { type: 'string', description: 'Factory or supplier name, up to 200 characters.' },
        supplierContact: { type: 'string', description: 'How to reach the supplier — person, email, WeChat, phone. Up to 300 characters.' },
        freightMode: {
          type: 'string',
          enum: ['sea', 'air', 'express'],
          description:
            'How the finished goods travel from the factory: `sea` = ocean freight (cheapest, slowest), `air` = air ' +
            'cargo, `express` = door-to-door courier such as DHL/FedEx (fastest, dearest).',
        },
        status: {
          type: 'string',
          enum: ['sourcing', 'quoted', 'sampling', 'sample_approved', 'in_production', 'shipped', 'received', 'cancelled'],
          description:
            'Where the PO sits in the sourcing loop, in order: `sourcing` (looking for a factory) → `quoted` (a price ' +
            'is in) → `sampling` (samples being made) → `sample_approved` (sample signed off) → `in_production` (the ' +
            'run is being made) → `shipped` (left the factory) → `received` (landed at the 3PL). `cancelled` ends it.',
        },
        actualUnitFobCents: {
          type: 'integer',
          minimum: 0,
          description:
            'Actual GOODS line for the WHOLE run, in US cents — unit FOB already multiplied by the edition, not a ' +
            'per-unit figure despite the name. Feeds actualLandedCents.',
        },
        actualToolingCents: {
          type: 'integer',
          minimum: 0,
          description: 'Actual one-time tooling, patterns, moulds and trims for the run, in US cents. Feeds actualLandedCents.',
        },
        actualSamplesCents: {
          type: 'integer',
          minimum: 0,
          description: 'Actual total spent across every sample round, in US cents. Feeds actualLandedCents.',
        },
        actualFreightCents: {
          type: 'integer',
          minimum: 0,
          description: 'Actual freight for the whole run, in US cents. Feeds actualLandedCents.',
        },
        actualDutyCents: {
          type: 'integer',
          minimum: 0,
          description: 'Actual US import duty paid on the run, in US cents. Feeds actualLandedCents.',
        },
        actualQcCents: {
          type: 'integer',
          minimum: 0,
          description: 'Actual third-party QC inspection spend for the run, in US cents. Feeds actualLandedCents.',
        },
        actualThreeplCents: {
          type: 'integer',
          minimum: 0,
          description: 'Actual 3PL receive plus pick/pack spend for the run, in US cents. Feeds actualLandedCents.',
        },
        sampleRounds: { type: 'integer', minimum: 0, description: 'How many sample rounds were actually run. The estimate budgets 3.' },
        qcStatus: {
          type: 'string',
          enum: ['pending', 'passed', 'failed'],
          description:
            'Third-party inspection result: `pending` = not inspected yet, `passed` = cleared to ship, `failed` = ' +
            'rejected at inspection (the run does not ship on this result).',
        },
        qcNotes: { type: 'string', description: 'Inspection findings and defect notes. Up to 4000 characters.' },
        trackingCode: { type: 'string', description: 'Carrier tracking number for the freight leg. Up to 120 characters.' },
        notes: { type: 'string', description: 'Internal ops notes on this PO. Up to 4000 characters.' },
      },
      required: ['poId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { poId, ...body } = args as Record<string, unknown> & { poId: string };
      return apiPatch(`/v1/production/pos/${encodeURIComponent(poId)}`, body);
    },
  },
];
