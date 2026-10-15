import { createApp } from './app';
import { env } from './config/env';
import { initDatabase } from './models';
import { matchRunner } from './services/matchRunner';

async function main() {
  await initDatabase();
  await matchRunner.start();
  createApp().listen(env.PORT, () => {
    console.log(`API MacroGod prête sur http://localhost:${env.PORT}/api (base ${env.DB_DIALECT})`);
  });
}

main().catch((err) => {
  console.error('Impossible de démarrer le serveur :', err);
  process.exit(1);
});
