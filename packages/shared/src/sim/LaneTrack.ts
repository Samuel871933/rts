import { LANE_PATHS } from '../data/map';
import { closestOnSegment, dist, type Vec2 } from '../math';
import type { Lane, Team } from '../types';

/** A lane polyline oriented from a team's base toward the enemy base, measured by distance along it. */
export class LaneTrack {
  readonly cumulative: number[];
  readonly length: number;

  constructor(readonly points: Vec2[]) {
    this.cumulative = [0];
    for (let i = 1; i < points.length; i++) {
      this.cumulative.push(this.cumulative[i - 1] + dist(points[i - 1], points[i]));
    }
    this.length = this.cumulative[this.cumulative.length - 1];
  }

  /** Progress `s` along the lane of the closest point to p, and the distance to the lane. */
  project(p: Vec2): { s: number; offset: number } {
    let best = { s: 0, offset: Infinity };
    for (let i = 0; i < this.points.length - 1; i++) {
      const { point, t } = closestOnSegment(p, this.points[i], this.points[i + 1]);
      const offset = dist(p, point);
      if (offset < best.offset) {
        best = { s: this.cumulative[i] + t * (this.cumulative[i + 1] - this.cumulative[i]), offset };
      }
    }
    return best;
  }

  pointAt(s: number): Vec2 {
    const clamped = Math.max(0, Math.min(this.length, s));
    for (let i = 0; i < this.points.length - 1; i++) {
      if (clamped <= this.cumulative[i + 1]) {
        const segLen = this.cumulative[i + 1] - this.cumulative[i];
        const t = segLen === 0 ? 0 : (clamped - this.cumulative[i]) / segLen;
        const a = this.points[i];
        const b = this.points[i + 1];
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      }
    }
    return { ...this.points[this.points.length - 1] };
  }
}

/** Built once: lane geometry never changes, and every game shares it read-only. */
const TRACKS: Record<Team, Record<Lane, LaneTrack>> = {
  blue: {
    top: new LaneTrack(LANE_PATHS.top),
    mid: new LaneTrack(LANE_PATHS.mid),
    bot: new LaneTrack(LANE_PATHS.bot),
  },
  red: {
    top: new LaneTrack([...LANE_PATHS.top].reverse()),
    mid: new LaneTrack([...LANE_PATHS.mid].reverse()),
    bot: new LaneTrack([...LANE_PATHS.bot].reverse()),
  },
};

export const laneTrack = (team: Team, lane: Lane): LaneTrack => TRACKS[team][lane];
