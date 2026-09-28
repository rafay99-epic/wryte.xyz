# Resources

Alongside tools, the server exposes MCP **resources** — read-only context an
agent should load *before* acting. Tools are verbs; resources are the shape of
your workspace.

They exist to remove whole classes of repeated tool call, which makes them a cost
reduction rather than a nicety.

| URI | Contains | Saves |
|---|---|---|
| `wryte://projects` | Project index: id, name, slug, repo, branch, content path and format, media mode | Re-listing projects every turn just to remember which id is which |
| `wryte://project/{projectId}/frontmatter-schema` | The project's frontmatter contract | Guess → rejected → retry. Three tool calls where zero were needed |
| `wryte://project/{projectId}/board-columns` | Statuses an agent may set, in board order | Inventing a status like `in progress` when your board says `wip` |
| `wryte://document/{documentId}` | A post's title, slug, status, tags and frontmatter. Never the Main body | Spending a tool call to attach a post as context |

## The frontmatter schema resource

This is the one that matters most for draft quality. If your project defines a
frontmatter schema, a document whose frontmatter doesn't satisfy it is rejected
on write. Exposing the schema means the model writes valid frontmatter on the
first attempt instead of discovering your rules through failed mutations.

Not every client hands resources to the model, so the same data comes back from
the `wryte_project_context` tool, together with the animation and media rules.

## Server instructions

On connect, the server also returns short guidance on how Wryte is shaped: read
the project context first, create a post shell, file research as research, check
animations with upsert, upload images and paste the returned markdown, and write
a draft labelled with the model and harness. The Main version is the user's.

Per the MCP spec, clients *may* use it, so it's a strong hint rather than a
guarantee. Anything that must hold is enforced server-side instead.
