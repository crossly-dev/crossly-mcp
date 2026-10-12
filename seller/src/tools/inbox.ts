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
        id: {
          type: 'string',
          description:
            "Crossly conversation UUID — the `id` from list_conversations. Not the marketplace's own thread id " +
            '(that is `platformConversationId` on the same row); each conversation belongs to exactly one ' +
            'platform, named in its `platform` field.',
        },
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
        id: {
          type: 'string',
          description:
            'Crossly conversation UUID from list_conversations (not the marketplace thread id). The server reads ' +
            "the row's `platform` and `platformConversationId` and sends the reply to that marketplace for you.",
        },
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
        id: {
          type: 'string',
          description:
            'Crossly conversation UUID carrying the offer (from list_conversations), not the marketplace thread ' +
            "id. The offer is dispatched to whichever platform the row's `platform` field names.",
        },
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
        id: {
          type: 'string',
          description:
            'Crossly conversation UUID from list_conversations (not the marketplace thread id). Both fields this ' +
            'tool writes are Crossly-side bookkeeping — nothing is sent to the platform.',
        },
        isRead: {
          type: 'boolean',
          description:
            'Mark the thread read (true) or unread (false). This is Crossly-side only — it never touches the ' +
            'read state on the marketplace. inbox_unread_count counts conversations with isRead=false. Omit to ' +
            'leave it unchanged.',
        },
        status: {
          type: 'string',
          description:
            "Crossly-side triage state. Exactly one of 'open' (buyer spoke last, needs the seller), 'replied' " +
            "(the seller has answered — what a successful reply_to_conversation sets), 'closed' (done, no reply " +
            "expected) or 'spam'. The server's zod enum rejects any other value with a 400. Omit to leave it " +
            'unchanged; sending neither isRead nor status is a 400 (no_fields_to_update).',
        },
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
        id: {
          type: 'string',
          description:
            'Crossly conversation UUID from list_conversations (not the marketplace thread id). Fetching marks ' +
            'the thread read as a side effect, which lowers inbox_unread_count.',
        },
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
        id: {
          type: 'string',
          description:
            "Crossly conversation UUID — the `id` field from list_conversations, NOT the marketplace's own thread " +
            "id (that is the same row's `platformConversationId`, and the server rejects it as not_found). The " +
            "row already records which marketplace the thread lives on in its `platform` field (poshmark, mercari, " +
            'depop, ebay, etsy, …), so the offer is dispatched to the right platform without you naming it. The ' +
            'conversation must have an active offer (hasOffer) or the call is 400 (no_active_offer).',
        },
        action: {
          type: 'string',
          enum: ['accept', 'counter', 'decline'],
          description:
            "What to do with the buyer's active offer. 'accept' takes it at the buyer's own offerAmount and sets " +
            "offerStatus='accepted' — a sale. 'counter' proposes counterAmount instead, sets offerStatus='countered' " +
            "and OVERWRITES the conversation's stored offerAmount with your counter; counterAmount is required and " +
            "its absence is a 400 (counter_amount_required). 'decline' rejects the offer and sets " +
            "offerStatus='declined'. The marketplace write is attempted FIRST — if the platform refuses you get a " +
            '502 (platform_write_failed) and no offerStatus is recorded. Accept and decline are irreversible on ' +
            'most platforms, so confirm with the user.',
        },
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
        name: {
          type: 'string',
          description:
            'Short label for the template, 1-100 characters (the server rejects empty or longer). Shown to the ' +
            'seller in the canned-response picker and never sent to the buyer. Names are listed alphabetically.',
        },
        body: {
          type: 'string',
          description:
            'The reply text the template inserts, 1-5000 characters. Plain text — marketplace messaging strips ' +
            'markdown/HTML. There is no variable substitution: whatever is stored is what gets pasted.',
        },
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
        id: {
          type: 'string',
          description:
            'Canned-response UUID from list_canned_responses. Templates are per-seller; an id owned by anyone ' +
            'else is a 404.',
        },
        name: {
          type: 'string',
          description:
            'Replacement label, 1-100 characters. Omit to leave the current name unchanged — this is a partial ' +
            'update, not a replace.',
        },
        body: {
          type: 'string',
          description:
            'Replacement template text, 1-5000 characters, plain text. Omit to leave the current body unchanged. ' +
            'Sending neither name nor body is a 400 (no_fields_to_update). Editing a template does not alter ' +
            'replies already sent from it.',
        },
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
        id: {
          type: 'string',
          description:
            'Canned-response UUID from list_canned_responses. Deletes the template only — messages already sent ' +
            'from it are untouched. A 404 means it is already gone or belongs to another seller.',
        },
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
        conversationId: {
          type: 'string',
          description:
            'Crossly conversation UUID (the `id` from list_conversations), not the marketplace thread id. The ' +
            'thread must already contain at least one message — an empty conversation is a 400 ' +
            '(empty_conversation). The suggestion is grounded in the whole message history plus the linked ' +
            'inventory item when the row has one; nothing is sent to the buyer.',
        },
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
        conversationIds: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 200,
          description:
            'Crossly conversation UUIDs (the `id` values from list_conversations, not marketplace thread ids). ' +
            '1-200 per call; the server rejects an empty list or more than 200. Ids the caller does not own are ' +
            'silently dropped rather than failing the batch — compare the returned `affected` count against the ' +
            'number you sent to detect that. Mixing platforms in one call is fine.',
        },
        action: {
          type: 'string',
          enum: ['mark_read', 'mark_unread', 'delete'],
          description:
            "'mark_read' sets isRead=true and 'mark_unread' sets isRead=false — both only affect the Crossly " +
            'unread badge (inbox_unread_count), never the marketplace. ' +
            "'delete' is a SOFT hide (isHidden=true): the thread disappears from the Crossly inbox while the " +
            'platform conversation stays untouched, and a new inbound buyer message un-hides it automatically. ' +
            'Nothing here deletes a message anywhere.',
        },
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
        conversationIds: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 200,
          description:
            'Crossly conversation UUIDs from list_conversations (not marketplace thread ids), 1-200 per call. ' +
            'Unowned ids are dropped silently. The server works through them three at a time and isolates ' +
            'failures per conversation, so an empty thread or an AI-config error shows up as one ok:false row ' +
            'instead of aborting the batch. Each id costs AI credits.',
        },
        mode: {
          type: 'string',
          enum: ['draft', 'send'],
          description:
            "'draft' generates the reply and stores it on the thread's newest message as aiSuggestedReply for the " +
            'seller to review — nothing leaves Crossly and no marketplace call is made. ' +
            "'send' generates AND immediately dispatches it to each marketplace, records it as a seller message, " +
            "and marks the thread read with status='replied' — no review step, and platform sends are not " +
            "undoable. Prefer 'draft' unless the user has explicitly approved sending.",
        },
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
        id: {
          type: 'string',
          description:
            'MESSAGE UUID (a row from conversation_messages / get_conversation) — not a conversation id and not ' +
            "the platform's own message id. Must be a buyer-sent message; a seller message returns 400 " +
            '(cannot_triage_seller_message). Re-running overwrites aiIntent, aiUrgency, aiScamScore, ' +
            'aiSuggestedReply and aiTriagedAt on that message.',
        },
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
