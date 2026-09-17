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
import { policyPresetsTools } from './tools/policy-presets.js';
import { deviceTools } from './tools/devices.js';
import { unitsTools } from './tools/units.js';
import { evidenceTools } from './tools/evidence.js';
import { spatialTools } from './tools/spatial.js';
import { wholesaleTools } from './tools/wholesale.js';
import { payoutTools } from './tools/payout.js';
import { cbxTools } from './tools/cbx.js';
import { cbxRewardTools } from './tools/cbx-rewards.js';
import { adsTools } from './tools/ads.js';
import { cbxWalletPaymentTools } from './tools/cbx-wallet-payments.js';
import { variationGroupTools } from './tools/variation_groups.js';
import { referenceTools } from './tools/reference.js';
import { restockTools } from './tools/restock.js';
import { returnsTools } from './tools/returns.js';
import { customersTools } from './tools/customers.js';
import { importsTools } from './tools/imports.js';
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
  templatesTools,
  taxTools,
  taxonomyTools,
  catalogLookupTools,
  marketTools,
  embedsTools,
  buyerTools,
  buyerLiveTools,
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
  policyPresetsTools,
  deviceTools,
  unitsTools,
  evidenceTools,
  spatialTools,
  wholesaleTools,
  payoutTools,
  cbxTools,
  cbxRewardTools,
  adsTools,
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
