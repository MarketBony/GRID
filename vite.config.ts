import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// IL N'Y A PLUS DE PROXY, parce qu'il n'y a plus rien a proxifier. Cette
// configuration portait `/api` et `/socket.io` vers un Express sur 3001 : les
// deux ont disparu avec lui. Le navigateur attaque Supabase en direct, par une
// URL absolue lue dans `VITE_SUPABASE_URL`.
//
// CONSEQUENCE A CONNAITRE : le developpement n'est plus isole de la production.
// Sans `.env` a la racine, `npm run dev` affiche l'ecran « Configuration
// incomplete » ; avec le `.env.production` versionne, il tape la VRAIE base
// Supabase. Il n'y a pas de base de developpement derriere le front — c'est
// `DATABASE_URL` (backend/.env) qui vise le PostgreSQL local, et il ne sert
// qu'aux migrations et aux suites.
export default defineConfig({
  server: {
    port: 3000,
    // Sans `strictPort`, Vite se rabat SILENCIEUSEMENT sur le port suivant quand
    // 3000 est occupe : on croit recharger l'application qu'on vient de modifier
    // alors qu'on regarde l'instance restee ouverte sur l'autre port. Mieux vaut
    // un refus net qu'un demarrage qui mentira.
    strictPort: true,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
