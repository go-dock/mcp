#!/usr/bin/env node
/**
 * @go-dock/mcp — local stdio bridge to the Dock MCP server.
 *
 * Why this exists:
 *   Dock's MCP server speaks JSON-RPC over HTTPS at trydock.ai/api/mcp.
 *   That's perfect for Claude.ai's remote-connector UX, but many MCP
 *   clients (Claude Desktop today, Cursor, Windsurf, Zed, Cline,
 *   Continue) still prefer a local stdio server. This package is the
 *   minimal bridge: it reads newline-delimited JSON-RPC from stdin,
 *   forwards each message to the hosted endpoint with your API key,
 *   and writes the response back to stdout.
 *
 * How it's wired into clients: see ../configs/*.json for per-client
 * snippets. The pattern is always:
 *     npx -y @go-dock/mcp         with DOCK_API_KEY in env
 *
 * No state, no persistence, no logging of request bodies. The bridge
 * is stateless — every call goes straight to the hosted server which
 * owns auth, rate limits, audit.
 */

import { createInterface } from "node:readline";
import process from "node:process";

const API_KEY = process.env.DOCK_API_KEY;
const ENDPOINT =
  process.env.DOCK_MCP_URL || "https://trydock.ai/api/mcp";

if (!API_KEY) {
  process.stderr.write(
    [
      "@go-dock/mcp: DOCK_API_KEY is required.",
      "",
      "Get a key in Settings → API keys at https://trydock.ai.",
      "Then set it in your MCP client config, e.g.:",
      "",
      '  "env": { "DOCK_API_KEY": "dk_..." }',
      "",
    ].join("\n")
  );
  process.exit(1);
}

/**
 * Forward a single JSON-RPC message upstream and return the response.
 * Any network / server error is translated into a JSON-RPC error so
 * the downstream client doesn't get a broken stream.
 */
async function forward(message) {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(message),
    });

    // Upstream sometimes streams SSE for long-running calls. In practice
    // Dock's tool calls are short, so we expect JSON. Fall back to text
    // if the content-type is unexpected.
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      return await res.json();
    }
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return {
        jsonrpc: "2.0",
        id: message.id ?? null,
        error: {
          code: -32603,
          message: `Upstream returned ${res.status} (${ct}): ${text.slice(0, 200)}`,
        },
      };
    }
  } catch (err) {
    return {
      jsonrpc: "2.0",
      id: message.id ?? null,
      error: {
        code: -32603,
        message: `Bridge upstream error: ${err?.message ?? String(err)}`,
      },
    };
  }
}

// MCP stdio transport frames messages as one JSON object per line.
const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let request;
  try {
    request = JSON.parse(trimmed);
  } catch (err) {
    process.stdout.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32700,
          message: `Parse error: ${err?.message ?? String(err)}`,
        },
      }) + "\n"
    );
    return;
  }

  const response = await forward(request);
  // Notifications (no `id`) don't expect a reply.
  if (request.id !== undefined || response?.error) {
    process.stdout.write(JSON.stringify(response) + "\n");
  }
});

rl.on("close", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
