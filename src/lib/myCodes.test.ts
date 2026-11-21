import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CODE, LOOKS, decode } from "./codm.ts";
import { RECENT_MAX, clean, push, rename } from "./myCodes.ts";

const valid = (c: string) => decode(c) !== null;
const e = (code: string, name = "x", at = 1) => ({ code, name, at });

test("push puts the newest first, once per code, capped", () => {
  let list = [e(LOOKS[0].code, "a"), e(LOOKS[1].code, "b")];
  list = push(list, e(LOOKS[1].code, "b2", 2), RECENT_MAX);
  assert.deepEqual(list.map((x) => x.name), ["b2", "a"]);
  for (const l of LOOKS) list = push(list, e(l.code), RECENT_MAX);
  assert.equal(list.length, RECENT_MAX);
});

test("rename keeps the old name when the new one is blank", () => {
  const list = [e(DEFAULT_CODE, "Mine")];
  assert.equal(rename(list, DEFAULT_CODE, "   ")[0].name, "Mine");
  assert.equal(rename(list, DEFAULT_CODE, " Night ")[0].name, "Night");
});

test("clean drops entries another version or a hand edit could leave behind", () => {
  const raw = {
    recent: [e(DEFAULT_CODE), { code: "1_2_3", name: "bad", at: 1 }, null, { code: DEFAULT_CODE }],
    saved: "nope",
  };
  assert.deepEqual(clean(raw, valid), { recent: [e(DEFAULT_CODE)], saved: [] });
  assert.deepEqual(clean(null, valid), { recent: [], saved: [] });
});
