import { ROLES } from '@macrogod/shared';
import { useCallback } from 'react';
import { ROLE_LABELS, formatGold } from '../../i18n/labels';
import { useGameContext, useHud } from '../core/GameSessionContext';
import { ChampionCard } from './ChampionCard';
import { StructuresStatus } from './StructuresStatus';
import styles from './hud.module.css';

/** Left column: the player's five champions. */
export function AllyPanel() {
  const { session, renderer } = useGameContext();
  const hud = useHud();

  const onSelect = useCallback((id: number, additive: boolean) => session.select([id], additive), [session]);
  const onFocus = useCallback(
    (id: number) => {
      const c = session.game.champion(id);
      if (c?.alive) renderer.camera.centerOnWorld(c.pos);
    },
    [session, renderer],
  );

  return (
    <div className={`${styles.sidePanel} ${styles.allySide}`}>
      <header className={styles.sideHeader}>
        <h2>Ton équipe</h2>
        <span>🪙 {formatGold(hud.teams[session.team].gold)}</span>
      </header>
      <div className={styles.cards}>
        {hud.champions.map((c, i) => (
          <ChampionCard
            key={c.id}
            champion={c}
            index={i}
            selected={hud.selection.includes(c.id)}
            onSelect={onSelect}
            onFocus={onFocus}
          />
        ))}
      </div>
      <StructuresStatus team={session.team} />
    </div>
  );
}

/** Right column: the opposing composition (empty until enemy champions exist) and their base. */
export function EnemyPanel() {
  const { session, renderer } = useGameContext();
  const hud = useHud();
  const enemyTeam = session.team === 'blue' ? 'red' : 'blue';

  const onFocus = useCallback(
    (id: number) => {
      const c = session.game.champion(id);
      if (c?.alive && c.visible[session.team]) renderer.camera.centerOnWorld(c.pos);
    },
    [session, renderer],
  );

  return (
    <div className={`${styles.sidePanel} ${styles.enemySide}`}>
      <header className={styles.sideHeader}>
        <h2>Équipe adverse</h2>
      </header>
      <div className={styles.cards}>
        {hud.enemies.length > 0
          ? hud.enemies.map((c, i) => (
              <ChampionCard key={c.id} champion={c} index={i} selected={false} onSelect={onFocus} onFocus={onFocus} enemy />
            ))
          : ROLES.map((role) => (
              <div key={role} className={styles.emptySlot}>
                <span className={styles.emptyIcon}>?</span>
                <span>
                  <strong>{ROLE_LABELS[role]}</strong>
                  <small>Aucun adversaire</small>
                </span>
              </div>
            ))}
      </div>
      <StructuresStatus team={enemyTeam} />
    </div>
  );
}
