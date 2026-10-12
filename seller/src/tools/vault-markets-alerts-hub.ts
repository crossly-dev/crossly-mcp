import { apiGet, apiPost, apiPut } from '../api.js';
import { ToolDef } from './types.js';

/**
 * The Vault Markets alerts hub (api routes/v1/write/vault-markets-alerts.ts):
 * which kinds of vault alert go to which channel, quiet hours, a test alert,
 * and the log of what the hub did. Every alert also lands in the notification
 * bell. Margin calls, ADL and P2P loan events always push and ignore quiet hours.
 */
const KINDS = ['price', 'fill', 'margin_call', 'adl', 'p2p_loan', 'auction', 'market_open', 'receipt_token', 'set_goal', 'follow', 'account'];
const KIND_WORDS = 'price (price alerts and offers), fill (fills and sales), margin_call (margin calls, recalls and buy-ins), adl (auto-deleveraging), p2p_loan (collector loans), auction (vault auctions), market_open, receipt_token, set_goal, follow (collectors you follow) or account (everything else)';
const CHANNEL_WORDS = 'push, telegram, terminal (the Crossly desktop app), email (the daily digest) or webhook (the event "vault.alert")';

export const vaultMarketsAlertsHubTools: ToolDef[] = [
  {
    name: 'get_vault_alert_settings',
    description: 'Your Vault Markets alert settings: every kind of vault alert, every channel with whether it is set up (and what to do if not), the full on/off grid, the switches that cannot be turned off, and quiet hours.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/alert-prefs', {}),
  },
  {
    name: 'update_vault_alert_settings',
    description: 'Change which kinds of vault alert go to which channel, set or clear quiet hours, or flip the Telegram master switch. Returns the new settings.',
    inputSchema: {
      type: 'object',
      properties: {
        matrix: {
          type: 'object',
          description: `Switches to change, as { kind: { channel: true or false } }. Kinds: ${KIND_WORDS}. Channels: ${CHANNEL_WORDS}. A critical kind's push cannot be turned off.`,
          additionalProperties: { type: 'object', additionalProperties: { type: 'boolean' } },
        },
        quietHours: {
          type: ['object', 'null'],
          description: 'Hold push and Telegram copies between these times (critical kinds still go): { start: "HH:MM", end: "HH:MM", tz: IANA time zone such as "America/New_York" }, or null to clear.',
          properties: {
            start: { type: 'string', description: 'Start time, "HH:MM" in 24-hour time.' },
            end: { type: 'string', description: 'End time, "HH:MM" in 24-hour time.' },
            tz: { type: 'string', description: 'IANA time zone, for example "Europe/London".' },
          },
        },
        telegram: { type: 'boolean', description: 'The Telegram master switch: copy vault alerts to the linked Telegram chat at all.' },
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const { matrix, quietHours, telegram } = args as { matrix?: Record<string, Record<string, boolean>>; quietHours?: { start: string; end: string; tz: string } | null; telegram?: boolean };
      return apiPut('/v1/vault-markets/alert-prefs', { matrix, quietHours, telegram });
    },
  },
  {
    name: 'send_vault_test_alert',
    description: 'Send yourself one test vault alert of a kind, through your own switches. Returns { sent, kind, plan } where plan says per channel: send, off, quiet (held by quiet hours) or unavailable (not set up).',
    inputSchema: {
      type: 'object',
      properties: { kind: { type: 'string', enum: KINDS, description: `The kind of alert to test: ${KIND_WORDS}.` } },
      required: ['kind'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { kind } = args as { kind: string };
      return apiPost('/v1/vault-markets/alert-prefs/test', { kind });
    },
  },
  {
    name: 'list_vault_alert_log',
    description: 'What the alerts hub did with your recent vault alerts: kind, title, the channels each went to, what was held and why (quiet hours, the daily cap, a switch, Telegram not linked) and the email digest state.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'integer', minimum: 1, maximum: 200, description: 'How many recent alerts, 1 to 200 (default 50).' } },
      additionalProperties: false,
    },
    handler: (args) => {
      const { limit } = args as { limit?: number };
      return apiGet('/v1/vault-markets/alert-log', limit ? { limit } : {});
    },
  },
];
