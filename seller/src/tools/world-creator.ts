import { apiDelete, apiGet, apiPost, apiPut } from '../api.js';
import { ToolDef } from './types.js';

/**
 * The Crossly World creator API (scope world:create): build interactive
 * objects and decor designs -- draft, check, preview, upload assets, submit
 * for ops review, archive. A price is an ask in COSM base units an operator
 * reviews; nothing here spends, mints or moves money.
 */
const ID_ARG = { type: 'string', format: 'uuid', description: 'The design.' } as const;
const PRICE_ARG = { type: 'string', pattern: '^[0-9]{1,19}$', description: 'Asking price in COSM base units (six decimals) as a string: a token currency, not cents or dollars. Reviewed by ops; nothing is charged.' } as const;

export const worldCreatorTools: ToolDef[] = [
  {
    name: 'get_world_interactive_design',
    description: 'One of your Crossly World interactive designs: its draft MML source, the last static check and every submitted version with its review state.',
    inputSchema: { type: 'object', properties: { id: ID_ARG }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiGet(`/v1/world/interactive/designs/${encodeURIComponent(id)}`, {});
    },
  },
  {
    name: 'create_world_interactive_design',
    description: 'Create a Crossly World interactive object design. It stays inactive until ops approve a submitted version.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 80, description: 'Its name.' },
        footprint: { type: 'string', enum: ['s', 'm', 'l', 'f'], description: 'Floor size: s (0.5 x 0.5 m), m (0.8 x 0.6 m), l (1.2 x 0.8 m) or f (tall and slim, 0.44 x 0.44 m).' },
        tint: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$', description: 'A hex colour, optional.' },
        description: { type: 'string', maxLength: 500, description: 'What it does, optional.' },
        priceBaseUnits: PRICE_ARG,
        maxSupply: { type: ['integer', 'null'], minimum: 1, description: 'How many copies may exist; null for open.' },
        source: { type: 'string', maxLength: 65536, description: 'Initial MML source, optional.' },
      },
      required: ['name', 'footprint', 'priceBaseUnits'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/world/interactive/designs', args as Record<string, unknown>),
  },
  {
    name: 'save_world_interactive_draft',
    description: 'Save the draft MML source of one of your interactive designs (up to 64 KB). The response carries its static check.',
    inputSchema: { type: 'object', properties: { id: ID_ARG, source: { type: 'string', maxLength: 65536, description: 'The MML document.' } }, required: ['id', 'source'], additionalProperties: false },
    handler: (args) => {
      const { id, source } = args as { id: string; source: string };
      return apiPut(`/v1/world/interactive/designs/${encodeURIComponent(id)}/draft`, { source });
    },
  },
  {
    name: 'check_world_interactive_design',
    description: 'Check the draft of one of your interactive designs: static rules, that uploads exist, and a sandboxed dry run. Budgeted per person.',
    inputSchema: { type: 'object', properties: { id: ID_ARG }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiPost(`/v1/world/interactive/designs/${encodeURIComponent(id)}/check`, {});
    },
  },
  {
    name: 'preview_world_interactive_design',
    description: 'A private preview token for the draft of one of your interactive designs and the socket path that runs it. Budgeted per person.',
    inputSchema: { type: 'object', properties: { id: ID_ARG }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiPost(`/v1/world/interactive/designs/${encodeURIComponent(id)}/preview`, {});
    },
  },
  {
    name: 'submit_world_interactive_design',
    description: 'Freeze the draft of one of your interactive designs as a new version and send it to ops review (up to 10 a day).',
    inputSchema: { type: 'object', properties: { id: ID_ARG }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiPost(`/v1/world/interactive/designs/${encodeURIComponent(id)}/submit`, {});
    },
  },
  {
    name: 'remove_world_interactive_design',
    description: 'Delete a draft interactive design, or archive a submitted one (off sale; owned copies keep working).',
    inputSchema: { type: 'object', properties: { id: ID_ARG }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiDelete(`/v1/world/interactive/designs/${encodeURIComponent(id)}`);
    },
  },
  {
    name: 'upload_world_interactive_asset',
    description: 'Upload one asset for your interactive designs: a glb or wav (4 MB) or png (1 MB), as base64. Answers its sha256 and the path to reference from MML.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['glb', 'wav', 'png'], description: 'The file type.' },
        dataBase64: { type: 'string', description: 'The file, base64-encoded.' },
      },
      required: ['kind', 'dataBase64'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/world/interactive/assets', args as Record<string, unknown>),
  },
  {
    name: 'reset_world_interactive_piece',
    description: 'Wipe the stored state of an interactive piece standing in a place you own (a home or your boutique).',
    inputSchema: { type: 'object', properties: { instanceId: { type: 'string', maxLength: 160, description: 'The placed piece instance id.' } }, required: ['instanceId'], additionalProperties: false },
    handler: (args) => apiPost('/v1/world/interactive/reset', args as Record<string, unknown>),
  },
  {
    name: 'list_world_decor_designs',
    description: 'Your Crossly World decor designs and their review state.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/world/decor/designs', {}),
  },
  {
    name: 'create_world_decor_design',
    description: 'Author a Crossly World decor design: what it unlocks, a mesh profile and params, and an asking price. Inactive until an operator approves it.',
    inputSchema: {
      type: 'object',
      properties: {
        unlocksKey: { type: 'string', description: 'The decor slot it unlocks (a DECOR_UNLOCK_KEYS value).' },
        slug: { type: 'string', minLength: 2, maxLength: 49, description: 'A url-safe id for it.' },
        name: { type: 'string', minLength: 1, maxLength: 120, description: 'Its name.' },
        meshProfile: { type: 'string', minLength: 2, maxLength: 48, description: 'The procedural mesh profile.' },
        meshParams: { type: 'object', additionalProperties: true, description: 'Mesh profile parameters, optional.' },
        description: { type: 'string', maxLength: 1000, description: 'A description, optional.' },
        previewImageUrl: { type: 'string', format: 'uri', description: 'A preview image URL, optional.' },
        priceBaseUnits: PRICE_ARG,
        maxSupply: { type: ['integer', 'null'], minimum: 1, description: 'How many copies may exist; null for open.' },
      },
      required: ['unlocksKey', 'slug', 'name', 'meshProfile', 'priceBaseUnits'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/world/decor/designs', args as Record<string, unknown>),
  },
  {
    name: 'create_world_wearable',
    description: 'Author a Crossly World wearable for a body slot. A submission: inactive until an operator approves it.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', minLength: 2, maxLength: 49, description: 'A url-safe id for it.' },
        name: { type: 'string', minLength: 1, maxLength: 120, description: 'Its name.' },
        slot: { type: 'string', enum: ['avatar_head', 'avatar_body', 'avatar_outer', 'avatar_legs', 'avatar_feet', 'avatar_back'], description: 'The body slot (avatar_outer: a jacket or vest over the top).' },
        meshProfile: { type: 'string', minLength: 2, maxLength: 48, description: 'The procedural mesh profile.' },
        meshParams: { type: 'object', additionalProperties: true, description: 'Mesh profile parameters, optional.' },
        description: { type: 'string', maxLength: 1000, description: 'A description, optional.' },
        previewImageUrl: { type: 'string', format: 'uri', description: 'A preview image URL, optional.' },
        priceBaseUnits: PRICE_ARG,
        maxSupply: { type: ['integer', 'null'], minimum: 1, description: 'How many copies may exist; null for open.' },
      },
      required: ['slug', 'name', 'slot', 'meshProfile', 'priceBaseUnits'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/world/avatar/wearables', args as Record<string, unknown>),
  },
  {
    name: 'submit_world_decor_design',
    description: 'Send one of your Crossly World decor designs to the review queue.',
    inputSchema: { type: 'object', properties: { id: ID_ARG }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiPost(`/v1/world/decor/designs/${encodeURIComponent(id)}/submit`, {});
    },
  },
];
