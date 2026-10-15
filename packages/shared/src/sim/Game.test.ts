import { describe, expect, it } from 'vitest';
import { CAMPS, FOUNTAINS, LANE_PATHS } from '../data/map';
import { MAP_SIZE, NAV_CELL_SIZE, SIM_TICK_RATE } from '../constants';
import { TERRAIN, isTerrainWalkable, terrainAt } from '../data/terrain';
import { dist } from '../math';
import { NavGrid } from './nav/NavGrid';
import { MONSTER_STATS } from '../data/monsters';
import { RULES } from '../data/rules';
import { STRUCTURES } from '../data/structures';
import type { ChampionPick } from '../types';
import { CommandReplay, applyCommand, type TimedCommand } from './commands';
import { Game } from './Game';
import { laneTrack } from './LaneTrack';
import type { MinionUnit, MonsterUnit } from './types';

const TEAM: ChampionPick[] = [
  { championId: 'garen', role: 'top' },
  { championId: 'leesin', role: 'jungle' },
  { championId: 'ahri', role: 'mid' },
  { championId: 'jinx', role: 'bot' },
  { championId: 'soraka', role: 'support' },
];

const runFor = (game: Game, seconds: number) => {
  for (let i = 0; i < seconds * SIM_TICK_RATE; i++) game.step();
};

describe('map data', () => {
  const game = new Game({ seed: 1, teams: { blue: [], red: [] } });

  it('puts every structure, camp, fountain and lane point on walkable ground', () => {
    for (const s of STRUCTURES) expect(game.nav.isWalkable(s.pos), s.id).toBe(true);
    for (const c of CAMPS) expect(game.nav.isWalkable(c.pos), c.id).toBe(true);
    for (const f of Object.values(FOUNTAINS)) expect(game.nav.isWalkable(f)).toBe(true);
    for (const pts of Object.values(LANE_PATHS)) for (const p of pts) expect(game.nav.isWalkable(p)).toBe(true);
  });

  it('connects both fountains and every camp', () => {
    expect(game.nav.findPath(FOUNTAINS.blue, FOUNTAINS.red).length).toBeGreaterThan(0);
    for (const c of CAMPS) expect(game.nav.findPath(FOUNTAINS.blue, c.pos).length, c.id).toBeGreaterThan(0);
  });

  it('puts every camp inside its alcove, clear of the walls', () => {
    for (const camp of CAMPS) {
      for (let a = 0; a < 16; a++) {
        const p = { x: camp.pos.x + Math.cos((a / 16) * Math.PI * 2) * 180, y: camp.pos.y + Math.sin((a / 16) * Math.PI * 2) * 180 };
        expect(isTerrainWalkable(p), `${camp.id} ${a}`).toBe(true);
      }
    }
  });

  it('only lets units into the epic pits from the river', () => {
    for (const pit of CAMPS.filter((c) => c.kind === 'dragon' || c.kind === 'baron')) {
      // Fill the river bed around the pit: with no river access left, the pit must be sealed.
      const dammed = new NavGrid(MAP_SIZE, NAV_CELL_SIZE, (p) => {
        const near = dist(p, pit.pos);
        return isTerrainWalkable(p) && !(terrainAt(p) === TERRAIN.river && near > 500 && near < 2500);
      });
      // From every jungle camp (the scuttles live in the river itself).
      for (const camp of CAMPS.filter((c) => c !== pit && c.kind !== 'scuttle')) {
        expect(game.nav.findPath(camp.pos, pit.pos).length, camp.id).toBeGreaterThan(0);
        expect(dammed.findPath(camp.pos, pit.pos), `${camp.id} → ${pit.id}`).toEqual([]);
      }
    }
  });
});

describe('simulation', () => {
  it('runs waves, farming and jungling for 8 minutes', () => {
    const game = new Game({ seed: 42, teams: { blue: TEAM, red: [] } });
    runFor(game, 8 * 60);
    const champs = game.state.champions;
    const cs = champs.reduce((n, c) => n + c.stats.cs, 0);
    const jungler = champs.find((c) => c.role === 'jungle')!;
    expect(game.state.wave.number).toBeGreaterThan(10);
    expect(cs).toBeGreaterThan(40);
    expect(jungler.stats.monsters).toBeGreaterThan(2);
    expect(champs.every((c) => c.level >= 3)).toBe(true);
    // Nobody needs to go home in an empty game: check they earn, not that they shopped.
    expect(champs.every((c) => c.totalGold > RULES.startGold + 1000)).toBe(true);
  });

  const RED: ChampionPick[] = [
    { championId: 'darius', role: 'top' },
    { championId: 'amumu', role: 'jungle' },
    { championId: 'annie', role: 'mid' },
    { championId: 'ashe', role: 'bot' },
    { championId: 'leona', role: 'support' },
  ];

  it('never starts champion fights without an order', () => {
    const game = new Game({ seed: 11, teams: { blue: TEAM, red: RED } });
    runFor(game, 12 * 60);
    expect(game.state.champions.every((c) => c.stats.kills === 0)).toBe(true);
    expect(game.state.champions.every((c) => c.level >= 4)).toBe(true);
  });

  it('fights back when ordered to attack a champion', () => {
    const game = new Game({ seed: 5, teams: { blue: TEAM, red: RED } });
    runFor(game, 100);
    const garen = game.state.champions.find((c) => c.defId === 'garen')!;
    const darius = game.state.champions.find((c) => c.defId === 'darius')!;
    // Put them face to face in top lane, then order the attack.
    garen.pos = { x: 1000, y: 11500 };
    darius.pos = { x: 1000, y: 11800 };
    runFor(game, 0.5);
    game.issueOrder(garen.id, { type: 'attack', targetId: darius.id });
    runFor(game, 4);
    expect(darius.lastDamagedBy).toBe(garen.id);
    expect(garen.lastDamagedBy).toBe(darius.id);
  });

  it('goes back to farming the lane when the ordered minion dies first', () => {
    const game = new Game({ seed: 4, teams: { blue: TEAM, red: RED } });
    runFor(game, 70);
    const ahri = game.state.champions.find((c) => c.defId === 'ahri')!;
    game.issueOrder(ahri.id, { type: 'move', pos: { x: 3000, y: 9000 } });
    runFor(game, 2);
    expect(ahri.standingOrder).toBeNull();
    const minion = [...game.state.units.values()].find((u) => u.kind === 'minion' && u.team === 'red' && u.lane === 'bot')!;
    game.issueOrder(ahri.id, { type: 'attack', targetId: minion.id });
    minion.hp = 1;
    minion.alive = false; // dies before she gets there
    runFor(game, 1);
    expect(ahri.order).toEqual({ type: 'lane', lane: 'bot' });
  });

  it('returns to its lane after a recall when it had no job left ("retour en lane")', () => {
    const game = new Game({ seed: 6, teams: { blue: TEAM, red: RED } });
    runFor(game, 60);
    const jinx = game.state.champions.find((c) => c.defId === 'jinx')!;
    game.issueOrder(jinx.id, { type: 'move', pos: { x: 5000, y: 3000 } });
    runFor(game, 3);
    expect(jinx.standingOrder).toBeNull();
    game.issueOrder(jinx.id, { type: 'recall' });
    runFor(game, 10);
    expect(jinx.order).toEqual({ type: 'lane', lane: 'bot' });
  });

  it('resumes farming after idling without orders ("farm auto"), unless disabled', () => {
    const game = new Game({ seed: 8, teams: { blue: TEAM, red: RED } });
    runFor(game, 40);
    const [garen, ahri] = ['garen', 'ahri'].map((id) => game.state.champions.find((c) => c.defId === id)!);
    game.setBehavior(ahri.id, { autoFarm: false });
    for (const c of [garen, ahri]) game.issueOrder(c.id, { type: 'idle' });
    runFor(game, 20);
    expect(garen.order).toEqual({ type: 'lane', lane: 'top' });
    expect(ahri.order.type).toBe('idle');
  });

  it('resumes farming even while hitting what walks into range', () => {
    const game = new Game({ seed: 9, teams: { blue: TEAM, red: RED } });
    runFor(game, 100);
    const garen = game.state.champions.find((c) => c.defId === 'garen')!;
    game.setBehavior(garen.id, { autoRetreat: false });
    game.issueOrder(garen.id, { type: 'idle' }); // holds in lane, among the minions
    let fought = false;
    for (let i = 0; i < 16 * SIM_TICK_RATE; i++) {
      game.step();
      fought ||= garen.activity === 'fighting';
    }
    expect(fought).toBe(true);
    expect(garen.order).toEqual({ type: 'lane', lane: 'top' });
  });

  it('waits at the base after a recall when "retour en lane" is off', () => {
    const game = new Game({ seed: 6, teams: { blue: TEAM, red: RED } });
    runFor(game, 60);
    const jinx = game.state.champions.find((c) => c.defId === 'jinx')!;
    game.setBehavior(jinx.id, { autoReturn: false });
    game.issueOrder(jinx.id, { type: 'recall' });
    runFor(game, 40);
    expect(jinx.order.type).toBe('idle');
    game.setBehavior(jinx.id, { autoReturn: true });
    runFor(game, 16);
    expect(jinx.order).toEqual({ type: 'lane', lane: 'bot' });
  });

  it('auto retreats once, then follows the player\'s orders even with low HP', () => {
    const game = new Game({ seed: 6, teams: { blue: TEAM, red: RED } });
    runFor(game, 60);
    const leesin = game.state.champions.find((c) => c.defId === 'leesin')!;
    leesin.hp = leesin.maxHp * 0.2;
    runFor(game, 0.1);
    expect(leesin.order.type).toBe('recall');
    game.issueOrder(leesin.id, { type: 'move', pos: { x: 5000, y: 5000 } });
    runFor(game, 2);
    expect(leesin.order.type).toBe('move');
    expect(leesin.recallTimer).toBeNull();
  });

  it('clears a camp ordered from the fog, or moves on when it is empty', () => {
    // No red jungler: it could take the camp first (that case is the "empty" one below).
    const game = new Game({ seed: 13, teams: { blue: TEAM, red: [] } });
    runFor(game, 100);
    const leesin = game.state.champions.find((c) => c.defId === 'leesin')!;
    const camp = game.state.camps.find((c) => c.def.owner === 'red' && c.unitId !== null && !MONSTER_STATS[c.def.kind].epic)!;
    const monster = game.get(camp.unitId!)!;
    expect(monster.visible.blue).toBe(false);
    game.issueOrder(leesin.id, { type: 'camp', campId: camp.def.id });
    let hit = false;
    for (let i = 0; i < 60 * SIM_TICK_RATE && !hit; i++) {
      game.step();
      hit = monster.lastDamagedBy === leesin.id;
    }
    expect(hit).toBe(true);

    const empty = game.state.camps.find((c) => c.unitId === null)!;
    game.issueOrder(leesin.id, { type: 'camp', campId: empty.def.id });
    const events: string[] = [];
    for (let i = 0; i < 60 * SIM_TICK_RATE && leesin.order.type === 'camp'; i++) {
      game.step();
      for (const e of game.drainEvents()) if (e.type === 'orderFailed') events.push(e.reason);
    }
    expect(leesin.order).toEqual({ type: 'jungle', scope: 'own' });
    expect(events).toContain('campEmpty');
  });

  it('minions never follow a champion out of their lane', () => {
    const game = new Game({ seed: 3, teams: { blue: TEAM, red: RED } });
    runFor(game, 45); // first red wave walking down mid, blue wave still far away
    const ahri = game.state.champions.find((c) => c.defId === 'ahri')!;
    const redMinions = () =>
      [...game.state.units.values()].filter((u): u is MinionUnit => u.kind === 'minion' && u.alive && u.team === 'red' && u.lane === 'mid');
    const near = redMinions().sort((a, b) => dist(a.pos, ahri.pos) - dist(b.pos, ahri.pos))[0];
    // Drop Ahri in front of the red wave, let them aggro her, then walk into the jungle.
    ahri.pos = { x: near.pos.x - 250, y: near.pos.y - 250 };
    game.setBehavior(ahri.id, { autoRetreat: false });
    runFor(game, 1);
    expect(redMinions().some((m) => m.targetId === ahri.id)).toBe(true);
    game.issueOrder(ahri.id, { type: 'move', pos: { x: 7000, y: 5400 } }); // blue raptors
    const track = laneTrack('red', 'mid');
    for (let i = 0; i < 8 * SIM_TICK_RATE; i++) {
      game.step();
      for (const m of redMinions()) expect(track.project(m.pos).offset).toBeLessThan(RULES.minionLaneCorridor + 200);
    }
    expect(redMinions().every((m) => m.targetId !== ahri.id)).toBe(true);
  });

  it('monsters stay in their camp and reset when the champion leaves', () => {
    const game = new Game({ seed: 3, teams: { blue: TEAM, red: [] } });
    runFor(game, 60);
    const leesin = game.state.champions.find((c) => c.defId === 'leesin')!;
    const camp = game.state.camps.find((c) => c.def.id === 'blue_gromp')!;
    runFor(game, 10); // gromp spawns at 1:07
    const gromp = game.get(camp.unitId!) as MonsterUnit;
    game.setBehavior(leesin.id, { autoFarm: false, autoRetreat: false });
    leesin.pos = { x: gromp.pos.x + 200, y: gromp.pos.y };
    game.issueOrder(leesin.id, { type: 'attack', targetId: gromp.id });
    runFor(game, 3);
    expect(gromp.hp).toBeLessThan(gromp.maxHp);
    game.issueOrder(leesin.id, { type: 'move', pos: { x: 3872, y: 7900 } }); // over to blue buff
    let farthest = 0;
    for (let i = 0; i < 15 * SIM_TICK_RATE; i++) {
      game.step();
      farthest = Math.max(farthest, dist(gromp.pos, gromp.home));
    }
    expect(farthest).toBeLessThanOrEqual(gromp.leash + 50);
    expect(gromp.hp).toBe(gromp.maxHp);
    expect(dist(gromp.pos, gromp.home)).toBeLessThan(50);
  });

  it('steps out of a turret\'s range when no minion is left to tank it ("sécurité tour")', () => {
    for (const safety of [true, false]) {
      const game = new Game({ seed: 4, teams: { blue: TEAM, red: RED } });
      runFor(game, 20); // before the first wave: nothing under the turret
      const garen = game.state.champions.find((c) => c.defId === 'garen')!;
      const turret = game.state.structures.find((s) => s.structureId === 'red_top_outer')!;
      game.setBehavior(garen.id, { autoTurretSafety: safety, autoRetreat: false });
      garen.pos = { x: turret.pos.x + 200, y: turret.pos.y - 200 };
      game.issueOrder(garen.id, { type: 'attack', targetId: turret.id });
      runFor(game, 4);
      const out = dist(garen.pos, turret.pos) > RULES.turretRange + garen.radius;
      expect(out, `safety ${safety}`).toBe(safety);
    }
  });

  it('keeps pushing past a destroyed inhibitor to the nexus turrets and the nexus', () => {
    const game = new Game({ seed: 5, teams: { blue: TEAM, red: [] } });
    // Raze red's bot lane up to its inhibitor (kept down), and the bot-side nexus turret: the last
    // one stands on the top side, far from where the bot lane used to end.
    const razed = (id: string) => id.startsWith('red_bot_') || id === 'red_nexus_turret_2';
    for (const s of game.state.structures) {
      if (razed(s.structureId)) {
        s.alive = false;
        s.hp = 0;
        s.respawnTimer = 9999;
      }
    }
    runFor(game, 4 * 60);
    const last = game.state.structures.find((s) => s.structureId === 'red_nexus_turret_1')!;
    expect(last.hp).toBeLessThan(last.maxHp);
  });

  it('ignores player commands naming opponents (forged or stale log)', () => {
    const game = new Game({ seed: 2, teams: { blue: TEAM, red: RED } });
    runFor(game, 30);
    const darius = game.state.champions.find((c) => c.defId === 'darius')!;
    const garen = game.state.champions.find((c) => c.defId === 'garen')!;
    applyCommand(game, { type: 'behavior', championIds: [darius.id], behavior: { autoFarm: false } });
    applyCommand(game, { type: 'order', championIds: [darius.id, garen.id], order: { type: 'recall' } });
    expect(darius.autoFarm).toBe(true);
    expect(darius.order.type).not.toBe('recall');
    expect(garen.order.type).toBe('recall');
  });

  it('stops farming when farm auto is turned off, and goes back when turned on', () => {
    const game = new Game({ seed: 12, teams: { blue: TEAM, red: RED } });
    runFor(game, 60);
    const jinx = game.state.champions.find((c) => c.defId === 'jinx')!;
    game.setBehavior(jinx.id, { autoFarm: false });
    expect(jinx.order.type).toBe('idle');
    runFor(game, 30);
    expect(jinx.order.type).toBe('idle');
    game.setBehavior(jinx.id, { autoFarm: true });
    expect(jinx.order).toEqual({ type: 'lane', lane: 'bot' });
  });

  it('tracks camp knowledge per team', () => {
    const game = new Game({ seed: 3, teams: { blue: TEAM, red: RED } });
    runFor(game, 70);
    // Every spawned camp shows up on both teams' maps.
    const alive = game.state.camps.filter((c) => c.unitId !== null);
    expect(alive.length).toBeGreaterThan(10);
    expect(alive.every((c) => c.intel.blue.status === 'up' && c.intel.red.status === 'up')).toBe(true);
    runFor(game, 120);
    const cleared = game.state.camps.find((c) => c.def.owner === 'blue' && c.unitId === null && c.nextSpawnAt !== null);
    expect(cleared).toBeDefined();
    expect(cleared!.intel.blue).toEqual({ status: 'down', respawnAt: cleared!.nextSpawnAt });
    expect(cleared!.intel.red.status).toBe('up');
  });

  it('is deterministic for a given seed', () => {
    const a = new Game({ seed: 7, teams: { blue: TEAM, red: [] } });
    const b = new Game({ seed: 7, teams: { blue: TEAM, red: [] } });
    runFor(a, 120);
    runFor(b, 120);
    expect(a.state.champions.map((c) => [c.pos.x, c.pos.y, c.gold])).toEqual(
      b.state.champions.map((c) => [c.pos.x, c.pos.y, c.gold]),
    );
  });

  it('rebuilds the exact same state by replaying the command log', () => {
    const setup = { seed: 21, teams: { blue: TEAM, red: RED } };
    const live = new Game(setup);
    const log: TimedCommand[] = [];
    const record = (command: TimedCommand['command']) => {
      log.push({ tick: live.state.tick, seq: log.length, command });
      applyCommand(live, command);
    };
    const [garen, ahri, jinx] = ['garen', 'ahri', 'jinx'].map((id) => live.state.champions.find((c) => c.defId === id)!);
    runFor(live, 50);
    record({ type: 'order', championIds: [ahri.id, garen.id], order: { type: 'move', pos: { x: 4321.5, y: 7654.25 } } });
    runFor(live, 7.35);
    record({ type: 'behavior', championIds: [jinx.id], behavior: { autoFarm: false } });
    record({ type: 'order', championIds: [jinx.id], order: { type: 'ward', pos: { x: 9000, y: 5000 } } });
    runFor(live, 30);
    record({ type: 'order', championIds: [ahri.id], order: { type: 'recall' } });
    runFor(live, 40);

    const replayed = new Game(setup);
    const replay = new CommandReplay(replayed, JSON.parse(JSON.stringify(log)));
    while (replayed.state.tick < live.state.tick) replay.step();
    replay.applyDue();

    const fingerprint = (g: Game) => g.state.champions.map((c) => [c.pos.x, c.pos.y, c.hp, c.gold, c.order]);
    expect(fingerprint(replayed)).toEqual(fingerprint(live));
    expect(replayed.state.units.size).toBe(live.state.units.size);
  });
});
