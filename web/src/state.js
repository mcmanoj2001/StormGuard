// Tiny pub/sub store — no framework, keeps the bundle small and the data
// flow obvious: poller writes here, map layers and panels subscribe.

const state = {
  testMode: false,
  gauges: [],
  alerts: [],
  storms: [],
  tracts: [],
  selectedGaugeId: null,
  lastUpdated: null,
  connection: 'connecting', // connecting | live | stale | error
};

const listeners = new Map(); // key -> Set<fn>

export function getState() {
  return state;
}

export function setState(patch) {
  Object.assign(state, patch);
  for (const key of Object.keys(patch)) {
    for (const fn of listeners.get(key) ?? []) fn(state);
  }
}

export function subscribe(keys, fn) {
  for (const key of [].concat(keys)) {
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key).add(fn);
  }
}
