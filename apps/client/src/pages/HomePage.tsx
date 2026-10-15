import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { MatchHistory } from '../features/matches/MatchHistory';
import { useAuthStore } from '../store/authStore';
import styles from './HomePage.module.css';

export function HomePage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <h1>Bienvenue{user ? `, ${user.username}` : ''}</h1>
          <p>
            Compose une équipe de 5 champions face à 5 adversaires tirés au sort, donne-leur des ordres et
            prends les bonnes décisions macro : vagues, jungle, objectifs, vision. La faille tourne en temps
            réel, accélérée x3.
          </p>
        </div>
        <Button size="lg" onClick={() => navigate('/play')}>
          Jouer
        </Button>
      </section>

      <section>
        <h2 className={styles.sectionTitle}>Dernières parties</h2>
        <MatchHistory />
      </section>
    </div>
  );
}
