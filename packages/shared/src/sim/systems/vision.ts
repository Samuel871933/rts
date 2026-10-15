import { dist2, type Vec2 } from '../../math';
import { TEAMS, type Team } from '../../types';
import type { Game } from '../Game';
import { isStructure } from '../queries';
import type { Unit } from '../types';
import { updateCampIntel } from './camps';

/**
 * Fog of war: a unit is visible to a team when it stands in the sight radius of one of that team's
 * units, turrets or wards. Structures are always visible; enemy wards never are (no control wards yet).
 */
export function updateVision(game: Game) {
  const sources: Record<Team, Unit[]> = { blue: [], red: [] };
  for (const u of game.state.units.values()) {
    if (u.alive && u.team !== 'neutral' && u.sight > 0) sources[u.team].push(u);
  }

  const sees = (team: Team, pos: Vec2) => sources[team].some((s) => dist2(s.pos, pos) <= s.sight * s.sight);

  for (const u of game.state.units.values()) {
    for (const team of TEAMS) {
      if (u.team === team || isStructure(u)) {
        u.visible[team] = true;
      } else if (!u.alive || u.kind === 'ward') {
        u.visible[team] = false;
      } else {
        u.visible[team] = sees(team, u.pos);
      }
    }
  }
  updateCampIntel(game, sees);
}
