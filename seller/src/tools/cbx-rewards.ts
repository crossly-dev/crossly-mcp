import { cbxRewardAdCredit } from './cbx-rewards/ad-credit.js';
import { cbxRewardBalances } from './cbx-rewards/balances.js';
import { cbxRewardCredit } from './cbx-rewards/credit.js';
import { cbxRewardDisbursements } from './cbx-rewards/disbursements.js';
import { cbxRewardEarn } from './cbx-rewards/earn-boosts.js';
import { cbxRewardRedemptions } from './cbx-rewards/redemptions.js';
import { cbxRewardStaking } from './cbx-rewards/staking.js';
import { cbxRewardTierAdmin } from './cbx-rewards/tier-admin.js';
import { ToolDef } from './types.js';

/**
 * CBX rewards, staking, advertising, balances, and wholesale credit.
 *
 * Split from `cbx.ts` to stay under the repo's file-size cap, and
 * registered alongside it.
 *
 * ── WHAT AN AGENT MUST UNDERSTAND BEFORE USING THESE ──────────────────
 * Several of these commit money forward or move it, and the descriptions
 * say so rather than reading as neutral CRUD:
 *
 *   create_cbx_boost         commits a merchant's budget to cashback.
 *   stake_cbx                makes a user's balance UNSPENDABLE. It is
 *                            their money and this locks it.
 *   redeem_cbx_service       debits a user for a service.
 *   purchase_cbx_ad_credit   claims an advertising budget against a
 *                            token transfer. One signature, one claim.
 *   draw_cbx_credit          advances real value against a credit line.
 *   grant_cbx                issues spendable value out of the reserve.
 *
 * ── THE THREE BALANCES ────────────────────────────────────────────────
 * A subject can hold three, and they are not interchangeable:
 *
 *   EARNED     cashback. Withdrawable once matured.
 *   GRANTED    ad credit, wholesale draws, promos. Spendable in the
 *              marketplace ONLY — never withdrawable.
 *   CONNECTED  the user's own self-custodied CBX, via a bounded
 *              delegation. Never a platform liability.
 *
 * Spends always consume granted → earned → connected, and that order is
 * not configurable. Never tell a user their granted balance can be
 * withdrawn or cashed out; it cannot, by construction.
 *
 * ── AMOUNTS ───────────────────────────────────────────────────────────
 * Cents are plain integers. TOKEN amounts are decimal STRINGS of base
 * units, because a balance can exceed what a JSON number holds exactly.
 * Never convert a token amount through a float before displaying it.
 */
export const cbxRewardTools: ToolDef[] = [
  ...cbxRewardEarn,
  ...cbxRewardStaking,
  ...cbxRewardRedemptions,
  ...cbxRewardAdCredit,
  ...cbxRewardBalances,
  ...cbxRewardCredit,
  ...cbxRewardDisbursements,
  ...cbxRewardTierAdmin,
];
