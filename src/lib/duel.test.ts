// Run with `npm test` (Node's built-in runner; Node 22 strips the types).
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CODE, LOOKS } from "./codm.ts";
import {
  decodeDuel,
  encodeDuel,
  lookIndex,
  lookName,
  openingPair,
  randomRival,
  rivalOf,
} from "./duel.ts";

const A = DEFAULT_CODE;
const B = LOOKS[0].code;

test("a duel round-trips through the hash", () => {
  const hash = encodeDuel({ a: A, b: B });
  assert.ok(hash.startsWith("#d="));
  assert.deepEqual(decodeDuel(hash), { a: A, b: B });
});

test("a duel hash is accepted next to other hash fields", () => {
  assert.deepEqual(decodeDuel(`#c=${A}&d=${A}~${B}`), { a: A, b: B });
});

test("malformed duels are rejected, not guessed at", () => {
  const bad = {
    empty: "",
    "no pair": "#d=" + A,
    "one side broken": `#d=${A}~1_2_3`,
    "identical sides": `#d=${A}~${A}`,
    "not a duel": "#c=" + A,
    "trailing junk": `#d=${A}~${B}~${A}`,
  };
  for (const [why, hash] of Object.entries(bad)) assert.equal(decodeDuel(hash), null, why);
});

test("a look always meets the same rival, and never itself", () => {
  for (const look of LOOKS) {
    const rival = rivalOf(look.code);
    assert.notEqual(rival, look.code, `${look.name} rivaled itself`);
    assert.ok(lookIndex(rival) >= 0, `${look.name} rival is not a look`);
  }
});

test("a random rival is always a real, different look", () => {
  for (let i = 0; i < 40; i++) {
    const rival = randomRival(LOOKS[0].code);
    assert.notEqual(rival, LOOKS[0].code);
    assert.ok(lookIndex(rival) >= 0);
  }
});

test("look names resolve, and custom grades say so", () => {
  assert.equal(lookName(LOOKS[0].code), "Hajin");
  assert.equal(lookName("2_1_30_300_1000_1500_1_1_1_1001_0_0_0_1000_0_0_0_1000_0_0_0_1000"), "Custom grade");
});

test("opening pairs put a real look against the plain screen", () => {
  for (let i = 0; i < 30; i++) {
    const { a, b } = openingPair();
    assert.ok(lookIndex(a) >= 0);
    assert.equal(b, DEFAULT_CODE);
    assert.notEqual(a, b);
  }
});
