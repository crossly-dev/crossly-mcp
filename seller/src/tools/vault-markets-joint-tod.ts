import { apiGet, apiPost, apiPut } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Joint vaults and transfer-on-death (api routes/v1/write/vault-markets-joint-tod.ts).
 * A joint vault is shared view and trading rights over units its ID-checked
 * members put in; each unit keeps its owner of record and never leaves the
 * custodian shelf. Each trade is placed by the member who starts it, under
 * that member. Transfer-on-death names who receives the user vault units; a
 * claim needs documents, an ops review and a 30-day wait. Nothing here moves
 * money. Writes answer 503 naming VAULT_JOINT_TERMS_VERSION or
 * VAULT_TOD_TERMS_VERSION until counsel terms are set.
 */

const JOINT_ID = { type: 'string', description: 'The joint vault id (a UUID) from list_vault_joint_vaults.' };
const USER_ID = { type: 'string', description: 'The member user id (a UUID) from get_vault_joint_vault members.' };
const RIGHTS = { type: 'string', enum: ['view', 'trade', 'full'], description: '"view" sees the joint vault; "trade" also buys into and sells from it; "full" also invites and removes members, changes rights and closes it.' };
const UNIT_IDS = { type: 'array', items: { type: 'string' }, description: 'Vault unit ids (UUIDs), 1 to 50.' };
const CLAIM_ID = { type: 'string', description: 'The transfer-on-death claim id (a UUID).' };

export const vaultMarketsJointTodTools: ToolDef[] = [
  {
    name: 'list_vault_joint_vaults',
    description: 'The user joint vaults (rights, members, units, whether they accepted the current terms) and invitations waiting for them, plus the gate (open, missing env), the joint terms in words and what each right allows.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/joint', {}),
  },
  {
    name: 'create_vault_joint_vault',
    description: 'Open a joint vault. The user must have shown ID; they hold full rights and accept the current joint terms. Optionally invites people. Moves no unit and no money. Ask the user before calling.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'A name for the joint vault (1 to 80 characters).' },
        invite: {
          type: 'array',
          description: 'People to invite now (up to 5), each by @username or email with their rights.',
          items: { type: 'object', properties: { to: { type: 'string', description: 'A Crossly @username or email.' }, rights: RIGHTS }, required: ['to'] },
        },
      },
      required: ['name'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/vault-markets/joint', args),
  },
  {
    name: 'get_vault_joint_vault',
    description: 'One joint vault (active members only): members and rights, units at the mark with each owner of record (markCents and valueCents in cents of US dollars), totals, recent joint trades and the activity from the audit trail.',
    inputSchema: { type: 'object', properties: { jointId: JOINT_ID }, required: ['jointId'], additionalProperties: false },
    handler: (args) => {
      const { jointId } = args as { jointId: string };
      return apiGet(`/v1/vault-markets/joint/${encodeURIComponent(jointId)}`, {});
    },
  },
  {
    name: 'invite_to_vault_joint_vault',
    description: 'Invite a Crossly user to a joint vault (the caller needs full rights). They have 14 days and show ID to join. Ask the user before calling.',
    inputSchema: {
      type: 'object',
      properties: { jointId: JOINT_ID, to: { type: 'string', description: 'The invitee @username or email.' }, rights: RIGHTS },
      required: ['jointId', 'to'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { jointId, ...body } = args as { jointId: string; to: string; rights?: string };
      return apiPost(`/v1/vault-markets/joint/${encodeURIComponent(jointId)}/invite`, body);
    },
  },
  {
    name: 'respond_vault_joint_invite',
    description: 'Accept or decline an invitation to a joint vault. Accepting needs ID and accepts the current joint terms. Ask the user before calling.',
    inputSchema: {
      type: 'object',
      properties: { jointId: JOINT_ID, action: { type: 'string', enum: ['accept', 'decline'], description: '"accept" joins the joint vault; "decline" turns the invitation down.' } },
      required: ['jointId', 'action'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { jointId, action } = args as { jointId: string; action: string };
      return apiPost(`/v1/vault-markets/joint/${encodeURIComponent(jointId)}/respond`, { action });
    },
  },
  {
    name: 'accept_vault_joint_terms',
    description: 'Accept the current joint vault terms (needed to trade after the terms version changes). Ask the user before calling.',
    inputSchema: { type: 'object', properties: { jointId: JOINT_ID }, required: ['jointId'], additionalProperties: false },
    handler: (args) => {
      const { jointId } = args as { jointId: string };
      return apiPost(`/v1/vault-markets/joint/${encodeURIComponent(jointId)}/terms`, {});
    },
  },
  {
    name: 'set_vault_joint_rights',
    description: 'Set a member rights in a joint vault (the caller needs full rights; the vault always keeps one full member). Ask the user before calling.',
    inputSchema: { type: 'object', properties: { jointId: JOINT_ID, userId: USER_ID, rights: RIGHTS }, required: ['jointId', 'userId', 'rights'], additionalProperties: false },
    handler: (args) => {
      const { jointId, userId, rights } = args as { jointId: string; userId: string; rights: string };
      return apiPost(`/v1/vault-markets/joint/${encodeURIComponent(jointId)}/members/${encodeURIComponent(userId)}/rights`, { rights });
    },
  },
  {
    name: 'remove_vault_joint_member',
    description: 'Remove a member from a joint vault (full rights), or leave it when userId is the caller. Their units go back to their own account and their joint orders are cancelled. Ask the user before calling.',
    inputSchema: { type: 'object', properties: { jointId: JOINT_ID, userId: USER_ID }, required: ['jointId', 'userId'], additionalProperties: false },
    handler: (args) => {
      const { jointId, userId } = args as { jointId: string; userId: string };
      return apiPost(`/v1/vault-markets/joint/${encodeURIComponent(jointId)}/members/${encodeURIComponent(userId)}/remove`, {});
    },
  },
  {
    name: 'add_vault_joint_units',
    description: 'Put units the caller owns into a joint vault (each stored and free). They keep the caller as owner of record and never leave the shelf. Ask the user before calling.',
    inputSchema: { type: 'object', properties: { jointId: JOINT_ID, vaultItemIds: UNIT_IDS }, required: ['jointId', 'vaultItemIds'], additionalProperties: false },
    handler: (args) => {
      const { jointId, vaultItemIds } = args as { jointId: string; vaultItemIds: string[] };
      return apiPost(`/v1/vault-markets/joint/${encodeURIComponent(jointId)}/units`, { vaultItemIds });
    },
  },
  {
    name: 'remove_vault_joint_units',
    description: 'Take units out of a joint vault, back to their owner own account (the caller own units at any rights; anyone else with full rights). Ask the user before calling.',
    inputSchema: { type: 'object', properties: { jointId: JOINT_ID, vaultItemIds: UNIT_IDS }, required: ['jointId', 'vaultItemIds'], additionalProperties: false },
    handler: (args) => {
      const { jointId, vaultItemIds } = args as { jointId: string; vaultItemIds: string[] };
      return apiPost(`/v1/vault-markets/joint/${encodeURIComponent(jointId)}/units/remove`, { vaultItemIds });
    },
  },
  {
    name: 'list_vault_joint_trades',
    description: 'A joint vault trades, newest first: side, book key, limitCents in cents of US dollars, who started it, whose account the order sits on, and the order standing on the book.',
    inputSchema: { type: 'object', properties: { jointId: JOINT_ID, limit: { type: 'integer', description: 'How many (1 to 200; default 50).' } }, required: ['jointId'], additionalProperties: false },
    handler: (args) => {
      const { jointId, limit } = args as { jointId: string; limit?: number };
      return apiGet(`/v1/vault-markets/joint/${encodeURIComponent(jointId)}/trades`, limit ? { limit } : {});
    },
  },
  {
    name: 'place_vault_joint_trade',
    description: 'Place a limit order for a joint vault (trade or full rights; ID shown). A buy (bookKey) is placed on the caller, paid from their own Vault Markets account and booked to the joint vault. A sell (vaultItemId of a unit in it) is placed on the unit owner of record, who gets the proceeds. Every order passes pre-trade checks. Ask the user before calling.',
    inputSchema: {
      type: 'object',
      properties: {
        jointId: JOINT_ID,
        side: { type: 'string', enum: ['buy', 'sell'], description: '"buy" buys into the joint vault; "sell" sells a unit in it.' },
        bookKey: { type: 'string', description: 'For a buy: the book key to buy.' },
        vaultItemId: { type: 'string', description: 'For a sell: the unit in the joint vault to sell (more units of the same owner and key when quantity is above 1).' },
        quantity: { type: 'integer', description: 'Units (1 to 25; default 1).' },
        limitCents: { type: 'integer', description: 'The limit price per unit, in cents of US dollars.' },
        tif: { type: 'string', enum: ['day', 'gtc', 'ioc'], description: '"day" works today, "gtc" until cancelled (default), "ioc" fills what it can now and cancels the rest.' },
        clientOrderId: { type: 'string', description: 'Your own id for the order: a retry with it returns the order already placed.' },
      },
      required: ['jointId', 'side', 'limitCents'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { jointId, ...body } = args as { jointId: string } & Record<string, unknown>;
      return apiPost(`/v1/vault-markets/joint/${encodeURIComponent(jointId)}/trades`, body);
    },
  },
  {
    name: 'cancel_vault_joint_trade',
    description: 'Cancel a working joint order (trade or full rights). What filled stays filled.',
    inputSchema: { type: 'object', properties: { jointId: JOINT_ID, tradeId: { type: 'string', description: 'The joint trade id (a UUID) from list_vault_joint_trades.' } }, required: ['jointId', 'tradeId'], additionalProperties: false },
    handler: (args) => {
      const { jointId, tradeId } = args as { jointId: string; tradeId: string };
      return apiPost(`/v1/vault-markets/joint/${encodeURIComponent(jointId)}/trades/${encodeURIComponent(tradeId)}/cancel`, {});
    },
  },
  {
    name: 'close_vault_joint_vault',
    description: 'Close a joint vault (full rights): open joint orders are cancelled and every unit goes back to its owner. Ask the user before calling.',
    inputSchema: { type: 'object', properties: { jointId: JOINT_ID }, required: ['jointId'], additionalProperties: false },
    handler: (args) => {
      const { jointId } = args as { jointId: string };
      return apiPost(`/v1/vault-markets/joint/${encodeURIComponent(jointId)}/close`, {});
    },
  },
  {
    name: 'get_vault_tod',
    description: 'The user transfer-on-death setup: the gate and terms, whether they accepted them, beneficiaries and shares (shareBps), units with designations and who the plan gives each to today (valueCents in cents of US dollars), and open claims on their account, which they can stop.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/tod', {}),
  },
  {
    name: 'accept_vault_tod_terms',
    description: 'Accept the current transfer-on-death terms. Ask the user before calling.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiPost('/v1/vault-markets/tod/terms', {}),
  },
  {
    name: 'set_vault_tod_beneficiaries',
    description: 'Replace the user transfer-on-death beneficiary list. Shares are basis points of the units not designated to anyone and add up to 10000. Ask the user before calling.',
    inputSchema: {
      type: 'object',
      properties: {
        beneficiaries: {
          type: 'array',
          description: 'The full list (up to 10). Keep an id to edit an existing beneficiary.',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'An existing beneficiary id, to edit it in place.' },
              fullName: { type: 'string', description: 'Their full legal name.' },
              contact: { type: 'string', description: 'Their email, or the @username of their Crossly account.' },
              relationship: { type: 'string', description: 'How they are related (optional).' },
              shareBps: { type: 'integer', description: 'Their share in basis points (0 to 10000; 2500 = 25%).' },
            },
            required: ['fullName', 'contact', 'shareBps'],
          },
        },
      },
      required: ['beneficiaries'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { beneficiaries } = args as { beneficiaries: unknown[] };
      return apiPut('/v1/vault-markets/tod/beneficiaries', { beneficiaries });
    },
  },
  {
    name: 'designate_vault_tod_unit',
    description: 'Leave one of the user vault units to one beneficiary, or clear that (the unit then follows the shares). Ask the user before calling.',
    inputSchema: {
      type: 'object',
      properties: {
        vaultItemId: { type: 'string', description: 'The vault unit id (a UUID) from get_vault_tod units.' },
        beneficiaryId: { type: ['string', 'null'], description: 'The beneficiary id from get_vault_tod, or null to clear the designation.' },
      },
      required: ['vaultItemId', 'beneficiaryId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { vaultItemId, beneficiaryId } = args as { vaultItemId: string; beneficiaryId: string | null };
      return apiPut('/v1/vault-markets/tod/designations', { vaultItemId, beneficiaryId });
    },
  },
  {
    name: 'object_to_vault_tod_claim',
    description: 'Stop a transfer-on-death claim made on the user own account (they are alive). Ask the user before calling.',
    inputSchema: { type: 'object', properties: { claimId: CLAIM_ID }, required: ['claimId'], additionalProperties: false },
    handler: (args) => {
      const { claimId } = args as { claimId: string };
      return apiPost(`/v1/vault-markets/tod/claims/${encodeURIComponent(claimId)}/object`, {});
    },
  },
  {
    name: 'list_vault_tod_my_claims',
    description: 'Claims the user filed as a beneficiary: status in words, documents sent (names only), the waiting period, units moved or held, and the planned share (valueCents in cents of US dollars) once documents are approved.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/vault-markets/tod/my-claims', {}),
  },
  {
    name: 'file_vault_tod_claim',
    description: 'Start a transfer-on-death claim as a named beneficiary (ID first). It stays a draft until documents are added and it is submitted. Ask the user before calling.',
    inputSchema: {
      type: 'object',
      properties: {
        holder: { type: 'string', description: 'The account holder who died: their @username or the email on their Crossly account.' },
        note: { type: 'string', description: 'A note for the review team (optional).' },
      },
      required: ['holder'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/vault-markets/tod/my-claims', args),
  },
  {
    name: 'add_vault_tod_claim_document',
    description: 'Add one document to a draft claim (or one the review team asked more of): PDF, JPEG or PNG up to 8 MB, as base64. Kept privately for the review team.',
    inputSchema: {
      type: 'object',
      properties: {
        claimId: CLAIM_ID,
        kind: { type: 'string', enum: ['death_certificate', 'letters', 'will', 'id_document', 'other'], description: '"death_certificate", "letters" (testamentary or of administration), "will", "id_document" (the claimant own ID) or "other".' },
        filename: { type: 'string', description: 'The file name.' },
        dataBase64: { type: 'string', description: 'The file contents, base64.' },
      },
      required: ['claimId', 'kind', 'filename', 'dataBase64'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { claimId, ...body } = args as { claimId: string; kind: string; filename: string; dataBase64: string };
      return apiPost(`/v1/vault-markets/tod/my-claims/${encodeURIComponent(claimId)}/documents`, body);
    },
  },
  {
    name: 'submit_vault_tod_claim',
    description: 'Send a claim for review (it needs a death certificate). The account holder is told and can stop it. Ask the user before calling.',
    inputSchema: { type: 'object', properties: { claimId: CLAIM_ID }, required: ['claimId'], additionalProperties: false },
    handler: (args) => {
      const { claimId } = args as { claimId: string };
      return apiPost(`/v1/vault-markets/tod/my-claims/${encodeURIComponent(claimId)}/submit`, {});
    },
  },
  {
    name: 'withdraw_vault_tod_claim',
    description: 'Withdraw a claim before it is released. Ask the user before calling.',
    inputSchema: { type: 'object', properties: { claimId: CLAIM_ID }, required: ['claimId'], additionalProperties: false },
    handler: (args) => {
      const { claimId } = args as { claimId: string };
      return apiPost(`/v1/vault-markets/tod/my-claims/${encodeURIComponent(claimId)}/withdraw`, {});
    },
  },
];
