import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/endpoints';
import { ApiError } from '../api/http';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import { useAuthStore } from '../store/authStore';
import styles from './AuthPage.module.css';

type Mode = 'login' | 'register';
type FieldErrors = Record<string, string | undefined>;

export function AuthPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [form, setForm] = useState({ login: '', username: '', email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();

  const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const switchMode = (next: Mode) => {
    setMode(next);
    setErrors({});
    setMessage(null);
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    setMessage(null);
    try {
      const result =
        mode === 'login'
          ? await authApi.login({ login: form.login, password: form.password })
          : await authApi.register({ username: form.username, email: form.email, password: form.password });
      setSession(result.token, result.user);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setMessage(err.message);
        setErrors(Object.fromEntries(Object.entries(err.details ?? {}).map(([k, v]) => [k, v?.[0]])));
      } else {
        setMessage('Erreur inattendue');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.logo}>
          Macro<span>God</span>
        </h1>
        <p className={styles.tagline}>Dirige les 5 champions. Gagne par la macro.</p>

        <div className={styles.tabs} role="tablist">
          <button role="tab" aria-selected={mode === 'login'} onClick={() => switchMode('login')}>
            Connexion
          </button>
          <button role="tab" aria-selected={mode === 'register'} onClick={() => switchMode('register')}>
            Créer un compte
          </button>
        </div>

        <form className={styles.form} onSubmit={onSubmit} noValidate>
          {mode === 'login' ? (
            <TextField label="Pseudo ou email" name="login" autoComplete="username" value={form.login} onChange={update('login')} error={errors.login} autoFocus />
          ) : (
            <>
              <TextField label="Pseudo" name="username" autoComplete="username" value={form.username} onChange={update('username')} error={errors.username} autoFocus />
              <TextField label="Email" name="email" type="email" autoComplete="email" value={form.email} onChange={update('email')} error={errors.email} />
            </>
          )}
          <TextField
            label="Mot de passe"
            name="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={form.password}
            onChange={update('password')}
            error={errors.password}
          />
          {message && <p className={styles.message}>{message}</p>}
          <Button type="submit" size="lg" loading={loading}>
            {mode === 'login' ? 'Se connecter' : "S'inscrire"}
          </Button>
        </form>
      </div>
    </div>
  );
}
