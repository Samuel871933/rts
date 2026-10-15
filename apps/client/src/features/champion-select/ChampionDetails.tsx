import type { ChampionDef } from '@macrogod/shared';
import { ARCHETYPE_LABELS, ROLE_LABELS } from '../../i18n/labels';
import styles from './ChampionSelect.module.css';

const STAT_BARS: { label: string; value: (c: ChampionDef) => number; max: number }[] = [
  { label: 'PV', value: (c) => c.stats.hp + c.stats.hpPerLevel * 17, max: 2700 },
  { label: 'Attaque', value: (c) => c.stats.ad + c.stats.adPerLevel * 17, max: 160 },
  { label: 'Armure', value: (c) => c.stats.armor + c.stats.armorPerLevel * 17, max: 140 },
  { label: 'Portée', value: (c) => c.stats.range, max: 650 },
  { label: 'Vitesse', value: (c) => c.stats.moveSpeed, max: 350 },
];

export function ChampionDetails({ champion }: { champion: ChampionDef | null }) {
  if (!champion) {
    return (
      <aside className={styles.details}>
        <p className={styles.hint}>Survole un champion pour voir ses caractéristiques.</p>
      </aside>
    );
  }
  return (
    <aside className={styles.details}>
      <h3>{champion.name}</h3>
      <p className={styles.title}>{champion.title}</p>
      <p className={styles.chips}>
        <span>{ARCHETYPE_LABELS[champion.archetype]}</span>
        {champion.roles.map((r) => (
          <span key={r}>{ROLE_LABELS[r]}</span>
        ))}
      </p>
      <div className={styles.bars}>
        {STAT_BARS.map((s) => (
          <div key={s.label} className={styles.bar}>
            <span>{s.label}</span>
            <div>
              <i style={{ width: `${Math.min(100, (s.value(champion) / s.max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className={styles.ability}>
        <strong>{champion.ability.name}</strong>
        <span>{champion.ability.description}</span>
        <small>Recharge {champion.ability.cooldown}s · lancée automatiquement</small>
      </div>
    </aside>
  );
}
