/**
 * The tool registry — every endpoint this API exposes, in one array.
 *
 * ── WHY IT IS ITS OWN MODULE ─────────────────────────────────────────
 * `index.ts` is the MCP server's ENTRY POINT: it calls `main()` at the bottom,
 * so importing anything from it starts a server on stdio. `@crossly/cli`
 * generates its whole command tree from this list, and a CLI that spawned an
 * MCP server merely by asking "what commands exist?" would be a genuinely
 * confusing bug.
 *
 * So the data lives here and both frontends import it: the MCP server wraps
 * each entry as a tool, the CLI wraps each as a command. One definition,
 * two surfaces, no second list to keep in step.
 */
import { accountTools } from './tools/account.js';
import { actionLogTools } from './tools/action_log.js';
import { accountsTools } from './tools/accounts.js';
import { aiTools } from './tools/ai.js';
import { analyticsTools } from './tools/analytics.js';
import { automationTools } from './tools/automation.js';
import { compWatchlistsTools } from './tools/comp_watchlists.js';
import { inboxTools } from './tools/inbox.js';
import { inventoryTools } from './tools/inventory.js';
import { listingsTools } from './tools/listings.js';
import { magicTools } from './tools/magic.js';
import { mobileTools } from './tools/mobile.js';
import { ordersTools } from './tools/orders.js';
import { patTools } from './tools/pat.js';
import { connectedAppsTools } from './tools/connected_apps.js';
import { offersTools } from './tools/offers.js';
import { tradeBlockTools } from './tools/trade-block.js';
import { productionTools } from './tools/production.js';
import { gradingTools } from './tools/grading.js';
import { stallsTools } from './tools/stalls.js';
import { neighbourhoodsTools } from './tools/neighbourhoods.js';
import { homesTools } from './tools/homes.js';
import { reputationTools } from './tools/reputation.js';
import { worldLiveTools } from './tools/world-live.js';
import { dropsTools } from './tools/drops.js';
import { spatialEmotesTools } from './tools/spatial-emotes.js';
import { spatialPartyTools } from './tools/spatial-party.js';
import { gamesTools } from './tools/games.js';
import { worldTools } from './tools/world.js';
import { worldPlaceTools } from './tools/world-places.js';
import { worldConventionTools } from './tools/world-conventions.js';
import { spatialRoomTools } from './tools/spatial-rooms.js';
import { worldCreatorTools } from './tools/world-creator.js';
import { worldCapabilityTools } from './tools/world-capabilities.js';
import { worldContestTools } from './tools/world-contests.js';
import { worldGameTools } from './tools/world-games.js';
import { worldAccountTools } from './tools/world-account.js';
import { worldStreetTools } from './tools/world-streets.js';
import { worldSpaceTools } from './tools/world-spaces.js';
import { worldPartyTools } from './tools/world-parties.js';
import { worldHomeTools } from './tools/world-homes.js';
import { worldHuntTools } from './tools/world-hunt.js';
import { worldWishesTools } from './tools/world-wishes.js';
import { worldFirefliesTools } from './tools/world-fireflies.js';
import { worldLanternsTools } from './tools/world-lanterns.js';
import { worldKitesTools } from './tools/world-kites.js';
import { worldHallTools } from './tools/world-hall.js';
import { worldAuroraTools } from './tools/world-aurora.js';
import { worldGrailsTools } from './tools/world-grails.js';
import { worldProvenanceTools } from './tools/world-provenance.js';
import { worldChestsTools } from './tools/world-chests.js';
import { worldTrialsTools } from './tools/world-trials.js';
import { worldArcadeTools } from './tools/world-arcade.js';
import { nftMarketTools } from './tools/nft-market.js';
import { web3Tools } from './tools/web3.js';
import { web3LaunchpadTools } from './tools/web3-launchpad.js';
import { web3LaunchToolsTools } from './tools/web3-launch-tools.js';
import { web3WorldLiveTools } from './tools/web3-world-live.js';
import { web3BookTools } from './tools/web3-book.js';
import { web3CrossListTools } from './tools/web3-crosslist.js';
import { vaultMarketsTools } from './tools/vault-markets.js';
import { vaultMarketsProTools } from './tools/vault-markets-pro.js';
import { vaultMarketsLiquidityTools } from './tools/vault-markets-liquidity.js';
import { vaultMarketsCreditTools } from './tools/vault-markets-credit.js';
import { vaultMarketsAnalyticsTools } from './tools/vault-markets-analytics.js';
import { vaultMarketsOpsTools } from './tools/vault-markets-ops.js';
import { vaultMarketsGradingTools } from './tools/vault-markets-grading.js';
import { vaultMarketsSocialTools } from './tools/vault-markets-social.js';
import { vaultMarketsChannelsTools } from './tools/vault-markets-channels.js';
import { vaultMarketsSupplyTools } from './tools/vault-markets-supply.js';
import { vaultMarketsStatsTools } from './tools/vault-markets-stats.js';
import { vaultMarketsIndexTools } from './tools/vault-markets-index.js';
import { vaultMarketsTitleTools } from './tools/vault-markets-title.js';
import { vaultMarketsInstTools } from './tools/vault-markets-inst.js';
import { vaultMarketsMmTools } from './tools/vault-markets-mm.js';
import { vaultMarketsAdlTools } from './tools/vault-markets-adl.js';
import { vaultMarketsCurvePoolsTools } from './tools/vault-markets-curve-pools.js';
import { vaultMarketsBullionTools } from './tools/vault-markets-bullion.js';
import { vaultMarketsP2pTools } from './tools/vault-markets-p2p.js';
import { vaultMarketsReceiptTokensTools } from './tools/vault-markets-receipt-tokens.js';
import { vaultMarketsMarksTools } from './tools/vault-markets-marks.js';
import { vaultMarketsPmTools } from './tools/vault-markets-pm.js';
import { vaultMarketsOracleDcmTools } from './tools/vault-markets-oracle-dcm.js';
import { vaultMarketsReportsTools } from './tools/vault-markets-reports.js';
import { vaultMarketsWorldTools } from './tools/vault-markets-world.js';
import { vaultMarketsGradeToVaultTools } from './tools/vault-markets-grade-to-vault.js';
import { vaultMarketsHallTools } from './tools/vault-markets-hall.js';
import { vaultMarketsAgentTools } from './tools/vault-markets-agent.js';
import { vaultMarketsPaperTools } from './tools/vault-markets-paper.js';
import { vaultMarketsModeTools } from './tools/vault-markets-mode.js';
import { vaultMarketsUnitStoryTools } from './tools/vault-markets-unit-story.js';
import { vaultMarketsAlertsHubTools } from './tools/vault-markets-alerts-hub.js';
import { vaultMarketsFollowsTools } from './tools/vault-markets-follows.js';
import { vaultMarketsFloorTools } from './tools/vault-markets-floor.js';
import { vaultMarketsSetGoalsTools } from './tools/vault-markets-set-goals.js';
import { vaultMarketsValuationTools } from './tools/vault-markets-valuation.js';
import { vaultMarketsJointTodTools } from './tools/vault-markets-joint-tod.js';
import { vaultMarketsMissionsTools } from './tools/vault-markets-missions.js';
import { vaultMarketsVaultSuggestTools } from './tools/vault-markets-vault-suggest.js';
import { vaultMarketsHealthTools } from './tools/vault-markets-health.js';
import { vaultMarketsTaxLossTools } from './tools/vault-markets-tax-loss.js';
import { vaultMarketsHomeTools } from './tools/vault-markets-home.js';
import { vaultMarketsPriceWidgetsTools } from './tools/vault-markets-price-widgets.js';
import { vaultMarketsPopReportTools } from './tools/vault-markets-pop-reports.js';
import { vaultMarketsWidgetTools } from './tools/vault-markets-widget.js';
import { policyPresetsTools } from './tools/policy-presets.js';
import { storefrontShippingTools } from './tools/storefront-shipping.js';
import { brandDropsTools } from './tools/brand-drops.js';
import { deviceTools } from './tools/devices.js';
import { unitsTools } from './tools/units.js';
import { evidenceTools } from './tools/evidence.js';
import { spatialTools } from './tools/spatial.js';
import { spatialAuctionTools } from './tools/spatial-auction.js';
import { spatialEmployeeTools } from './tools/spatial-employee.js';
import { wholesaleTools } from './tools/wholesale.js';
import { payoutTools } from './tools/payout.js';
import { cbxTools } from './tools/cbx.js';
import { cbxRewardTools } from './tools/cbx-rewards.js';
import { adsTools } from './tools/ads.js';
import { cbxOpsTools } from './tools/cbx-ops.js';
import { cosmTools } from './tools/cosm.js';
import { daoTools } from './tools/dao.js';
import { cbxWalletPaymentTools } from './tools/cbx-wallet-payments.js';
import { variationGroupTools } from './tools/variation_groups.js';
import { referenceTools } from './tools/reference.js';
import { restockTools } from './tools/restock.js';
import { returnsTools } from './tools/returns.js';
import { customersTools } from './tools/customers.js';
import { importsTools } from './tools/imports.js';
import { catalogMatchesTools } from './tools/catalog-matches.js';
import { salesTools } from './tools/sales.js';
import { savedViewsTools } from './tools/saved_views.js';
import { sourcingTools } from './tools/sourcing.js';
import { taxTools } from './tools/tax.js';
import { taxonomyTools } from './tools/taxonomy.js';
import { catalogLookupTools } from './tools/catalog-lookup.js';
import { marketTools } from './tools/market.js';
import { embedsTools } from './tools/embeds.js';
import { buyerTools } from './tools/buyer.js';
import { buyerLiveTools } from './tools/buyer-live.js';
import { buyerGiftCardTools } from './tools/buyer-gift-cards.js';
import { buyerXmarketTools } from './tools/buyer-xmarket.js';
import { buyerXmarketExtraTools } from './tools/buyer-xmarket-extras.js';
import { buyerPackTools } from './tools/buyer-packs.js';
import { buyerW7Tools } from './tools/buyer-w7.js';
import { passportTools } from './tools/passports.js';
import { liveShowTools } from './tools/live-shows.js';
import { friendsBoardsClubsTools } from './tools/friends-boards-clubs.js';
import { buyerWave3Tools } from './tools/buyer-wave3.js';
import { sellerXmarketTools } from './tools/seller-xmarket.js';
import { sellerOpsTools } from './tools/seller-ops.js';
import { repriceTools } from './tools/reprice.js';
import { fulfillmentTools } from './tools/fulfillment.js';
import { buyerCommerceTools } from './tools/buyer-commerce.js';
import { buyerOrderTools } from './tools/buyer-orders.js';
import { buyerListTools } from './tools/buyer-lists.js';
import { scanTools } from './tools/scan.js';
import { teamTools } from './tools/team.js';
import { templatesTools } from './tools/templates.js';
import { webhooksTools } from './tools/webhooks.js';
import type { ToolDef } from './tools/types.js';

const TOOL_DOMAINS: ToolDef[][] = [
  inventoryTools,
  listingsTools,
  ordersTools,
  returnsTools,
  customersTools,
  salesTools,
  inboxTools,
  analyticsTools,
  accountsTools,
  accountTools,
  automationTools,
  webhooksTools,
  referenceTools,
  aiTools,
  importsTools,
  catalogMatchesTools,
  templatesTools,
  taxTools,
  taxonomyTools,
  catalogLookupTools,
  marketTools,
  embedsTools,
  buyerTools,
  buyerLiveTools,
  buyerGiftCardTools,
  buyerXmarketTools,
  buyerXmarketExtraTools,
  buyerPackTools,
  buyerW7Tools,
  passportTools,
  liveShowTools,
  friendsBoardsClubsTools,
  buyerWave3Tools,
  sellerXmarketTools,
  sellerOpsTools,
  repriceTools,
  fulfillmentTools,
  buyerCommerceTools,
  buyerOrderTools,
  buyerListTools,
  scanTools,
  patTools,
  connectedAppsTools,
  magicTools,
  compWatchlistsTools,
  restockTools,
  savedViewsTools,
  mobileTools,
  teamTools,
  sourcingTools,
  actionLogTools,
  offersTools,
  tradeBlockTools,
  productionTools,
  gradingTools,
  stallsTools,
  neighbourhoodsTools,
  homesTools,
  reputationTools,
  worldLiveTools,
  dropsTools,
  spatialEmotesTools,
  spatialPartyTools,
  gamesTools,
  worldTools,
  worldPlaceTools,
  worldConventionTools,
  spatialRoomTools,
  worldCreatorTools,
  worldCapabilityTools,
  worldContestTools,
  worldGameTools,
  worldAccountTools,
  worldStreetTools,
  worldSpaceTools,
  worldPartyTools,
  worldHomeTools,
  worldHuntTools,
  worldWishesTools,
  worldFirefliesTools,
  worldLanternsTools,
  worldKitesTools,
  worldHallTools,
  worldAuroraTools,
  worldGrailsTools,
  worldProvenanceTools,
  worldChestsTools,
  worldTrialsTools,
  worldArcadeTools,
  nftMarketTools,
  web3Tools,
  web3LaunchpadTools,
  web3LaunchToolsTools,
  web3WorldLiveTools,
  web3BookTools,
  web3CrossListTools,
  vaultMarketsTools,
  vaultMarketsProTools,
  vaultMarketsLiquidityTools,
  vaultMarketsCreditTools,
  vaultMarketsAnalyticsTools,
  vaultMarketsOpsTools,
  vaultMarketsGradingTools,
  vaultMarketsSocialTools,
  vaultMarketsChannelsTools,
  vaultMarketsSupplyTools,
  vaultMarketsStatsTools,
  vaultMarketsIndexTools,
  vaultMarketsTitleTools,
  vaultMarketsInstTools,
  vaultMarketsMmTools,
  vaultMarketsAdlTools,
  vaultMarketsCurvePoolsTools,
  vaultMarketsBullionTools,
  vaultMarketsP2pTools,
  vaultMarketsReceiptTokensTools,
  vaultMarketsMarksTools,
  vaultMarketsPmTools,
  vaultMarketsOracleDcmTools,
  vaultMarketsReportsTools,
  vaultMarketsWorldTools,
  vaultMarketsGradeToVaultTools,
  vaultMarketsHallTools,
  vaultMarketsAgentTools,
  vaultMarketsPaperTools,
  vaultMarketsModeTools,
  vaultMarketsUnitStoryTools,
  vaultMarketsAlertsHubTools,
  vaultMarketsFollowsTools,
  vaultMarketsFloorTools,
  vaultMarketsSetGoalsTools,
  vaultMarketsValuationTools,
  vaultMarketsJointTodTools,
  vaultMarketsMissionsTools,
  vaultMarketsVaultSuggestTools,
  vaultMarketsHealthTools,
  vaultMarketsTaxLossTools,
  vaultMarketsHomeTools,
  vaultMarketsPriceWidgetsTools,
  vaultMarketsPopReportTools,
  vaultMarketsWidgetTools,
  policyPresetsTools,
  storefrontShippingTools,
  brandDropsTools,
  deviceTools,
  unitsTools,
  evidenceTools,
  spatialTools,
  spatialAuctionTools,
  spatialEmployeeTools,
  wholesaleTools,
  payoutTools,
  cbxTools,
  cbxRewardTools,
  adsTools,
  cbxOpsTools,
  cosmTools,
  daoTools,
  cbxWalletPaymentTools,
  variationGroupTools,
];

/**
 * Every tool, flattened.
 *
 * Not only an MCP concern: `@crossly/cli` generates its entire command tree
 * from exactly this array, so one definition serves both surfaces and neither
 * can drift from the other.
 */
export const ALL_TOOLS: ToolDef[] = TOOL_DOMAINS.flat();

export type { ToolDef } from './tools/types.js';
