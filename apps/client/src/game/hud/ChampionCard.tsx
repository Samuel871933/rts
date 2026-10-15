import { ITEMS_BY_ID, MAX_ITEM_SLOTS, itemIconUrl } from '@macrogod/shared';
import { Coins, Eye, SlidersHorizontal } from 'lucide-react';
import { memo } from 'react';
import { ChampionIcon } from '../../components/ui/ChampionIcon';
import { ACTIVITY_LABELS, ROLE_LABELS } from '../../i18n/labels';
import type { HudChampion } from '../core/hudSnapshot';
import { orderLabel } from './orderLabel';
import styles from './hud.module.css';

interface ChampionCardProps {
  champion: HudChampion;
  index: number;
  selected: boolean;
  /** Ally cards select their champion; opponent cards are read-only. */
  onSelect?: (id: number, additive: boolean) => void;
  /** Opponent card: scoreboard info only (no gold, orders or HP while out of sight). */
  enemy?: boolean;
}

function ChampionCardView({ champion: c, index, selected, onSelect, enemy }: ChampionCardProps) {
  const hpRatio = c.maxHp > 0 ? c.hp / c.maxHp : 0;
  const canBuy = !enemy && c.nextItem !== null && c.gold >= c.nextItem.cost;
  const slots = Array.from({ length: MAX_ITEM_SLOTS }, (_, i) => c.items[i] ?? null);

  return (
    <div
      className={`${styles.card} ${enemy ? styles.cardEnemy : ''} ${selected ? styles.cardSelected : ''} ${!c.alive ? styles.cardDead : ''}`}
      {...(onSelect && { onClick: (e: React.MouseEvent) => onSelect(c.id, e.shiftKey), role: 'button', tabIndex: -1 })}
    >
      <div className={styles.cardPortrait}>
        <ChampionIcon championId={c.defId} size={48} dimmed={!c.alive} />
        <span className={styles.level}>{c.level}</span>
        {!enemy && <span className={styles.hotkey}>{index + 1}</span>}
        {!c.alive && <span className={styles.respawn}>{Math.ceil(c.respawnIn)}</span>}
      </div>

      <div className={styles.cardBody}>
        <div className={styles.cardHeader}>
          <span className={styles.cardName}>{c.name}</span>
          <span className={styles.cardRole}>{ROLE_LABELS[c.role]}</span>
        </div>
        {enemy && !c.visible ? (
          <div className={styles.hiddenInfo}>{c.alive ? 'Hors de vue' : 'Mort'}</div>
        ) : (
          <div className={styles.hpBar} title={`${Math.ceil(c.hp)} / ${Math.round(c.maxHp)} PV`}>
            <i style={{ width: `${hpRatio * 100}%` }} className={hpRatio < 0.3 ? styles.hpLow : ''} />
            <span>
              {Math.ceil(c.hp)} / {Math.round(c.maxHp)}
            </span>
          </div>
        )}
        {!enemy && (
          <>
            <div className={styles.xpBar}>
              <i style={{ width: `${c.xpRatio * 100}%` }} />
            </div>
            {c.recallRatio !== null && (
              <div className={styles.recallBar}>
                <i style={{ width: `${c.recallRatio * 100}%` }} />
              </div>
            )}
            <div className={styles.cardStatus}>
              <span>{ACTIVITY_LABELS[c.activity]}</span>
              {c.resumeIn !== null ? (
                <span className={styles.cardResume} title="Farm auto : repart à son poste sans nouvel ordre">
                  Retour au poste {Math.ceil(c.resumeIn)} s
                </span>
              ) : (
                <span className={styles.cardOrder}>{orderLabel(c.order)}</span>
              )}
            </div>
          </>
        )}
        <div className={styles.cardFooter}>
          {!enemy && (
            <span className={canBuy ? styles.goldReady : styles.gold} title={canBuy ? 'Peut acheter un objet : rappelle-le !' : undefined}>
              <Coins size={12} /> {Math.floor(c.gold)}
            </span>
          )}
          <span title="Kills / morts / sbires">
            {c.kills}/{c.deaths} · {c.cs} cs
          </span>
          {!enemy && (
            <span className={styles.iconStat} title="Balises disponibles">
              <Eye size={12} /> {c.wardCharges}
            </span>
          )}
          {c.buffs.blue && <span className={styles.buffBlue} title="Buff bleu" />}
          {c.buffs.red && <span className={styles.buffRed} title="Buff rouge" />}
          {c.buffs.baron && <span className={styles.buffBaron} title="Main de Nashor" />}
          {!enemy && (!c.autoRetreat || !c.autoReturn || !c.autoFarm || !c.autoTurretSafety) && (
            <span
              title={[!c.autoRetreat && 'Repli auto OFF', !c.autoReturn && 'Retour en lane OFF', !c.autoFarm && 'Farm auto OFF', !c.autoTurretSafety && 'Sécurité tour OFF']
                .filter(Boolean)
                .join(' · ')}
            >
              <SlidersHorizontal size={12} />
            </span>
          )}
        </div>
        <div className={styles.items}>
          {slots.map((id, i) =>
            id ? (
              <img key={i} src={itemIconUrl(ITEMS_BY_ID[id].iconId)} alt={ITEMS_BY_ID[id].name} title={ITEMS_BY_ID[id].name} />
            ) : (
              <span key={i} />
            ),
          )}
        </div>
      </div>
    </div>
  );
}

export const ChampionCard = memo(ChampionCardView);
