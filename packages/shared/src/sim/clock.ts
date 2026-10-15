import { SIM_TICK_RATE } from '../constants';

/**
 * Wall-clock schedule of a match: the game keeps running in real time even with no page open.
 * Anchored at the last speed / pause change: `tick` was reached at `at` (epoch ms, server time).
 */
export interface MatchClock {
  tick: number;
  at: number;
  speed: number;
  paused: boolean;
}

/** Tick (fractional) the match should be at, at `now` (epoch ms, server time). */
export function clockTick(clock: MatchClock, now: number): number {
  if (clock.paused) return clock.tick;
  return clock.tick + (Math.max(0, now - clock.at) / 1000) * clock.speed * SIM_TICK_RATE;
}
