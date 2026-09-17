import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../api.js';
import { IDEMPOTENCY_PROP, PAGINATION_PROPS, ToolDef } from './types.js';

export const inboxTools: ToolDef[] = [
  {
    name: 'list_conversations',
    description:
      'List the seller\'s buyer-message conversations across every marketplace (Poshmark bundles, Mercari ' +
      'messages, Depop chats, eBay/Etsy messaging, etc.). Sorted newest-message-first. Use this to surface ' +
      'unanswered questions or pending offers before replying. Paginated.',
    inputSchema: {
      type: 'object',
      properties: {
        ...PAGINATION_PROPS,
      },
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet('/v1/inbox', {
        page: args.page,
        limit: args.limit,
      }),
  },
  {
    name: 'get_conversation',
    description:
      'Open one conversation by UUID — returns its metadata plus the last 200 messages in chronological order. ' +
      'Call this before reply_to_conversation so you can read context and avoid duplicate replies.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Conversation UUID from list_conversations.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => apiGet(`/v1/inbox/${encodeURIComponent(args.id as string)}`),
  },
  {
    name: 'reply_to_conversation',
    description:
      'Send a text reply in a conversation. Dispatches an async job to the originating platform (each marketplace ' +
      'has its own messaging API). Keep replies courteous and concise — these messages are sent under the ' +
      'seller\'s name. Pass an idempotencyKey on retries to avoid double-posting.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Conversation UUID.' },
        body: {
          type: 'string',
          maxLength: 8000,
          description: 'Plain-text message body. Most platforms don\'t support markdown/HTML.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id', 'body'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, idempotencyKey, ...body } = args as Record<string, unknown> & {
        id: string;
        idempotencyKey?: string;
      };
      return apiPost(`/v1/inbox/${encodeURIComponent(id)}/reply`, body, idempotencyKey);
    },
  },
  {
    name: 'respond_to_offer',
    description:
      'Accept, counter, or decline a buyer\'s offer attached to a conversation. ' +
      '`action="accept"` finalises the sale at the offer\'s amount. `action="counter"` requires `counterAmount`. ' +
      '`action="decline"` closes the offer politely. Dispatches an async job to the marketplace. ' +
      'CONFIRM with the user before accepting/declining — these are irreversible on most platforms.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Conversation UUID containing the offer.' },
        action: {
          type: 'string',
          enum: ['accept', 'counter', 'decline'],
          description: 'What to do with the offer.',
        },
        counterAmount: {
          type: 'number',
          exclusiveMinimum: 0,
          description: 'Required when action="counter". Counter price in the listing\'s currency.',
        },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id', 'action'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, idempotencyKey, ...body } = args as Record<string, unknown> & {
        id: string;
        idempotencyKey?: string;
      };
      return apiPost(`/v1/inbox/${encodeURIComponent(id)}/offer`, body, idempotencyKey);
    },
  },

  // ── Conversation-level helpers ─────────────────────────────────────────
  {
    name: 'conversation_update',
    description:
      'PATCH a conversation — mark read/unread, change status, close. Body shape: { isRead?: boolean, status?: string }. ' +
      'Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Conversation UUID.' },
        isRead: { type: 'boolean' },
        status: { type: 'string' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, idempotencyKey, ...body } = args as Record<string, unknown> & {
        id: string;
        idempotencyKey?: string;
      };
      return apiPatch(`/v1/inbox/conversations/${encodeURIComponent(id)}`, body, idempotencyKey);
    },
  },
  {
    name: 'conversation_messages',
    description:
      'Paginated messages for a conversation, in chronological order. Also marks the conversation as read as a side effect ' +
      '(matches the web UI). Use this before reply_to_conversation to read context.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Conversation UUID.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiGet(`/v1/inbox/conversations/${encodeURIComponent(args.id as string)}/messages`),
  },
  {
    name: 'inbox_unread_count',
    description:
      'Sidebar badge: total number of unread conversations across every platform. Use this to surface a notification count.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/inbox/conversations/unread-count'),
  },
  {
    name: 'conversation_offer_action',
    description:
      'Accept / counter / decline an active offer on a conversation. Same shape as respond_to_offer but uses the canonical ' +
      'conversations sub-route so the conversation row\'s offerStatus is also updated. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        action: { type: 'string', enum: ['accept', 'counter', 'decline'] },
        counterAmount: { type: 'number', exclusiveMinimum: 0 , description: 'The counter-offer in DOLLARS as a decimal, e.g. 45.99 — it is compared against the conversation\'s current offer, which is a decimal string. Required when action is `counter`; ignored otherwise.' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id', 'action'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, idempotencyKey, ...body } = args as Record<string, unknown> & {
        id: string;
        idempotencyKey?: string;
      };
      return apiPost(`/v1/inbox/conversations/${encodeURIComponent(id)}/offer-action`, body, idempotencyKey);
    },
  },

  // ── Canned responses ──────────────────────────────────────────────────
  {
    name: 'list_canned_responses',
    description:
      'List the seller\'s canned response templates. Each row has { id, name, body }. Use this before send-reply if the ' +
      "agent wants to surface 'common replies' to the user.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => apiGet('/v1/inbox/canned-responses'),
  },
  {
    name: 'create_canned_response',
    description:
      "Create a canned response. Pass an idempotencyKey on retries.",
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        body: { type: 'string' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['name', 'body'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/inbox/canned-responses', body, idempotencyKey);
    },
  },
  {
    name: 'update_canned_response',
    description: 'Update a canned response\'s name or body. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        body: { type: 'string' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { id, idempotencyKey, ...body } = args as Record<string, unknown> & {
        id: string;
        idempotencyKey?: string;
      };
      return apiPut(`/v1/inbox/canned-responses/${encodeURIComponent(id)}`, body, idempotencyKey);
    },
  },
  {
    name: 'delete_canned_response',
    description: 'Delete a canned response by id. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiDelete(
        `/v1/inbox/canned-responses/${encodeURIComponent(args.id as string)}`,
        args.idempotencyKey as string | undefined,
      ),
  },

  // ── AI helpers ────────────────────────────────────────────────────────
  {
    name: 'inbox_ai_suggest',
    description:
      'Ask the AI to suggest a reply for a conversation. Returns a single suggested string, grounded in the conversation ' +
      "history and (when present) the linked inventory item. Costs against the seller\'s AI credits — surface a confirmation " +
      'before calling in a loop. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        conversationId: { type: 'string' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['conversationId'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/inbox/ai-suggest', body, idempotencyKey);
    },
  },
  {
    name: 'bulk_conversation_action',
    description:
      'Mark read / mark unread / soft-delete multiple conversations at once. Body: { conversationIds: string[], ' +
      "action: 'mark_read'|'mark_unread'|'delete' }. delete hides the thread from the inbox without touching the " +
      'platform conversation itself — a new buyer message un-hides it automatically. Returns { affected }. ' +
      'Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        conversationIds: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 200 },
        action: { type: 'string', enum: ['mark_read', 'mark_unread', 'delete'] },
        ...IDEMPOTENCY_PROP,
      },
      required: ['conversationIds', 'action'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/inbox/conversations/bulk', body, idempotencyKey);
    },
  },
  {
    name: 'bulk_ai_respond',
    description:
      "AI reply for multiple conversations at once. Body: { conversationIds: string[], mode: 'draft'|'send' }. " +
      "'draft' writes a suggested reply into each thread for review (nothing sent); 'send' generates AND immediately " +
      'sends a reply to every conversation with no review step — confirm with the caller before using send on more ' +
      'than a couple of conversations. Costs AI credits per conversation. Returns { results: [{ conversationId, ok, ' +
      'suggestion?, error? }] } — one bad conversation never aborts the rest of the batch. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        conversationIds: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 200 },
        mode: { type: 'string', enum: ['draft', 'send'] },
        ...IDEMPOTENCY_PROP,
      },
      required: ['conversationIds', 'mode'],
      additionalProperties: false,
    },
    handler: (args) => {
      const { idempotencyKey, ...body } = args as Record<string, unknown> & { idempotencyKey?: string };
      return apiPost('/v1/inbox/conversations/bulk-ai-respond', body, idempotencyKey);
    },
  },
  {
    name: 'message_triage',
    description:
      'Manually re-run AI triage on a buyer message (re-classifies intent, urgency, scam score, suggested reply). Only works ' +
      'on buyer-originated messages — seller messages return 400. Pass an idempotencyKey on retries.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Message UUID.' },
        ...IDEMPOTENCY_PROP,
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) =>
      apiPost(
        `/v1/inbox/messages/${encodeURIComponent(args.id as string)}/triage`,
        {},
        args.idempotencyKey as string | undefined,
      ),
  },
];
