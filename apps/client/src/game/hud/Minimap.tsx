import { MAP_SIZE, type Vec2 } from '@macrogod/shared';
import { useEffect, useRef } from 'react';
import { isShownTo } from '../render/layers/UnitLayer';
import { buildMapPaint, paintCanvas } from '../render/mapPaint';
import { CAMP_COLORS } from '../render/theme';
import { useGameContext } from '../core/GameSessionContext';
import styles from './hud.module.css';

const SIZE = 236;
const REFRESH_MS = 100;

function renderBackground(px: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = px;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0d1611';
  ctx.fillRect(0, 0, px, px);
  ctx.scale(px / MAP_SIZE, px / MAP_SIZE);
  paintCanvas(ctx, buildMapPaint());
  return canvas;
}

export function Minimap() {
  const { session, renderer } = useGameContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.round(SIZE * dpr);
    canvas.width = canvas.height = px;
    const ctx = canvas.getContext('2d')!;
    const background = renderBackground(px);
    const k = px / MAP_SIZE;
    const toMini = (p: Vec2) => ({ x: p.x * k, y: (MAP_SIZE - p.y) * k });
    let last = 0;

    const draw = () => {
      ctx.drawImage(background, 0, 0);
      ctx.globalAlpha = 0.9;
      ctx.drawImage(renderer.fog.canvas, 0, 0, px, px);
      ctx.globalAlpha = 1;

      for (const u of session.game.state.units.values()) {
        if (!isShownTo(u, session.team) || u.kind === 'ward') continue;
        const p = toMini(u.pos);
        const color = u.team === 'neutral' ? '#f2a33a' : u.team === 'blue' ? '#3d8bff' : '#ff4d5e';
        if (u.kind === 'turret' || u.kind === 'inhibitor' || u.kind === 'nexus') {
          const s = (u.kind === 'nexus' ? 5 : 3.5) * dpr;
          ctx.fillStyle = u.alive ? color : '#3a3f47';
          ctx.fillRect(p.x - s, p.y - s, s * 2, s * 2);
        } else if (u.kind === 'minion' && u.alive) {
          ctx.fillStyle = color;
          ctx.fillRect(p.x - 1 * dpr, p.y - 1 * dpr, 2 * dpr, 2 * dpr);
        } else if (u.kind === 'monster' && u.alive) {
          ctx.fillStyle = u.epic ? '#b48cff' : color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, (u.epic ? 4.5 : 2.5) * dpr, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // Jungle camps the team believes are up (and does not currently see).
      for (const camp of session.game.state.camps) {
        if (camp.intel[session.team].status !== 'up') continue;
        const monster = camp.unitId !== null ? session.game.get(camp.unitId) : undefined;
        if (monster?.visible[session.team]) continue;
        const p = toMini(camp.def.pos);
        ctx.fillStyle = `#${CAMP_COLORS[camp.def.kind].toString(16).padStart(6, '0')}`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, (camp.def.kind === 'dragon' || camp.def.kind === 'baron' ? 4 : 2.6) * dpr, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const c of session.game.state.champions) {
        if (!c.alive || !isShownTo(c, session.team)) continue;
        const p = toMini(c.pos);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = c.team === 'blue' ? '#3d8bff' : '#ff4d5e';
        ctx.fill();
        ctx.lineWidth = 1.5 * dpr;
        ctx.strokeStyle = session.selection.has(c.id) ? '#f0d58a' : '#0b1016';
        ctx.stroke();
      }

      const r = renderer.camera.worldRect();
      const a = toMini({ x: r.minX, y: r.maxY });
      const b = toMini({ x: r.maxX, y: r.minY });
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1.2 * dpr;
      ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    };

    draw();
    return session.onFrame(() => {
      const now = performance.now();
      if (now - last < REFRESH_MS) return;
      last = now;
      draw();
    });
  }, [session, renderer]);

  const toWorld = (e: React.MouseEvent<HTMLCanvasElement>): Vec2 => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * MAP_SIZE;
    const y = MAP_SIZE - ((e.clientY - rect.top) / rect.height) * MAP_SIZE;
    return { x, y };
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0) renderer.camera.centerOnWorld(toWorld(e));
    if (e.button === 2 && session.selection.size > 0) {
      const pos = toWorld(e);
      session.order({ type: 'move', pos });
      renderer.effects.addMarker(pos, 0x3ecf8e);
    }
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.buttons & 1) renderer.camera.centerOnWorld(toWorld(e));
  };

  return (
    <div className={`${styles.panel} ${styles.minimap}`}>
      <canvas
        ref={canvasRef}
        style={{ width: SIZE, height: SIZE }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}
