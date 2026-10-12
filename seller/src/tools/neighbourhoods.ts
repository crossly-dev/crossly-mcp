import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Crossly World's neighbourhoods: four streets by taste beside Main Street --
 * Sneaker Row (sneakers, streetwear), Card District (trading cards, comics),
 * Vintage Alley (vintage clothing, accessories), Vinyl Lane (records, music
 * gear). A neighbourhood opens at 6 businesses (open shops + open stalls) or
 * while a street event is on. Its stalls and events: list_street_stalls /
 * list_street_events with the neighbourhood's slug as the street.
 */
const SLUG = { type: 'string', enum: ['sneaker-row', 'card-district', 'vintage-alley', 'vinyl-lane'], description: 'Neighbourhood slug.' } as const;

export const neighbourhoodsTools: ToolDef[] = [
  {
    name: 'list_neighbourhoods',
    description:
      'Every Crossly World neighbourhood street: whether it is open or "Opening soon - N of 6 shops", its shop count, ' +
      'stalls today, the next Night Market / Swap Meet, its anchor (authentication desk, grading desk, fitting rooms, ' +
      'listening booths) and its crossly.net path (/c/<slug>).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/neighbourhoods', {}),
  },
  {
    name: 'get_neighbourhood',
    description: 'One Crossly World neighbourhood street by slug: open state, shops, stalls today, next street event.',
    inputSchema: { type: 'object', properties: { slug: SLUG }, required: ['slug'], additionalProperties: false },
    handler: (args) => {
      const { slug } = args as { slug: string };
      return apiGet(`/v1/neighbourhoods/${encodeURIComponent(slug)}`, {});
    },
  },
];
