import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Meme configuration que GEARBOX : front sur 3000, backend Express sur 3001, et
// tous les appels en RELATIF (`/api/...`) que Vite proxifie. Consequence utile :
// le code du front ne connait aucune URL d'API, donc il fonctionne a l'identique
// en developpement et derriere Caddy en production, ou les deux sont servis sous
// le meme domaine.
export default defineConfig({
  server: {
    port: 3000,
    // Sans `strictPort`, Vite se rabat SILENCIEUSEMENT sur le port suivant quand
    // 3000 est occupe — donc sur 3001, celui de l'API. Le front se sert alors
    // depuis le port qu'il proxifie, et le proxy `/api` boucle sur lui-meme.
    // Constate en vrai. Mieux vaut un refus net qu'un demarrage qui mentira.
    strictPort: true,
    host: '0.0.0.0',
    proxy: {
      '/api': 'http://localhost:3001',
      '/socket.io': { target: 'http://localhost:3001', ws: true },
    },
  },
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
