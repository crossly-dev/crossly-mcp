import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Pets and live events in Crossly World. Pets (a cat, a dog, a slab-carrying
 * robot) are earned through quests and reputation levels and never sold. The
 * Main Stage hosts brand launches, creator meetups and festival shows; a
 * festival is a weekend when every street wears one decor and a limited quest
 * line counts. Read-only here.
 */
export const worldLiveTools: ToolDef[] = [
  {
    name: 'get_my_pets',
    description:
      'Your Crossly World pets: every kind with whether you own it and the ways to earn it (a quest or a reputation level -- pets are never sold), ' +
      'the pet walking beside you, and the one greeting visitors at your shop door.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/pets/mine', {}),
  },
  {
    name: 'get_main_stage',
    description:
      'The Crossly World Main Stage right now: the live show and its host lineup, the stream on its big screen while a lineup host is on air, ' +
      'how many people are there, and what is on next.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/main-stage', {}),
  },
  {
    name: 'list_main_stage_events',
    description: 'Live and upcoming Main Stage events, soonest first: brand launches, creator meetups, talks, live sales and festival shows, each with its window and lineup.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/main-stage/events', {}),
  },
  {
    name: 'list_festivals',
    description: 'Live and upcoming Crossly World festivals, soonest first: when every street wears the festival decor and the festival quest line counts. meta.live is the one on now.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/festivals', {}),
  },
  {
    name: 'search_world_items',
    description: 'Find an item on a shelf anywhere in Crossly World: what public rooms have for sale now, by title or catalogue name. Each hit names the room and item; /c/<roomSlug>?item=<itemId> opens it there.',
    inputSchema: { type: 'object', properties: { q: { type: 'string', minLength: 2, description: 'What to look for: words from the title or catalogue name, 2+ characters.' } }, required: ['q'], additionalProperties: false },
    handler: (a) => apiGet('/v1/world/items/search', { q: String(a.q ?? '') }),
  },
  {
    name: 'get_world_shelf',
    description: 'Where a Crossly listing sits on a shelf in a public room right now (room and item), or null when it is in no room.',
    inputSchema: { type: 'object', properties: { listingSlug: { type: 'string', description: 'The Crossly listing slug (its URL name).' } }, required: ['listingSlug'], additionalProperties: false },
    handler: (a) => apiGet(`/v1/world/shelf/${encodeURIComponent(String(a.listingSlug))}`, {}),
  },
  {
    name: 'get_cheapest_copy',
    description: 'The cheapest copy of a catalogue piece (market SKU id) for sale on Crossly now, and its room and shelf when it stands in one; null when none is for sale.',
    inputSchema: { type: 'object', properties: { skuId: { type: 'string', description: 'The market catalogue (SKU) id, a UUID.' } }, required: ['skuId'], additionalProperties: false },
    handler: (a) => apiGet(`/v1/world/skus/${encodeURIComponent(String(a.skuId))}/cheapest`, {}),
  },
  {
    name: 'get_room_funnel',
    description: "Your Crossly World room's funnel over the last days (1-35): visitors, looks, items opened, checkouts started from the room, paid sales and revenue. Only sales the room itself started count.",
    inputSchema: { type: 'object', properties: { sceneId: { type: 'string', description: 'Your room (scene) id, a UUID.' }, days: { type: 'integer', minimum: 1, maximum: 35, description: 'How many days back, 1-35 (default 30).' } }, required: ['sceneId'], additionalProperties: false },
    handler: (a) => apiGet(`/v1/world/rooms/${encodeURIComponent(String(a.sceneId))}/funnel`, a.days ? { days: a.days } : {}),
  },
  {
    name: 'get_room_wants',
    description: "Items your room shows but does not sell that visitors said they would buy (\"I'd buy this\"), most wanted first.",
    inputSchema: { type: 'object', properties: { sceneId: { type: 'string', description: 'Your room (scene) id, a UUID.' } }, required: ['sceneId'], additionalProperties: false },
    handler: (a) => apiGet(`/v1/world/rooms/${encodeURIComponent(String(a.sceneId))}/wants`, {}),
  },
  {
    name: 'list_world_blocks',
    description: 'The people you blocked in Crossly World, as you saw them (never the account behind a pseudonym).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/world/blocks', {}),
  },
];
