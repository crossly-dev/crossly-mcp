import { cosmAttestations } from './cosm/attestations.js';
import { cosmAuction } from './cosm/auction.js';
import { cosmCosmetics } from './cosm/cosmetics.js';
import { cosmDesigner } from './cosm/designer.js';
import { cosmFusionHandles } from './cosm/fusion-handles.js';
import { cosmPegs } from './cosm/pegs.js';
import { cosmStorefront } from './cosm/storefront.js';
import { cosmSupply } from './cosm/supply.js';
import { cosmWithdrawals } from './cosm/withdrawals.js';
import { ToolDef } from './types.js';

/**
 * COSM — the metaverse cosmetics currency.
 *
 * ── DO NOT CONFUSE IT WITH CBX ────────────────────────────────────────
 * They are opposites, and describing one with the other's properties is
 * the most likely way an agent misleads somebody here:
 *
 *   CBX   fixed supply · backed by a reserve · spends RECIRCULATE
 *         · withdrawable once matured
 *   COSM  minted on demand · backed by NOTHING · spends BURN
 *         · not withdrawable at all yet
 *
 * ── AMOUNTS ARE STRINGS OF BASE UNITS WITH SIX DECIMALS ───────────────
 * `"10000000000"` is ten thousand COSM. They are strings because a JSON
 * number loses precision past 2^53 — about nine billion COSM. Never do
 * float arithmetic on them, and divide by 1e6 before showing a figure to
 * a person.
 *
 * ── WHAT AN AGENT MUST NOT MISREPRESENT ───────────────────────────────
 * COSM IS NOT WITHDRAWABLE AND IS NOT A YIELD. It is earned by ACTIVITY
 * — accepting CBX on a sale, selling, buying goods — and staking only
 * multiplies the RATE. There is no entitlement without activity, however
 * large a stake. If somebody asks whether they can stake COSM or CBX to
 * earn COSM passively, the answer is no, and that is deliberate rather
 * than a missing feature.
 *
 * THERE IS NO WAY TO CASH IT OUT TODAY. The withdrawal tools exist and
 * they REFUSE — `request_cosm_withdrawal` returns a 409 listing what is
 * outstanding. Call `get_cosm_withdrawals` and read `meta.open` before
 * offering it to anybody; do not call the request tool to discover that
 * it is closed.
 *
 * Do not tell anybody a market is coming on a date. It is gated on an
 * audited minter, a securities opinion, a money-transmission review and
 * the emission invariant proven under real volume, and NONE of those has
 * a timetable. "Not yet, and here is what has to happen first" is the
 * honest answer; a guessed quarter is not.
 *
 * A USER-TO-USER SEND DOES NOT EXIST AT ANY SETTING. If somebody asks to
 * send COSM to another user or to an address, that is not a thing this
 * API can do. The auction house moves COSM between users but only
 * through a matched listing for amounts derived from it.
 *
 * THE TIERS ARE DISJOINT. `premium` cosmetics cost CASH only, `earned`
 * cost COSM only, `stake_exclusive` cannot be bought at any price in any
 * currency. Never imply a premium item can be earned or that a
 * stake-exclusive one can be purchased.
 *
 * ── SPENDING COSM DESTROYS IT ─────────────────────────────────────────
 * Buying an earned cosmetic, a fusion cost and the auction fee all BURN.
 * Nothing is credited to Crossly. If a user asks where their COSM went,
 * the honest answer is that it no longer exists — that is what makes the
 * supply figures meaningful.
 */
export const cosmTools: ToolDef[] = [
  ...cosmSupply,
  ...cosmCosmetics,
  ...cosmAuction,
  ...cosmFusionHandles,
  ...cosmWithdrawals,
  ...cosmAttestations,
  ...cosmPegs,
  ...cosmStorefront,
  ...cosmDesigner,
];
