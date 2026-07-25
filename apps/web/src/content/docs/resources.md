# Resources

Alongside tools, the server exposes MCP **resources** — read-only context an
agent should load *before* acting. Tools are verbs; resources are the shape of
your workspace.

They exist to remove whole classes of repeated tool call, which makes them a cost
reduction rather than a nicety.

| URI | Contains | Saves |
|---|---|---|
| `wryte://projects` | Project index: id, name, slug, repo, branch, content path, media mode | Re-listing projects every turn just to remember which id is which |
| `wryte://project/{projectId}/frontmatter-schema` | The project's frontmatter contract | Guess → rejected → retry. Three tool calls where zero were needed |
| `wryte://project/{projectId}/board-columns` | Valid status values, in board order | Inventing a status like `in progress` when your board says `wip` |
| `wryte://document/{documentId}` | A document's frontmatter, body and tags | Spending a tool call to attach a document as context |

## The frontmatter schema resource

This is the one that matters most for draft quality. If your project defines a
frontmatter schema, a document whose frontmatter doesn't satisfy it is rejected
on write. Exposing the schema means the model writes valid frontmatter on the
first attempt instead of discovering your rules through failed mutations.

Any decent MCP client reads resources automatically. If yours doesn't, ask the
agent directly: *"read the frontmatter schema resource for this project before
writing."*

## Server instructions

On connect, the server also returns a short paragraph of guidance describing how
Wryte is shaped — work inside a project, search before creating, file research
findings as research notes rather than burying them in the body, page list
results with the cursor, branch for substantial rewrites.

Per the MCP spec, clients *may* use it, so it's a strong hint rather than a
guarantee. Anything that must hold is enforced server-side instead.
