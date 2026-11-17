# Lit-Ledger MCP server

A stdio [Model Context Protocol](https://modelcontextprotocol.io) server that exposes the
Lit-Ledger Firestore database to Claude (Desktop / Code) and Google Antigravity.

It reads and writes the same collections the app uses:

| Collection | Purpose |
| --- | --- |
| `inventory/{itemId}` | Literature catalog items (`sku`, `title`, `category`, `language`, `stockLevel`, `status`, …) |
| `events/{eventId}` | Distribution events (`name`, `date`, `location`, `materialsDistributed`, `status`, `categoryStats`, …) |
| `events/{eventId}/materials/{materialId}` | Items assigned to an event |
| `settings/system` | Global settings, including `warningThreshold` / `criticalThreshold` |
| `audit_logs/{logId}` | Stock and catalog audit trail |

The project uses a **named Firestore database** (`ai-studio-7dcfaee1-ad85-4940-b13d-8df8f061af40`),
not `(default)`. The server reads that id from `firebase-applet-config.json`; override it with
`FIREBASE_DATABASE_ID` if needed.

## Tools

| Tool | Type | Description |
| --- | --- | --- |
| `list_items` | read | Filter by category, language, status, stock level; sort and page. |
| `get_item` | read | Fetch one item by Firestore id or SKU (case-insensitive). |
| `search_items` | read | Free-text search across SKU, title, subtitle, base code/name and aliases. |
| `list_categories` | read | Category summary (items, total stock, low/out counts) plus thresholds. |
| `list_events` | read | Events newest-first, with status and inclusive date-range filters. |
| `get_event` | read | One event plus its materials subcollection. |
| `update_item_quantity` | write | `set` / `add` / `subtract` stock atomically, recompute status, write audit log. |
| `create_item` | write | Create a catalog item; rejects duplicate SKUs and writes an audit log. |
| `list_audit_logs` | read | Recent audit entries, optionally filtered by action or target id. |

Status is derived exactly like the app (`src/lib/countPosting.ts`): `Out` at or below the
critical threshold, `Low` at or below the warning threshold, otherwise `Healthy`. Thresholds
come from `settings/system`, defaulting to `75` / `250`.

## Install and run

```bash
npm install
npm run mcp        # tsx mcp/server.ts
```

The process speaks JSON-RPC on **stdout**; diagnostics are written to **stderr**. You do not
normally run it by hand — your MCP client spawns it.

## Credentials

Two modes are supported. The **service-account** mode is recommended: it runs as an
administrator, is not subject to the app's security rules, and does not require a user
password.

### Mode 1 — service account (recommended)

1. Firebase Console → **Project settings** → **Service accounts** → **Generate new private key**.
2. Save the JSON **outside this repository** (never commit it).
3. Point `FIREBASE_SERVICE_ACCOUNT` (inline JSON or path) or
   `GOOGLE_APPLICATION_CREDENTIALS` (path) at it.
4. If the key lacks permission, grant the service account **Cloud Datastore User**
   (`roles/datastore.user`) on the project.

### Mode 2 — Firebase client SDK

Set `FIREBASE_API_KEY`, `FIREBASE_AUTH_EMAIL` and `FIREBASE_AUTH_PASSWORD` instead. The server
signs in with email/password and therefore **obeys `firestore.rules`** as that user. The user
must be an admin or have a `users/{uid}` role of `admin`/`user` (or a verified email) to read
inventory. This mode is a fallback for environments where you cannot create a service account.

### Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | Mode 1 | Inline service-account JSON **or** an absolute path to the JSON file. Takes precedence over ADC. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Mode 1 | Alternative: absolute path to a service-account JSON file. |
| `FIREBASE_PROJECT_ID` | No | Defaults to the service account's `project_id`, then `projectId` in `firebase-applet-config.json`. |
| `FIREBASE_DATABASE_ID` | No | Defaults to `firestoreDatabaseId` in `firebase-applet-config.json` (`ai-studio-7dcfaee1-ad85-4940-b13d-8df8f061af40`). Use `(default)` for a default database. |
| `FIREBASE_API_KEY` | Mode 2 | Web API key. `VITE_FIREBASE_API_KEY` is also accepted. |
| `FIREBASE_AUTH_EMAIL` | Mode 2 | Email of an existing app user. |
| `FIREBASE_AUTH_PASSWORD` | Mode 2 | Password for that user. |
| `FIREBASE_AUTH_DOMAIN` | No | Defaults to `<projectId>.firebaseapp.com`. |
| `FIREBASE_APP_ID` | No | Web app id; only needed if your project requires it. |

> Inline JSON (`FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'`) is handy when a
> client cannot pass a file path. Keep the `private_key` newlines escaped as `\n`, exactly as
> they appear in the downloaded JSON.

## Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or
`%APPDATA%\Claude\claude_desktop_config.json` (Windows). Replace `/absolute/path/to/...` with
real paths, then fully quit and reopen Claude.

```json
{
  "mcpServers": {
    "lit-ledger": {
      "command": "/absolute/path/to/inventory/node_modules/.bin/tsx",
      "args": ["/absolute/path/to/inventory/mcp/server.ts"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/absolute/path/to/service-account.json",
        "FIREBASE_DATABASE_ID": "ai-studio-7dcfaee1-ad85-4940-b13d-8df8f061af40"
      }
    }
  }
}
```

Using the project's local `tsx` binary avoids depending on the `PATH` Claude Desktop sees.
If you prefer npm, use `"command": "npm"` with
`"args": ["--prefix", "/absolute/path/to/inventory", "run", "mcp"]`.

## Claude Code

Add it from a terminal (use `--scope project` to write a shareable `.mcp.json`, or omit it for
user scope):

```bash
claude mcp add lit-ledger \
  --env GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json \
  --env FIREBASE_DATABASE_ID=ai-studio-7dcfaee1-ad85-4940-b13d-8df8f061af40 \
  -- /absolute/path/to/inventory/node_modules/.bin/tsx /absolute/path/to/inventory/mcp/server.ts
```

Verify with `claude mcp list` (or `/mcp` inside a session).

Or commit a project-scoped `.mcp.json` at the repository root:

```json
{
  "mcpServers": {
    "lit-ledger": {
      "command": "/absolute/path/to/inventory/node_modules/.bin/tsx",
      "args": ["/absolute/path/to/inventory/mcp/server.ts"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/absolute/path/to/service-account.json",
        "FIREBASE_DATABASE_ID": "ai-studio-7dcfaee1-ad85-4940-b13d-8df8f061af40"
      }
    }
  }
}
```

## Antigravity

Antigravity reads `mcp_config.json` from:

- **Global** (App, IDE, CLI): `~/.gemini/config/mcp_config.json`
- **Workspace**: `<workspace>/.agents/mcp_config.json`

Add the server (the `cwd` helps `tsx` resolve the project's `node_modules` and config):

```json
{
  "mcpServers": {
    "lit-ledger": {
      "command": "/absolute/path/to/inventory/node_modules/.bin/tsx",
      "args": ["/absolute/path/to/inventory/mcp/server.ts"],
      "cwd": "/absolute/path/to/inventory",
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/absolute/path/to/service-account.json",
        "FIREBASE_DATABASE_ID": "ai-studio-7dcfaee1-ad85-4940-b13d-8df8f061af40"
      }
    }
  }
}
```

You can also use the **Customizations → Installed → MCP Servers** UI; it edits the same file.
Antigravity lazy-loads tool schemas by default. To preload a frequently used tool instead, add
`"tools": { "list_items": { "eager": true } }` to the server entry.

## Example prompts

- "List the ten lowest-stock items in the Spanish catalog."
- "How many tracts do we have in total, and which are out of stock?"
- "Show events from 2026-01-01 to 2026-06-30 with their categories."
- "Subtract 40 units from SKU `T-EN-001` because they were given out at the Tuesday outreach, and log why."
- "Create a new booklet `BKL-EN-004`, 'The Gospel of God', English, starting at 120 units."
- "What changed in inventory in the last 20 audit entries?"

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `No Firestore credentials configured` | Set `FIREBASE_SERVICE_ACCOUNT` / `GOOGLE_APPLICATION_CREDENTIALS`, or all three client-SDK variables. |
| `Could not read the Firebase service account file` | Use an **absolute** path; relative paths resolve against the client's working directory, not yours. |
| `PERMISSION_DENIED` / `Missing or insufficient permissions` | The service account lacks `roles/datastore.user`, or the client-SDK user is not an authorized member. |
| `NOT_FOUND` / empty results with data in the console | Wrong database id. This project uses the named database above, not `(default)`. |
| Client shows the server but no tools | Run `npm run mcp` manually; if it fails, the error appears on stderr (stdout is reserved for JSON-RPC). |
| `Cannot find module 'tsx'` | Use the absolute `node_modules/.bin/tsx` path shown above, or run `npm install` in the project. |

Credentials in this server can **change stock**. Keep the service-account JSON private and
scoped to the project.
