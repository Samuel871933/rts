import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { authApi } from './api/endpoints';
import { AppLayout } from './components/layout/AppLayout';
import { AuthPage } from './pages/AuthPage';
import { ChampionSelectPage } from './pages/ChampionSelectPage';
import { HomePage } from './pages/HomePage';
import { GuestOnly, RequireAuth } from './routes/guards';
import { useAuthStore } from './store/authStore';

// The game screen pulls in Pixi: load it only when a match starts.
const GamePage = lazy(() => import('./pages/GamePage').then((m) => ({ default: m.GamePage })));

export function App() {
  const token = useAuthStore((s) => s.token);
  const setUser = useAuthStore((s) => s.setUser);

  // Refresh the profile behind a persisted token (an expired token logs out via the http layer).
  useEffect(() => {
    if (token) authApi.me().then(setUser).catch(() => undefined);
  }, [token, setUser]);

  return (
    <Routes>
      <Route path="/auth" element={<GuestOnly><AuthPage /></GuestOnly>} />
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<HomePage />} />
        <Route path="play" element={<ChampionSelectPage />} />
      </Route>
      <Route
        path="/game/:matchId"
        element={
          <RequireAuth>
            <Suspense fallback={null}>
              <GamePage />
            </Suspense>
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
