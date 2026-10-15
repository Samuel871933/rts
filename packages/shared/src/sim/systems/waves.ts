import { WAVE_RULES, waveHasSiege, waveInterval, type MinionType } from '../../data/minions';
import { LANES, TEAMS, enemyOf, type Lane, type Team } from '../../types';
import { createMinion } from '../factory';
import type { Game } from '../Game';
import { laneTrack } from '../LaneTrack';

export function updateWaves(game: Game) {
  const { wave, time } = game.state;
  if (time >= wave.nextAt) {
    wave.number++;
    scheduleWave(game, wave.number, wave.nextAt);
    wave.nextAt += waveInterval(wave.nextAt);
  }

  const queue = wave.queue;
  for (let i = 0; i < queue.length; ) {
    const spawn = queue[i];
    if (spawn.at > time) {
      i++;
      continue;
    }
    queue.splice(i, 1);
    const start = laneTrack(spawn.team, spawn.lane).points[0];
    const jitter = () => game.rng.range(-60, 60);
    game.add(createMinion(game.allocateId(), spawn.team, spawn.lane, spawn.type, { x: start.x + jitter(), y: start.y + jitter() }, time));
  }
}

/** Super minions replace the siege minion while the enemy inhibitor of that lane is down. */
function superCount(game: Game, team: Team, lane: Lane): number {
  const enemyInhibs = game.state.structures.filter((s) => s.kind === 'inhibitor' && s.team === enemyOf(team));
  const laneInhib = enemyInhibs.find((s) => s.lane === lane);
  if (!laneInhib || laneInhib.alive) return 0;
  return enemyInhibs.every((s) => !s.alive) ? 2 : 1;
}

function scheduleWave(game: Game, waveNumber: number, at: number) {
  const siege = waveHasSiege(waveNumber, at);
  for (const team of TEAMS) {
    for (const lane of LANES) {
      const supers = superCount(game, team, lane);
      const types: MinionType[] = [];
      const melee = at >= 14 * 60 && siege && supers === 0 ? 2 : 3;
      for (let i = 0; i < melee; i++) types.push('melee');
      for (let i = 0; i < supers; i++) types.push('super');
      if (siege && supers === 0) types.push('siege');
      const casters = at >= 30 * 60 ? 2 : 3;
      for (let i = 0; i < casters; i++) types.push('caster');

      types.forEach((type, i) => {
        game.state.wave.queue.push({ at: at + i * WAVE_RULES.spawnGap, team, lane, type });
      });
    }
  }
}
