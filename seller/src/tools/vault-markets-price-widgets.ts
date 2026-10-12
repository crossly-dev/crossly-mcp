import { apiDelete, apiGet, apiPatch, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Vault Markets: embeddable price widgets for creators (api
 * routes/v1/write/vault-markets-widgets.ts). A widget shows one vault
 * market's mark or one public Crossly index's level on the user's own page,
 * through an iframe or a script tag, with a link back through their own
 * affiliate code when they have an eligible one. Every number comes from the
 * Crossly order book when the widget is viewed. Nothing here trades, stores a
 * price or moves money.
 */
const widgetId = { type: 'string', description: 'The widget id (uuid), from list_vault_price_widgets or create_vault_price_widget.' };
const range = { type: 'string', enum: ['1m', '3m', '6m', '1y', '5y'], description: 'History shown in the chart and the move: "1m", "3m" (the default), "6m", "1y" or "5y".' };
const layout = { type: 'string', enum: ['compact', 'chart'], description: '"compact" = the value, move and source only (340x132); "chart" = with a sparkline (340x214, the default).' };
const theme = { type: 'string', enum: ['auto', 'light', 'dark'], description: '"auto" follows the reader light or dark setting (the default); "light" or "dark" fixes it.' };
const name = { type: 'string', description: 'The user own label for the widget, up to 80 characters. Defaults to the market or index name.' };
const affiliateCodeId = { type: ['string', 'null'], description: 'One of the user own active affiliate codes (uuid, from list_vault_price_widgets meta.codes) for the link back; null for none. A seller shop code is refused.' };
const allowedOrigins = { type: 'array', items: { type: 'string' }, maxItems: 20, description: 'Sites allowed to show the widget, e.g. ["https://blog.example.com"]. Empty = any site.' };
const kind = { type: 'string', enum: ['mark', 'index'], description: '"mark" = one vault market (give bookKey); "index" = one public Crossly index (give indexSlug).' };
const bookKey = { type: 'string', description: 'The vault market as variantId:condition:gradeKey (gradeKey "-" when ungraded). Required when kind is "mark".' };
const indexSlug = { type: 'string', description: 'A public index slug, e.g. "crossly-50". Required when kind is "index".' };

export const vaultMarketsPriceWidgetsTools: ToolDef[] = [
  {
    name: 'list_vault_price_widgets',
    description: 'The user price widgets, newest first, each with its iframe and script-tag snippets to paste. meta.codes lists the affiliate codes a widget can link through; meta.max is the cap on live widgets.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/price-widgets', {}),
  },
  {
    name: 'create_vault_price_widget',
    description: 'Make an embeddable price widget for one vault market or one public index. Returns the widget with its iframe and script-tag snippets. Prices shown are always read from the Crossly order book.',
    inputSchema: {
      type: 'object',
      properties: { kind, bookKey, indexSlug, name, range, layout, theme, affiliateCodeId, allowedOrigins },
      required: ['kind'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { kind: k, bookKey: key, indexSlug: slug, name: n, range: r, layout: l, theme: t, affiliateCodeId: code, allowedOrigins: sites } = args as {
        kind: string; bookKey?: string; indexSlug?: string; name?: string; range?: string; layout?: string; theme?: string; affiliateCodeId?: string | null; allowedOrigins?: string[];
      };
      return apiPost('/v1/vault-markets/price-widgets', { kind: k, bookKey: key, indexSlug: slug, name: n, range: r, layout: l, theme: t, affiliateCodeId: code, allowedOrigins: sites });
    },
  },
  {
    name: 'preview_vault_price_widget',
    description: 'What a widget would show before saving it: the value, move, quality, n, as-of and link back, plus the exact HTML of its frame. Nothing is stored.',
    inputSchema: {
      type: 'object',
      properties: { kind, bookKey, indexSlug, name, range, layout, theme, affiliateCodeId },
      required: ['kind'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { kind: k, bookKey: key, indexSlug: slug, name: n, range: r, layout: l, theme: t, affiliateCodeId: code } = args as {
        kind: string; bookKey?: string; indexSlug?: string; name?: string; range?: string; layout?: string; theme?: string; affiliateCodeId?: string | null;
      };
      return apiPost('/v1/vault-markets/price-widgets/preview', { kind: k, bookKey: key, indexSlug: slug, name: n, range: r, layout: l, theme: t, affiliateCodeId: code });
    },
  },
  {
    name: 'get_vault_price_widget',
    description: 'One of the user price widgets, with its snippets and URLs.',
    inputSchema: { type: 'object', properties: { widgetId }, required: ['widgetId'], additionalProperties: false },
    handler: (args) => {
      const { widgetId: id } = args as { widgetId: string };
      return apiGet(`/v1/vault-markets/price-widgets/${encodeURIComponent(id)}`, {});
    },
  },
  {
    name: 'update_vault_price_widget',
    description: 'Change a widget: name, range, layout, theme, affiliate code (null for none) or allowed sites. The market or index it shows never changes; make a new widget for another.',
    inputSchema: {
      type: 'object',
      properties: { widgetId, name, range, layout, theme, affiliateCodeId, allowedOrigins },
      required: ['widgetId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { widgetId: id, name: n, range: r, layout: l, theme: t, affiliateCodeId: code, allowedOrigins: sites } = args as {
        widgetId: string; name?: string; range?: string; layout?: string; theme?: string; affiliateCodeId?: string | null; allowedOrigins?: string[];
      };
      return apiPatch(`/v1/vault-markets/price-widgets/${encodeURIComponent(id)}`, { name: n, range: r, layout: l, theme: t, affiliateCodeId: code, allowedOrigins: sites });
    },
  },
  {
    name: 'delete_vault_price_widget',
    description: 'Delete a widget. Pages that still paste it show that it is no longer available.',
    inputSchema: { type: 'object', properties: { widgetId }, required: ['widgetId'], additionalProperties: false },
    handler: (args) => {
      const { widgetId: id } = args as { widgetId: string };
      return apiDelete(`/v1/vault-markets/price-widgets/${encodeURIComponent(id)}`);
    },
  },
];
