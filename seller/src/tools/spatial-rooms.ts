import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Arranging and sharing your Crossly World rooms: invite codes (shown once),
 * direct grants, pinning items, warehouse units and racks, cosmetics and the
 * shop layout. Ownership is checked server-side.
 */
export const spatialRoomTools: ToolDef[] = [
  {
    name: 'create_spatial_room_invite',
    description: "Mint an invite code to one of your Crossly World rooms (visitor or staff, optional expiry). The code is shown in this response only.",
    inputSchema: { type: 'object', properties: { sceneId: { type: 'string', format: 'uuid', description: 'Your room (scene id).' }, role: { type: 'string', enum: ['visitor', 'staff'], description: 'visitor (walk in) or staff (may arrange).' }, expiresInHours: { type: ['integer', 'null'], minimum: 1, description: 'Hours until it expires; null never expires.' } }, required: ['sceneId'], additionalProperties: false },
    handler: (args) => {
      const { sceneId, ...rest } = args as { sceneId: string } & Record<string, unknown>;
      return apiPost(`/v1/spatial/scenes/${encodeURIComponent(sceneId)}/invites`, rest);
    },
  },
  {
    name: 'list_spatial_room_grants',
    description: "Everyone who can currently walk into one of your Crossly World rooms, and unused invites. Never returns codes.",
    inputSchema: { type: 'object', properties: { sceneId: { type: 'string', format: 'uuid', description: 'Your room (scene id).' } }, required: ['sceneId'], additionalProperties: false },
    handler: (args) => {
      const { sceneId } = args as { sceneId: string } & Record<string, unknown>;
      return apiGet(`/v1/spatial/scenes/${encodeURIComponent(sceneId)}/grants`, {});
    },
  },
  {
    name: 'grant_spatial_room_access',
    description: "Let a specific user into one of your Crossly World rooms, no code needed.",
    inputSchema: { type: 'object', properties: { sceneId: { type: 'string', format: 'uuid', description: 'Your room (scene id).' }, userId: { type: 'string', format: 'uuid', description: 'The user to let in.' }, role: { type: 'string', enum: ['visitor', 'staff'], description: 'visitor (walk in) or staff (may arrange).' } }, required: ['sceneId', 'userId'], additionalProperties: false },
    handler: (args) => {
      const { sceneId, ...rest } = args as { sceneId: string } & Record<string, unknown>;
      return apiPost(`/v1/spatial/scenes/${encodeURIComponent(sceneId)}/grants`, rest);
    },
  },
  {
    name: 'revoke_spatial_room_grant',
    description: "Take somebody access away from one of your Crossly World rooms, or kill an invite nobody has used yet.",
    inputSchema: { type: 'object', properties: { sceneId: { type: 'string', format: 'uuid', description: 'Your room (scene id).' }, grantId: { type: 'string', format: 'uuid', description: 'The grantId.' } }, required: ['sceneId', 'grantId'], additionalProperties: false },
    handler: (args) => {
      const { sceneId, grantId } = args as { sceneId: string; grantId: string } & Record<string, unknown>;
      return apiDelete(`/v1/spatial/scenes/${encodeURIComponent(sceneId)}/grants/${encodeURIComponent(grantId)}`, undefined, undefined, undefined);
    },
  },
  {
    name: 'accept_spatial_room_invite',
    description: "Redeem a Crossly World room invite code; returns the room it opens.",
    inputSchema: { type: 'object', properties: { code: { type: 'string', maxLength: 64, description: 'The invite code (dashes optional).' } }, required: ['code'], additionalProperties: false },
    handler: (args) => {
      const { ...rest } = args as Record<string, unknown>;
      return apiPost(`/v1/spatial/invites/accept`, rest);
    },
  },
  {
    name: 'list_spatial_rooms_shared_with_me',
    description: "Crossly World rooms other people let you into.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet(`/v1/spatial/shared-with-me`, {}),
  },
  {
    name: 'place_item_in_spatial_room',
    description: "Pin an inventory item to a slot in one of your Crossly World rooms: give nodeId (warehouse) or containerKey + containerIndex (collection).",
    inputSchema: { type: 'object', properties: { sceneId: { type: 'string', format: 'uuid', description: 'Your room (scene id).' }, inventoryItemId: { type: 'string', format: 'uuid', description: 'The item.' }, inventoryUnitId: { type: 'string', format: 'uuid', description: 'One unit of it, optional.' }, slotIndex: { type: 'integer', minimum: 0, description: 'The slot.' }, nodeId: { type: 'string', format: 'uuid', description: 'Warehouse unit, or use containerKey + containerIndex.' }, containerKey: { type: 'string', maxLength: 40, description: 'Collection container key, e.g. binder.' }, containerIndex: { type: 'integer', minimum: 0, description: 'Which container of that key.' } }, required: ['sceneId', 'inventoryItemId', 'slotIndex'], additionalProperties: false },
    handler: (args) => {
      const { sceneId, ...rest } = args as { sceneId: string } & Record<string, unknown>;
      return apiPost(`/v1/spatial/scenes/${encodeURIComponent(sceneId)}/place`, rest);
    },
  },
  {
    name: 'unpin_spatial_room',
    description: "Clear every pin in one of your Crossly World rooms so it arranges itself again.",
    inputSchema: { type: 'object', properties: { sceneId: { type: 'string', format: 'uuid', description: 'Your room (scene id).' } }, required: ['sceneId'], additionalProperties: false },
    handler: (args) => {
      const { sceneId } = args as { sceneId: string } & Record<string, unknown>;
      return apiPost(`/v1/spatial/scenes/${encodeURIComponent(sceneId)}/unpin`, {});
    },
  },
  {
    name: 'add_spatial_room_unit',
    description: "Add a unit (rack, shelf, bin) to one of your Crossly World warehouse rooms.",
    inputSchema: { type: 'object', properties: { sceneId: { type: 'string', format: 'uuid', description: 'Your room (scene id).' }, unitKey: { type: 'string', maxLength: 40, description: 'The unit kind (rack, shelf, bin...).' }, parentId: { type: 'string', format: 'uuid', description: 'Parent unit, optional.' }, label: { type: 'string', maxLength: 120, description: 'A label, optional.' } }, required: ['sceneId', 'unitKey'], additionalProperties: false },
    handler: (args) => {
      const { sceneId, ...rest } = args as { sceneId: string } & Record<string, unknown>;
      return apiPost(`/v1/spatial/scenes/${encodeURIComponent(sceneId)}/nodes`, rest);
    },
  },
  {
    name: 'remove_spatial_room_units',
    description: "Remove units (up to 500) from one of your Crossly World warehouse rooms.",
    inputSchema: { type: 'object', properties: { sceneId: { type: 'string', format: 'uuid', description: 'Your room (scene id).' }, nodeIds: { type: 'array', items: { type: 'string', format: 'uuid' }, maxItems: 500, description: 'Units to remove.' } }, required: ['sceneId', 'nodeIds'], additionalProperties: false },
    handler: (args) => {
      const { sceneId, ...rest } = args as { sceneId: string } & Record<string, unknown>;
      return apiDelete(`/v1/spatial/scenes/${encodeURIComponent(sceneId)}/nodes`, undefined, undefined, rest);
    },
  },
  {
    name: 'move_spatial_room_unit',
    description: "Move a rack in one of your Crossly World warehouse rooms (x, y, z in metres).",
    inputSchema: { type: 'object', properties: { sceneId: { type: 'string', format: 'uuid', description: 'Your room (scene id).' }, nodeId: { type: 'string', format: 'uuid', description: 'The nodeId.' }, position: { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3, description: 'x, y, z in metres.' } }, required: ['sceneId', 'nodeId', 'position'], additionalProperties: false },
    handler: (args) => {
      const { sceneId, nodeId, ...rest } = args as { sceneId: string; nodeId: string } & Record<string, unknown>;
      return apiPatch(`/v1/spatial/scenes/${encodeURIComponent(sceneId)}/nodes/${encodeURIComponent(nodeId)}`, rest);
    },
  },
  {
    name: 'set_spatial_room_cosmetics',
    description: "Redecorate one of your Crossly World rooms. Unknown keys are dropped; the response is what survived.",
    inputSchema: { type: 'object', properties: { sceneId: { type: 'string', format: 'uuid', description: 'Your room (scene id).' }, cosmetics: { type: 'object', additionalProperties: true, description: 'Cosmetic keys to set (wall, floor, lighting...); add clear: [keys] to reset some.' } }, required: ['sceneId', 'cosmetics'], additionalProperties: false },
    handler: (args) => {
      const { sceneId, ...rest } = args as { sceneId: string } & Record<string, unknown>;
      return apiPatch(`/v1/spatial/scenes/${encodeURIComponent(sceneId)}/cosmetics`, rest.cosmetics);
    },
  },
  {
    name: 'list_spatial_room_unplaced',
    description: "Stock not yet on a shelf in a Crossly World warehouse room you can arrange.",
    inputSchema: { type: 'object', properties: { sceneId: { type: 'string', format: 'uuid', description: 'Your room (scene id).' } }, required: ['sceneId'], additionalProperties: false },
    handler: (args) => {
      const { sceneId } = args as { sceneId: string } & Record<string, unknown>;
      return apiGet(`/v1/spatial/scenes/${encodeURIComponent(sceneId)}/warehouse/unplaced`, {});
    },
  },
  {
    name: 'stock_spatial_room_rack',
    description: "Put an inventory item (or one unit) on a rack in one of your Crossly World warehouse rooms.",
    inputSchema: { type: 'object', properties: { sceneId: { type: 'string', format: 'uuid', description: 'Your room (scene id).' }, nodeId: { type: 'string', format: 'uuid', description: 'The rack.' }, inventoryItemId: { type: 'string', format: 'uuid', description: 'The item.' }, inventoryUnitId: { type: 'string', format: 'uuid', description: 'One unit of it, optional.' } }, required: ['sceneId', 'nodeId', 'inventoryItemId'], additionalProperties: false },
    handler: (args) => {
      const { sceneId, ...rest } = args as { sceneId: string } & Record<string, unknown>;
      return apiPost(`/v1/spatial/scenes/${encodeURIComponent(sceneId)}/warehouse/stock`, rest);
    },
  },
  {
    name: 'unstock_spatial_room_rack',
    description: "Take an inventory item (or one unit) off its rack in a Crossly World warehouse room.",
    inputSchema: { type: 'object', properties: { sceneId: { type: 'string', format: 'uuid', description: 'Your room (scene id).' }, inventoryItemId: { type: 'string', format: 'uuid', description: 'The item.' }, inventoryUnitId: { type: 'string', format: 'uuid', description: 'One unit of it, optional.' } }, required: ['sceneId', 'inventoryItemId'], additionalProperties: false },
    handler: (args) => {
      const { sceneId, ...rest } = args as { sceneId: string } & Record<string, unknown>;
      return apiDelete(`/v1/spatial/scenes/${encodeURIComponent(sceneId)}/warehouse/stock`, undefined, undefined, rest);
    },
  },
  {
    name: 'save_spatial_shop_layout',
    description: "Save the sections and displays of your Crossly World shop room (validated server-side).",
    inputSchema: { type: 'object', properties: { sceneId: { type: 'string', format: 'uuid', description: 'Your room (scene id).' }, layout: { type: 'object', additionalProperties: true, description: 'The shop sections and displays.' } }, required: ['sceneId', 'layout'], additionalProperties: false },
    handler: (args) => {
      const { sceneId, ...rest } = args as { sceneId: string } & Record<string, unknown>;
      return apiPut(`/v1/spatial/scenes/${encodeURIComponent(sceneId)}/shop/layout`, rest);
    },
  },
  {
    name: 'get_spatial_shop_window',
    description: "The listings you chose for the street window of your Crossly World shop, in slot order (left, middle, right; empty means newest first), plus the listings you could put in it.",
    inputSchema: { type: 'object', properties: { sceneId: { type: 'string', format: 'uuid', description: 'Your shop room (scene id).' } }, required: ['sceneId'], additionalProperties: false },
    handler: (args) => {
      const { sceneId } = args as { sceneId: string };
      return apiGet(`/v1/spatial/scenes/${encodeURIComponent(sceneId)}/window`, {});
    },
  },
  {
    name: 'set_spatial_shop_window',
    description: "Choose up to three of your live Crossly listings for the street window of your Crossly World shop, in slot order. Picks that sell drop out and the newest fill in; an empty list goes back to newest first.",
    inputSchema: { type: 'object', properties: { sceneId: { type: 'string', format: 'uuid', description: 'Your shop room (scene id).' }, listingIds: { type: 'array', maxItems: 3, items: { type: 'string', format: 'uuid' }, description: 'Listing ids, left to right.' } }, required: ['sceneId', 'listingIds'], additionalProperties: false },
    handler: (args) => {
      const { sceneId, ...rest } = args as { sceneId: string } & Record<string, unknown>;
      return apiPut(`/v1/spatial/scenes/${encodeURIComponent(sceneId)}/window`, rest);
    },
  },
  {
    name: 'place_item_in_spatial_shop',
    description: "Place an inventory item in a section and display of your Crossly World shop room.",
    inputSchema: { type: 'object', properties: { sceneId: { type: 'string', format: 'uuid', description: 'Your room (scene id).' }, sectionId: { type: 'string', maxLength: 16, description: 'The section.' }, containerKey: { type: 'string', maxLength: 22, description: 'The display.' }, containerIndex: { type: 'integer', minimum: 0, description: 'Which display.' }, slotIndex: { type: 'integer', minimum: 0, description: 'The slot.' }, inventoryItemId: { type: 'string', format: 'uuid', description: 'The item.' }, inventoryUnitId: { type: 'string', format: 'uuid', description: 'One unit, optional.' } }, required: ['sceneId', 'sectionId', 'containerKey', 'containerIndex', 'slotIndex', 'inventoryItemId'], additionalProperties: false },
    handler: (args) => {
      const { sceneId, ...rest } = args as { sceneId: string } & Record<string, unknown>;
      return apiPost(`/v1/spatial/scenes/${encodeURIComponent(sceneId)}/shop/place`, rest);
    },
  },
];
