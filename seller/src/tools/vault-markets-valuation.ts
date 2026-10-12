import { apiGet, apiPost } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Vault Markets insurance and appraisal statements (api
 * routes/v1/write/vault-markets-valuation.ts). A statement lists the vault
 * units the user held on a chosen day, each at its Crossly mark that day (the
 * order book price for its exact item, condition and grade, nothing else),
 * with the mark quality, the last eligible trade, grade and cert, unit id and
 * receipt, and the total of the marked units. Issuing freezes it with a sha256
 * and seals it in the Crossly audit chain. Nothing here moves money. The PDF
 * is binary and not a tool; get_vault_valuation_statement returns every
 * figure on it.
 */

const PURPOSE = { type: 'string', enum: ['insurance', 'appraisal'], description: 'What the statement is for: "insurance" (a schedule of replacement values at the mark, for the user own policy) or "appraisal" (the same figures with the methodology paragraph, for estate planning or a lender).' };
const AS_OF = { type: 'string', description: 'The day the holdings and marks are read at, YYYY-MM-DD in UTC, from 2024-01-01 to today. Leave out for today.' };
const SUBACCOUNT = { type: 'string', description: 'A firm sub-account id (a UUID) the user can read. Leave out for the user own account.' };
const PREPARED_FOR = { type: 'string', description: 'Who the statement is prepared for, printed on it (the insured, an estate, a lender), up to 120 characters. Never shown on the public verify view.' };
const POLICY_REF = { type: 'string', description: 'The user policy or file reference, printed on it, up to 80 characters. Never shown on the public verify view.' };
const STATEMENT_ID = { type: 'string', description: 'The statement id (a UUID) from issue_vault_valuation_statement or list_vault_valuation_statements, or printed on the statement.' };

export const vaultMarketsValuationTools: ToolDef[] = [
  {
    name: 'preview_vault_valuation_statement',
    description: 'Build an insurance or appraisal statement for a day without issuing it: every vault unit the user held that day with its mark (markCents and valueCents in cents of US dollars), mark quality (A, B, C or none), last trade, grade and cert, and the totals (totalCents in cents of US dollars). No id and no hash; nothing is stored.',
    inputSchema: {
      type: 'object',
      properties: { purpose: PURPOSE, asOf: AS_OF, subaccountId: SUBACCOUNT, preparedFor: PREPARED_FOR, policyRef: POLICY_REF },
      required: ['purpose'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { purpose, asOf, subaccountId, preparedFor, policyRef } = args as { purpose: string; asOf?: string; subaccountId?: string; preparedFor?: string; policyRef?: string };
      return apiGet('/v1/vault-markets/valuation-statements/preview', {
        purpose,
        ...(asOf ? { asOf } : {}),
        ...(subaccountId ? { subaccountId } : {}),
        ...(preparedFor ? { preparedFor } : {}),
        ...(policyRef ? { policyRef } : {}),
      });
    },
  },
  {
    name: 'issue_vault_valuation_statement',
    description: 'Issue an insurance or appraisal statement for a day: frozen with the sha256 of its record, sealed in the Crossly audit chain, with a public verify link (verifyUrl) an insurer can open. Returns the whole statement, money in cents of US dollars. Moves no money and places no order.',
    inputSchema: {
      type: 'object',
      properties: { purpose: PURPOSE, asOf: AS_OF, subaccountId: SUBACCOUNT, preparedFor: PREPARED_FOR, policyRef: POLICY_REF },
      required: ['purpose'],
      additionalProperties: false,
    },
    handler: (args) => apiPost('/v1/vault-markets/valuation-statements', args),
  },
  {
    name: 'list_vault_valuation_statements',
    description: 'The insurance and appraisal statements the user issued, newest first: purpose, date, units, totalCents (cents of US dollars at the marks), hash and verify link.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'integer', description: 'How many to return, 1 to 100. Default 50.' } },
      additionalProperties: false,
    },
    handler: (args) => {
      const { limit } = args as { limit?: number };
      return apiGet('/v1/vault-markets/valuation-statements', limit ? { limit } : {});
    },
  },
  {
    name: 'get_vault_valuation_statement',
    description: 'One statement the user issued: every unit (markCents and valueCents in cents of US dollars, mark quality, last trade, grade, cert, unit id, receipt), totals by mark quality, the methodology, its sha256, its audit-chain seal and the verify link.',
    inputSchema: { type: 'object', properties: { statementId: STATEMENT_ID }, required: ['statementId'], additionalProperties: false },
    handler: (args) => {
      const { statementId } = args as { statementId: string };
      return apiGet(`/v1/vault-markets/valuation-statements/${encodeURIComponent(statementId)}`, {});
    },
  },
  {
    name: 'verify_vault_valuation_statement',
    description: 'Check any issued statement by its id, as an insurer would: purpose, date, totals by mark quality (totalCents in cents of US dollars) and the sha256; intact (the stored record still hashes to it), seal.ok (its audit-chain entry still carries it) and, given a hash, hashMatches. Verdict is "valid", "mismatch" (the hash given is not this statement) or "altered". Never shows the holder or the units.',
    inputSchema: {
      type: 'object',
      properties: {
        statementId: STATEMENT_ID,
        hash: { type: 'string', description: 'The sha256 printed on the statement (64 hex characters), to compare. Leave out to just read the totals.' },
      },
      required: ['statementId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { statementId, hash } = args as { statementId: string; hash?: string };
      return apiGet(`/v1/vault-markets/valuation-statements/${encodeURIComponent(statementId)}/verify`, hash ? { hash } : {});
    },
  },
];
