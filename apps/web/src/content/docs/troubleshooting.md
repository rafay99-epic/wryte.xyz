# Troubleshooting

Every error the MCP server can return, and what to do about it.

## Connection

**`Protected resource ...\/mcp\/ does not match expected ...\/mcp`**

The configured URL and the advertised one disagree on the trailing slash. Use the
URL exactly as shown in **Settings → MCP Server**, with no trailing slash:

```bash
claude mcp remove wryte
claude mcp add --transport http wryte https://<your-deployment>.convex.site/mcp
```

**The agent never opens a browser**

The server isn't advertising a registration endpoint, so the client can't
self-register. Confirm discovery resolves:

```bash
curl https://<your-deployment>.convex.site/.well-known/oauth-protected-resource/mcp
```

You should get JSON containing `authorization_servers`. A `404` means OAuth isn't
configured on the deployment.

**`tools/list` is empty and no login is offered**

The backend is serving an older build, or every capability is off. Check
**Settings → MCP Server**.

## Authorization

**`No Wryte account for this identity. Sign in at wryte.xyz once, then reconnect.`**

Your token is valid but no Wryte account matches it. This happens if you
authorize an agent before ever signing in through the browser — the account row
is created on first web sign-in. Sign in once, then retry. No need to
re-authorize.

**`Forbidden: this capability is not enabled for MCP clients (...)`**

Exactly what it says: the token is fine, the capability is off. Enable it in
**Settings → MCP Server**. It applies immediately, with no reconnect.

Note this is a `403`, not a `401`, on purpose — a `401` would make your client
throw away a working token and re-run OAuth, which cannot help. The fix is a
toggle, not a fresh token.

**Publish or media tools aren't in the list at all**

Working as designed. Tools you can't call are hidden rather than shown and then
refused. Enable the capability and they appear.

## During a call

**`Rate limited. Slow down and retry.` (429)**

Back off for the `Retry-After` interval. See [Rate limits](/docs/rate-limits) for
the budgets and how to reduce round trips.

**`Tool execution failed`**

A deliberately generic message. Error text from a tool can quote URLs containing
credentials, so anything unexpected is replaced before it reaches the model;
specific, user-facing errors are passed through verbatim. The full detail is in
the audit log and your Convex logs.

**A write is rejected for invalid frontmatter**

Your project defines a frontmatter schema and the document doesn't satisfy it.
Have the agent read `wryte://project/{projectId}/frontmatter-schema` first — see
[Resources](/docs/resources).

**A status value is rejected**

Board statuses are per-project. Read
`wryte://project/{projectId}/board-columns` for the valid set.

## Losing work

**An agent trashed something**

Recoverable. Use `wryte_trash_restore`, or the trash view in the app. There is no
permanent delete over MCP at any capability.

**An agent and the editor both edited one document**

Last write wins on a field-by-field basis. For substantial rewrites, ask the
agent to branch a draft and promote it when done, rather than editing the live
document while you have it open.
