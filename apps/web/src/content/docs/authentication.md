# Authentication

Wryte's MCP server uses **OAuth 2.1 with PKCE**, brokered by Clerk. No API
tokens.

## The flow

1. Your agent calls the endpoint with no credentials and gets **HTTP 401** plus a
   `WWW-Authenticate` header pointing at a discovery document.
2. It fetches that document (RFC 9728) and learns that Clerk is the authorization
   server.
3. It **registers itself** with Clerk automatically (RFC 7591 Dynamic Client
   Registration). You never copy a client ID or secret.
4. A browser opens, you approve, and the agent receives a short-lived access
   token plus a refresh token.
5. Every later request carries `Authorization: Bearer <token>`. Convex verifies
   the signature locally against your Clerk instance's public keys — no network
   round trip per call.

Steps 1–4 happen once per machine, and the agent handles all of them.

## Why not an API token

A token would have been faster to build. It's also worse in every way that
matters once something goes wrong.

| | API token | OAuth |
|---|---|---|
| Where it lives | Plaintext in `.mcp.json`, which gets committed | Nowhere you manage; the client's own credential store |
| Lifetime | Until you remember to rotate it | Short-lived, silently refreshed |
| Blast radius | The whole account, no scopes | Scoped — a read-only token can't write |
| Revocation | Rotate it, break every machine you own | Revoke one client; your laptop keeps working |
| Attribution | All calls look identical | Every machine is a distinct registration, named in the audit log |

If a token leaks, an OAuth access token expires on its own, only carries the
capabilities you granted, and can be revoked for that one machine.

## Identity, precisely

The token proves **who you are**. It does not carry **what you can do** — see
[Capabilities](/docs/capabilities) for why.

Your Convex `users` row is matched by the Clerk subject in the token. If you
authorize an agent before ever signing in to Wryte in a browser, there is no row
to match and every tool returns a clear error telling you to sign in once first.

## Revoking access

Revoke an individual client from your Clerk dashboard under **OAuth
applications**. That cuts off one machine — a compromised CI box, an old laptop
— while everything else keeps working.

To remove *all* agent access at once, turn every capability off in
**Settings → MCP Server**. Tokens stay valid but every tool refuses.
