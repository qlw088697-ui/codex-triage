import test from "node:test";
import assert from "node:assert/strict";
import { searchRules } from "../dist/engine/search.js";
import { renderFaq, faqHitsToJson } from "../dist/report/faq.js";
import { loadRules } from "../dist/knowledge/loader.js";

test("searches English fields and ranks phrase matches first", async () => {
  const rules = await loadRules();
  const hits = searchRules(rules, "Windows sandbox cannot spawn", "en");
  assert.ok(hits.length, "expected sandbox hits for the title phrase");
  assert.equal(hits[0].rule.id, "windows-createprocess-error-1312");
  assert.ok(hits[0].score >= 20, "title phrase match should carry the bonus");
});

test("searches zh-CN fields for Chinese queries", async () => {
  const rules = await loadRules();
  const hits = searchRules(rules, "无法创建进程", "zh-CN");
  assert.ok(hits.some((hit) => hit.rule.id === "windows-createprocess-error-1312"), "Chinese query should hit zh titles");
  const handshake = searchRules(rules, "握手超时", "zh-CN");
  assert.ok(handshake.some((hit) => hit.rule.id === "wsl-app-server-handshake-timeout"), "Chinese query should hit the WSL handshake rule");
});

test("every token must be found somewhere before a rule is a hit", async () => {
  const rules = await loadRules();
  const hits = searchRules(rules, "sandbox quantum-unicorning", "en");
  assert.equal(hits.some((hit) => hit.rule.category === "sandbox"), false, "rules missing one token must not match");
  assert.equal(searchRules(rules, "zzz-no-such-token", "en").length, 0);
});

test("empty query lists the whole knowledge base deterministically", async () => {
  const rules = await loadRules();
  const hits = searchRules(rules, "", "en");
  assert.equal(hits.length, rules.length);
  const expectedOrder = [...hits].sort((a, b) =>
    a.rule.category.localeCompare(b.rule.category) || a.rule.id.localeCompare(b.rule.id)
  );
  assert.deepEqual(
    hits.map((hit) => hit.rule.id),
    expectedOrder.map((hit) => hit.rule.id),
    "list mode must be sorted by category then id",
  );
  const second = searchRules(rules, "", "en");
  assert.deepEqual(hits.map((hit) => hit.rule.id), second.map((hit) => hit.rule.id), "ordering must be stable");
});

test("faq rendering localizes and includes links", async () => {
  const rules = await loadRules();
  const hits = searchRules(rules, "CreateProcessAsUserW failed", "en");
  const rendered = renderFaq({ hits: hits.slice(0, 1), query: "CreateProcessAsUserW failed", locale: "en" });
  assert.match(rendered, /Codex Triage FAQ \(offline\)/);
  assert.match(rendered, /windows-createprocess-error-1312|Windows sandbox/);
  assert.match(rendered, /https:\/\/github\.com\/openai\/codex\/issues\/31768/);
  const zh = renderFaq({ hits: hits.slice(0, 1), query: "1312", locale: "zh-CN" });
  assert.match(zh, /常见问题（离线检索）/);
  const empty = renderFaq({ hits: [], query: "nothing", locale: "en" });
  assert.match(empty, /No matching entries/);
});

test("faq JSON projection carries ids, scores, and links", async () => {
  const rules = await loadRules();
  const hits = searchRules(rules, "CreateProcessAsUserW", "en").slice(0, 2);
  const json = faqHitsToJson(hits, "en");
  assert.equal(json.length, 2);
  for (const entry of json) {
    assert.ok(entry.id);
    assert.ok(entry.title);
    assert.ok(entry.score > 0);
    assert.ok(Array.isArray(entry.links));
  }
});
