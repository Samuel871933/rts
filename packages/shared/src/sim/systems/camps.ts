import { CAMPS } from '../../data/map';
import { MONSTER_STATS } from '../../data/monsters';
import { RULES } from '../../data/rules';
import { dist } from '../../math';
import { createMonster } from '../factory';
import type { Game } from '../Game';
import { aliveChampionsNear } from '../queries';
import type { CampState, ChampionUnit, MonsterUnit } from '../types';
import { TEAMS, type Team } from '../../types';
import type { Vec2 } from '../../math';
import { moveToward, stopMoving } from './movement';
import { addGold, addXp, recomputeChampionStats } from './progression';

export function createCamps(): CampState[] {
  return CAMPS.map((def) => {
    const firstSpawn = MONSTER_STATS[def.kind].firstSpawn;
    // Initial spawn times are common knowledge.
    const intel = () => ({ status: 'down' as const, respawnAt: firstSpawn });
    return { def, unitId: null, nextSpawnAt: firstSpawn, intel: { blue: intel(), red: intel() } };
  });
}

/**
 * Who learns about a camp's death: the killer's team, any team that saw it die, and everyone for
 * epic monsters (announced). The others keep believing it is up until they look at the empty camp.
 */
function recordCampDeath(camp: CampState, monster: MonsterUnit, killerTeam: Team | null) {
  for (const team of TEAMS) {
    if (monster.epic || team === killerTeam || monster.visible[team]) {
      camp.intel[team] = { status: 'down', respawnAt: camp.nextSpawnAt };
    }
  }
}

/** Called with fresh vision: an empty camp seen by a team that thought it was up becomes "unknown". */
export function updateCampIntel(game: Game, sees: (team: Team, pos: Vec2) => boolean) {
  for (const camp of game.state.camps) {
    if (camp.unitId !== null) continue;
    for (const team of TEAMS) {
      if (camp.intel[team].status === 'up' && sees(team, camp.def.pos)) {
        camp.intel[team] = { status: 'unknown', respawnAt: null };
      }
    }
  }
}

export function updateCamps(game: Game) {
  const time = game.state.time;
  for (const camp of game.state.camps) {
    if (camp.unitId !== null || camp.nextSpawnAt === null || time < camp.nextSpawnAt) continue;
    const monster = game.add(createMonster(game.allocateId(), camp.def));
    camp.unitId = monster.id;
    camp.nextSpawnAt = null;
    // Spawns show up on everyone's map, like LoL camp icons.
    camp.intel = { blue: { status: 'up', respawnAt: null }, red: { status: 'up', respawnAt: null } };
    game.emit({ type: 'campSpawned', campId: camp.def.id, epic: monster.epic });
  }
}

function startReset(m: MonsterUnit) {
  m.targetId = null;
  m.resetting = true;
  m.blockedSince = null;
}

/** Where to stand to fight `target` without leaving the camp area. */
function chaseSpot(m: MonsterUnit, target: Vec2): Vec2 {
  const d = dist(m.home, target);
  if (d <= m.leash) return target;
  const k = m.leash / d;
  return { x: m.home.x + (target.x - m.home.x) * k, y: m.home.y + (target.y - m.home.y) * k };
}

/**
 * Monster AI, like LoL camps: idle at camp, fight back when attacked, never leave the camp area.
 * It resets (walks home, back to full HP) when its target leaves the area, or when it can't
 * reach it for a few seconds (kiting from outside the leash).
 */
export function updateMonsters(game: Game, dt: number) {
  const time = game.state.time;
  for (const m of game.state.units.values()) {
    if (m.kind !== 'monster' || !m.alive) continue;

    if (m.resetting) {
      m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.2 * dt);
      moveToward(game, m, m.home);
      if (dist(m.pos, m.home) < 40) {
        m.resetting = false;
        m.hp = m.maxHp;
        stopMoving(m);
      }
      continue;
    }

    if (m.passive) {
      m.targetId = null;
      continue;
    }

    let target = m.targetId !== null ? game.get(m.targetId) : undefined;
    if (!target?.alive) {
      // Switch to whoever hit us last, if still around.
      const last = m.lastDamagedBy !== null ? game.get(m.lastDamagedBy) : undefined;
      target = last?.alive && time - m.lastDamagedAt < 3 ? last : undefined;
      m.targetId = target?.id ?? null;
      m.blockedSince = null;
    }

    if (!target) {
      if (dist(m.pos, m.home) > 40) moveToward(game, m, m.home);
      else if (time - m.lastDamagedAt > 5) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.05 * dt);
      continue;
    }

    if (dist(m.home, target.pos) > m.leash + RULES.monsterDisengage) {
      startReset(m);
      continue;
    }

    if (dist(m.pos, target.pos) <= m.range + m.radius + target.radius) {
      stopMoving(m);
      m.blockedSince = null;
      continue;
    }
    m.blockedSince ??= time;
    if (time - m.blockedSince >= RULES.monsterPatience) {
      startReset(m);
      continue;
    }
    const spot = chaseSpot(m, target.pos);
    if (dist(m.pos, spot) > 20) moveToward(game, m, spot);
    else stopMoving(m);
  }
}

export function onMonsterKilled(game: Game, m: MonsterUnit, killer: ChampionUnit | null) {
  const camp = game.state.camps.find((c) => c.def.id === m.campId);
  if (!camp) return;
  const stats = MONSTER_STATS[camp.def.kind];
  const time = game.state.time;
  camp.unitId = null;
  camp.nextSpawnAt = time + stats.respawn;
  recordCampDeath(camp, m, killer?.team ?? null);

  if (killer) {
    const team = killer.team;
    if (stats.buff === 'baron') {
      game.state.teams[team].barons++;
      addGold(game, killer, RULES.baronKillerGold);
      for (const c of game.state.champions) {
        if (c.team !== team) continue;
        addGold(game, c, stats.gold);
        addXp(game, c, stats.xp);
        if (c.alive) {
          c.buffs.baron = time + RULES.baronDuration;
          recomputeChampionStats(game, c);
          game.emit({ type: 'buffGained', championId: c.id, buff: 'baron' });
        }
      }
    } else if (stats.buff === 'dragon') {
      game.state.teams[team].dragons++;
      for (const c of aliveChampionsNear(game, team, m.pos, 1600)) {
        addGold(game, c, stats.gold);
        addXp(game, c, stats.xp);
      }
    } else {
      addGold(game, killer, stats.gold);
      addXp(game, killer, stats.xp);
      if (killer.role === 'jungle') {
        killer.hp = Math.min(killer.maxHp, killer.hp + RULES.jungleCompanionHealOnKill);
        // Jungle pet bonus XP keeps the jungler's levels in line with laners.
        addXp(game, killer, killer.stats.monsters === 0 ? RULES.jungleCompanionFirstXp : RULES.jungleCompanionXp);
      }
      if (stats.buff === 'blue' || stats.buff === 'red') {
        killer.buffs[stats.buff] = time + RULES.buffDuration;
        game.emit({ type: 'buffGained', championId: killer.id, buff: stats.buff });
      }
    }
    killer.stats.monsters++;
  }

  game.emit({
    type: 'campCleared',
    campId: camp.def.id,
    championId: killer?.id ?? null,
    team: killer?.team ?? null,
    epic: stats.epic,
  });
}
