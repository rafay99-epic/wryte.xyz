import assert from "node:assert/strict";
import { frontmatterContract } from "../convex/mcp/frontmatterSchema";
import { agentStatuses, assertAgentStatus } from "../convex/mcp/projectContext";

{
  const contract = frontmatterContract(
    JSON.stringify([
      { name: "title", type: "string", required: true, defaultValue: "" },
      { name: "date", type: "date", required: true },
      { name: "draft", type: "boolean", required: false, defaultValue: "true" },
      { name: "secret", type: "string", required: true, hidden: true },
      { type: "string" },
      "junk",
    ]),
  );
  assert.deepEqual(
    contract.fields.map((f) => f.name),
    ["title", "date", "draft", "secret"],
  );
  assert.deepEqual(contract.requiredFields, ["title", "date"]);
  assert.equal(contract.defaults["draft"], "true");
  assert.equal(contract.defaults["date"], "today's date (YYYY-MM-DD)");
}

assert.match(frontmatterContract("{nope").note, /failed to parse/);
assert.match(frontmatterContract(undefined).note, /No schema configured/);

{
  const project = {
    boardColumns: JSON.stringify([
      {
        id: "idea",
        label: "Idea",
        color: "gray",
        behavior: "none",
        position: 0,
      },
      {
        id: "live",
        label: "Live",
        color: "green",
        behavior: "publish",
        position: 2,
      },
      {
        id: "queued",
        label: "Queued",
        color: "blue",
        behavior: "schedule",
        position: 1,
      },
    ]),
  };
  assert.deepEqual(agentStatuses(project), [{ id: "idea", label: "Idea" }]);
  assert.doesNotThrow(() => assertAgentStatus(project, "idea"));
  assert.throws(() => assertAgentStatus(project, "live"), /can't be set/);
  assert.throws(() => assertAgentStatus(project, "queued"), /can't be set/);
}

assert.deepEqual(
  agentStatuses({}).map((s) => s.id),
  ["draft", "review", "ready"],
);

console.info("mcp-project-context: all assertions passed");
