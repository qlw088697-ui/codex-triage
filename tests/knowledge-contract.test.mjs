import test from "node:test";
import assert from "node:assert/strict";
import { loadRules } from "../dist/knowledge/loader.js";

test("every bundled rule has tags and complete zh-CN guidance", async () => {
  const rules = await loadRules();
  for (const rule of rules) {
    assert.ok(rule.tags.length, `${rule.id} needs tags`);
    assert.ok(rule.i18n["zh-CN"]?.title, `${rule.id} needs zh-CN title`);
    assert.ok(rule.i18n["zh-CN"]?.summary, `${rule.id} needs zh-CN summary`);
    assert.ok(rule.i18n["zh-CN"]?.actions?.length, `${rule.id} needs zh-CN actions`);
  }
});

test("bundled rule links are secure and rules have an executable signal", async () => {
  const rules = await loadRules();
  for (const rule of rules) {
    assert.ok(rule.match.any.length || rule.match.all.length || rule.match.doctor, `${rule.id} has no signal`);
    for (const link of rule.links) assert.match(link.url, /^https?:\/\//, `${rule.id} has an unsafe link`);
  }
});
