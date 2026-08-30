#!/usr/bin/env node
// Fails when line or branch coverage drops below the project thresholds.
// Parses the summary row printed by `node --experimental-test-coverage`.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const LINES_THRESHOLD = 80;
const BRANCH_THRESHOLD = 70;

const root = fileURLToPath(new URL("..", import.meta.url));
const result = spawnSync(`"${process.execPath}" --experimental-test-coverage --test`, {
  cwd: root,
  encoding: "utf8",
  shell: true,
  maxBuffer: 32 * 1024 * 1024,
});

const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
const summary = output.split("\n").find((line) => line.includes("all files"));
if (!summary) {
  console.error("coverage check failed: no summary row found in test runner output");
  process.exit(1);
}
const numbers = [...summary.matchAll(/\d+\.\d+/g)].map((match) => Number(match[0]));
if (numbers.length < 2) {
  console.error(`coverage check failed: could not parse summary row: ${summary.trim()}`);
  process.exit(1);
}
const [lines, branches] = numbers;
console.log(`coverage: lines ${lines}% (min ${LINES_THRESHOLD}), branches ${branches}% (min ${BRANCH_THRESHOLD})`);
if (lines < LINES_THRESHOLD) {
  console.error(`line coverage ${lines}% is below the ${LINES_THRESHOLD}% threshold`);
  process.exit(1);
}
if (branches < BRANCH_THRESHOLD) {
  console.error(`branch coverage ${branches}% is below the ${BRANCH_THRESHOLD}% threshold`);
  process.exit(1);
}
