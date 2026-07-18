// Test-data injection toggle (a hard Phase 3 requirement). When enabled,
// data modules load a canned historical riverine-flood scenario (modeled on
// the August 2016 Louisiana flood) from static fixtures instead of live
// federal APIs — the rest of the pipeline (cache → normalize → render) runs
// unchanged, so demos exercise the real code path.

import { invalidate } from './cache.js';

let enabled = false;

export function isTestMode() {
  return enabled;
}

export function setTestMode(on) {
  enabled = Boolean(on);
  invalidate(); // make the switch instant in the UI
  return enabled;
}

export async function loadFixture(name) {
  const res = await fetch(`${import.meta.env.BASE_URL}testdata/${name}.json`);
  if (!res.ok) throw new Error(`Fixture ${name} failed: ${res.status}`);
  return res.json();
}
