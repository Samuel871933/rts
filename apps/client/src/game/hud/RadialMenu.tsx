import type { Vec2 } from '@macrogod/shared';
import { useEffect, useRef } from 'react';
import { useGameContext, useHud } from '../core/GameSessionContext';
import type { GameSession } from '../core/GameSession';
import type { RadialTarget } from '../core/hudSnapshot';
import { groundMenuFor, radialMenuFor, type RadialMenuModel } from './radialActions';
import styles from './hud.module.css';

const RADIUS = 78;
const WIDE_RADIUS = 96;
/** Largest ring radius + half an item: distance the anchor keeps from the stage edges. */
const EDGE_MARGIN = WIDE_RADIUS + 42;

/** World position the ring is anchored to, or null when its unit is gone / out of sight. */
function anchorOf(session: GameSession, target: RadialTarget): Vec2 | null {
  if (target.kind === 'ground') return target.pos;
  const unit = session.game.get(target.id);
  if (!unit?.alive || !(unit.team === session.team || unit.visible[session.team])) return null;
  return unit.pos;
}

function menuOf(session: GameSession, target: RadialTarget): RadialMenuModel | null {
  if (target.kind === 'ground') return groundMenuFor(session, target.pos);
  const unit = session.game.get(target.id);
  return unit ? radialMenuFor(session, unit) : null;
}

/**
 * Quick action ring, around a clicked unit's bubble or a clicked point of the map. It follows its
 * unit every frame and closes on Escape, on any click outside, or when the unit disappears.
 */
export function RadialMenu() {
  const { session, renderer } = useGameContext();
  const { radial } = useHud();
  const anchorRef = useRef<HTMLDivElement>(null);

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
      const y = Math.min(Math.max(p.y, EDGE_MARGIN), height - EDGE_MARGIN - 30);
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

  if (!radial) return null;
  const menu = menuOf(session, radial);
  if (!menu) return null;
  const step = (Math.PI * 2) / menu.actions.length;
  const radius = menu.actions.length > 4 ? WIDE_RADIUS : RADIUS;
  const targetId = radial.kind === 'unit' ? radial.id : null;

  return (
    <div ref={anchorRef} className={styles.radialAnchor}>
      <div className={radial.kind === 'ground' ? styles.radialPoint : styles.radialRing} />
      <span className={styles.radialTitle}>{menu.title}</span>
      {menu.actions.map((action, i) => {
        const angle = -Math.PI / 2 + i * step;
        return (
          <button
            key={action.id}
            className={`${styles.radialItem} ${styles[`radial_${action.tone ?? 'neutral'}`]}`}
            style={{ transform: `translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px)` }}
            onClick={() => {
              const ids = [...session.selection].filter((id) => !(action.order.type === 'follow' && id === targetId));
              session.order(action.order, ids);
              const pos = 'pos' in action.order ? action.order.pos : null;
              if (pos) renderer.effects.addMarker(pos, action.tone === 'attack' ? 0xff4d5e : 0x3ecf8e);
            }}
          >
            <span className={styles.radialIcon}>{action.icon}</span>
            <span>{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}
