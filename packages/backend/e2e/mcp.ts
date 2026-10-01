import { createClerkClient } from "@clerk/backend";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { SCOPES } from "../convex/mcp/scopes";
import { McpClient, type ToolOutcome } from "./mcpClient";

const siteUrl = (process.env["NEXT_PUBLIC_CONVEX_SITE_URL"] ?? "").replace(
  /\/+$/,
  "",
);
const convexUrl = process.env["NEXT_PUBLIC_CONVEX_URL"] ?? "";
const secretKey = process.env["CLERK_SECRET_KEY"] ?? "";
const withMedia = process.env["MCP_E2E_MEDIA"] === "1";

if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(siteUrl)) {
  throw new Error(
    `Refusing to run: NEXT_PUBLIC_CONVEX_SITE_URL must be the local Convex site URL, got "${siteUrl}".`,
  );
}
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(convexUrl)) {
  throw new Error(
    `Refusing to run: NEXT_PUBLIC_CONVEX_URL must be the local Convex URL, got "${convexUrl}".`,
  );
}
if (!secretKey.startsWith("sk_test_")) {
  throw new Error("Refusing to run: CLERK_SECRET_KEY must be a sk_test_ key.");
}

const FORBIDDEN_TOOLS = [
  "wryte_publish_document",
  "wryte_schedule_set",
  "wryte_schedule_cancel",
  "wryte_drafts_promote",
  "wryte_drafts_create",
  "wryte_drafts_update_content",
  "wryte_animations_create",
  "wryte_animations_update",
  "wryte_animations_replace_by_name",
];

const REQUIRED_TOOLS = [
  "wryte_projects_list",
  "wryte_project_context",
  "wryte_documents_create",
  "wryte_documents_get",
  "wryte_documents_update",
  "wryte_documents_workspace",
  "wryte_drafts_snapshot",
  "wryte_drafts_update",
  "wryte_drafts_remove",
  "wryte_research_create",
  "wryte_animations_upsert",
  "wryte_animations_remove",
];

const NOTE_TOOLS = [
  "wryte_notes_list",
  "wryte_notes_search",
  "wryte_notes_get",
  "wryte_note_groups_list",
  "wryte_notes_create",
  "wryte_notes_update",
  "wryte_notes_append",
  "wryte_notes_trash",
];

const E2E_SCOPES = [SCOPES.trash, SCOPES.notes];
const NOTE_PAGE = 25;
const MAX_LIST_BYTES = 15 * 1024;
const RATE_RETRIES = 45;

const PIXEL_PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  ),
  (char) => char.charCodeAt(0),
);

let passed = 0;
let failed = 0;
let skipped = 0;

function check(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    passed++;
    console.info(`  ✓ ${name}`);
    return;
  }
  failed++;
  console.error(`  ✗ ${name}`);
  if (detail !== undefined) console.error(`    ${JSON.stringify(detail)}`);
}

function skip(name: string, reason: string): void {
  skipped++;
  console.info(`  - ${name} (skipped: ${reason})`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function field(value: unknown, ...path: string[]): unknown {
  let current: unknown = value;
  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

function isNoteId(value: unknown): value is Id<"notes"> {
  return typeof value === "string";
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function refusedWith(outcome: ToolOutcome, text: string): boolean {
  return !outcome.ok && outcome.error.includes(text);
}

function data(outcome: ToolOutcome): unknown {
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.data;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimited(message: string): boolean {
  return message.includes("Rate limited") || message.includes("RateLimited");
}

async function patiently<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!isRateLimited(message) || attempt >= RATE_RETRIES) throw error;
      await sleep(2000);
    }
  }
}

async function callPatiently(
  client: McpClient,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolOutcome> {
  for (let attempt = 0; ; attempt++) {
    const outcome = await client.call(name, args);
    if (outcome.ok || !isRateLimited(outcome.error)) return outcome;
    if (attempt >= RATE_RETRIES) return outcome;
    await sleep(2000);
  }
}

async function timed(
  label: string,
  run: () => Promise<ToolOutcome>,
): Promise<ToolOutcome> {
  const started = performance.now();
  const outcome = await run();
  const ms = Math.round(performance.now() - started);
  const bytes = outcome.ok ? JSON.stringify(outcome.data).length : 0;
  console.info(
    `    ${label}: ${String(ms)} ms, ${(bytes / 1024).toFixed(1)} KB`,
  );
  return outcome;
}

const clerk = createClerkClient({ secretKey });

async function resolveClerkUserId(): Promise<string> {
  const email = process.env["MCP_E2E_USER_EMAIL"];
  const users = await clerk.users.getUserList(
    email
      ? { emailAddress: [email], limit: 1 }
      : { limit: 1, orderBy: "created_at" },
  );
  const user = users.data[0];
  if (!user) throw new Error("No Clerk user found for the e2e run");
  console.info(
    `user: ${user.primaryEmailAddress?.emailAddress ?? user.id} (set MCP_E2E_USER_EMAIL to pick another)`,
  );
  return user.id;
}

const ANIMATION_LIMIT = 200;

async function pickProject(
  client: McpClient,
  projects: unknown[],
): Promise<unknown> {
  const pinned = process.env["MCP_E2E_PROJECT_ID"];
  if (pinned) return projects.find((p) => field(p, "projectId") === pinned);

  for (const project of projects) {
    const projectId = field(project, "projectId");
    if (field(project, "contentFormat") !== "mdx") continue;
    const context = await client.call("wryte_project_context", { projectId });
    if (!context.ok || field(context.data, "animations", "enabled") !== true) {
      continue;
    }
    const animations = await client.call("wryte_animations_list", {
      projectId,
    });
    if (animations.ok && list(animations.data).length < ANIMATION_LIMIT) {
      return project;
    }
  }
  return projects[0];
}

async function main(): Promise<void> {
  const unauthenticated = await fetch(`${siteUrl}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  });
  console.info("auth");
  check("rejects a request with no token", unauthenticated.status === 401);
  const forged = await fetch(`${siteUrl}/mcp`, {
    method: "POST",
    headers: {
      authorization: "Bearer not.a.jwt",
      "content-type": "application/json",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  });
  check(
    "answers a malformed token with 401 and an OAuth challenge",
    forged.status === 401 &&
      (forged.headers.get("www-authenticate") ?? "").includes(
        "resource_metadata",
      ),
    forged.status,
  );

  const session = await clerk.sessions.createSession({
    userId: await resolveClerkUserId(),
  });
  let cached: { jwt: string; at: number } | null = null;
  const token = async (): Promise<string> => {
    if (cached && Date.now() - cached.at < 30_000) return cached.jwt;
    const { jwt } = await clerk.sessions.getToken(session.id);
    cached = { jwt, at: Date.now() };
    return jwt;
  };

  const convex = new ConvexHttpClient(convexUrl);
  convex.setAuth(await token());
  const grant = await convex.query(api.mcp.grants.myGrant, {});
  const addedScopes = E2E_SCOPES.filter((scope) => !grant.includes(scope));
  if (addedScopes.length > 0) {
    await convex.mutation(api.mcp.grants.setGrant, {
      scopes: [...grant, ...addedScopes],
    });
  }
  const authed = async () => {
    convex.setAuth(await token());
    return convex;
  };

  const client = new McpClient(`${siteUrl}/mcp`, token);
  const cleanup: (() => Promise<unknown>)[] = [];

  try {
    const init = await client.initialize();
    check(
      "initialize returns drafts-only instructions",
      String(field(init, "instructions")).includes("Main version"),
    );

    const tools = await client.listTools();
    console.info("tool surface");
    check(`lists ${String(tools.length)} tools`, tools.length > 0);
    const missing = REQUIRED_TOOLS.filter((name) => !tools.includes(name));
    check("has every core tool", missing.length === 0, missing);
    const leaked = FORBIDDEN_TOOLS.filter((name) => tools.includes(name));
    check(
      "exposes no Main, publish or legacy tools",
      leaked.length === 0,
      leaked,
    );

    const projects = list(data(await client.call("wryte_projects_list", {})));
    const project = await pickProject(client, projects);
    const projectId = field(project, "projectId");
    if (typeof projectId !== "string") {
      throw new Error("The e2e user has no projects in the local deployment");
    }
    console.info(
      `project: ${String(field(project, "name"))} (set MCP_E2E_PROJECT_ID to pick another)`,
    );

    const context = data(
      await client.call("wryte_project_context", { projectId }),
    );
    console.info("project context");
    const statuses = list(field(context, "statuses"));
    check("returns agent statuses", statuses.length > 0);
    check(
      "hides scheduling and publishing columns",
      !statuses.some((s) =>
        ["scheduled", "published"].includes(String(field(s, "id"))),
      ),
    );
    const mdx = field(context, "content", "format") === "mdx";
    const animationsOn = field(context, "animations", "enabled") === true;
    const checkLevel = String(field(context, "animations", "checks", "level"));

    const frontmatter: Record<string, string> = {};
    const requiredFields = list(
      field(context, "frontmatter", "requiredFields"),
    );
    for (const name of requiredFields) {
      frontmatter[String(name)] = "mcp-e2e";
    }

    const stamp = Date.now().toString(36);
    console.info("post shell");
    const documentId = data(
      await client.call("wryte_documents_create", {
        projectId,
        title: `MCP e2e ${stamp}`,
        slug: `mcp-e2e-${stamp}`,
        frontmatter: JSON.stringify(frontmatter),
      }),
    );
    if (typeof documentId !== "string") throw new Error("No document id");
    check("creates a post shell", true);
    check(
      "lists the trash tool once granted",
      tools.includes("wryte_documents_trash"),
    );
    cleanup.push(async () => {
      const trashed = await client.call("wryte_documents_trash", {
        documentId,
      });
      const restored = await client.call("wryte_trash_restore", {
        documentId,
      });
      const retrashed = await client.call("wryte_documents_trash", {
        documentId,
      });
      check(
        "trashes, restores and re-trashes its own empty post",
        trashed.ok && restored.ok && retrashed.ok,
        [trashed, restored, retrashed],
      );
    });

    const shell = (overrides: Record<string, unknown>) =>
      client.call("wryte_documents_create", {
        projectId,
        title: `MCP e2e ${stamp} bad`,
        slug: `mcp-e2e-${stamp}-bad`,
        frontmatter: JSON.stringify(frontmatter),
        ...overrides,
      });
    const refusals: [string, Record<string, unknown>, string][] = [
      ["a taken slug", { slug: `mcp-e2e-${stamp}` }, "already used"],
      [
        "a slug with spaces and slashes",
        { slug: "Bad Slug/../x" },
        "Slug must be",
      ],
      ["an empty title", { title: "  " }, "Title is required"],
      ["frontmatter that is not JSON", { frontmatter: "{nope" }, "JSON object"],
      ["frontmatter that is an array", { frontmatter: "[1]" }, "JSON object"],
      ...(requiredFields.length > 0
        ? [
            [
              "frontmatter without required fields",
              { frontmatter: "{}" },
              "missing required fields",
            ] satisfies [string, Record<string, unknown>, string],
          ]
        : []),
    ];
    for (const [label, overrides, reason] of refusals) {
      const outcome = await shell(overrides);
      check(`refuses ${label}`, refusedWith(outcome, reason), outcome);
      if (outcome.ok && typeof outcome.data === "string") {
        const leaked = outcome.data;
        cleanup.push(() =>
          client.call("wryte_documents_trash", { documentId: leaked }),
        );
      }
    }

    const created = await client.call("wryte_documents_create", {
      projectId,
      title: "x",
      slug: `mcp-e2e-${stamp}-body`,
      content: "agent body",
    });
    check("rejects a Main body on create", !created.ok);

    const doc = data(await client.call("wryte_documents_get", { documentId }));
    check(
      "get never returns the Main body",
      isRecord(doc) && !("content" in doc) && field(doc, "mainWordCount") === 0,
      doc,
    );

    const toPublished = await client.call("wryte_documents_update", {
      documentId,
      status: "published",
    });
    check(
      "refuses a publishing status and says why",
      refusedWith(toPublished, "can't be set over MCP"),
      toPublished,
    );
    const retag = await client.call("wryte_documents_update", {
      documentId,
      tags: [" mcp-e2e ", "mcp-e2e", ""],
    });
    const retagged = data(
      await client.call("wryte_documents_get", { documentId }),
    );
    check(
      "retags the post with trimmed, deduped tags",
      retag.ok && JSON.stringify(field(retagged, "tags")) === '["mcp-e2e"]',
      field(retagged, "tags"),
    );
    const noop = await client.call("wryte_documents_update", { documentId });
    check(
      "refuses an update with nothing to change",
      refusedWith(noop, "Nothing to update"),
      noop,
    );

    console.info("research");
    const research = data(
      await client.call("wryte_research_create", {
        documentId,
        items: [
          {
            type: "source",
            title: "Spec",
            content: "MCP spec",
            url: "https://modelcontextprotocol.io",
          },
          {
            type: "note",
            title: "Angle",
            content: "Agents write drafts, humans write Main.",
          },
        ],
      }),
    );
    check("files a batch of research", list(research).length === 2, research);
    const tooMany = await client.call("wryte_research_create", {
      documentId,
      items: Array.from({ length: 16 }, (_, i) => ({
        type: "note",
        title: `n${String(i)}`,
        content: "x",
      })),
    });
    check(
      "rejects more than 15 items and says why",
      refusedWith(tooMany, "At most 15"),
      tooMany,
    );
    const none = await client.call("wryte_research_create", {
      documentId,
      items: [],
    });
    check("rejects an empty batch", refusedWith(none, "at least one"), none);
    const script = await client.call("wryte_research_create", {
      documentId,
      items: [
        {
          type: "source",
          title: "x",
          content: "x",
          url: "javascript:alert(1)",
        },
      ],
    });
    check(
      "rejects a non-http research url",
      refusedWith(script, "http or https"),
      script,
    );

    let animationCreated = false;
    const animationName = `McpE2e${stamp.replace(/^[^a-z]*/i, "").replace(/^./, (c) => c.toUpperCase())}`;
    console.info("animations");
    const badName = await client.call("wryte_animations_upsert", {
      projectId,
      name: "lowercase",
      source: "export default function lowercase() { return null; }",
      dryRun: true,
    });
    check(
      "dryRun refuses a non-PascalCase name",
      refusedWith(badName, "PascalCase"),
      badName,
    );
    if (!animationsOn) {
      skip("animation upsert", "code animations are off for this project");
    } else {
      const broken = data(
        await client.call("wryte_animations_upsert", {
          projectId,
          name: animationName,
          dryRun: true,
          source: `export default function A(p: any) { const w = window.innerWidth; return <div>{w}{p}</div>; }\nconst top = window.location.href;`,
        }),
      );
      if (checkLevel === "off") {
        check(
          "dryRun reports skipped when checks are off",
          field(broken, "check", "status") === "skipped",
        );
      } else {
        check(
          "dryRun finds errors in broken source",
          field(broken, "check", "status") === "fail" &&
            list(field(broken, "check", "diagnostics")).length > 0,
          field(broken, "check"),
        );
      }
      check("dryRun saves nothing", field(broken, "animationId") === null);

      const source = `export default function ${animationName}() {\n  return (\n    <svg role="img" aria-label="dot" viewBox="0 0 10 10">\n      <circle cx={5} cy={5} r={4} />\n    </svg>\n  );\n}\n`;
      const firstOutcome = await client.call("wryte_animations_upsert", {
        projectId,
        name: animationName,
        source,
      });
      if (refusedWith(firstOutcome, "limit of")) {
        skip("animation create", firstOutcome.ok ? "" : firstOutcome.error);
      } else {
        const first = data(firstOutcome);
        const animationId = field(first, "animationId");
        if (typeof animationId === "string") {
          cleanup.push(() =>
            client.call("wryte_animations_remove", { animationId }),
          );
        }
        check(
          "creates a valid animation",
          field(first, "created") === true,
          first,
        );
        check(
          "records a passing check",
          checkLevel === "off"
            ? field(first, "check", "status") === "skipped"
            : ["pass", "warn"].includes(
                String(field(first, "check", "status")),
              ),
          field(first, "check"),
        );
        const second = data(
          await client.call("wryte_animations_upsert", {
            projectId,
            name: animationName,
            source,
          }),
        );
        check(
          "upsert by the same name replaces",
          field(second, "created") === false,
        );
        animationCreated = true;
      }
    }

    console.info("drafts");
    const body = `# MCP e2e\n\nDraft written by the e2e run.\n\n<${animationName} />\n\n<NotAnAnimation />\n`;
    const snapshot = data(
      await client.call("wryte_drafts_snapshot", {
        documentId,
        label: "e2e · wryte-mcp-e2e",
        title: `MCP e2e ${stamp}`,
        content: body,
        frontmatter: JSON.stringify(frontmatter),
      }),
    );
    const draftId = field(snapshot, "draftId");
    check("writes a draft tab", typeof draftId === "string", snapshot);
    cleanup.push(() => client.call("wryte_drafts_remove", { draftId }));
    const unknown = list(field(snapshot, "unknownComponents"));
    if (mdx) {
      check(
        "reports unknown components",
        unknown.includes("NotAnAnimation") &&
          (!animationCreated || !unknown.includes(animationName)),
        unknown,
      );
    } else {
      skip("unknown component report", "project content is md");
    }

    const unlabeled = await client.call("wryte_drafts_snapshot", {
      documentId,
      label: " ",
      title: "x",
      content: "x",
    });
    check(
      "refuses a draft with no label",
      refusedWith(unlabeled, "Label is required"),
      unlabeled,
    );

    const updated = await client.call("wryte_drafts_update", {
      draftId,
      label: "e2e · renamed",
      summary: "updated by e2e",
    });
    check("updates draft label and summary", updated.ok, updated);
    const emptyUpdate = await client.call("wryte_drafts_update", { draftId });
    check(
      "refuses a draft update with nothing to change",
      refusedWith(emptyUpdate, "Nothing to update"),
      emptyUpdate,
    );

    const rewritten = `${body}\nRewritten ✨ ünïcödé.\n`;
    const rewrite = await client.call("wryte_drafts_update", {
      draftId,
      content: rewritten,
    });
    const stored = data(await client.call("wryte_drafts_get", { draftId }));
    check(
      "stores the rewritten body exactly",
      rewrite.ok &&
        field(stored, "content") === rewritten &&
        field(stored, "label") === "e2e · renamed",
      { label: field(stored, "label") },
    );

    let mediaUrl: unknown = null;
    console.info("media");
    if (!tools.includes("wryte_media_upload_url")) {
      skip("media upload", "Media capability is off for this account");
    } else if (!withMedia) {
      skip("media upload", "uploads to the real provider; set MCP_E2E_MEDIA=1");
    } else {
      const ticket = data(
        await client.call("wryte_media_upload_url", {
          projectId,
          documentId,
          filename: `mcp-e2e-${stamp}.png`,
          alt: "e2e pixel",
        }),
      );
      const uploadUrl = String(field(ticket, "uploadUrl"));
      check(
        "issues an upload URL on the Convex site",
        uploadUrl.startsWith(`${siteUrl}/mcp/media?ticket=`),
      );
      const upload = await fetch(uploadUrl, {
        method: "POST",
        headers: { "content-type": "image/png" },
        body: PIXEL_PNG,
      });
      const uploaded: unknown = await upload.json();
      mediaUrl = field(uploaded, "url");
      check(
        "uploads the file to the project provider",
        upload.ok &&
          typeof mediaUrl === "string" &&
          String(field(uploaded, "markdown")).startsWith("![e2e pixel]("),
        uploaded,
      );
      const reused = await fetch(uploadUrl, {
        method: "POST",
        headers: { "content-type": "image/png" },
        body: PIXEL_PNG,
      });
      check("upload URL is single use", reused.status === 401);
    }

    console.info("workspace");
    const workspace = data(
      await client.call("wryte_documents_workspace", { documentId }),
    );
    check("lists the draft", list(field(workspace, "drafts")).length === 1);
    check(
      "lists the research",
      list(field(workspace, "research")).length === 2,
    );
    if (mdx && animationCreated) {
      const referenced = list(field(workspace, "animations")).find(
        (a) => field(a, "name") === animationName,
      );
      check(
        "links the animation to the draft with its check",
        list(field(referenced, "referencedIn")).includes(draftId) &&
          field(referenced, "check") !== "stale",
        referenced,
      );
    }
    if (typeof mediaUrl === "string") {
      check(
        "lists the uploaded image",
        list(field(workspace, "media")).some(
          (m) => field(m, "url") === mediaUrl,
        ),
      );
      console.info(
        `  note: ${mediaUrl} stays in the provider; delete it there if you want`,
      );
    }

    console.info("notes");
    const missingNoteTools = NOTE_TOOLS.filter((name) => !tools.includes(name));
    check(
      "lists every notes tool once granted",
      missingNoteTools.length === 0,
      missingNoteTools,
    );
    const groupName = `MCP e2e ${stamp}`;
    const marker = `zebra${stamp}`;
    const noteIds: Id<"notes">[] = [];
    cleanup.push(async () => {
      let purged = 0;
      for (const noteId of noteIds) {
        await patiently(async () =>
          (await authed()).mutation(api.cms.notes.notes.trash, { noteId }),
        );
        await patiently(async () =>
          (await authed()).mutation(api.cms.notes.notes.purge, { noteId }),
        );
        purged++;
      }
      const rail = await (await authed()).query(api.cms.notes.groups.rail, {});
      const group = rail.groups.find((row) => row.name === groupName);
      if (group) {
        await patiently(async () =>
          (await authed()).mutation(api.cms.notes.groups.remove, {
            groupId: group._id,
          }),
        );
      }
      check(
        `purges its ${String(purged)} notes and removes its group`,
        purged === noteIds.length &&
          !(
            await (await authed()).query(api.cms.notes.groups.rail, {})
          ).groups.some((row) => row.name === groupName),
      );
    });

    const createdNote = await timed("create", () =>
      callPatiently(client, "wryte_notes_create", {
        title: `MCP e2e note ${stamp}`,
        content: "First line from the e2e run.",
        group: groupName,
        documentIds: [documentId],
      }),
    );
    const noteId = field(data(createdNote), "noteId");
    if (!isNoteId(noteId)) throw new Error("No note id");
    noteIds.push(noteId);
    check(
      "creates a note in a new group and returns its web path",
      field(createdNote.ok ? createdNote.data : null, "rev") === 1 &&
        field(createdNote.ok ? createdNote.data : null, "url") ===
          `/notes/${noteId}`,
      createdNote,
    );

    const appended = await timed("append", () =>
      client.call("wryte_notes_append", {
        noteId,
        text: `Appended ${marker} ✨`,
      }),
    );
    check(
      "appends and bumps rev",
      field(data(appended), "rev") === 2,
      appended,
    );
    const emptyAppend = await client.call("wryte_notes_append", {
      noteId,
      text: "  ",
    });
    check(
      "refuses an empty append",
      refusedWith(emptyAppend, "Nothing to append"),
      emptyAppend,
    );

    const fetched = data(
      await timed("get", () => client.call("wryte_notes_get", { noteId })),
    );
    check(
      "get shows the appended text, group and linked post",
      String(field(fetched, "body")).includes("First line") &&
        String(field(fetched, "body")).includes(marker) &&
        field(fetched, "group") === groupName &&
        field(fetched, "rev") === 2 &&
        field(fetched, "truncated") === false &&
        field(fetched, "lastWriter") === "mcp" &&
        list(field(fetched, "links")).some(
          (link) => field(link, "documentId") === documentId,
        ),
      fetched,
    );

    const stale = await client.call("wryte_notes_update", {
      noteId,
      expectedRev: 1,
      content: "overwrite",
    });
    check(
      "refuses a content update with a stale expectedRev",
      refusedWith(stale, "changed since rev 1"),
      stale,
    );
    const blind = await client.call("wryte_notes_update", {
      noteId,
      content: "overwrite",
    });
    check(
      "refuses a content update without expectedRev",
      refusedWith(blind, "expectedRev is required"),
      blind,
    );
    const badDate = await client.call("wryte_notes_update", {
      noteId,
      dueDate: "2026-13-40",
    });
    check(
      "refuses an invalid due date",
      refusedWith(badDate, "YYYY-MM-DD"),
      badDate,
    );
    const todo = await timed("update", () =>
      client.call("wryte_notes_update", {
        noteId,
        status: "todo",
        dueDate: "2030-01-15",
      }),
    );
    const asTodo = data(await client.call("wryte_notes_get", { noteId }));
    check(
      "turns the note into a todo with a due date",
      todo.ok &&
        field(asTodo, "status") === "todo" &&
        field(asTodo, "dueDate") === "2030-01-15",
      asTodo,
    );
    const dueSoon = data(
      await client.call("wryte_notes_list", {
        status: "todo",
        dueBefore: "2030-01-16",
        group: groupName,
      }),
    );
    check(
      "lists it among todos due before a date",
      list(field(dueSoon, "notes")).some(
        (row) => field(row, "noteId") === noteId,
      ),
      dueSoon,
    );
    const noStatus = await client.call("wryte_notes_list", {
      dueBefore: "2030-01-16",
    });
    check(
      "refuses dueBefore without a status",
      refusedWith(noStatus, "pass status"),
      noStatus,
    );
    const done = data(
      await client.call("wryte_notes_update", { noteId, status: "done" }),
    );
    const asDone = data(await client.call("wryte_notes_get", { noteId }));
    check(
      "marks it done",
      typeof field(done, "rev") === "number" &&
        field(asDone, "status") === "done" &&
        typeof field(asDone, "completedAt") === "number",
      asDone,
    );
    const rev = field(asDone, "rev");
    const replaced = await client.call("wryte_notes_update", {
      noteId,
      expectedRev: rev,
      content: `Replaced body ${marker}\n${"long line of text ".repeat(200)}`,
    });
    check("replaces the body with the current rev", replaced.ok, replaced);

    const clipped = data(
      await client.call("wryte_notes_get", { noteId, maxChars: 100 }),
    );
    check(
      "get respects maxChars and flags truncation",
      String(field(clipped, "body")).length <= 100 &&
        field(clipped, "truncated") === true &&
        Number(field(clipped, "totalChars")) > 100,
      { truncated: field(clipped, "truncated") },
    );

    const fillerBody = `Filler note for the list payload check. ${"word ".repeat(400)}`;
    for (let i = noteIds.length; i < NOTE_PAGE; i++) {
      const filler = await callPatiently(client, "wryte_notes_create", {
        title: `MCP e2e filler ${String(i)} ${"x".repeat(170)}`,
        content: fillerBody,
        group: groupName,
        status: "todo",
        dueDate: "2030-02-01",
      });
      const fillerId = field(data(filler), "noteId");
      if (isNoteId(fillerId)) noteIds.push(fillerId);
    }
    const page = await timed(`list ${String(NOTE_PAGE)} rows`, () =>
      client.call("wryte_notes_list", { group: groupName }),
    );
    const rows = list(field(data(page), "notes"));
    const pageBytes = JSON.stringify(data(page)).length;
    check(
      `lists ${String(NOTE_PAGE)} rows without bodies`,
      rows.length === NOTE_PAGE &&
        rows.every(
          (row) => isRecord(row) && !("body" in row) && !("content" in row),
        ),
      { rows: rows.length },
    );
    check(
      `list payload under 15 KB (${(pageBytes / 1024).toFixed(1)} KB)`,
      pageBytes < MAX_LIST_BYTES,
    );

    const groups = data(
      await timed("groups", () => client.call("wryte_note_groups_list", {})),
    );
    check(
      "groups list counts the run's notes",
      list(groups).some(
        (group) =>
          field(group, "name") === groupName &&
          field(group, "noteCount") === NOTE_PAGE,
      ),
      list(groups).find((group) => field(group, "name") === groupName),
    );

    const hits = data(
      await timed("search", () =>
        client.call("wryte_notes_search", { query: marker }),
      ),
    );
    check(
      "search finds the note by body text",
      list(hits).some((hit) => field(hit, "noteId") === noteId),
      hits,
    );

    const linked = data(
      await client.call("wryte_notes_list", { linkedDocumentId: documentId }),
    );
    check(
      "lists notes linked to the post",
      list(field(linked, "notes")).some(
        (row) => field(row, "noteId") === noteId,
      ),
    );

    const trashedNote = await timed("trash", () =>
      client.call("wryte_notes_trash", { noteId }),
    );
    const gone = await client.call("wryte_notes_get", { noteId });
    check(
      "trashes the note",
      field(trashedNote.ok ? trashedNote.data : null, "ok") === true &&
        refusedWith(gone, "Note not found"),
      [trashedNote, gone],
    );
  } finally {
    console.info("cleanup");
    for (const step of cleanup.reverse()) await step();
    if (addedScopes.length > 0) {
      await (await authed()).mutation(api.mcp.grants.setGrant, {
        scopes: grant,
      });
    }
    await clerk.sessions.revokeSession(session.id);
  }
}

try {
  await main();
} catch (error) {
  failed++;
  console.error(
    `✗ aborted: ${error instanceof Error ? error.message : String(error)}`,
  );
}

console.info(
  `\n${String(passed)} passed, ${String(failed)} failed, ${String(skipped)} skipped`,
);
process.exit(failed > 0 ? 1 : 0);
