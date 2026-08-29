import test from "node:test";
import assert from "node:assert/strict";
import { loadRules } from "../dist/knowledge/loader.js";
test("loads at least 20 valid unique rules",async()=>{const rules=await loadRules();assert.ok(rules.length>=20);assert.equal(new Set(rules.map(r=>r.id)).size,rules.length);});
