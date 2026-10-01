import { createClerkClient } from "@clerk/backend";
import { ConvexClient, ConvexHttpClient } from "convex/browser";
import type { FunctionReference, FunctionReturnType } from "convex/server";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { SCOPES, type Scope } from "../convex/mcp/scopes";
import { resetLimit, tokenIdentifier } from "./localConvex";
import { McpClient, type ToolOutcome } from "./mcpClient";

const siteUrl = (process.env["NEXT_PUBLIC_CONVEX_SITE_URL"] ?? "").replace(
  /\/+$/,
  "",
);
const convexUrl = process.env["NEXT_PUBLIC_CONVEX_URL"] ?? "";
const secretKey = process.env["CLERK_SECRET_KEY"] ?? "";
const LOCAL = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;

if (!LOCAL.test(siteUrl) || !LOCAL.test(convexUrl)) {
  throw new Error("Refusing to run: perf tests only run against local Convex.");
}
if (!secretKey.startsWith("sk_test_")) {
  throw new Error("Refusing to run: CLERK_SECRET_KEY must be a sk_test_ key.");
}

const WRITER = "perf-tab";
const TYPING_SAVES = 25;
const ARTICLE_SAVES = 20;
const BOARD_NOTES = 200;
const SHARE_NOTES = 50;
const SHARE_BIG_NOTES = 10;
const SHARE_BODY_CAP = 512 * 1024;
const BUDGET = {
  boardBytes: 20_000,
  flushArgBytes: 1_024,
  listBytes: 20_000,
  metaBytes: 1_500,
  railBytes: 10_000,
  saveP95Ms: 250,
  queryP95Ms: 250,
  mcpP95Ms: 400,
  mcpListBytes: 15_000,
  shareIndexBytes: 15_000,
};

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail?: unknown): void {
  if (ok) {
    passed++;
    console.info(`  ✓ ${name}`);
    return;
  }
  failed++;
  console.error(`  ✗ ${name}`);
  if (detail !== undefined) console.error(`    ${JSON.stringify(detail)}`);
}

function bytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function percentile(samples: number[], p: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1,
  );
  return Math.round(sorted[Math.max(0, index)] ?? 0);
}

function stats(samples: number[]): string {
  return `p50 ${String(percentile(samples, 50))} ms, p95 ${String(percentile(samples, 95))} ms`;
}

async function timed<T>(fn: () => Promise<T>, into: number[]): Promise<T> {
  const start = performance.now();
  const result = await fn();
  into.push(performance.now() - start);
  return result;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Watch = { updates: number; lastBytes: number; stop: () => void };

function watch<Q extends FunctionReference<"query">>(
  client: ConvexClient,
  query: Q,
  args: Q["_args"],
): Promise<Watch> {
  return new Promise((resolve, reject) => {
    let initial = true;
    const state: Watch = { updates: 0, lastBytes: 0, stop: () => {} };
    state.stop = client.onUpdate(
      query,
      args,
      (value: FunctionReturnType<Q>) => {
        state.lastBytes = bytes(value);
        if (initial) {
          initial = false;
          resolve(state);
          return;
        }
        state.updates++;
      },
      reject,
    );
  });
}

function typed(base: string, i: number): string {
  return `${base}\n\nLine ${String(i)}: the quick brown fox jumps over the lazy dog.`;
}

function data(outcome: ToolOutcome): unknown {
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.data;
}

function noteIdOf(value: unknown): string {
  if (
    typeof value === "object" &&
    value !== null &&
    "noteId" in value &&
    typeof value.noteId === "string"
  ) {
    return value.noteId;
  }
  throw new Error("MCP create returned no noteId");
}

async function throttled<T>(
  items: T[],
  limits: { name: string; every: number }[],
  key: string,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  for (const [index, item] of items.entries()) {
    for (const limit of limits) {
      if (index % limit.every === 0) resetLimit(limit.name, key);
    }
    await fn(item);
  }
}

async function notesSuite(client: ConvexClient): Promise<void> {
  console.info("notes: typing does not fan out");
  const word = `zq${Date.now().toString(36)}perf`;
  const body = "# Perf note\n\n".concat(
    "Some realistic note text. ".repeat(200),
  );
  const noteId = await client.mutation(api.cms.notes.notes.create, {
    title: "Perf note",
    content: body,
    writer: WRITER,
  });

  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const fromMs = Date.parse(`${month}-01T00:00:00`);
  const list = await watch(client, api.cms.notes.notes.list, {
    paginationOpts: { numItems: 50, cursor: null },
  });
  const meta = await watch(client, api.cms.notes.notes.getMeta, { noteId });
  const rail = await watch(client, api.cms.notes.groups.rail, {});
  const board = await watch(client, api.cms.notes.board.board, {});
  const calendar = await watch(client, api.cms.notes.calendar.month, {
    from: `${month}-01`,
    to: `${month}-31`,
    today,
    fromMs,
    toMs: fromMs + 31 * 86_400_000,
  });

  const saveTimes: number[] = [];
  let content = body;
  for (let i = 0; i < TYPING_SAVES; i++) {
    content = typed(content, i);
    if (i === 3) content = `${content} ${word}`;
    const result = await timed(
      () =>
        client.mutation(api.cms.notes.notes.save, {
          noteId,
          content,
          writer: WRITER,
        }),
      saveTimes,
    );
    if (result.touched) check(`save ${String(i)} did not touch`, false);
    await sleep(40);
  }
  await sleep(400);
  check(
    `${String(TYPING_SAVES)} autosaves re-ran 0 list/meta/rail/calendar/board subscriptions`,
    list.updates +
      meta.updates +
      rail.updates +
      calendar.updates +
      board.updates ===
      0,
    {
      list: list.updates,
      meta: meta.updates,
      rail: rail.updates,
      calendar: calendar.updates,
      board: board.updates,
    },
  );
  const stale = await client.query(api.cms.notes.notes.search, {
    query: word,
  });
  check(
    `${String(TYPING_SAVES)} autosaves wrote the search index 0 times`,
    !stale.some((hit) => hit.noteId === noteId),
    stale,
  );
  check(
    `save latency ${stats(saveTimes)}`,
    percentile(saveTimes, 95) < BUDGET.saveP95Ms,
  );

  const flushArgs = { noteId, writer: WRITER, flush: true };
  const flush = await client.mutation(api.cms.notes.notes.save, flushArgs);
  await sleep(400);
  check(
    `flush without content sends ${String(bytes(flushArgs))} B and touches once`,
    bytes(flushArgs) < BUDGET.flushArgBytes &&
      flush.touched &&
      meta.updates === 1,
    { touched: flush.touched, meta: meta.updates },
  );
  check("flush refreshes the list once", list.updates === 1, list.updates);
  check("flush refreshes the board once", board.updates === 1, board.updates);
  const fresh = await client.query(api.cms.notes.notes.search, {
    query: word,
  });
  check(
    "the flush indexes the typed text for search",
    fresh.some((hit) => hit.noteId === noteId && hit.snippet.includes(word)),
    fresh,
  );
  const stored = await client.query(api.cms.notes.notes.getBody, { noteId });
  check(
    "the flush kept the saved body",
    stored?.content === content,
    stored?.content.length,
  );
  check(
    `list page ${String(list.lastBytes)} B, meta ${String(meta.lastBytes)} B, rail ${String(rail.lastBytes)} B`,
    list.lastBytes < BUDGET.listBytes &&
      meta.lastBytes < BUDGET.metaBytes &&
      rail.lastBytes < BUDGET.railBytes,
  );
  check(
    `the subscribed meta never carries the ${String(bytes(content))} B body`,
    meta.lastBytes < bytes(content) / 10,
  );

  for (const w of [list, meta, rail, calendar, board]) w.stop();

  console.info("notes: stale editor saves never overwrite other writers");
  const before = await client.query(api.cms.notes.notes.getMeta, { noteId });
  const baseRev = before?.rev ?? 0;
  await client.mutation(api.cms.notes.notes.update, {
    noteId,
    writer: "other-device",
    title: "Perf note (renamed elsewhere)",
  });
  let refused = false;
  try {
    await client.mutation(api.cms.notes.notes.save, {
      noteId,
      content: `${content}\nstale tab`,
      writer: WRITER,
      baseRev,
    });
  } catch (error) {
    refused = String(error).includes("NOTE_CHANGED");
  }
  check("a save based on an old rev is refused", refused);
  const after = await client.query(api.cms.notes.notes.getMeta, { noteId });
  const accepted = await client.mutation(api.cms.notes.notes.save, {
    noteId,
    content,
    writer: WRITER,
    baseRev: after?.rev ?? 0,
  });
  check("the same save on the current rev goes through", accepted.rev >= 0);

  const queryTimes: number[] = [];
  for (let i = 0; i < 15; i++) {
    await timed(
      () =>
        client.query(api.cms.notes.notes.list, {
          paginationOpts: { numItems: 50, cursor: null },
        }),
      queryTimes,
    );
    await timed(
      () => client.query(api.cms.notes.notes.getBody, { noteId }),
      queryTimes,
    );
    await timed(
      () => client.query(api.cms.notes.notes.search, { query: "realistic" }),
      queryTimes,
    );
  }
  check(
    `list/body/search one-shot ${stats(queryTimes)}`,
    percentile(queryTimes, 95) < BUDGET.queryP95Ms,
  );

  await client.mutation(api.cms.notes.notes.trash, { noteId });
  await client.mutation(api.cms.notes.notes.purge, { noteId });
}

const COLUMNS = ["notes", "todo", "doing", "done"] as const;

async function purgeNotes(
  client: ConvexClient,
  key: string,
  ids: Id<"notes">[],
): Promise<void> {
  await throttled(ids, [{ name: "notes:trash", every: 7 }], key, async (id) => {
    await client.mutation(api.cms.notes.notes.trash, { noteId: id });
    await client.mutation(api.cms.notes.notes.purge, { noteId: id });
  });
}

async function boardSuite(client: ConvexClient, key: string): Promise<void> {
  console.info(`board: ${String(BOARD_NOTES)} notes, drag is one small write`);
  const ids: Id<"notes">[] = [];
  try {
    const seeds = Array.from({ length: BOARD_NOTES }, (_, i) => i);
    await throttled(
      seeds,
      [{ name: "notes:create", every: 25 }],
      key,
      async (i) => {
        const column = COLUMNS[i % COLUMNS.length] ?? "notes";
        ids.push(
          await client.mutation(api.cms.notes.notes.create, {
            title: `Perf board ${String(i)}`,
            content: `Card ${String(i)} body.`,
            writer: WRITER,
            ...(column === "notes" ? {} : { status: column }),
          }),
        );
      },
    );

    const board = await watch(client, api.cms.notes.board.board, {});
    check(
      `board payload ${String(board.lastBytes)} B for ${String(BOARD_NOTES)} notes`,
      board.lastBytes < BUDGET.boardBytes,
    );

    const before = await client.query(api.cms.notes.board.board, {});
    const card = before.columns.todo[2];
    const above = before.columns.doing[0];
    const below = before.columns.doing[1];
    if (!card || !above || !below) throw new Error("Board seed is missing");

    const moveTimes: number[] = [];
    const moved = await timed(
      () =>
        client.mutation(api.cms.notes.board.move, {
          noteId: card._id,
          to: "doing",
          beforeId: above._id,
          afterId: below._id,
          writer: WRITER,
        }),
      moveTimes,
    );
    await sleep(400);
    check(
      `a drag is one move (${stats(moveTimes)}) and re-runs the board once`,
      board.updates === 1,
      board.updates,
    );
    const after = await client.query(api.cms.notes.board.board, {});
    const doing = after.columns.doing.slice(0, 3).map((row) => row._id);
    check(
      "the card lands between its neighbours with the new status",
      doing.join() === [above._id, card._id, below._id].join() &&
        after.columns.doing[1]?.status === "doing" &&
        after.columns.doing[1]?.boardPosition === moved.boardPosition &&
        !after.columns.todo.some((row) => row._id === card._id),
      { doing, moved },
    );

    await client.mutation(api.cms.notes.board.move, {
      noteId: card._id,
      to: "doing",
      beforeId: null,
      afterId: above._id,
      writer: WRITER,
    });
    const top = await client.query(api.cms.notes.board.board, {});
    check(
      "moving above the first card puts it on top",
      top.columns.doing[0]?._id === card._id,
    );

    const last = top.columns.todo.at(-1);
    const page =
      last?.boardPosition === undefined
        ? { cards: [], more: false }
        : await client.query(api.cms.notes.board.column, {
            status: "todo",
            after: last.boardPosition,
            limit: 50,
          });
    const shown = new Set(top.columns.todo.map((row) => row._id));
    check(
      `load more returns the next ${String(page.cards.length)} todo cards`,
      top.more.todo &&
        page.cards.length > 0 &&
        page.cards.every((row) => !shown.has(row._id)),
    );
    board.stop();
  } finally {
    await purgeNotes(client, key, ids);
  }
}

async function shareSuite(client: ConvexClient, key: string): Promise<void> {
  console.info(
    `shares: ${String(SHARE_NOTES)}-note group, index small, bodies capped`,
  );
  const groupId = await client.mutation(api.cms.notes.groups.create, {
    name: "Perf share",
  });
  const ids: Id<"notes">[] = [];
  const bigBody = "Perf share body text that fills a large note. ".repeat(2600);
  try {
    const seeds = Array.from({ length: SHARE_NOTES }, (_, i) => i);
    await throttled(
      seeds,
      [{ name: "notes:create", every: 50 }],
      key,
      async (i) => {
        const big = i >= SHARE_NOTES - SHARE_BIG_NOTES;
        ids.push(
          await client.mutation(api.cms.notes.notes.create, {
            title: `Perf share ${String(i)}: a realistic note title of some length`,
            content: big ? bigBody : `Short body ${String(i)}.`,
            groupId,
            writer: WRITER,
            ...(i % 3 === 0 ? { status: "todo", dueDate: "2030-03-01" } : {}),
          }),
        );
      },
    );
    const share = await client.mutation(api.cms.notes.shares.create, {
      kind: "group",
      groupId,
    });
    const reader = new ConvexHttpClient(convexUrl);
    const viewTimes: number[] = [];
    let index = await reader.query(api.cms.notes.shares.view, {
      token: share.token,
    });
    for (let i = 0; i < 10; i++) {
      index = await timed(
        () => reader.query(api.cms.notes.shares.view, { token: share.token }),
        viewTimes,
      );
    }
    check(
      `share index ${String(bytes(index))} B for ${String(index?.notes.length)} notes, ${stats(viewTimes)}`,
      index?.notes.length === SHARE_NOTES &&
        bytes(index) < BUDGET.shareIndexBytes &&
        percentile(viewTimes, 95) < BUDGET.queryP95Ms,
    );

    const bigIds = ids.slice(-SHARE_BIG_NOTES);
    let pending: Id<"notes">[] = bigIds;
    let calls = 0;
    let largest = 0;
    const loaded = new Set<Id<"notes">>();
    while (pending.length > 0 && calls < SHARE_BIG_NOTES) {
      const batch = await reader.query(api.cms.notes.shares.bodies, {
        token: share.token,
        noteIds: pending,
      });
      calls++;
      if (!batch) break;
      largest = Math.max(largest, bytes(batch));
      for (const note of batch.notes) loaded.add(note.noteId);
      pending = batch.deferred;
    }
    check(
      `10 large bodies (${String(Math.round(bytes(bigBody) / 1024))} KB each) load in ${String(calls)} capped calls, largest ${String(Math.round(largest / 1024))} KB`,
      loaded.size === SHARE_BIG_NOTES &&
        calls > 1 &&
        largest <= SHARE_BODY_CAP + 4096,
    );
    await client.mutation(api.cms.notes.shares.revoke, {
      shareId: share.shareId,
    });
  } finally {
    await purgeNotes(client, key, ids);
    await client.mutation(api.cms.notes.groups.remove, { groupId });
  }
}

async function articleSuite(client: ConvexClient): Promise<void> {
  console.info("articles: autosave no longer echoes the body");
  const projects = await client.query(api.cms.projects.list, {});
  const project = projects[0];
  if (!project) {
    console.info("  - skipped: the local user has no projects");
    return;
  }
  const stamp = Date.now().toString(36);
  const body = "Article body text for the perf run. ".repeat(300);
  const documentId: Id<"documents"> = await client.mutation(
    api.cms.documents.create,
    {
      projectId: project._id,
      title: `Perf ${stamp}`,
      slug: `perf-${stamp}`,
      content: body,
    },
  );
  const meta = await watch(client, api.cms.documents.getMeta, { documentId });
  const legacy = await watch(client, api.cms.documents.get, { documentId });

  let content = body;
  let legacyBytes = 0;
  for (let i = 0; i < ARTICLE_SAVES; i++) {
    content = typed(content, i);
    const before = legacy.updates;
    await client.mutation(api.cms.documents.autosaveBody, {
      documentId,
      content,
      writer: WRITER,
    });
    await sleep(60);
    if (legacy.updates > before) legacyBytes += legacy.lastBytes;
  }
  await sleep(400);
  check(
    `${String(ARTICLE_SAVES)} autosaves re-ran the editor meta 0 times`,
    meta.updates === 0,
    meta.updates,
  );
  console.info(
    `    old full-body subscription would have pushed ${String(legacy.updates)} updates, ${String(Math.round(legacyBytes / 1024))} KB`,
  );
  check(
    `editor meta is ${String(meta.lastBytes)} B vs ${String(legacy.lastBytes)} B with the body`,
    meta.lastBytes < legacy.lastBytes / 5,
  );

  const flushArgs = { documentId, writer: WRITER, flush: true };
  await client.mutation(api.cms.documents.autosaveBody, flushArgs);
  await sleep(400);
  check(
    `flush without content sends ${String(bytes(flushArgs))} B and bumps the editor meta once`,
    bytes(flushArgs) < BUDGET.flushArgBytes && meta.updates === 1,
    meta.updates,
  );
  const saved = await client.query(api.cms.documents.getBody, { documentId });
  check("the article flush kept the saved body", saved?.content === content);

  meta.stop();
  legacy.stop();
  await client.mutation(api.cms.documents.remove, { documentId });
}

async function mcpSuite(token: () => Promise<string>): Promise<void> {
  console.info("mcp: notes tools stay small and fast");
  const mcp = new McpClient(`${siteUrl}/mcp`, token);
  await mcp.initialize();
  const times: number[] = [];
  const created = data(
    await timed(
      () =>
        mcp.call("wryte_notes_create", {
          title: "Perf MCP note",
          content: "Started a perf run.",
          group: "Perf",
        }),
      times,
    ),
  );
  const noteId = noteIdOf(created);
  for (let i = 0; i < 10; i++) {
    data(
      await timed(
        () =>
          mcp.call("wryte_notes_append", {
            noteId,
            text: `- step ${String(i)} done`,
          }),
        times,
      ),
    );
  }
  const listed = data(
    await timed(() => mcp.call("wryte_notes_list", {}), times),
  );
  data(await timed(() => mcp.call("wryte_notes_get", { noteId }), times));
  check(`mcp calls ${stats(times)}`, percentile(times, 95) < BUDGET.mcpP95Ms);
  check(
    `mcp list ${String(bytes(listed))} B, no bodies`,
    bytes(listed) < BUDGET.mcpListBytes,
  );
  data(await mcp.call("wryte_notes_trash", { noteId }));
}

async function main(): Promise<void> {
  const clerk = createClerkClient({ secretKey });
  const email = process.env["MCP_E2E_USER_EMAIL"];
  const users = await clerk.users.getUserList(
    email
      ? { emailAddress: [email], limit: 1 }
      : { limit: 1, orderBy: "created_at" },
  );
  const user = users.data[0];
  if (!user) throw new Error("No Clerk user found for the perf run");
  const session = await clerk.sessions.createSession({ userId: user.id });
  let cached: { jwt: string; at: number } | null = null;
  const token = async (): Promise<string> => {
    if (cached && Date.now() - cached.at < 30_000) return cached.jwt;
    const { jwt } = await clerk.sessions.getToken(session.id);
    cached = { jwt, at: Date.now() };
    return jwt;
  };

  const client = new ConvexClient(convexUrl);
  client.setAuth(token);
  const grant = await client.query(api.mcp.grants.myGrant, {});
  const wanted: Scope[] = [SCOPES.notes, SCOPES.trash];
  const needed = wanted.filter((scope) => !grant.includes(scope));
  if (needed.length > 0) {
    await client.mutation(api.mcp.grants.setGrant, {
      scopes: [...grant, ...needed],
    });
  }
  try {
    await notesSuite(client);
    await boardSuite(client, tokenIdentifier(await token()));
    await articleSuite(client);
    await shareSuite(client, tokenIdentifier(await token()));
    await mcpSuite(token);
    const purge = await client.query(api.cms.notes.notes.trashList, {
      paginationOpts: { numItems: 50, cursor: null },
    });
    for (const row of purge.page) {
      if (row.title.startsWith("Perf")) {
        await client.mutation(api.cms.notes.notes.purge, { noteId: row._id });
      }
    }
    const { groups } = await client.query(api.cms.notes.groups.rail, {});
    for (const group of groups) {
      if (group.name === "Perf") {
        await client.mutation(api.cms.notes.groups.remove, {
          groupId: group._id,
        });
      }
    }
  } finally {
    if (needed.length > 0) {
      await client.mutation(api.mcp.grants.setGrant, { scopes: grant });
    }
    await client.close();
    await clerk.sessions.revokeSession(session.id);
  }
  console.info(`\n${String(passed)} passed, ${String(failed)} failed`);
  if (failed > 0) process.exit(1);
}

await main();
