# @crossly/mcp

[Model Context Protocol](https://modelcontextprotocol.io) server for [Crossly](https://crossly.net) — the multi-marketplace crossposting platform for resellers.

> Building your own integration in TypeScript instead of letting an AI drive? Use [`@crossly/sdk`](https://www.npmjs.com/package/@crossly/sdk) — same API, typed methods, no MCP host needed.

Exposes Crossly's public API as MCP tools so an AI agent (Claude Desktop, Cursor, Cline, Continue, etc.) can drive a seller's store end-to-end: list new items, crosspost across Poshmark / Mercari / eBay / Etsy / Depop / Grailed / Vinted / Whatnot / Vestiaire / Facebook / OfferUp / Shopify, edit prices, submit tracking, reply to buyer messages, accept/counter offers, run analytics, and configure automation rules.

> **Not on npm yet.** `@crossly/mcp` is unreleased — the install command below
> will 404 until the first publish. To try it now, clone this repo and build from
> source. Star or watch to hear when it lands.


## Install

No install — invoke via `npx`:

```bash
npx -y @crossly/mcp
```

The server reads two environment variables:

| Var | Required | Default | Purpose |
|-----|---|---|---|
| `CROSSLY_PAT` | yes | — | Personal access token. Mint one in the Crossly web app at **Settings → Personal Access Tokens**. Must start with `crossly_pat_`. |
| `CROSSLY_API_BASE_URL` | no | `https://crossly.net/api` | Override for self-hosted or staging environments. No trailing slash. |

The PAT's scopes determine what the agent can do. A read-only token can only call `list_*` / `get_*` tools; a token without `listings:write` can't crosspost. Grant the minimum scopes the agent needs.

## Claude Desktop config

Add to `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`; Windows: `%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "crossly": {
      "command": "npx",
      "args": ["-y", "@crossly/mcp"],
      "env": { "CROSSLY_PAT": "crossly_pat_live_..." }
    }
  }
}
```

Restart Claude Desktop. The Crossly tools appear under the hammer/MCP icon.

## Cursor / Cline / Continue

Same shape — every MCP host accepts `command` + `args` + `env`. Point them at `npx -y @crossly/mcp` with `CROSSLY_PAT` in env.

## Tools

### Inventory

- **`list_inventory`** — List catalog items (filter by status / search).
- **`get_inventory_item`** — Get one item plus its per-platform listing rows.
- **`create_inventory_item`** — Add a new item to the catalog.
- **`update_inventory_item`** — Edit catalog defaults (does not push to live listings).
- **`archive_inventory_item`** — Soft-delete an item.

### Listings

- **`list_listings`** — List live listings across marketplaces.
- **`get_listing`** — Get one listing with all per-platform rows / URLs.
- **`crosspost_listing`** — Publish an item to one or more marketplaces.
- **`update_listing`** — Push a price/title/image edit to live platforms.
- **`delist`** — Remove a listing from one or all platforms.

### Orders

- **`list_orders`** — List orders (filter by status / platform).
- **`get_order`** — Get one order with buyer + shipping + tracking detail.
- **`submit_tracking`** — Mark shipped with a tracking number.
- **`issue_refund`** — Refund full or partial via the marketplace's API.

### Sales

- **`list_sales`** — List unique sale events across marketplaces.

### Inbox

- **`list_conversations`** — List buyer-message conversations.
- **`get_conversation`** — Get one conversation with its messages.
- **`reply_to_conversation`** — Send a text reply.
- **`respond_to_offer`** — Accept / counter / decline a buyer offer.

### Analytics

- **`get_analytics_summary`** — Sales count, revenue, fees for the last N days.

### Platform accounts

- **`list_platform_accounts`** — List connected marketplace accounts.
- **`add_platform_account`** — Add a new account slot (OAuth/extension login still required in the UI).
- **`remove_platform_account`** — Disconnect an account.

### Automation

- **`list_automation_rules`** — List automation rules.
- **`create_automation_rule`** — Create a trigger-condition-action rule.
- **`delete_automation_rule`** — Remove a rule.

### Webhooks

- **`list_webhooks`** — List registered webhook endpoints.
- **`register_webhook`** — Register a new endpoint (response includes the HMAC secret — shown once).
- **`delete_webhook`** — Remove an endpoint.

## Idempotency

Every mutation tool accepts an optional `idempotencyKey` argument. If the agent might retry a call (transient network error, client crash, ambiguous timeout), pass a stable unique key — the Crossly API stores the first response and replays it for any retry within 24 hours. Strongly recommended for `crosspost_listing`, `submit_tracking`, `issue_refund`, and `register_webhook`.

## Error handling

API errors are surfaced as MCP tool errors with the structured `{ error: { code, message } }` envelope returned by the server. The agent receives a single text content block of the form:

```
Crossly API 403 (insufficient_scope): missing scope listings:write
```

This is intentional — the agent can read it, decide whether to retry or escalate, and explain it back to the user.

## License

MIT
