import test from "node:test";
import assert from "node:assert/strict";
import { redactText } from "../dist/report/redact.js";
test("redacts common secrets and home paths",()=>{const result=redactText("C:\\Users\\alice\\x sk-abcdefghijklmnopqrstuvwxyz token=super-secret-value");assert.ok(!result.includes("alice"));assert.ok(!result.includes("sk-abcdefghijklmnopqrstuvwxyz"));assert.ok(!result.includes("super-secret-value"));});
