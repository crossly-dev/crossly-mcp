import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

/**
 * What a public Crossly World room shows a visitor, by its public slug:
 * offers, the shop, bundle deals, drops, trades, the live sale, collection
 * rooms, item interest, your have/want radar, trade tables and boards. Read-only.
 */
export const worldPlaceTools: ToolDef[] = [
  {
    name: 'list_world_place_offers',
    description: "What is for sale in a public Crossly World room, by its public slug: price, condition, stock and market references.",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', minLength: 1, maxLength: 64, description: 'The room public slug.' } }, required: ['slug'], additionalProperties: false },
    handler: (args) => {
      const { slug } = args as { slug: string };
      return apiGet(`/v1/world/places/${encodeURIComponent(slug)}/offers`, {});
    },
  },
  {
    name: 'get_world_place_seller',
    description: "The shop whose public Crossly World room this is (username and name), or null.",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', minLength: 1, maxLength: 64, description: 'The room public slug.' } }, required: ['slug'], additionalProperties: false },
    handler: (args) => {
      const { slug } = args as { slug: string };
      return apiGet(`/v1/world/places/${encodeURIComponent(slug)}/seller`, {});
    },
  },
  {
    name: 'list_world_place_bundles',
    description: "The room owner's bundle deals mapped onto a public room's items. itemIds null means any N items from the shop.",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', minLength: 1, maxLength: 64, description: 'The room public slug.' } }, required: ['slug'], additionalProperties: false },
    handler: (args) => {
      const { slug } = args as { slug: string };
      return apiGet(`/v1/world/places/${encodeURIComponent(slug)}/bundles`, {});
    },
  },
  {
    name: 'get_world_place_drop',
    description: "The room owner's next drop (name, cover, time, live) and how many people are waiting in the room.",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', minLength: 1, maxLength: 64, description: 'The room public slug.' } }, required: ['slug'], additionalProperties: false },
    handler: (args) => {
      const { slug } = args as { slug: string };
      return apiGet(`/v1/world/places/${encodeURIComponent(slug)}/drop`, {});
    },
  },
  {
    name: 'list_world_place_trades',
    description: "Items in a public Crossly World room that are open to trades, each with its trade post path.",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', minLength: 1, maxLength: 64, description: 'The room public slug.' } }, required: ['slug'], additionalProperties: false },
    handler: (args) => {
      const { slug } = args as { slug: string };
      return apiGet(`/v1/world/places/${encodeURIComponent(slug)}/trades`, {});
    },
  },
  {
    name: 'get_world_place_live',
    description: "The room owner's live sale in Crossly World: their stream and the lot on the block, or null.",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', minLength: 1, maxLength: 64, description: 'The room public slug.' } }, required: ['slug'], additionalProperties: false },
    handler: (args) => {
      const { slug } = args as { slug: string };
      return apiGet(`/v1/world/places/${encodeURIComponent(slug)}/live`, {});
    },
  },
  {
    name: 'get_world_place_shop_pet',
    description: "A shop room's pet kind, or null.",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', minLength: 1, maxLength: 64, description: 'The room public slug.' } }, required: ['slug'], additionalProperties: false },
    handler: (args) => {
      const { slug } = args as { slug: string };
      return apiGet(`/v1/world/places/${encodeURIComponent(slug)}/shop-pet`, {});
    },
  },
  {
    name: 'list_world_place_collections',
    description: "The room owner's collection rooms: one per category, brand and model they collect.",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', minLength: 1, maxLength: 64, description: 'The room public slug.' } }, required: ['slug'], additionalProperties: false },
    handler: (args) => {
      const { slug } = args as { slug: string };
      return apiGet(`/v1/world/places/${encodeURIComponent(slug)}/collections`, {});
    },
  },
  {
    name: 'get_world_place_collection',
    description: "One collection room in Crossly World: every piece of the set, owned or missing. Category, brand and model are lowercase slugs.",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', minLength: 1, maxLength: 64, description: 'The room public slug.' }, category: { type: 'string', maxLength: 160, description: 'Category slug.' }, brand: { type: 'string', maxLength: 160, description: 'Brand slug.' }, model: { type: 'string', maxLength: 160, description: 'Model slug.' } }, required: ['slug', 'category', 'brand', 'model'], additionalProperties: false },
    handler: (args) => {
      const { slug, category, brand, model } = args as { slug: string; category: string; brand: string; model: string };
      return apiGet(`/v1/world/places/${encodeURIComponent(slug)}/collections/${encodeURIComponent(category)}/${encodeURIComponent(brand)}/${encodeURIComponent(model)}`, {});
    },
  },
  {
    name: 'get_world_place_item_interest',
    description: "How many people looked at one item in a public Crossly World room today.",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', minLength: 1, maxLength: 64, description: 'The room public slug.' }, itemId: { type: 'string', format: 'uuid', description: 'The item.' } }, required: ['slug', 'itemId'], additionalProperties: false },
    handler: (args) => {
      const { slug, itemId } = args as { slug: string; itemId: string };
      return apiGet(`/v1/world/places/${encodeURIComponent(slug)}/items/${encodeURIComponent(itemId)}/interest`, {});
    },
  },
  {
    name: 'list_world_place_radar',
    description: "Your have/want radar in a Crossly World room: what you have that someone here wants, and what is here that you want, matched on catalog ids.",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', minLength: 1, maxLength: 64, description: 'The room public slug.' } }, required: ['slug'], additionalProperties: false },
    handler: (args) => {
      const { slug } = args as { slug: string };
      return apiGet(`/v1/world/places/${encodeURIComponent(slug)}/radar`, {});
    },
  },
  {
    name: 'list_world_place_trade_tables',
    description: "The open trade tables in a Crossly World place: who is sitting and what is laid on the mat.",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', minLength: 1, maxLength: 64, description: 'The room public slug.' } }, required: ['slug'], additionalProperties: false },
    handler: (args) => {
      const { slug } = args as { slug: string };
      return apiGet(`/v1/world/places/${encodeURIComponent(slug)}/trade-tables`, {});
    },
  },
  {
    name: 'get_world_place_boards',
    description: "The Trade Floor's wall of wants and its authentication desk (only the trade-floor place has them).",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', minLength: 1, maxLength: 64, description: 'The room public slug.' } }, required: ['slug'], additionalProperties: false },
    handler: (args) => {
      const { slug } = args as { slug: string };
      return apiGet(`/v1/world/places/${encodeURIComponent(slug)}/boards`, {});
    },
  },
];
