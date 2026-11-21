import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CODE, LOOKS } from "./codm.ts";
import { hashFor, readHash } from "./shareUrl.ts";

test("a hash carries one code, or a code and the pinned one", () => {
  const a = LOOKS[0].code;
  assert.deepEqual(readHash(hashFor(a)), { code: a, pin: null });
  assert.deepEqual(readHash(hashFor(a, DEFAULT_CODE)), { code: a, pin: DEFAULT_CODE });
  assert.equal(hashFor(a, null), `#c=${a}`);
});

test("anything else in the hash is ignored rather than half-read", () => {
  assert.deepEqual(readHash(""), { code: null, pin: null });
  assert.deepEqual(readHash("#c=1_2&p=x"), { code: null, pin: null });
  assert.deepEqual(readHash("#look"), { code: null, pin: null });
});
