// Small seeded random number generator (mulberry32). The whole game is
// deterministic from its seed, which lets the server replay and verify scores.

export function nextRandom(state: number): { value: number; state: number } {
  const s = (state + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: s };
}

/** A random function that advances a stored state; read `.state` afterwards to save it. */
export function rngFrom(state: number) {
  const r = {
    state: state >>> 0,
    next: () => {
      const out = nextRandom(r.state);
      r.state = out.state;
      return out.value;
    },
  };
  return r;
}

export const randomSeed = () => Math.floor(Math.random() * 4294967296) >>> 0;
