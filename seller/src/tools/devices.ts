import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

export const deviceTools: ToolDef[] = [
  {
    name: 'connection_health',
    description:
      "Diagnose the seller's connected marketplace accounts: which are working, which have silently stopped, and what " +
      'to do about each. One entry per ACCOUNT rather than per platform, because a healthy slot 1 does not speak for a ' +
      'dead slot 2.\n\n' +
      'Each entry carries a `state`, an `audience`, and a written `summary` + `action`. Two rules matter when reporting ' +
      'this to a user:\n' +
      '  • `unknown` means NOT MEASURED — no sync seen, no jar stored, or a jar that could not be read. It is not ' +
      'evidence of a problem and must never be described as one.\n' +
      "  • `audience: \"crossly\"` means the finding is about OUR coverage (a platform renamed a cookie and our " +
      'expectations lag), not something the seller can fix. Do not instruct them to act on it.\n\n' +
      'Prefer the `action` text verbatim — it is already specific ("Whatnot renamed its session cookie — reconnect ' +
      'this account") and paraphrasing it loses the part that helps.',
    inputSchema: {
      type: 'object',
      properties: {
        includeUnconnected: {
          type: 'boolean',
          description:
            'Include platforms the seller has never connected. Off by default — a health check normally means the ' +
            'accounts they actually have.',
          default: false,
        },
      },
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet('/v1/connection-health', { includeUnconnected: args.includeUnconnected }),
  },
  {
    name: 'list_devices',
    description:
      'List the machines paired to this account (desktop app / printer agent) and what each can do.\n\n' +
      'Capabilities are what the machine DECLARED at pairing: print, scan_watch, scan_direct, browser, cookie_jar, ' +
      'proxy_bind, scale. `scale` is only declared when a scale actually answered, never speculatively — so its ' +
      'presence means a weight can really be read from that machine.\n\n' +
      '`lastSeenAt` is a timestamp rather than an online flag, deliberately: how fresh counts as online depends on ' +
      'what you are about to do with the answer. Revoked pairings are never returned.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    handler: () => apiGet('/v1/devices'),
  },
];
