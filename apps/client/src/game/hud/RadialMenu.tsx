import type { Vec2 } from '@macrogod/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useGameContext, useHud } from '../core/GameSessionContext';
import type { GameSession } from '../core/GameSession';
import type { RadialTarget } from '../core/hudSnapshot';
import { campMenuFor, groundMenuFor, radialMenuFor, type RadialMenuModel } from './radialActions';
import { COLORS } from '../render/theme';
import type { RadialAction } from './radialActions';
import styles from './RadialMenu.module.css';

const MARKER_COLORS: Record<NonNullable<RadialAction['tone']>, number> = {
  attack: COLORS.orderAttack,
  support: COLORS.heal,
  neutral: COLORS.orderMove,
};

/** Distance from the target to the buttons' centers (more actions, wider wheel). */
const RADIUS = 50;
const WIDE_RADIUS = 58;
/** Wheel radius + label: distance the anchor keeps from the stage edges. */
const EDGE_MARGIN = WIDE_RADIUS + 40;

/** World position the ring is anchored to, or null when its unit is gone / out of sight. */
const campOf = (session: GameSession, campId: string) => session.game.state.camps.find((c) => c.def.id === campId);

function anchorOf(session: GameSession, target: RadialTarget): Vec2 | null {
  if (target.kind === 'ground') return target.pos;
  if (target.kind === 'camp') return campOf(session, target.campId)?.def.pos ?? null;
  const unit = session.game.get(target.id);
  if (!unit?.alive || !(unit.team === session.team || unit.visible[session.team])) return null;
  return unit.pos;
}

function menuOf(session: GameSession, target: RadialTarget): RadialMenuModel | null {
  if (target.kind === 'ground') return groundMenuFor(session, target.pos);
  if (target.kind === 'camp') {
    const camp = campOf(session, target.campId);
    return camp ? campMenuFor(camp) : null;
  }
  const unit = session.game.get(target.id);
  return unit ? radialMenuFor(session, unit) : null;
}

/**
 * Quick action ring, around a clicked unit's bubble or a clicked point of the map. It follows its
 * unit every frame and closes on Escape, on any click outside, or when the unit disappears.
 */
export function RadialMenu() {
  const { session, renderer } = useGameContext();
  const radial = useHud((h) => h.radial);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    if (radial === null) return;
    const follow = () => {
      const world = anchorOf(session, radial);
      if (!world) {
        session.closeRadial();
        return;
      }
      const p = renderer.camera.worldToScreen(world);
      // Keep the whole ring (and its title below) inside the stage near the map edges.
      const { width, height } = renderer.camera;
      const x = Math.min(Math.max(p.x, EDGE_MARGIN), width - EDGE_MARGIN);
      const y = Math.min(Math.max(p.y, EDGE_MARGIN), height - EDGE_MARGIN);
      if (anchorRef.current) anchorRef.current.style.transform = `translate(${x}px, ${y}px)`;
    };
    follow();
    const offFrame = session.onFrame(follow);
    const onPointerDown = (e: PointerEvent) => {
      if (anchorRef.current?.contains(e.target as Node)) return;
      session.closeRadial();
      // A click on the map only dismisses the ring: it must not also select or give an order.
      if (e.target === renderer.canvas) e.stopPropagation();
    };
    // Capture phase on window: runs before the canvas handlers.
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      offFrame();
      window.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [radial, session, renderer]);

  // Built once per opening: the ring's actions don't change while it is open.
  const menu = useMemo(() => (radial ? menuOf(session, radial) : null), [session, radial]);
  if (!radial || !menu) return null;
  const step = (Math.PI * 2) / menu.actions.length;
  const radius = menu.actions.length > 4 ? WIDE_RADIUS : RADIUS;
  const targetId = radial.kind === 'unit' ? radial.id : null;

  const hoveredAction = menu.actions.find((a) => a.id === hovered);

  return (
    <div ref={anchorRef} className={styles.anchor} style={{ ['--wheel' as string]: `${radius + 26}px` }}>
      <div className={styles.wheel} />
      <div className={radial.kind === 'ground' ? styles.point : styles.target} />
      <span className={`${styles.label} ${hoveredAction ? styles.labelAction : ''}`}>
        {hoveredAction ? hoveredAction.label : menu.title}
      </span>
      {menu.actions.map((action, i) => {
        const angle = -Math.PI / 2 + i * step;
        return (
          <button
            key={action.id}
            className={`${styles.item} ${styles[action.tone ?? 'neutral']}`}
            style={{ ['--x' as string]: `${Math.cos(angle) * radius}px`, ['--y' as string]: `${Math.sin(angle) * radius}px` }}
            aria-label={action.label}
            onPointerEnter={() => setHovered(action.id)}
            onPointerLeave={() => setHovered((h) => (h === action.id ? null : h))}
            onClick={() => {
              const ids = [...session.selection].filter((id) => !(action.order.type === 'follow' && id === targetId));
              session.order(action.order, ids);
              const pos =
                'pos' in action.order ? action.order.pos : action.order.type === 'camp' ? anchorOf(session, radial) : null;
              if (pos) renderer.effects.addMarker(pos, MARKER_COLORS[action.tone ?? 'neutral']);
            }}
          >
            <action.Icon size={16} strokeWidth={2.2} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
