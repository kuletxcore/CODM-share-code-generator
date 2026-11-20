// Run with `npm test` (Node's built-in runner; Node 22 strips the types).
import { test } from "node:test";
import assert from "node:assert/strict";
import { fitFrame } from "./frame.ts";

const aspect = (f: { w: number; h: number }) => f.w / f.h;

test("a 16:9 screenshot is held exactly at 16:9", () => {
  const f = fitFrame(1920, 1080);
  assert.equal(f.w, 1920);
  assert.equal(f.h, 1080);
});

test("a wider shot is cropped to 16:9, height kept", () => {
  const f = fitFrame(2560, 1080);
  assert.equal(f.h, 1080);
  assert.ok(Math.abs(aspect(f) - 16 / 9) < 0.002);
  assert.ok(f.w < 2560);
});

test("a portrait shot is cropped no taller than 4:3", () => {
  const f = fitFrame(1080, 1920);
  assert.equal(f.w, 1080);
  assert.ok(Math.abs(aspect(f) - 4 / 3) < 0.002);
  assert.ok(f.h < 1920);
});

test("an almost-square shot lands at 4:3, never narrower", () => {
  const f = fitFrame(1000, 1000);
  assert.ok(aspect(f) >= 4 / 3 - 0.002);
  assert.ok(f.h <= 1000 && f.w <= 1000);
});

test("degenerate sizes stay positive", () => {
  const f = fitFrame(0, 0);
  assert.ok(f.w > 0 && f.h > 0);
});
