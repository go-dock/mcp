# @go-dock/mcp

Local stdio bridge to the [Dock](https://godock.ai) MCP server. Point any
MCP-capable agent (Claude Desktop, Cursor, Windsurf, Zed, Cline, Continue)
at your Dock workspaces in one config change.

> **Do you need this package?**
>
> If your agent supports **remote MCP connectors** (Claude.ai web,
> Claude.ai Projects), you don't need this — add
> `https://godock.ai/api/mcp` as a custom connector and follow the OAuth
> flow. See the [MCP reference](https://godock.ai/docs/mcp).
>
> This package is for agents that only speak **local stdio MCP** — the
> dominant pattern for Claude Desktop and most code-editor agents today.

## Quickstart

1. Get an API key in Dock's Settings → API keys
   ([godock.ai](https://godock.ai)).
2. Add the config for your agent below.
3. Restart the agent. You'll see Dock's 8 tools appear.

## Configs

All clients follow the same pattern: run `npx -y @go-dock/mcp`, pass
`DOCK_API_KEY` in env. Per-client JSON snippets are in
[`configs/`](./configs):

| Client | File | Typical config path |
|---|---|---|
| Claude Desktop | [`configs/claude-desktop.json`](./configs/claude-desktop.json) | `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) |
| Cursor | [`configs/cursor.json`](./configs/cursor.json) | `~/.cursor/mcp.json` |
| Windsurf | [`configs/windsurf.json`](./configs/windsurf.json) | `~/.codeium/windsurf/mcp_config.json` |
| Zed | [`configs/zed.json`](./configs/zed.json) | `~/.config/zed/settings.json` (under `context_servers`) |
| Cline (VS Code) | [`configs/cline.json`](./configs/cline.json) | VS Code settings → `cline.mcpServers` |
| Continue | [`configs/continue.json`](./configs/continue.json) | `~/.continue/config.json` |

Example (Claude Desktop):

```json
{
  "mcpServers": {
    "dock": {
      "command": "npx",
      "args": ["-y", "@go-dock/mcp"],
      "env": {
        "DOCK_API_KEY": "dk_..."
      }
    }
  }
}
```

## Tools

All 8 tools are forwarded to the hosted Dock server. JSON schemas live
in [`schemas/`](./schemas).

| Tool | Purpose |
|---|---|
| [`list_workspaces`](./schemas/list_workspaces.json) | Enumerate workspaces you can access |
| [`get_workspace`](./schemas/get_workspace.json) | Fetch a workspace by slug |
| [`list_rows`](./schemas/list_rows.json) | Read rows from a table-mode workspace |
| [`create_row`](./schemas/create_row.json) | Append a row |
| [`update_row`](./schemas/update_row.json) | Partial-merge update |
| [`delete_row`](./schemas/delete_row.json) | Remove a row |
| [`create_workspace`](./schemas/create_workspace.json) | Create a new workspace |
| [`get_recent_events`](./schemas/get_recent_events.json) | Read the activity log |

Full reference with examples: [godock.ai/docs/mcp](https://godock.ai/docs/mcp).

## How the bridge works

The bridge is a ~100-line Node process ([`src/bridge.js`](./src/bridge.js)).
Every JSON-RPC message your agent writes on stdin is forwarded over HTTPS
to `https://godock.ai/api/mcp` with your `DOCK_API_KEY` as Bearer auth.
The hosted server owns authentication, rate limits, audit, and tool
execution. The bridge stores no state and logs no request bodies.

Environment variables:

| Variable | Required? | Purpose |
|---|---|---|
| `DOCK_API_KEY` | yes | Bearer token (get one from Settings → API keys) |
| `DOCK_MCP_URL` | no | Override the upstream endpoint (staging / self-host). Default: `https://godock.ai/api/mcp` |

## Security

- Your API key is only held in the agent's environment and passed on
  each HTTPS call. It's never logged, never written to disk by this
  bridge.
- Rotate keys any time in Dock's Settings → API keys. Old keys return
  401 immediately on revocation.
- Keys are stored as SHA-256 hashes on Dock's side, not plaintext. A
  Dock DB leak wouldn't expose usable credentials.
- See the full [security doc](https://godock.ai/docs/security) for the
  threat model, the revocation runbook, and what data is audited.

## License

MIT. Copyright © 2026 Vector Apps, Inc.
