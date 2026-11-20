# Lit-Ledger MCP server

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes the
Lit-Ledger Firestore database to Claude (Desktop / Code / web / mobile) and Google Antigravity.

Three entrypoints share the same nine tools (`src/tools.ts`):

- **stdio** — `src/stdio.ts` (`npm run start`) for Claude Desktop, Claude Code and Antigravity.
- **Streamable HTTP** — `src/http-server.ts` (`npm run start:http`) for a remote deployment that
  claude.ai and the Claude mobile app use as a **Custom Connector**.
- **Cloudflare Worker** — `worker/` (`npm run deploy:worker`) for a serverless
  Custom Connector with OAuth 2.1 and no container to run.

It reads and writes the same collections the app uses:

| Collection | Purpose |
| --- | --- |
| `inventory/{itemId}` | Literature catalog items (`sku`, `title`, `category`, `language`, `stockLevel`, `status`, …) |
| `events/{eventId}` | Distribution events (`name`, `date`, `location`, `materialsDistributed`, `status`, `categoryStats`, …) |
| `events/{eventId}/materials/{materialId}` | Items assigned to an event |
| `settings/system` | Global settings, including the per-category `reorder` points |
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
| `list_categories` | read | Category summary (items, total stock, low/out counts) plus reorder points. |
| `list_events` | read | Events newest-first, with status and inclusive date-range filters. |
| `get_event` | read | One event plus its materials subcollection. |
| `update_item_quantity` | write | `set` / `add` / `subtract` stock atomically, keep `stockLevel` and `stock` equal, recompute status, write audit log. |
| `create_item` | write | Create a catalog item; rejects duplicate SKUs and writes an audit log. |
| `list_audit_logs` | read | Recent audit entries, optionally filtered by action or target id. |

Status is derived like the app's Inventory screen: `Out` at zero, `Low` below the item's
reorder point, otherwise `Healthy`. The reorder point is the item's own `reorder`, then
`settings/system.reorder` for its category, then the app defaults (Bible 20, Booklet 60,
Tract 200; 100 for anything else). Read tools report this effective status rather than the
stored `status` field. If the SDK cannot decode a document, list and search tools skip it
and name it under `unreadable` instead of failing.

## Install and run

```bash
npm --prefix mcp install   # mcp/ is its own package; the root install is untouched
npm run mcp                # tsx mcp/src/stdio.ts (stdio)
npm run mcp:http           # tsx mcp/src/http-server.ts (Streamable HTTP on $PORT)
```

The stdio process speaks JSON-RPC on **stdout**; diagnostics are written to **stderr**. You do not
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
| `PORT` | No | HTTP entrypoint only. Port to listen on (default `8080`). |
| `MCP_AUTH_TOKEN` | HTTP | Bearer token required on `/mcp`. If unset, `/mcp` is open (a warning is logged) unless `NODE_ENV=production`, where the server refuses to start. |
| `NODE_ENV` | No | Set to `production` on a public deployment to enforce `MCP_AUTH_TOKEN`. |

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
      "command": "/absolute/path/to/inventory/mcp/node_modules/.bin/tsx",
      "args": ["/absolute/path/to/inventory/mcp/src/stdio.ts"],
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
  -- /absolute/path/to/inventory/mcp/node_modules/.bin/tsx /absolute/path/to/inventory/mcp/src/stdio.ts
```

Verify with `claude mcp list` (or `/mcp` inside a session).

Or commit a project-scoped `.mcp.json` at the repository root:

```json
{
  "mcpServers": {
    "lit-ledger": {
      "command": "/absolute/path/to/inventory/mcp/node_modules/.bin/tsx",
      "args": ["/absolute/path/to/inventory/mcp/src/stdio.ts"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/absolute/path/to/service-account.json",
        "FIREBASE_DATABASE_ID": "ai-studio-7dcfaee1-ad85-4940-b13d-8df8f061af40"
      }
    }
  }
}
```

## Claude Custom Connector (Web & Mobile)

`npm run mcp:http` starts the same nine tools over MCP **Streamable HTTP**:

| Route | Purpose |
| --- | --- |
| `POST /mcp` | JSON-RPC (initialize + tool calls) |
| `GET /mcp` | SSE stream for an existing session |
| `DELETE /mcp` | End a session |
| `GET /healthz` | Liveness probe (`200 ok`) |

When `MCP_AUTH_TOKEN` is set every `/mcp` request must send
`Authorization: Bearer <MCP_AUTH_TOKEN>` (the health check stays open). Without the variable the
server logs a loud warning and serves `/mcp` unauthenticated — but it **refuses to start** when
`NODE_ENV=production`.

Claude connectors must reach the server over **HTTPS**, so `localhost` is not usable directly.
Use a tunnel for testing, or deploy to any host that terminates TLS.

### 1. Generate a token and run locally

```bash
export MCP_AUTH_TOKEN="$(openssl rand -hex 32)"
PORT=8080 npm run mcp:http

curl -sS http://localhost:8080/healthz        # -> ok
```

Expose it while testing with a tunnel, for example `cloudflared tunnel --url http://localhost:8080`
or `ngrok http 8080`; the connector URL is then `https://<tunnel-host>/mcp`.

### 2. Deploy to Cloud Run

Docker (the `Dockerfile.mcp` in the repository root) expects `MCP_AUTH_TOKEN` and the Firebase
credentials at runtime:

```bash
PROJECT_ID=your-project
IMAGE="gcr.io/$PROJECT_ID/lit-ledger-mcp"

gcloud auth configure-docker
docker build -f Dockerfile.mcp -t "$IMAGE" .
docker push "$IMAGE"
```

Store both secrets in Secret Manager (never bake them into the image):

```bash
openssl rand -hex 32 | tr -d '\n' | gcloud secrets create MCP_AUTH_TOKEN --data-file=-
gcloud secrets create FIREBASE_SERVICE_ACCOUNT --data-file=service-account.json
```

Deploy:

```bash
gcloud run deploy lit-ledger-mcp \
  --image "$IMAGE" \
  --region us-central1 \
  --port 8080 \
  --allow-unauthenticated \
  --session-affinity \
  --max-instances 1 \
  --set-env-vars NODE_ENV=production,FIREBASE_DATABASE_ID=ai-studio-7dcfaee1-ad85-4940-b13d-8df8f061af40 \
  --set-secrets MCP_AUTH_TOKEN=MCP_AUTH_TOKEN:latest,FIREBASE_SERVICE_ACCOUNT=FIREBASE_SERVICE_ACCOUNT:latest
```

Notes:

- `--allow-unauthenticated` is required because Claude cannot present a Google IAM identity. TLS
  plus the Bearer token is the access boundary; keep the token secret.
- Sessions are held in memory, so `--max-instances 1` (or session affinity) keeps a session's
  requests on the same instance. Scale out only with sticky routing.
- Cloud Run injects `PORT`; the server listens on `0.0.0.0:$PORT`.
- `gcloud run deploy --source .` only picks up a file named `Dockerfile`. Either rename/copy
  `Dockerfile.mcp` before using it, or build and push the image as shown above.

Verify the deployment:

```bash
SERVICE_URL=$(gcloud run services describe lit-ledger-mcp --region us-central1 --format='value(status.url)')
curl -sS "$SERVICE_URL/healthz"     # -> ok

curl -sS "$SERVICE_URL/mcp" \
  -H "Authorization: Bearer $MCP_AUTH_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
```

A request without the header must return `401`:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' "$SERVICE_URL/mcp"   # -> 401
```

### 3. Add the connector in Claude

1. Open **claude.ai → Settings → Connectors → Add custom connector**.
2. Name it `Lit-Ledger`, set the URL to `https://<your-host>/mcp`.
3. Paste the `MCP_AUTH_TOKEN` value as the **Bearer token**.
4. Save, then enable the connector from the tools/connectors menu in a chat.
5. **Mobile:** sign in to the Claude mobile app with the same account — the custom connector
   appears under **Settings → Connectors** and its nine tools work from the phone.
6. Ask something like "List the ten lowest-stock Spanish items in Lit-Ledger" to confirm the
   connection.

If your Claude client offers OAuth only (no static header field), put a gateway in front that
injects `Authorization: Bearer <MCP_AUTH_TOKEN>` and leave the connector header empty.

Session state lives in the process, so a restart invalidates existing sessions; Claude creates a
new one on the next request.

## Cloudflare Worker (serverless Custom Connector)

`mcp/worker` serves the same nine tools over MCP Streamable HTTP on Cloudflare Workers,
fronted by OAuth 2.1 (dynamic client registration, PKCE S256, refresh tokens) from
`@cloudflare/workers-oauth-provider`. The consent screen asks for a shared access password
stored as the `MCP_ACCESS_PASSWORD` secret; the Worker compares SHA-256 digests, so the
password never lands in KV, logs or code.

The Worker cannot run `firebase-admin`, so it uses `mcp/rest-store.ts`: the Firestore REST
API, authenticated with a service-account JWT signed through WebCrypto, pointed at the
project's named database. Same tools, same validation, same audit trail. Stock updates use
real Firestore transactions (`:beginTransaction` / `:commit`), so two people giving out stock
at once cannot overwrite each other.

### Configuration

`mcp/wrangler.toml` holds the non-secret settings:

| Setting | Value |
| --- | --- |
| `FIREBASE_PROJECT_ID` | `inventory-website-ca94e` |
| `FIREBASE_DATABASE_ID` | `ai-studio-7dcfaee1-ad85-4940-b13d-8df8f061af40` |
| `MCP_MEMBER_ID` | OAuth subject for the shared connector identity (`lit-ledger-team`) |

Secrets are set with `wrangler secret put` and never appear in the file:

| Secret | Purpose |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | Service-account JSON on one line (`roles/datastore.user` is enough). |
| `MCP_ACCESS_PASSWORD` | Password shown on the consent screen. |

### Deploy

```bash
cd mcp
npx wrangler login
npx wrangler kv namespace create OAUTH_KV   # paste the id into wrangler.toml
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT   # service-account JSON, one line
npx wrangler secret put MCP_ACCESS_PASSWORD
# edit worker/config.ts → PUBLIC_URL to the deployed origin
npx wrangler deploy
```

Or from the repository root: `npm run mcp:dev:worker` and `npm run mcp:deploy:worker`.

`PUBLIC_URL` must match the deployed origin exactly: it is the RFC 9728 resource identifier,
and the provider refuses to serve discovery metadata or a `resource_metadata` challenge when
the request origin disagrees.

For local development, create `mcp/.dev.vars` (git-ignored) with the same two secrets and run
`npx wrangler dev` from `mcp/`.

Then in Claude: **Settings → Connectors → Add custom connector**, URL
`https://<origin>/mcp`. Claude registers itself, opens the consent page, and you enter the
access password once. The mobile app picks the connector up from the same account.

### What the flow looks like

1. Client fetches `/.well-known/oauth-protected-resource/mcp` → issuer.
2. Registers at `/register` (DCR), starts `/authorize` with PKCE.
3. Consent page posts the access password; the Worker verifies its digest.
4. `/token` exchanges the code for a 1-hour access token + 30-day refresh token.
5. `/mcp` accepts the bearer token; `env.OAUTH_PROVIDER` validates it before the handler runs.

## Antigravity

Antigravity reads `mcp_config.json` from:

- **Global** (App, IDE, CLI): `~/.gemini/config/mcp_config.json`
- **Workspace**: `<workspace>/.agents/mcp_config.json`

Add the server (the `cwd` helps `tsx` resolve the project's `node_modules` and config):

```json
{
  "mcpServers": {
    "lit-ledger": {
      "command": "/absolute/path/to/inventory/mcp/node_modules/.bin/tsx",
      "args": ["/absolute/path/to/inventory/mcp/src/stdio.ts"],
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
