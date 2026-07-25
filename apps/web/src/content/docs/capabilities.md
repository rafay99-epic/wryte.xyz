# Capabilities

Five capabilities gate what a connected agent can do. Manage them in
**Settings → MCP Server**.

| Capability | Grants | Default |
|---|---|---|
| **Read** | List and search projects, documents, research, calendar, stats, publish history | **on** |
| **Write** | Create and edit documents and research notes | **on** |
| **Publish** | Commit to GitHub, schedule and cancel publishing | off |
| **Media** | Upload and list media via the project's storage provider | off |
| **Trash** | Move documents to the project trash | off |

## Why read and write are both on

"Read my existing posts, research this topic, draft the first version" is one
intent, not two. A write-capable agent that can't read is useless, and one that
stops mid-task for a second approval is worse than one scoped correctly up front.

Everything with an effect **outside** Wryte stays opt-in. Publishing pushes
commits to your repo. Uploads spend your storage provider's quota. Deletion is
deletion.

## Where the grant lives, and why it isn't in the token

It's stored on your Wryte account, not in the OAuth token.

Clerk does not support custom OAuth scopes yet — its supported scope list is
fixed (`openid`, `profile`, `email`, `public_metadata`, `private_metadata`,
`offline_access`), so a `wryte:publish` scope cannot be issued or consented to at
all. So the split is: **the token proves identity, your Wryte setting decides
capability.**

The honest trade-off: a grant is **per-account, not per-client**. Two agents
belonging to you get the same capabilities, so a leaked token carries whatever
you have enabled. Per-client revocation still works in Clerk, and the audit log
still records which client did what. When Clerk ships custom scopes, the two will
be intersected rather than replaced.

## Effect of a change

Immediate — the next tool call picks it up. No reconnect, no re-authorization.

Turning a capability **off** also hides those tools: the catalog an agent sees is
exactly the set it could actually call, so it won't try a publish tool it would
be refused for.

## Never available, at any capability

- Permanent delete or emptying the trash
- Deleting a project
- Deleting your account
- Anything touching stored credentials — GitHub tokens, AI keys, storage provider
  secrets

An MCP server is a remote code path driven by a model reading text that other
people can influence. It has no business near secrets, and nothing it does should
be unrecoverable.
