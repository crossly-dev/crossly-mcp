# Crossly MCP servers

Model Context Protocol servers that give an AI agent the Crossly APIs as tools.

Crossly has two APIs with separate keys: the **seller** API runs a store, the **buyer** API is for shoppers. Each has its own package in this repo.

| Folder | Package | For |
|---|---|---|
| [`seller/`](./seller) | `@crossly/mcp` | run a reselling account: every seller endpoint as a tool |
| [`buyer/`](./buyer) | `@crossly/buyer-mcp` | manage a shopper's cart, orders, wishlists and offers |

```bash
npm install @crossly/mcp
npm install @crossly/buyer-mcp
```

Each folder has its own README with setup and examples. Docs: https://crossly.net/docs

_Synced from the Crossly monorepo at 284f6a8f7. Open issues here; pull requests are welcome but are applied upstream._
