import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Crossly World game packages (docs/WORLD-GAME-PACKAGES.md): the directory,
 * submitting a package folder for review, your packages, buying from a game
 * store, and the rewards you won.
 */
const ID_ARG = { type: 'string', format: 'uuid', description: 'The game package.' } as const;

/** Every file under a package folder as { path, base64 }; dot-files skipped (the api refuses them). */
async function readPackageFolder(folder: string): Promise<Array<{ path: string; base64: string }>> {
  const out: Array<{ path: string; base64: string }> = [];
  const walk = async (dir: string): Promise<void> => {
    for (const name of await readdir(dir)) {
      if (name.startsWith('.')) continue;
      const full = join(dir, name);
      if ((await stat(full)).isDirectory()) await walk(full);
      else out.push({ path: relative(folder, full).split(sep).join('/'), base64: (await readFile(full)).toString('base64') });
    }
  };
  await walk(folder);
  return out;
}

export const worldGameTools: ToolDef[] = [
  {
    name: 'list_world_games',
    description: 'The Crossly World Game Directory: every live, reviewed game with its players, places, rewards and contests.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/world/games', {}),
  },
  {
    name: 'get_world_game',
    description: 'One live game: its manifest, its store items (items and passes) and which you own.',
    inputSchema: { type: 'object', properties: { id: ID_ARG }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiGet(`/v1/world/games/${encodeURIComponent(id)}`, {});
    },
  },
  {
    name: 'list_my_world_game_packages',
    description: 'Your game packages, each with its latest version and review state.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/world/games/packages', {}),
  },
  {
    name: 'get_my_world_game_package',
    description: 'One of your game packages with every version, its review state and the reviewer note.',
    inputSchema: { type: 'object', properties: { id: ID_ARG }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiGet(`/v1/world/games/packages/${encodeURIComponent(id)}`, {});
    },
  },
  {
    name: 'scaffold_world_game',
    description: "Start a Crossly World game (or an NFT collection's capability declaration) in a new folder from a template: table (2 players), arena (1-8), object (one piece), collection (capabilities.json). The same files as world-kit init. Then edit it, validate_world_game_package, and submit_world_game_package.",
    inputSchema: {
      type: 'object',
      properties: {
        folder: { type: 'string', description: 'Absolute path of a NEW folder on this machine (must not exist).' },
        template: { type: 'string', enum: ['table', 'arena', 'object', 'collection'], description: 'Which template.' },
        id: { type: 'string', maxLength: 40, description: 'The package id, 2-40 of a-z, 0-9 and -.' },
        name: { type: 'string', maxLength: 60, description: 'Its display name.' },
      },
      required: ['folder', 'template'],
      additionalProperties: false,
    },
    handler: async (args) => {
      const a = args as { folder: string; template: string; id?: string; name?: string };
      if (await stat(a.folder).then(() => true, () => false)) throw new Error(`${a.folder} already exists`);
      const res = await apiGet(`/v1/world/games/templates/${encodeURIComponent(a.template)}`, { id: a.id ?? 'my-game', name: a.name ?? 'My Game' }) as { data?: { files?: Array<{ path: string; base64: string }> } };
      const files = res.data?.files ?? [];
      for (const f of files) {
        const p = join(a.folder, ...f.path.split('/'));
        await mkdir(dirname(p), { recursive: true });
        await writeFile(p, Buffer.from(f.base64, 'base64'));
      }
      return { folder: a.folder, files: files.map((f) => f.path) };
    },
  },
  {
    name: 'validate_world_game_package',
    description: 'Check a game package folder exactly as a submission is checked (manifest, documents, assets, budgets, your version number still free) without storing or submitting anything. Fix every issue, then submit_world_game_package.',
    inputSchema: { type: 'object', properties: { folder: { type: 'string', description: 'Absolute path to the package folder on this machine.' } }, required: ['folder'], additionalProperties: false },
    handler: async (args) => {
      const a = args as { folder: string };
      return apiPost('/v1/world/games/packages/check', { files: await readPackageFolder(a.folder) });
    },
  },
  {
    name: 'submit_world_game_package',
    description: 'Submit a game package folder for review: reads every file under `folder` (game.json, thumb.png, logic/, scene/, audio/, images/) and uploads it. The api checks it exactly like `world-kit validate`, quarantines its assets, dry-runs the entry document, and queues it for a person to review. Bump game.json `version` for each new submission.',
    inputSchema: {
      type: 'object',
      properties: {
        folder: { type: 'string', description: 'Absolute path to the package folder on this machine.' },
        piecePriceBaseUnits: { type: 'string', description: 'What a copy of the game piece costs, in COSM base units (6 decimals, so 1000000 = 1 COSM), as an integer string. Not DOLLARS or CENTS. Default 1 COSM.' },
        maxSupply: { type: 'integer', minimum: 1, description: 'Edition size of the game piece (omit for open).' },
      },
      required: ['folder'],
      additionalProperties: false,
    },
    handler: async (args) => {
      const a = args as { folder: string; piecePriceBaseUnits?: string; maxSupply?: number };
      const files = await readPackageFolder(a.folder);
      return apiPost('/v1/world/games/packages', { files, ...(a.piecePriceBaseUnits ? { piecePriceBaseUnits: a.piecePriceBaseUnits } : {}), ...(a.maxSupply ? { maxSupply: a.maxSupply } : {}) });
    },
  },
  {
    name: 'checkout_world_game_store_item',
    description: 'Buy an item or pass from a game store: answers a client secret for the payment; the item is yours once it succeeds.',
    inputSchema: { type: 'object', properties: { id: ID_ARG, itemId: { type: 'string', description: 'The store item id from game.json.' } }, required: ['id', 'itemId'], additionalProperties: false },
    handler: (args) => {
      const { id, itemId } = args as { id: string; itemId: string };
      return apiPost(`/v1/world/games/${encodeURIComponent(id)}/store/${encodeURIComponent(itemId)}/checkout`, {});
    },
  },
  {
    name: 'get_my_world_game_rewards',
    description: 'Rewards you won in games: granted, or recorded as unfunded for COSM and CBX.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/world/games/rewards', {}),
  },
  {
    name: 'get_world_game_leaderboard',
    description: 'A live game leaderboard, this week and all time, by its manifest scoring (wins, best points or best time). scoring is null when the game keeps no board.',
    inputSchema: { type: 'object', properties: { id: ID_ARG }, required: ['id'], additionalProperties: false },
    handler: (args) => {
      const { id } = args as { id: string };
      return apiGet(`/v1/world/games/${encodeURIComponent(id)}/leaderboard`, {});
    },
  },
  {
    name: 'rate_world_game',
    description: 'Rate a game you played, 1 to 5 stars (again replaces it). Only players the server recorded in the game can rate it.',
    inputSchema: { type: 'object', properties: { id: ID_ARG, stars: { type: 'integer', minimum: 1, maximum: 5, description: 'Stars, 1 to 5.' } }, required: ['id', 'stars'], additionalProperties: false },
    handler: (args) => { const { id, stars } = args as { id: string; stars: number }; return apiPost(`/v1/world/games/${encodeURIComponent(id)}/rating`, { stars }); },
  },
  {
    name: 'report_world_game',
    description: 'Report a game to Crossly staff. The creator is told the reason, never who reported.',
    inputSchema: { type: 'object', properties: { id: ID_ARG, reason: { type: 'string', enum: ['broken', 'unfair', 'offensive', 'scam', 'other'], description: 'Why.' }, detail: { type: 'string', maxLength: 500, description: 'What happened, optional.' } }, required: ['id', 'reason'], additionalProperties: false },
    handler: (args) => { const { id, ...rest } = args as { id: string } & Record<string, unknown>; return apiPost(`/v1/world/games/${encodeURIComponent(id)}/report`, rest); },
  },
];
