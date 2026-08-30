import test from "node:test";
import assert from "node:assert/strict";
import * as api from "../dist/index.js";

// The public API is frozen at v1.0. Adding or removing a runtime export must
// be a conscious decision: update this list and document the change in the
// changelog. TypeScript-only type exports are erased at runtime and are not
// listed here.
const EXPECTED_EXPORTS = {
  parseDoctorReport: "function",
  runCodexDoctor: "function",
  loadRules: "function",
  matchRules: "function",
  searchRules: "function",
  redactText: "function",
  redactValue: "function",
  renderMarkdownReport: "function",
  renderFaq: "function",
  faqHitsToJson: "function",
  renderTerminal: "function",
  sanitizeTerminalText: "function",
};

test("public API surface matches the frozen v1.0 contract", () => {
  assert.deepEqual(Object.keys(api).sort(), Object.keys(EXPECTED_EXPORTS).sort());
  for (const [name, kind] of Object.entries(EXPECTED_EXPORTS)) {
    assert.equal(typeof api[name], kind, `${name} should be a ${kind}`);
  }
});
