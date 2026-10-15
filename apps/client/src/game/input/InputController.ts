import type { Order } from '@macrogod/shared';
import type { GameSession } from '../core/GameSession';
import type { GameRenderer } from '../render/GameRenderer';
import { COLORS } from '../render/theme';
import { hotkeyFor, type HotkeyAction } from './hotkeys';

const DRAG_THRESHOLD = 6;
const EDGE_PAN_MARGIN = 14;
const EDGE_PAN_SPEED = 1100;
const KEY_PAN_SPEED = 1300;
const DOUBLE_TAP_MS = 320;

/**
 * Mouse & keyboard → selection, orders and camera. RTS conventions:
 * left click / drag on the ground selects, drag from one of our champions gives it an order
 * (drop on a target = attack, on an ally = escort, elsewhere = move), right click orders,
 * edges / arrows pan.
 */
export class InputController {
  private dragStart: { x: number; y: number } | null = null;
  private dragging = false;
  /** Champion the current left drag started on: the drag becomes an order instead of a box. */
  private dragChampionId: number | null = null;
  private panning: { x: number; y: number } | null = null;
  private mouse: { x: number; y: number } | null = null;
  private keysDown = new Set<string>();
  private lastSelectKey = { index: -1, at: 0 };
  private readonly offFrame: () => void;

  constructor(
    private readonly renderer: GameRenderer,
    private readonly session: GameSession,
  ) {
    const canvas = renderer.canvas;
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('contextmenu', this.preventDefault);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    this.offFrame = session.onFrame((_alpha, realDt) => this.update(realDt));
  }

  destroy() {
    const canvas = this.renderer.canvas;
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('contextmenu', this.preventDefault);
    canvas.removeEventListener('pointerleave', this.onPointerLeave);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.offFrame();
  }

  private local(e: { clientX: number; clientY: number }) {
    const rect = this.renderer.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private preventDefault = (e: Event) => e.preventDefault();

  // --- Mouse ---

  private onPointerDown = (e: PointerEvent) => {
    const p = this.local(e);
    if (e.button === 0) {
      this.dragStart = p;
      this.dragging = false;
      const champ =
        this.session.commandMode === 'none'
          ? this.renderer.pickUnit(p.x, p.y, (u) => u.kind === 'champion' && u.team === this.session.team)
          : null;
      this.dragChampionId = champ?.id ?? null;
    } else if (e.button === 1) {
      e.preventDefault();
      this.panning = p;
    } else if (e.button === 2) {
      this.rightClick(p.x, p.y);
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    const p = this.local(e);
    this.mouse = p;
    this.renderer.cursorWorld = this.renderer.camera.screenToWorld(p.x, p.y);
    if (this.panning) {
      this.renderer.camera.panBy(p.x - this.panning.x, p.y - this.panning.y);
      this.panning = p;
    }
    if (this.dragStart && !this.dragging && Math.hypot(p.x - this.dragStart.x, p.y - this.dragStart.y) > DRAG_THRESHOLD) {
      this.dragging = true;
    }
    if (this.dragging && this.dragStart) {
      if (this.dragChampionId !== null) this.drawOrderDrag(p);
      else this.drawBox(this.dragStart, p);
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.button === 1) this.panning = null;
    if (e.button !== 0 || !this.dragStart) return;
    const p = this.local(e);
    if (this.dragging && this.dragChampionId !== null) this.dropOrder(this.dragChampionId, p);
    else if (this.dragging) this.boxSelect(this.dragStart, p, e.shiftKey);
    else this.leftClick(p.x, p.y, e.shiftKey);
    this.dragStart = null;
    this.dragging = false;
    this.dragChampionId = null;
    this.renderer.screenOverlay.clear();
  };

  private onPointerLeave = () => {
    this.mouse = null;
  };

  private leftClick(x: number, y: number, additive: boolean) {
    const { session, renderer } = this;
    const world = renderer.camera.screenToWorld(x, y);
    if (session.commandMode === 'ward') {
      session.order({ type: 'ward', pos: world });
      renderer.effects.addMarker(world, COLORS.ward);
      return;
    }
    if (session.commandMode === 'attackMove') {
      session.order({ type: 'attackMove', pos: world });
      renderer.effects.addMarker(world, COLORS.orderAttack);
      return;
    }
    const mine = renderer.pickUnit(x, y, (u) => u.kind === 'champion' && u.team === session.team);
    if (mine) return session.select([mine.id], additive);
    if (session.selection.size === 0) return;
    // With champions selected, a click opens the quick action ring: on the unit under the cursor,
    // or on that point of the map (move, ward...). Escape deselects.
    const other = renderer.pickUnit(x, y, (u) => u.kind !== 'ward');
    session.openRadial(other ? { kind: 'unit', id: other.id } : { kind: 'ground', pos: world });
  }

  private rightClick(x: number, y: number) {
    const { session, renderer } = this;
    if (session.commandMode !== 'none') {
      session.setCommandMode('none');
      return;
    }
    if (session.selection.size === 0) return;
    // Right click on an ally champion: actions with it (escort, join...).
    const ally = renderer.pickUnit(x, y, (u) => u.kind === 'champion' && u.team === session.team);
    if (ally) return session.openRadial({ kind: 'unit', id: ally.id });
    const target = renderer.pickUnit(x, y, (u) => u.team !== session.team && u.kind !== 'ward');
    const world = renderer.camera.screenToWorld(x, y);
    if (target) {
      session.order({ type: 'attack', targetId: target.id });
      renderer.effects.addMarker(target.pos, COLORS.orderAttack);
    } else {
      session.order({ type: 'move', pos: world });
      renderer.effects.addMarker(world, COLORS.orderMove);
    }
  }

  /** What a champion drag released at this point would target (anything but our own wards). */
  private dragTarget(x: number, y: number, championId: number) {
    return this.renderer.pickUnit(x, y, (u) => u.kind !== 'ward' && u.id !== championId && (u.team !== this.session.team || u.kind === 'champion'));
  }

  /** Drag from a champion: arrow to the cursor, red over a target, green to move. */
  private drawOrderDrag(p: { x: number; y: number }) {
    const champ = this.dragChampionId !== null ? this.session.game.champion(this.dragChampionId) : undefined;
    const g = this.renderer.screenOverlay.clear();
    if (!champ?.alive) return;
    const from = this.renderer.toScreen(champ.pos);
    const target = this.dragTarget(p.x, p.y, champ.id);
    const color = !target ? COLORS.orderMove : target.team === this.session.team ? COLORS.heal : COLORS.orderAttack;
    const to = target ? this.renderer.toScreen(target.pos) : p;
    g.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ width: 3, color, alpha: 0.85 });
    // Arrow head
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const head = 12;
    g.poly([
      to.x, to.y,
      to.x - head * Math.cos(angle - 0.45), to.y - head * Math.sin(angle - 0.45),
      to.x - head * Math.cos(angle + 0.45), to.y - head * Math.sin(angle + 0.45),
    ]).fill({ color, alpha: 0.9 });
    if (target) g.circle(to.x, to.y, 18).stroke({ width: 2, color });
  }

  /** Drop of a champion drag: attack a hostile target, escort an ally champion, or move. */
  private dropOrder(championId: number, p: { x: number; y: number }) {
    const { session, renderer } = this;
    const champ = session.game.champion(championId);
    if (!champ?.alive) return;
    // Dragging a member of the selection orders the whole group; otherwise only that champion.
    if (!session.selection.has(championId)) session.select([championId]);
    const ids = [...session.selection];
    const target = this.dragTarget(p.x, p.y, championId);
    if (target?.kind === 'champion' && target.team === session.team) {
      session.order({ type: 'follow', targetId: target.id }, ids.filter((id) => id !== target.id));
      renderer.effects.addMarker(target.pos, COLORS.heal);
    } else if (target) {
      session.order({ type: 'attack', targetId: target.id }, ids);
      renderer.effects.addMarker(target.pos, COLORS.orderAttack);
    } else {
      const world = renderer.camera.screenToWorld(p.x, p.y);
      session.order({ type: 'move', pos: world }, ids);
      renderer.effects.addMarker(world, COLORS.orderMove);
    }
  }

  private drawBox(a: { x: number; y: number }, b: { x: number; y: number }) {
    this.renderer.screenOverlay
      .clear()
      .rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(a.x - b.x), Math.abs(a.y - b.y))
      .fill({ color: COLORS.selection, alpha: 0.08 })
      .stroke({ width: 1, color: COLORS.selection, alpha: 0.8 });
  }

  private boxSelect(a: { x: number; y: number }, b: { x: number; y: number }, additive: boolean) {
    const [x0, x1] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
    const [y0, y1] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
    const ids = this.session
      .myChampions()
      .filter((c) => {
        if (!c.alive) return false;
        const s = this.renderer.toScreen(c.pos);
        return s.x >= x0 && s.x <= x1 && s.y >= y0 && s.y <= y1;
      })
      .map((c) => c.id);
    if (ids.length > 0 || !additive) this.session.select(ids, additive);
  }

  // --- Keyboard ---

  private onKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    this.keysDown.add(e.code);
    const action = hotkeyFor(e);
    if (!action) return;
    e.preventDefault();
    if (!e.repeat) this.runAction(action, e.timeStamp);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keysDown.delete(e.code);
  };

  private onBlur = () => {
    this.keysDown.clear();
    this.mouse = null;
  };

  /** Shared by hotkeys and HUD buttons. `at` is the event timestamp (double-tap detection). */
  runAction(action: HotkeyAction, at = performance.now()) {
    const { session } = this;
    const order = (o: Order) => session.order(o);
    switch (action.type) {
      case 'selectIndex': {
        const champ = session.myChampions()[action.index];
        if (!champ) return;
        if (this.lastSelectKey.index === action.index && at - this.lastSelectKey.at < DOUBLE_TAP_MS) {
          this.renderer.camera.centerOnWorld(champ.pos);
        }
        this.lastSelectKey = { index: action.index, at };
        session.select([champ.id]);
        return;
      }
      case 'selectAll':
        return session.selectAll();
      case 'center':
        return this.centerOnSelection();
      case 'overview':
        return this.renderer.camera.fitMap();
      case 'cancel':
        if (session.radial !== null) session.closeRadial();
        else if (session.commandMode !== 'none') session.setCommandMode('none');
        else session.clearSelection();
        return;
      case 'mode':
        return session.setCommandMode(session.commandMode === action.mode ? 'none' : action.mode);
      case 'lane':
        return order({ type: 'lane', lane: action.lane });
      case 'jungle':
        return order({ type: 'jungle', scope: 'own' });
      case 'recall':
        return order({ type: 'recall' });
      case 'stop':
        return order({ type: 'idle' });
      case 'autoRetreat':
      case 'autoReturn':
      case 'autoFarm':
        return session.toggleBehavior(action.type);
      case 'pause':
        return session.togglePause();
    }
  }

  centerOnSelection() {
    const selected = this.session.selectedChampions().filter((c) => c.alive);
    if (selected.length === 0) return this.renderer.camera.fitMap();
    const x = selected.reduce((s, c) => s + c.pos.x, 0) / selected.length;
    const y = selected.reduce((s, c) => s + c.pos.y, 0) / selected.length;
    this.renderer.camera.centerOnWorld({ x, y });
  }

  private update(realDt: number) {
    const cam = this.renderer.camera;
    let dx = 0;
    let dy = 0;
    if (this.keysDown.has('ArrowLeft')) dx += 1;
    if (this.keysDown.has('ArrowRight')) dx -= 1;
    if (this.keysDown.has('ArrowUp')) dy += 1;
    if (this.keysDown.has('ArrowDown')) dy -= 1;
    let speed = KEY_PAN_SPEED;
    if (this.mouse && (!this.dragStart || this.dragChampionId !== null) && !this.panning && document.hasFocus()) {
      const { x, y } = this.mouse;
      if (x < EDGE_PAN_MARGIN) dx += 1;
      if (x > cam.width - EDGE_PAN_MARGIN) dx -= 1;
      if (y < EDGE_PAN_MARGIN) dy += 1;
      if (y > cam.height - EDGE_PAN_MARGIN) dy -= 1;
      speed = Math.max(speed, EDGE_PAN_SPEED);
    }
    if (dx !== 0 || dy !== 0) cam.panBy(dx * speed * realDt, dy * speed * realDt);
    if (this.mouse) this.renderer.cursorWorld = cam.screenToWorld(this.mouse.x, this.mouse.y);
    // Keep the drag arrow attached to the (moving) champion.
    if (this.dragging && this.dragChampionId !== null && this.mouse) this.drawOrderDrag(this.mouse);
  }
}
