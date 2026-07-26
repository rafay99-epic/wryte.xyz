# MCP server

Wryte ships a Model Context Protocol server, so a coding agent — Claude Code,
Cursor, or anything that speaks MCP — can read your posts, do research, draft,
schedule and publish, working as you.

It runs **inside Wryte's Convex backend**. There is no separate service to
deploy, no API token to create, and no secret stored on your machine.

## Endpoint

```
https://<your-deployment>.convex.site/mcp
```

Your exact URL is shown in **Settings → MCP Server**, with a copy button.

## Connect

Choose the client you use. The setup cards on the [MCP Server docs home](/docs)
and in **Settings → MCP Server** copy the exact endpoint automatically.

### Claude Code

```bash
claude mcp add --transport http wryte https://<your-deployment>.convex.site/mcp
```

Then run `/mcp`, pick **wryte**, and choose **Authenticate**.

### Claude Desktop

In Claude Desktop, open **Settings → Connectors → Add custom connector** and
paste the Wryte endpoint. Claude opens the browser to finish sign-in.

### Codex

```bash
codex mcp add wryte --url https://<your-deployment>.convex.site/mcp
```

Then authenticate the `wryte` server from Codex. Codex opens the browser and
stores the OAuth credential in its own credential store.

Codex Desktop and Codex CLI use the same MCP configuration, so the command
above also makes Wryte available in the desktop app.

### Cursor

Cursor supports a one-click **Add to Cursor** action from the setup card. For a
manual setup, add this to your global `~/.cursor/mcp.json` or a project-level
`.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "wryte": {
      "url": "https://<your-deployment>.convex.site/mcp"
    }
  }
}
```

After adding it, open Cursor's MCP settings and authenticate `wryte` when
prompted. Each client opens the browser for OAuth approval; Wryte never creates
or stores a copy-paste API token.

Use the URL exactly as shown, with no trailing slash. The server advertises
itself under that precise spelling, and the OAuth spec makes clients verify the
two match character for character.

## What an agent can do

The canonical loop this was built for:

> Look at my existing posts, research this topic, file what you find, then write
> me a first draft.

That works out of the box — read and write are granted by default. Publishing,
media upload and trash are opt-in, because they have effects outside Wryte:
commits land in your GitHub repo, uploads spend your storage provider's quota,
and deletion is deletion.

## Design notes worth knowing

- **21 tools, deliberately.** An earlier cut had 48. Every tool description sits
  in the model's context on every turn, and near-duplicate tools make models pick
  wrong and retry. Fewer, better-shaped tools cost less and work better.
- **Nothing irreversible is reachable.** No permanent delete, no project delete,
  no account deletion, and nothing that touches stored credentials. The worst an
  agent can do is move a document to the trash, which you can restore.
- **Agents share your app's rules.** Tools call the same functions the web app
  does, so every ownership check, quota and rate limit already applies.

## Read next

- [Authentication](/docs/authentication) — how the OAuth flow works and why there's no API token
- [Capabilities](/docs/capabilities) — the five permissions and how to change them
- [Tool reference](/docs/tools) — all 21 tools with arguments
- [Resources](/docs/resources) — context an agent should read before acting
- [Rate limits](/docs/rate-limits) — what's enforced, and what happens when you hit it
- [Troubleshooting](/docs/troubleshooting) — every error message and what it means
