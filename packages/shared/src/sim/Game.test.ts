import { describe, expect, it } from 'vitest';
import { SIM_TICK_RATE } from '../constants';
import { CAMPS, FOUNTAINS, LANE_PATHS } from '../data/map';
import { STRUCTURES } from '../data/structures';
import type { ChampionPick } from '../types';
import { Game } from './Game';

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
    expect(champs.some((c) => c.items.length > 1)).toBe(true);
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
});
