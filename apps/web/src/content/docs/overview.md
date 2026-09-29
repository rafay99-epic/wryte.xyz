# MCP server

Wryte ships a Model Context Protocol server, so a coding agent (Claude Code,
Cursor, or anything that speaks MCP) can research, write drafts, build animations
and upload images around your posts. You write the Main version and publish.

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
prompted.

### VS Code

Use the **VS Code** button on the setup card, or run **MCP: Add Server** from the
Command Palette, choose **HTTP**, and paste the endpoint. VS Code writes it to
your `mcp.json`:

```json
{
  "servers": {
    "wryte": {
      "type": "http",
      "url": "https://<your-deployment>.convex.site/mcp"
    }
  }
}
```

Start the server from the Extensions view or `mcp.json`, then sign in when VS
Code asks.

### ChatGPT

ChatGPT connects to remote MCP servers in developer mode, on paid plans.

1. Turn on **Developer mode** in ChatGPT's settings. On Business and Enterprise
   workspaces an admin may need to allow custom connectors first.
2. Create a new app or connector, name it **Wryte**, paste the endpoint, and
   choose **OAuth** as the authentication.
3. Connect, approve access in the browser, then pick Wryte from the developer
   mode tools in a new chat.

ChatGPT moves these menus often. If a label doesn't match, search its settings
for "Developer mode". Each client opens the browser for OAuth approval; Wryte never creates
or stores a copy-paste API token.

Use the URL exactly as shown, with no trailing slash. The server advertises
itself under that precise spelling, and the OAuth spec makes clients verify the
two match character for character.

## Upgrading from the earlier server

Nothing to reinstall. The endpoint and sign-in are the same, so an existing
connection keeps working and picks up the new tools the next time your client
starts a session. Restart the client, or reconnect `wryte`, if it still lists
the old tools.

What changed for agents:

- Drafts replace direct edits. `wryte_drafts_create`, `wryte_drafts_update_content`
  and `wryte_drafts_promote` are gone; use `wryte_drafts_snapshot` and
  `wryte_drafts_update`. Agents never touch the Main version.
- Publishing and scheduling are gone: `wryte_publish_document`,
  `wryte_schedule_set` and `wryte_schedule_cancel`. The Publish capability no
  longer exists, and a stored Publish grant is ignored.
- One animation tool. `wryte_animations_upsert` replaces create, update and
  replace-by-name, and runs the project's checks before saving.
- New: `wryte_project_context`, `wryte_documents_workspace` and
  `wryte_media_upload_url`.
- Stricter input. Slugs, titles, frontmatter, tags, draft labels and research
  are validated, and a refusal says exactly what to fix.

A saved prompt or script that calls a removed tool gets `Unknown tool`. Point it
at the replacement above.

## What an agent can do

The canonical loop this was built for:

> Look at my existing posts, research this topic, file what you find, then write
> me a first draft.

That works out of the box: read and write are granted by default. Media upload
and trash are opt-in, because uploads spend your storage provider's quota and
deletion is deletion. Publishing is never available to an agent.

## Design notes worth knowing

- **30 tools, deliberately.** An earlier cut had 48. Every tool description sits
  in the model's context on every turn, and near-duplicate tools make models pick
  wrong and retry. Fewer, better-shaped tools cost less and work better.
- **Nothing irreversible is reachable.** No permanent delete, no project delete,
  no account deletion, and nothing that touches stored credentials. The worst an
  agent can do is trash a post whose Main version is still empty, which you can
  restore.
- **Main is yours.** Agents write draft tabs. No tool reads or writes the Main
  body, promotes a draft, schedules or publishes.
- **Agents share your app's rules.** Tools call the same functions the web app
  does, so every ownership check, quota and rate limit already applies.

## Read next

- [Authentication](/docs/authentication): how the OAuth flow works and why there's no API token
- [Capabilities](/docs/capabilities): the four permissions and how to change them
- [Tool reference](/docs/tools): all 30 tools with arguments
- [Resources](/docs/resources): context an agent should read before acting
- [Rate limits](/docs/rate-limits): what's enforced, and what happens when you hit it
- [Troubleshooting](/docs/troubleshooting): every error message and what it means
