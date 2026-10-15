import { ROLES, enemyOf } from '@macrogod/shared';
import { Coins } from 'lucide-react';
import { useCallback } from 'react';
import { ROLE_LABELS, formatGold } from '../../i18n/labels';
import { useGameContext, useHud } from '../core/GameSessionContext';
import { ChampionCard } from './ChampionCard';
import { StructuresStatus } from './StructuresStatus';
import styles from './hud.module.css';

/** Left column: the player's five champions. */
export function AllyPanel() {
  const { session } = useGameContext();
  const hud = useHud((h) => ({ champions: h.champions, selection: h.selection, teams: h.teams }));

  const onSelect = useCallback((id: number, additive: boolean) => session.select([id], additive), [session]);

  return (
    <div className={`${styles.sidePanel} ${styles.allySide}`}>
      <header className={styles.sideHeader}>
        <h2>Ton équipe</h2>
        <span>
          <Coins size={14} /> {formatGold(hud.teams[session.team].gold)}
        </span>
      </header>
      <div className={styles.cards}>
        {hud.champions.map((c, i) => (
          <ChampionCard
            key={c.id}
            champion={c}
            index={i}
            selected={hud.selection.includes(c.id)}
            onSelect={onSelect}
          />
        ))}
      </div>
      <StructuresStatus team={session.team} />
    </div>
  );
}

/** Right column: the opposing composition (empty until enemy champions exist) and their base. */
export function EnemyPanel() {
  const { session } = useGameContext();
  const hud = useHud((h) => ({ enemies: h.enemies }));
  const enemyTeam = enemyOf(session.team);

  return (
    <div className={`${styles.sidePanel} ${styles.enemySide}`}>
      <header className={styles.sideHeader}>
        <h2>Équipe adverse</h2>
      </header>
      <div className={styles.cards}>
        {hud.enemies.length > 0
          ? hud.enemies.map((c, i) => (
              <ChampionCard key={c.id} champion={c} index={i} selected={false} enemy />
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
