// Run with Node 22: node --experimental-strip-types scripts/atlas.mjs [--check]
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { LOOKS, applyGrade, encode, decode } from '../src/lib/codm.ts';

const target = new URL('../src/lib/atlas.json', import.meta.url);
const originals = LOOKS.filter(look => look.image);
// Probe dark, mid and bright colours, not just neutral greys.
const probe = [];
for (const r of [24, 100, 220]) for (const g of [24, 100, 220])
  for (const b of [24, 100, 220]) probe.push(r, g, b, 255);
function signature(code) {
  const pixels = Uint8ClampedArray.from(probe);
  applyGrade(pixels, decode(code));
  return pixels;
}
const library = originals.map(l => signature(l.code));
const candidates = [];
for (const shadow of originals) for (const light of originals) {
  if (shadow === light) continue;
  const settings = decode(light.code);
  settings.zones.shadows = decode(shadow.code).zones.shadows;
  const code = encode(settings);
  candidates.push({ recipe: { shadow: shadow.name, light: light.name, code }, pixels: signature(code), distance: Infinity });
}
function consider(pixels) {
  for (const c of candidates) {
    const distance = pixels.reduce((sum, v, i) => sum + (v - c.pixels[i]) ** 2, 0);
    c.distance = Math.min(c.distance, distance);
  }
}
library.forEach(consider);
const atlas = [];
const serialize = () => '[\n' + atlas.map(r => '  ' + JSON.stringify(r)).join(',\n') + '\n]\n';
while (atlas.length < 100) {
  candidates.sort((a, b) => b.distance - a.distance);
  const best = candidates.shift();
  assert(best.distance > 0, 'Each pass must add a distinct grade');
  assert.equal(encode(decode(best.recipe.code)), best.recipe.code);
  atlas.push(best.recipe);
  consider(best.pixels);
  if (!process.argv.includes('--check')) writeFileSync(target, serialize());
}
assert.equal(readFileSync(target, 'utf8'), serialize());
console.log('Verified 100 distinct atlas recipes.');
