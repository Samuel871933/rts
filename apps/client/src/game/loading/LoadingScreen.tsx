import { CHAMPIONS_BY_ID, championLoadingUrl, type ChampionPick, type Team } from '@macrogod/shared';
import { useMemo, useState } from 'react';
import { ROLE_LABELS } from '../../i18n/labels';
import { ControlsPanel, SettingsPanel } from './LoadingSidebars';
import styles from './LoadingScreen.module.css';

const TIPS = [
  'Un dragon pris, c’est un bonus pour toute la partie : prépare la vision de la rivière une minute avant.',
  'Envoie tes champions en groupe : un champion seul dans la jungle adverse est une proie.',
  'Rappelle tes champions quand ils ont de l’or : un objet d’avance vaut mieux qu’une vague de plus.',
  'Les sbires ne quittent jamais leur voie : recule dans la jungle pour les semer.',
  'Un monstre ne sort pas de son camp : s’il te poursuit trop loin, il repart soigné.',
  'Le Nashor ne bouge pas de sa fosse : approche-toi par la rivière, c’est le seul accès.',
  'Une balise bien placée révèle les rotations adverses avant qu’elles n’arrivent.',
  'Garder son sang-froid sous la pression, ça s’entraîne. Respire un coup si besoin.',
];

interface LoadingCardProps {
  pick: ChampionPick;
  team: Team;
  controller: string;
}

function LoadingCard({ pick, team, controller }: LoadingCardProps) {
  const def = CHAMPIONS_BY_ID[pick.championId];
  const [artFailed, setArtFailed] = useState(false);
  return (
    <article className={`${styles.card} ${team === 'blue' ? styles.blue : styles.red}`}>
      {!artFailed ? (
        <img
          className={styles.art}
          src={championLoadingUrl(def.iconKey)}
          alt={def.name}
          onError={() => setArtFailed(true)}
        />
      ) : (
        <div className={styles.artFallback}>{def.name.slice(0, 2)}</div>
      )}
      <div className={styles.info}>
        <span className={styles.champion}>{def.name}</span>
        <span className={styles.role}>{ROLE_LABELS[pick.role]}</span>
        <span className={styles.controller}>{controller}</span>
      </div>
    </article>
  );
}

interface LoadingScreenProps {
  allies: ChampionPick[];
  enemies: ChampionPick[];
  playerName: string;
  /** 0-1, for the whole game (shown in the bar at the bottom). */
  progress: number;
  status: string;
}

/** LoL-style loading screen: both teams' splash cards, a tip between them, the loading bar below. */
export function LoadingScreen({ allies, enemies, playerName, progress, status }: LoadingScreenProps) {
  const tip = useMemo(() => TIPS[Math.floor(Math.random() * TIPS.length)], []);
  return (
    <div className={styles.screen}>
      <ControlsPanel />
      <SettingsPanel />
      <div className={styles.row}>
        {allies.map((pick) => (
          <LoadingCard key={pick.championId} pick={pick} team="blue" controller={playerName} />
        ))}
      </div>
      <p className={`${styles.middle} ${styles.tip}`}>{tip}</p>
      <div className={styles.row}>
        {enemies.map((pick) => (
          <LoadingCard key={pick.championId} pick={pick} team="red" controller="IA" />
        ))}
      </div>
      <footer className={styles.footer}>
        <p className={styles.status}>
          <span>{status}</span>
          <span>{Math.floor(progress * 100)} %</span>
        </p>
        <div className={styles.bar}>
          <i style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      </footer>
    </div>
  );
}
