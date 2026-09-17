import { apiDelete, apiGet } from '../api.js';
import { IDEMPOTENCY_PROP, ToolDef } from './types.js';

/**
 * "What third-party software can reach my store, and cut off anything I don't
 * recognise." A security audit an agent can actually run.
 *
 * Note what is NOT here: there is no tool to register an OAuth app or to mint
 * one a client secret. Creating a credential that other people's software will
 * authenticate with is a deliberate act by a developer at a keyboard, not
 * something to hand an agent a button for.
 */
export const connectedAppsTools: ToolDef[] = [
  {
    name: 'list_connected_apps',
    description:
      'List third-party OAuth apps with access to this Crossly account. Each entry has grantId, appName, ' +
      'appDescription, developerName, developerEmail, scopes, connectedAt and lastUsedAt. `lastUsedAt` is the ' +
      'useful signal when auditing: an app that has never been used, or has been silent for months, is a ' +
      'candidate for disconnection. This is distinct from list_accounts, which is the marketplaces the seller ' +
      'sells on — these are programs acting on their behalf.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/connected-apps'),
  },
  {
    name: 'disconnect_app',
    description:
      "Disconnect a third-party app by GRANT id (from list_connected_apps — not the app id). Its access tokens " +
      'stop working immediately and anything it was doing on a schedule stops. The seller can reconnect later by ' +
      'going through the app\'s own connect flow again. Confirm with the user first: this breaks a working ' +
      'integration, and the breakage shows up wherever that app runs rather than in Crossly. Refused with ' +
      '403 not_available_to_apps when the caller is itself an OAuth app — one app may not disconnect another.',
    inputSchema: {
      type: 'object',
      properties: {
        grantId: { type: 'string', description: 'The `grantId` from list_connected_apps.' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['grantId'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiDelete(
        `/v1/connected-apps/${encodeURIComponent(args.grantId as string)}`,
        args.idempotencyKey as string | undefined,
      ),
  },
];
