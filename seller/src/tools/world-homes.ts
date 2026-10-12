import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Your Crossly World home and other people's: settings, layout, co-building,
 * guestbooks, and asking whether an owner would sell a piece.
 */
export const worldHomeTools: ToolDef[] = [
  {
    name: 'update_world_home',
    description: "Your Crossly World home: privacy, theme, and wall, floor and mood decor you hold.",
    inputSchema: { type: 'object', properties: { privacy: { type: 'string', description: 'open, friends or private.' }, theme: { type: 'string', description: 'A home theme.' }, decor: { type: ['object', 'null'], additionalProperties: true, description: 'wall, floor and mood decor you hold.' } }, required: [], additionalProperties: false },
    handler: (args) => {
      const { ...rest } = args as Record<string, unknown>;
      return apiPatch(`/v1/world/home`, rest);
    },
  },
  {
    name: 'save_world_home_layout',
    description: "Arrange your Crossly World home: the full layout of pieces you own.",
    inputSchema: { type: 'object', properties: { layout: { type: 'array', items: { type: 'object', additionalProperties: true }, maxItems: 200, description: 'The full layout: up to 200 pieces you own.' } }, required: ['layout'], additionalProperties: false },
    handler: (args) => {
      const { ...rest } = args as Record<string, unknown>;
      return apiPut(`/v1/world/home/layout`, rest);
    },
  },
  {
    name: 'list_world_home_placeable',
    description: "What you can place in your Crossly World home: items and furniture.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet(`/v1/world/home/placeable`, {}),
  },
  {
    name: 'list_world_homes_you_build',
    description: "Crossly World homes whose owner made you a co-builder.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet(`/v1/world/home/building`, {}),
  },
  {
    name: 'save_world_home_layout_as_builder',
    description: "Rearrange a Crossly World home you co-build (never adding the owner bought pieces).",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', minLength: 8, maxLength: 40, description: 'The home slug.' }, layout: { type: 'array', items: { type: 'object', additionalProperties: true }, maxItems: 200, description: 'The full layout.' } }, required: ['slug', 'layout'], additionalProperties: false },
    handler: (args) => {
      const { slug, ...rest } = args as { slug: string } & Record<string, unknown>;
      return apiPut(`/v1/world/homes/${encodeURIComponent(slug)}/layout`, rest);
    },
  },
  {
    name: 'sign_world_home_guestbook',
    description: "Sign a Crossly World home guestbook with one short line.",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', minLength: 8, maxLength: 40, description: 'The home slug.' }, body: { type: 'string', minLength: 1, description: 'One short line.' } }, required: ['slug', 'body'], additionalProperties: false },
    handler: (args) => {
      const { slug, ...rest } = args as { slug: string } & Record<string, unknown>;
      return apiPost(`/v1/world/homes/${encodeURIComponent(slug)}/guestbook`, rest);
    },
  },
  {
    name: 'hide_world_guestbook_entry',
    description: "As the home owner, hide a Crossly World guestbook entry.",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', minLength: 8, maxLength: 40, description: 'The home slug.' }, id: { type: 'string', format: 'uuid', description: 'The entry.' } }, required: ['slug', 'id'], additionalProperties: false },
    handler: (args) => {
      const { slug, id } = args as { slug: string; id: string } & Record<string, unknown>;
      return apiDelete(`/v1/world/homes/${encodeURIComponent(slug)}/guestbook/${encodeURIComponent(id)}`);
    },
  },
  {
    name: 'report_world_guestbook_entry',
    description: "Report a Crossly World guestbook entry to moderation.",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', minLength: 8, maxLength: 40, description: 'The home slug.' }, id: { type: 'string', format: 'uuid', description: 'The entry.' }, reason: { type: 'string', enum: ['harassment', 'hate', 'sexual', 'spam', 'scam', 'impersonation', 'other'], description: 'Why.' }, detail: { type: 'string', maxLength: 1000, description: 'More detail, optional.' } }, required: ['slug', 'id', 'reason'], additionalProperties: false },
    handler: (args) => {
      const { slug, id, ...rest } = args as { slug: string; id: string } & Record<string, unknown>;
      return apiPost(`/v1/world/homes/${encodeURIComponent(slug)}/guestbook/${encodeURIComponent(id)}/report`, rest);
    },
  },
  {
    name: 'ask_world_home_owner_to_sell',
    description: "Ask a Crossly World home owner whether they would sell a piece you saw there.",
    inputSchema: { type: 'object', properties: { slug: { type: 'string', minLength: 8, maxLength: 40, description: 'The home slug.' }, ref: { type: 'object', additionalProperties: true, description: 'The piece: { kind, id }.' } }, required: ['slug', 'ref'], additionalProperties: false },
    handler: (args) => {
      const { slug, ...rest } = args as { slug: string } & Record<string, unknown>;
      return apiPost(`/v1/world/homes/${encodeURIComponent(slug)}/ask`, rest);
    },
  },
];
