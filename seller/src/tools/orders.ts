import { orderActions } from './orders/actions.js';
import { orderBulk } from './orders/bulk.js';
import { orderFulfillment } from './orders/fulfillment.js';
import { orderWhatnot } from './orders/whatnot.js';
import { orderReads } from './orders/read.js';
import { ToolDef } from './types.js';

/**
 * Orders — the fulfillment side of a sale.
 *
 * ── TWO ID SPACES, AND THEY ARE NOT INTERCHANGEABLE ───────────────────
 * Every `id`/`orderIds` argument here is OUR order UUID (what list_orders
 * returns). The marketplace's own identifier is `platformOrderId` on the
 * row, and a third one — `platformCaseId` — exists for disputes. Passing
 * a marketplace id where a Crossly UUID is expected fails validation
 * with invalid_order_id rather than acting on the wrong order.
 *
 * ── AN ORDER'S MONEY LIVES ON `sales` ─────────────────────────────────
 * `orders` is the fulfillment lifecycle; the sale price, platform fee,
 * tax and shipping charged all live on the 1:1 `sales` row (see
 * packages/api/src/services/orders/money.ts). Those columns are DECIMAL
 * DOLLARS — "45.99" is $45.99 — as are the order's own labelCost and the
 * refund amount. The exceptions that really are CENTS are named for it:
 * get_order_shipments' totalLabelCostCents, and the requiredCents /
 * balanceCents a shipping-wallet shortfall reports.
 *
 * Split by section to keep each file under the 650-line limit; this
 * module stays the single import point.
 */
export const ordersTools: ToolDef[] = [
  ...orderReads,
  ...orderActions,
  ...orderBulk,
  ...orderFulfillment,
  ...orderWhatnot,
];
