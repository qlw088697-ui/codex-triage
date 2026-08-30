import test from "node:test";
import assert from "node:assert/strict";
import { detectPlatform, normalizeLocale, parseIntegerOption, parsePlatform } from "../dist/cli.js";

test("platform detection prioritizes explicit and runtime evidence", () => {
  assert.equal(detectPlatform("mentions wsl docs", undefined, "win32", undefined), "windows");
  assert.equal(detectPlatform("", undefined, "linux", "Ubuntu"), "wsl");
  assert.equal(detectPlatform("", "macos", "win32", "Ubuntu"), "macos");
  assert.equal(parsePlatform("WINDOWS"), "windows");
  assert.throws(() => parsePlatform("android"), /platform/i);
});

test("locale aliases normalize consistently", () => {
  assert.equal(normalizeLocale("zh"), "zh-CN");
  assert.equal(normalizeLocale("zh_CN"), "zh-CN");
  assert.equal(normalizeLocale("en-US"), "en");
  assert.throws(() => normalizeLocale("fr"), /lang/i);
});

test("integer options reject partial and out-of-range values", () => {
  assert.equal(parseIntegerOption("0", "--limit", 0, 100), 0);
  assert.equal(parseIntegerOption("100", "--limit", 0, 100), 100);
  assert.throws(() => parseIntegerOption("5x", "--limit", 0, 100), /integer/i);
  assert.throws(() => parseIntegerOption("-1", "--limit", 0, 100), /integer/i);
  assert.throws(() => parseIntegerOption("101", "--limit", 0, 100), /integer/i);
});
