import { apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Checkout paid from the buyer's own wallet.
 *
 * ── WHAT AN AGENT MUST UNDERSTAND ─────────────────────────────────────
 * The flow is three steps and only two of them are ours:
 *
 *   quote_cbx_wallet_payment    we build an unsigned transfer
 *   (the buyer's wallet)        they sign and submit it
 *   confirm_cbx_wallet_payment  they hand us the signature
 *
 * We never hold a key or a delegation and never submit anything, so the
 * platform has no authority over the buyer's tokens at any point.
 *
 * ── A QUOTE IS NOT A PAYMENT ──────────────────────────────────────────
 * Quoting reserves nothing and records nothing. Never tell a user their
 * order is paid because a quote succeeded — the buyer may never sign it.
 * The SIGNATURE is the event.
 *
 * ── `releaseDecision` IS ABOUT THE GOODS, NOT THE MONEY ───────────────
 * By the time a signature exists the tokens have moved and cannot be
 * un-moved. So the decision is only whether to ship:
 *
 *   release  ship it
 *   review   hold — a person must look. Also what you get when no
 *            screening provider is configured.
 *   refuse   do not ship. The payment is STILL RECORDED, because we
 *            received the tokens and that does not go away.
 *
 * A `refuse` is not "the payment failed" and must never be described
 * that way to a buyer — their tokens are gone and they are owed either
 * goods or a refund decision from a human.
 */
export const cbxWalletPaymentTools: ToolDef[] = [
  {
    name: 'quote_cbx_wallet_payment',
    description:
      'Build an unsigned transfer for a buyer to sign with their own wallet. '
      + 'RESERVES NOTHING and RECORDS NOTHING — no row, no hold, no balance change. Do not '
      + 'tell anyone their order is paid on the strength of a quote; the buyer may never '
      + 'sign it. '
      + '`lastValidBlockHeight` is when it expires: a wallet prompt left open for a couple '
      + 'of minutes yields a transaction the chain rejects, so re-quote rather than retry. '
      + '`payerCanCover` is a courtesy balance read so you can warn before the prompt — null '
      + 'means we could not read it, which is NOT the same as "no". '
      + 'The buyer needs no prior wallet registration: a payment proves control of the '
      + 'tokens, which is what a connect step would have been proving.',
    inputSchema: {
      type: 'object',
      properties: {
        payerAddress: {
          type: 'string',
          description:
            "The buyer's wallet address. They will sign the transfer themselves; no prior "
            + 'registration or verification is required.',
        },
        valueCents: {
          type: 'integer',
          description:
            'What the order costs, in CENTS. Converted to a token amount at the live spot. '
            + 'Pass dollars, never a token quantity — a client naming the quantity could pay '
            + 'whatever it liked for a fixed-price order.',
        },
      },
      required: ['payerAddress', 'valueCents'],
    },
    handler: (args) => apiPost('/v1/cbx/wallet-payments/quote', args),
  },
  {
    name: 'confirm_cbx_wallet_payment',
    description:
      'Present the signature of a transfer the buyer already made, and get a ship / '
      + 'do-not-ship decision. '
      + 'Everything is read from the CHAIN at finalized commitment — amount, payer, '
      + 'destination. Nothing asserted in the request is trusted. '
      + 'Read `releaseDecision` before telling anyone anything: `release` means ship, '
      + '`review` means a person must look (including when no screening provider is '
      + 'configured), `refuse` means do not ship. '
      + 'A `refuse` is NOT "the payment failed" — the tokens moved and the buyer is owed '
      + 'either goods or a refund decision from a human. Never describe it as a failed '
      + 'payment. '
      + 'Idempotent on txSig globally and on (merchant, externalId). A 409 means it has not '
      + 'finalized yet and you should retry; a 400 means it never will be claimable.',
    inputSchema: {
      type: 'object',
      properties: {
        externalId: {
          type: 'string',
          description: "The merchant's order id. Idempotency key — one order is paid once.",
        },
        txSig: {
          type: 'string',
          description:
            'Signature of the transfer the buyer signed and submitted. Claimable exactly '
            + 'once across every merchant and order.',
        },
        subjectId: {
          type: 'string',
          description:
            'The paying subject, when they are a known user. Optional — a payment does not '
            + 'require an account.',
        },
        valueCents: {
          type: 'integer',
          description:
            'What the order costs, in CENTS. Used for the review ceiling on large orders. '
            + 'Omit to use the value read from the chain.',
        },
      },
      required: ['externalId', 'txSig'],
    },
    handler: (args) => apiPost('/v1/cbx/wallet-payments/confirm', args),
  },
  {
    name: 'list_cbx_wallet_payments_for_review',
    description:
      'Payments held for a human — the ops queue. Every row is money taken and goods not '
      + 'shipped, which is not a state to leave a buyer in quietly. '
      + '`riskLevel` and `riskExposures` are the verdict as recorded at the time, not '
      + 're-derived: asking a provider again later answers a different question than the one '
      + 'already decided. '
      + 'When summarising, lead with how long each has been waiting — a buyer who paid and '
      + 'received nothing is the most urgent case in this system.',
    inputSchema: { type: 'object', properties: {} },
    handler: () => apiGet('/v1/cbx/wallet-payments/review'),
  },
  {
    name: 'resolve_cbx_wallet_payment',
    description:
      'Record a human decision on a held payment. RELEASES OR REFUSES MERCHANDISE against a '
      + 'payment somebody flagged — confirm the person actually reviewed it before calling. '
      + 'Only moves a payment OUT of `review`, never between the other two: a refusal that '
      + 'could later be flipped to a release is an approval control with no teeth, and a '
      + 'release re-decided as a refusal after shipping is a record that no longer describes '
      + 'what happened. '
      + 'The reviewer and note are stored, because this is the decision somebody will be '
      + 'asked to justify.',
    inputSchema: {
      type: 'object',
      properties: {
        paymentId: {
          type: 'string',
          description: 'The held payment, from list_cbx_wallet_payments_for_review.',
        },
        decision: {
          type: 'string',
          enum: ['release', 'refuse'],
          description:
            'release ships the goods; refuse does not. There is no path back to review, and '
            + 'neither decision can be overwritten by a later call.',
        },
        note: {
          type: 'string',
          description:
            'Why. Stored on the row alongside the reviewer, and this is the text somebody '
            + 'reads when asked to justify the call.',
        },
      },
      required: ['paymentId', 'decision', 'note'],
    },
    handler: (args) => {
      const { paymentId, ...body } = args as { paymentId: string };
      return apiPost(
        `/v1/cbx/wallet-payments/${encodeURIComponent(paymentId)}/resolve`,
        body,
      );
    },
  },
];
