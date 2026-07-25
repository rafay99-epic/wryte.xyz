# Rate limits

Agents call APIs in bursts and loops. Everything below exists so that a runaway
agent costs you a `429` instead of an invoice.

## What's enforced

| Limit | Budget | Scope |
|---|---|---|
| Requests | 600/min, burst 120 | Per account |
| Connections (`initialize`) | 20/min | Per account |
| Global circuit breaker | 20,000/min, burst 4,000 | All MCP traffic, everyone |

Per-account limits key on your **account**, not the client, so every agent you
connect shares one budget — registering another client doesn't buy more quota.

Underneath these, **every mutation and action already carries its own per-user
limit** — the same ones the web app obeys, at 155 call sites across the backend.
So even if the MCP limits were misconfigured, an agent still can't exceed a
human's publishing or autosave allowance. There is deliberately no separate
MCP-specific write limit; it would spend a database write to enforce a ceiling
that already exists one layer down.

The global breaker is unkeyed. Every MCP request costs a few database writes, and
Convex caps concurrent writes per deployment, so without it one pathological
agent fleet could starve the web app of write throughput.

## Hitting a limit

You get **HTTP 429** with a `Retry-After` header in seconds. Well-behaved
clients back off on their own.

Rejections happen *before* the request reaches the tool layer, so a burst costs
almost nothing and can't inflate the audit log. That ordering is deliberate:
without it, an agent hammering a tool it lacks permission for would write one
audit row per attempt.

## Keeping calls low

Round trips, not tool count, drive limit consumption:

- **Read the resources.** The frontmatter schema alone turns a guess-reject-retry
  cycle into a single successful write.
- **Page with the cursor** rather than raising `limit`. List tools return lean
  rows — id, title, slug — on purpose.
- **Search before listing.** `wryte_documents_search` beats paging a project.

## Cost, honestly

Convex bills function calls, database bandwidth, egress and action compute. One
MCP tool call costs roughly 8 function calls and 4 small writes, against 1 call
for the same query from the web app — session bookkeeping, rate limiting and the
audit row.

Function calls are not the expensive part. **Response size is.** A document list
written for the app's live UI returns up to 500 rows with excerpts, around
200&nbsp;KB; the paginated equivalent is about 8&nbsp;KB. Across a million calls
that difference is roughly $64 versus $2.50. Which is why the MCP tools use lean,
paginated queries rather than reusing the UI's, and why list results look
deliberately sparse.

## Audit log

Every tool call writes one audit row: which tool, by which client, when, how
long, and whether it was allowed. Retained **7 days**, pruned hourly.

Document bodies and uploaded files are **redacted** from the log. You keep the
forensic record — that a body was written, by whom, when — without storing the
payload twice or paying to keep it.
