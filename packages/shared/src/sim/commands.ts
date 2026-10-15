import type { Team } from '../types';
import type { Game } from './Game';
import type { ChampionBehavior, Order } from './types';

/**
 * Everything the player can do that changes the simulation. A match is fully defined by
 * its setup (seed + picks) and the list of commands stamped with the tick they were given at.
 */
export type GameCommand =
  | { type: 'order'; championIds: number[]; order: Order }
  | { type: 'behavior'; championIds: number[]; behavior: Partial<ChampionBehavior> };

export interface TimedCommand {
  /** Value of `state.tick` when the command was applied (between two steps). */
  tick: number;
  /** Order of the command in the match (ties within a tick, and dedupe when it is sent twice). */
  seq: number;
  command: GameCommand;
}

/** Log order: by tick, then by the order the player gave them. */
export const compareCommands = (a: TimedCommand, b: TimedCommand) => a.tick - b.tick || a.seq - b.seq;

/** The side the player commands; the other one is played by the AI. */
export const PLAYER_TEAM: Team = 'blue';

/**
 * Applies a player command. Only champions of `team` obey: a command naming an opponent (forged
 * request, stale log) is ignored the same way by the client and the server.
 */
export function applyCommand(game: Game, command: GameCommand, team: Team = PLAYER_TEAM) {
  const ids = command.championIds.filter((id) => game.champion(id)?.team === team);
  switch (command.type) {
    case 'order':
      for (const id of ids) game.issueOrder(id, command.order);
      return;
    case 'behavior':
      for (const id of ids) game.setBehavior(id, command.behavior);
      return;
  }
}

/** Steps a game while re-applying a recorded command log at the exact ticks it was given. */
export class CommandReplay {
  private index = 0;

  constructor(
    private readonly game: Game,
    private readonly log: readonly TimedCommand[],
  ) {}

  /** Last tick the log reaches: a replay must get at least there to rebuild the state. */
  get lastTick(): number {
    return this.log.length > 0 ? this.log[this.log.length - 1].tick : 0;
  }

  /** Applies the commands due at the current tick (call before stepping, and once at the end). */
  applyDue() {
    const tick = this.game.state.tick;
    while (this.index < this.log.length && this.log[this.index].tick <= tick) {
      applyCommand(this.game, this.log[this.index++].command);
    }
  }

  step() {
    this.applyDue();
    this.game.step();
  }
}
