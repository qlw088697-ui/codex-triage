import test from "node:test";
import assert from "node:assert/strict";
import { redactText, redactValue } from "../dist/report/redact.js";

test("redacts common secrets, credentials, emails, and home paths", () => {
  const input = [
    "C:\\Users\\alice\\x",
    "sk-abcdefghijklmnopqrstuvwxyz",
    "github_pat_abcdefghijklmnopqrstuvwxyz123456",
    "token=super-secret-value",
    "https://user:pass@example.com/path",
    "alice@example.com",
  ].join(" ");
  const result = redactText(input);
  for (const secret of ["alice", "sk-abcdefghijklmnopqrstuvwxyz", "github_pat_", "super-secret-value", "user:pass"]) {
    assert.equal(result.includes(secret), false, `should redact ${secret}`);
  }
});

test("recursively redacts JSON-like values without mutation", () => {
  const input = {
    details: { token: "sk-abcdefghijklmnopqrstuvwxyz" },
    notes: ["C:\\Users\\alice\\secret"],
    issues: [{ remedy: "email alice@example.com" }],
  };
  const before = structuredClone(input);
  const result = redactValue(input);
  assert.deepEqual(input, before);
  assert.equal(JSON.stringify(result).includes("alice"), false);
  assert.equal(JSON.stringify(result).includes("sk-abcdefghijklmnopqrstuvwxyz"), false);
});

test("redaction is idempotent", () => {
  const once = redactText("token=secret-value C:\\Users\\alice\\x");
  assert.equal(redactText(once), once);
});

test("redacts user paths written with JSON-escaped or forward-slash separators", () => {
  const dump = [
    String.raw`C:\\Users\\alice\\secret`,
    String.raw`"C:\\Users\\bob\\file.txt"`,
    String.raw`\/home\/carol\/notes`,
    "C:/Users/dave/profile",
    "/Users/erin/x",
    "/home/frank/y",
  ].join(" ");
  const result = redactText(dump);
  for (const name of ["alice", "bob", "carol", "dave", "erin", "frank"]) {
    assert.equal(result.includes(name), false, `should redact ${name}`);
  }
  assert.equal(redactText(result), result, "redaction of escaped paths is idempotent");
});
