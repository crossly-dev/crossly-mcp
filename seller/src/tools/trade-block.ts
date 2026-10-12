import { apiGet, apiPost } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

/**
 * The Trade Block — peer-to-peer swaps on the Crossly Market.
 *
 * Post a WANT or an OFFER, respond with a concrete one-item-each-side swap (plus
 * optional cash boot), and accept/decline/counter/withdraw. Accepting charges
 * BOTH parties the 9.5% market fee and sends both items to authentication;
 * nothing releases until BOTH pass. Market items only.
 */
const ITEM_SCHEMA = {
  type: 'object',
  properties: {
    variantId: { type: 'string', description: 'Market variant UUID.' },
    condition: { type: 'string', description: 'Condition code (default DS).' },
    gradeKey: { type: 'string', description: 'Grade key, e.g. psa:10. Omit for ungraded.' },
    portfolioId: { type: 'string', description: 'Optional link to your known holding.' },
  },
  required: ['variantId'],
  additionalProperties: false,
} as const;

export const tradeBlockTools: ToolDef[] = [
  {
    name: 'list_trade_block_posts',
    description:
      'Browse open Trade Block posts on the Crossly Market — WANTs (someone looking for an item) and OFFERs ' +
      '(items up for trade). Filter by `kind`, `categorySlug`, or a text `q`. Each post lists the items on the ' +
      'table and, for wants, the target item + any cash bounty.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['want', 'offer'],
          description:
            'Filter the board. `want` = the poster is looking for something; `offer` = the poster has items up for trade. Omit for both.',
        },
        categorySlug: { type: 'string', description: 'Filter to one Crossly Market category slug. Omit for every category.' },
        brand: { type: 'string', description: 'Filter to posts with a product of this brand (case-insensitive).' },
        model: { type: 'string', description: 'Filter to posts with a product of this catalogue model (case-insensitive).' },
        q: { type: 'string', description: 'Free-text search over post titles and want text.' },
        limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Max posts to return, 1–100. Defaults to 40.' },
        offset: { type: 'integer', minimum: 0, description: 'Rows to skip for paging. Defaults to 0.' },
      },
      additionalProperties: false,
    },
    handler: (args) => apiGet('/v1/trade-block/posts', args as Record<string, unknown>),
  },
  {
    name: 'list_my_trades',
    description: 'List the Trade Block trades you are a party to, newest first, with their status and cross-verification state.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/trade-block/trades', {}),
  },
  {
    name: 'create_trade_block_post',
    description:
      'RETIRED — always refused. Trades are listed by sellers as a listing in Trade mode (create a listing with ' +
      'platformOverrides.crossly.isTrade = "true", tradeItems and tradeWants), so the trade is tied to their inventory. ' +
      'Buyers respond to posts with an offer instead (create_trade_block_offer).',
    inputSchema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['want', 'offer'],
          description:
            '`want` = you are hunting something, and the post needs at least one of `target`, `wantText` or a non-zero ' +
            '`wantCashCents`. `offer` = you have things up for trade, and the post needs at least one entry in `items`.',
        },
        title: { type: 'string', description: 'Headline for the post, 1–140 characters.' },
        note: { type: 'string', description: 'Optional body text — terms, condition notes, what you are after. Up to 2000 characters.' },
        categorySlug: { type: 'string', description: 'Crossly Market category slug to file the post under, up to 40 characters.' },
        target: {
          type: 'object',
          description: 'WANT only: the specific market item you are hunting. Both `variantId` and `condition` are required here.',
          properties: {
            variantId: { type: 'string', description: 'Market variant UUID of the item you want.' },
            condition: { type: 'string', description: 'Condition code you will accept, e.g. DS.' },
            gradeKey: { type: 'string', description: 'Grade key, e.g. psa:10. Omit to accept any grade.' },
          },
          required: ['variantId', 'condition'],
          additionalProperties: false,
        },
        wantText: {
          type: 'string',
          description: 'WANT only: prose for what you are after when no single variant captures it. Up to 500 characters.',
        },
        wantCashCents: { type: 'integer', minimum: 0, description: 'Cash bounty added on top of a want, in cents.' },
        items: { type: 'array', items: ITEM_SCHEMA, description: 'Items the poster puts up.' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['kind', 'title'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/trade-block/posts', body, idempotencyKey);
    },
  },
  {
    name: 'create_trade_block_offer',
    description:
      'Respond to a post with a concrete swap: the items you give (`fromItems`, 0..N) and the items you want ' +
      'back (`toItems`, 0..N), plus optional cash (`cashCents` + `cashPayer`). At least one item must exist across ' +
      'the trade, and each side must bring value (items or cash) — this covers even swaps, boot, and cash ' +
      'bounties. On accept both parties pay the market fee and every item goes to authentication. Pass an ' +
      'idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        postId: { type: 'string', description: 'The post UUID to respond to.' },
        proposerStripePaymentMethodId: { type: 'string', description: 'Your saved card, charged your fee (+ cash) on accept.' },
        cashCents: {
          type: 'integer',
          minimum: 0,
          description:
            'Cash boot riding on top of the items, in US CENTS (integer, 0–100,000,000 — so $0.00 to $1,000,000.00). ' +
            '1000 means $10.00, not $1000. Defaults to 0; anything above 0 makes `cashPayer` required.',
        },
        cashPayer: {
          type: 'string',
          enum: ['responder', 'poster'],
          description:
            'Which side owes `cashCents`. `responder` = you, the one making this offer; `poster` = the person whose post ' +
            'you are answering (i.e. you are asking THEM for cash). Required whenever cashCents is above 0.',
        },
        note: { type: 'string', description: 'Optional message to the poster explaining the swap. Up to 2000 characters.' },
        fromItems: { type: 'array', items: ITEM_SCHEMA, description: 'Items you give.' },
        toItems: { type: 'array', items: ITEM_SCHEMA, description: 'Items you want from the poster.' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['postId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { postId, idempotencyKey, ...body } = args as Record<string, unknown> & { postId: string; idempotencyKey?: string };
      return apiPost(`/v1/trade-block/posts/${encodeURIComponent(postId)}/offers`, body, idempotencyKey);
    },
  },
  {
    name: 'respond_to_trade_block_offer',
    description:
      'Accept, decline, counter, or withdraw a Trade Block offer. `accept` charges both parties and opens the ' +
      'two auth intakes (pass your `stripePaymentMethodId` if you are the accepting party). `counter` opens a ' +
      'child offer with new cash terms over the same items. `withdraw` is for the party who made the offer; ' +
      '`decline` is for the party it is addressed to. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Offer UUID.' },
        action: {
          type: 'string',
          enum: ['accept', 'decline', 'counter', 'withdraw'],
          description:
            '`accept` — take the deal: charges BOTH parties the 9.5% market fee plus whatever cash their side owes, and ' +
            'opens an authentication intake per item. `decline` — refuse it (for the party the offer is addressed to). ' +
            '`counter` — open a child offer with new cash terms over the same items. `withdraw` — pull an offer you made.',
        },
        stripePaymentMethodId: { type: 'string', description: 'Your saved card (accept, or counter where you become the proposer).' },
        cashCents: {
          type: 'integer',
          minimum: 0,
          description:
            'Counter only: the replacement cash boot, in US CENTS (integer, 0–100,000,000). 1000 means $10.00. ' +
            'Omit to keep the cash terms of the offer you are countering.',
        },
        cashPayer: {
          type: 'string',
          enum: ['responder', 'poster'],
          description:
            'Counter only: which side owes the new `cashCents` — `responder` (whoever answered the post) or `poster` ' +
            '(whoever made it). Required when the countered amount is above 0 and the original offer named no payer.',
        },
        note: { type: 'string', description: 'Counter only: optional message carried on the counter-offer. Up to 2000 characters.' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id', 'action'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, idempotencyKey, action, stripePaymentMethodId, cashCents, cashPayer, note } =
        args as Record<string, unknown> & { id: string; idempotencyKey?: string; action: string };
      let body: Record<string, unknown>;
      if (action === 'accept') body = { action, stripePaymentMethodId };
      else if (action === 'counter') body = { action, cashCents, cashPayer, stripePaymentMethodId, note };
      else body = { action }; // decline | withdraw
      return apiPost(`/v1/trade-block/offers/${encodeURIComponent(id)}/respond`, body, idempotencyKey);
    },
  },
  {
    name: 'get_trade_block_post',
    description: 'Get one Trade Block post with its items and open-offer count.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Post UUID.' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiGet(`/v1/trade-block/posts/${encodeURIComponent(id)}`, {});
    },
  },
  {
    name: 'close_trade_block_post',
    description: 'Close one of your Trade Block posts so it stops taking offers.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Post UUID.' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiPost(`/v1/trade-block/posts/${encodeURIComponent(id)}/close`, {});
    },
  },
  {
    name: 'list_trade_block_evolutions',
    description:
      'List your Trade Evolution unlocks — completed swaps that unlocked a designer-authored evolved or set-master cosmetic you can mint by burning COSM.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/trade-block/evolutions', {}),
  },
  {
    name: 'claim_trade_block_evolution',
    description:
      'Burn COSM and mint the evolved (or set-master) NFT for one of your evolution unlocks. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Unlock UUID.' }, ...IDEMPOTENCY_PROP },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, idempotencyKey } = args as { id: string; idempotencyKey?: string };
      return apiPost(`/v1/trade-block/evolutions/${encodeURIComponent(id)}/claim`, {}, idempotencyKey);
    },
  },
  {
    name: 'create_trade_block_evolution_recipe',
    description:
      'Author a Trade Evolution recipe: a graded item (or a pair) that, when swapped, unlocks an evolved cosmetic you designed. Born unreviewed until ops approves.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'e.g. "Charizard + Blastoise → Charizard-EX (Holo)".' },
        note: { type: 'string', description: 'Optional note about the recipe, up to 2000 characters — ops reads this when reviewing it.' },
        inputA: {
          type: 'object',
          description: 'The required input: the item that must change hands in a completed swap for the unlock to fire.',
          properties: {
            variantId: { type: 'string', description: 'Market variant UUID of the input item.' },
            condition: { type: 'string', description: 'Condition code the input must be in. Omit to match any condition.' },
            gradeKey: { type: 'string', description: 'Grade key, e.g. psa:10. Omit to match any grade.' },
          },
          required: ['variantId'],
          additionalProperties: false,
        },
        inputB: {
          type: 'object',
          description: 'Optional second input — a two-item fusion.',
          properties: {
            variantId: { type: 'string' },
            condition: { type: 'string' },
            gradeKey: { type: 'string' },
          },
          required: ['variantId'],
          additionalProperties: false,
        },
        outputCosmeticId: { type: 'string', description: 'A cosmetic you designed, with a COSM price.' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['name', 'inputA', 'outputCosmeticId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/trade-block/evolution-recipes', body, idempotencyKey);
    },
  },
  {
    name: 'create_trade_block_set_recipe',
    description:
      'Author a set-completion recipe: a set of items (2–60) that, once a trader assembles the whole set through trading, unlocks a set-master cosmetic you designed. Born unreviewed until ops approves.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'e.g. "Gen-1 Starters — Master Set".' },
        note: { type: 'string', description: 'Optional note about the set, up to 2000 characters — ops reads this when reviewing it.' },
        members: {
          type: 'array',
          minItems: 2,
          maxItems: 60,
          description:
            'The items that make up the set — 2 to 60 of them. A trader unlocks the set-master cosmetic only once every ' +
            'member has been acquired through trading.',
          items: {
            type: 'object',
            properties: {
              variantId: { type: 'string', description: 'Market variant UUID of this set member.' },
              condition: { type: 'string', description: 'Condition code this member must be in. Omit to match any condition.' },
              gradeKey: { type: 'string', description: 'Grade key, e.g. psa:10. Omit to match any grade.' },
            },
            required: ['variantId'],
            additionalProperties: false,
          },
        },
        outputCosmeticId: { type: 'string', description: 'A set-master cosmetic you designed, with a COSM price.' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['name', 'members', 'outputCosmeticId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/trade-block/set-recipes', body, idempotencyKey);
    },
  },
];
