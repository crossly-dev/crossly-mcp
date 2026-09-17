import { apiGet, apiPost } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

export const magicTools: ToolDef[] = [
  {
    name: 'magic_scan',
    description:
      'Run a Magic List image scan — uses eBay image-search on the primary photo to bootstrap candidate matches, ' +
      'then text-searches other connected platforms with the top eBay title/brand. Pass extra photos in imageUrls ' +
      "(a size tag, a material label, a wear closeup) and the seller's vision model reads Size / Brand / Material " +
      "off them. Legacy `imageUrl` (single) still accepted. Returns a runId + match keys. Costs against the " +
      "seller's AI/scan budget. Pass an idempotencyKey on retries.",
    inputSchema: {
      type: 'object',
      properties: {
        imageUrls: {
          type: 'array',
          items: { type: 'string', format: 'uri' },
          minItems: 1,
          maxItems: 4,
          description:
            'Public HTTPS URLs. imageUrls[0] is the primary product shot (drives the eBay search + fanout). ' +
            'Additional photos feed vision-LLM aspect extraction — most valuable use is a size-tag closeup.',
        },
        imageUrl: {
          type: 'string',
          format: 'uri',
          description: 'Legacy single-photo form. Prefer imageUrls[]. Ignored when imageUrls is provided.',
        },
        hint: {
          type: 'string',
          maxLength: 120,
          description:
            'Optional seller context, e.g. "1968 patch". Part of the scan cache key and reorders the eBay hits, '
            + 'so it genuinely changes what comes back — re-scanning the same photo with a different hint is a '
            + 'different scan, not a cached repeat.',
        },
        ...IDEMPOTENCY_PROP,
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/magic/scan', body, idempotencyKey);
    },
  },
  {
    name: 'magic_synthesize',
    description:
      'Synthesize a draft listing from confirmed matches on a prior scan run. confirmedMatchKeys are the seller-approved ' +
      'matches from the magic_scan response; chosenPriceCents is the suggested asking price. Returns a draftId + the ' +
      "merged payload that can be passed to crosspost_listing. Pass an idempotencyKey on retries.",
    inputSchema: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: 'magic_scan response.runId.' },
        confirmedMatchKeys: { type: 'array', items: { type: 'string' } },
        chosenPriceCents: { type: 'integer', minimum: 0 , description: 'The price you picked in CENTS as an integer, so 4599 means $45.99. NOT dollars — sending 45.99 here is off by a factor of 100.' },
        note: {
          type: 'string',
          maxLength: 300,
          description:
            'Correction from the seller after seeing the scan results, e.g. "it is the 1968 version, not the 1964". '
            + 'Treated as authoritative over the matched listings and over the scan hint.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['runId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { runId, idempotencyKey, ...body } = args as Record<string, unknown> & {
        runId: string;
        idempotencyKey?: string;
      };
      return apiPost(`/v1/magic/scan/${encodeURIComponent(runId)}/synthesize`, body, idempotencyKey);
    },
  },
  {
    name: 'magic_recent',
    description:
      "List the seller's recent Magic List scans (up to 8). Each row has { id, imageUrl, createdAt, topMatchTitle, " +
      'matchCount } — useful for a "scan history" UI or to resume a half-finished synthesis.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/magic/recent'),
  },
  {
    name: 'magic_get_draft',
    description:
      'Get a synthesized Magic List draft by id. Returns the full draft payload — title, description, suggested price, ' +
      "images, category, etc. — ready to be passed to crosspost_listing.",
    inputSchema: {
      type: 'object',
      properties: {
        draftId: { type: 'string' },
      },
      required: ['draftId'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet(`/v1/magic/drafts/${encodeURIComponent(args.draftId as string)}`),
  },
];
