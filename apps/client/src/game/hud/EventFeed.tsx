import { formatClock } from '../../i18n/labels';
import { useHud } from '../core/GameSessionContext';
import styles from './hud.module.css';

export function EventFeed() {
  const { feed } = useHud();
  if (feed.length === 0) return null;
  return (
    <ul className={styles.feed}>
      {feed.map((entry) => (
        <li key={entry.id} className={styles[`tone_${entry.tone}`]}>
          <time>{formatClock(entry.time)}</time>
          {entry.text}
        </li>
      ))}
    </ul>
  );
}
