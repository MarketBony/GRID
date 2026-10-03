import { useEffect, useRef } from 'react';

// ============================================================================
// LE FOND DE LA CONNEXION — la grille de depart, en mouvement.
//
// GRID, c'est la grille de depart (voir `public/grid.svg`) : un sol en
// perspective qui file vers l'horizon, des trainees de lumiere qui en
// jaillissent — les memes trainees de vitesse que le logotype. Couleurs de la
// charte : orange #f75632 vers violet #8f12ab, sur le bleu nuit.
//
// Un <canvas> et non du CSS : 60 trainees et une grille projetee, c'est un seul
// dessin par image, la ou autant d'elements DOM animes chargeraient le
// compositeur. Il s'arrete quand l'onglet est masque, et se FIGE (une image,
// aucune boucle) si l'utilisateur a demande moins d'animations.
// ============================================================================

const ORANGE = [247, 86, 50] as const;
const VIOLET = [143, 18, 171] as const;
const melange = (t: number, a = 1) => {
  const c = ORANGE.map((o, i) => Math.round(o + (VIOLET[i] - o) * t));
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
};

interface Trainee {
  x: number;
  y: number;
  z: number;
  teinte: number;
  vitesse: number;
}

export function FondGrille() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const fige =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.classList.contains('animations-reduites');

    let l = 0;
    let h = 0;
    let dpr = 1;
    const dimensionner = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      l = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(l * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    dimensionner();

    // Parallaxe : le point de fuite suit (un peu) le pointeur, amorti.
    const cible = { x: 0, y: 0 };
    const point = { x: 0, y: 0 };
    const bouger = (e: PointerEvent) => {
      if (!l || !h) return;
      cible.x = (e.clientX / l - 0.5) * 2;
      cible.y = (e.clientY / h - 0.5) * 2;
    };

    const nouvelle = (loin = true): Trainee => ({
      x: (Math.random() - 0.5) * 2.4,
      y: (Math.random() - 0.5) * 1.1 - 0.15,
      z: loin ? 1 : Math.random(),
      teinte: Math.random(),
      vitesse: 0.25 + Math.random() * 0.55,
    });
    const trainees: Trainee[] = Array.from({ length: 70 }, () => nouvelle(false));

    let t0 = performance.now();
    let image = 0;
    let derive = 0;

    const dessiner = (maintenant: number) => {
      // Onglet en arriere-plan ou fenetre reduite : rien a dessiner, et une
      // division par une largeur nulle empoisonnerait la parallaxe de NaN.
      if (!l || !h) {
        if (!fige) image = requestAnimationFrame(dessiner);
        return;
      }
      const dt = Math.max(0, Math.min(0.05, (maintenant - t0) / 1000));
      t0 = maintenant;
      derive = (derive + dt * 0.55) % 1;
      point.x += (cible.x - point.x) * 0.04;
      point.y += (cible.y - point.y) * 0.04;

      const fx = l / 2 - point.x * l * 0.04;
      const horizon = h * 0.46 - point.y * h * 0.03;
      ctx.clearRect(0, 0, l, h);

      // --- le halo d'horizon : un soleil couchant a la charte
      const halo = ctx.createRadialGradient(fx, horizon, 0, fx, horizon, Math.max(l, h) * 0.55);
      halo.addColorStop(0, 'rgba(247,86,50,0.34)');
      halo.addColorStop(0.35, 'rgba(143,18,171,0.16)');
      halo.addColorStop(1, 'rgba(41,63,116,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, l, h);

      // --- le sol : lignes de fuite + traverses qui avancent
      const bas = h - horizon;
      ctx.lineWidth = 1;
      const nbFuite = 26;
      for (let i = -nbFuite; i <= nbFuite; i++) {
        const xb = fx + (i / nbFuite) * l * 2.2;
        const g = ctx.createLinearGradient(fx, horizon, xb, h);
        const teinte = (i + nbFuite) / (2 * nbFuite);
        g.addColorStop(0, melange(teinte, 0));
        g.addColorStop(1, melange(teinte, 0.38));
        ctx.strokeStyle = g;
        ctx.beginPath();
        ctx.moveTo(fx, horizon);
        ctx.lineTo(xb, h);
        ctx.stroke();
      }
      const nbTraverses = 16;
      for (let j = 0; j < nbTraverses; j++) {
        const z = (j + derive) / nbTraverses;
        const y = horizon + bas * Math.pow(z, 2.4);
        const a = Math.pow(z, 1.4) * 0.5;
        const g = ctx.createLinearGradient(0, y, l, y);
        g.addColorStop(0, melange(0, 0));
        g.addColorStop(0.3, melange(0.15, a));
        g.addColorStop(0.7, melange(0.85, a));
        g.addColorStop(1, melange(1, 0));
        ctx.strokeStyle = g;
        ctx.lineWidth = 0.6 + z * 1.4;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(l, y);
        ctx.stroke();
      }

      // --- la ligne d'horizon elle-meme, lumineuse
      const ligne = ctx.createLinearGradient(0, horizon, l, horizon);
      ligne.addColorStop(0, 'rgba(247,86,50,0)');
      ligne.addColorStop(0.5, 'rgba(255,190,150,0.85)');
      ligne.addColorStop(1, 'rgba(143,18,171,0)');
      ctx.strokeStyle = ligne;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      ctx.lineTo(l, horizon);
      ctx.stroke();

      // --- les trainees : elles jaillissent du point de fuite vers le spectateur
      ctx.lineCap = 'round';
      for (const p of trainees) {
        const zAvant = p.z;
        p.z -= dt * p.vitesse * 0.6;
        if (p.z <= 0.04) {
          Object.assign(p, nouvelle());
          continue;
        }
        const proj = (z: number) => ({ x: fx + (p.x / z) * l * 0.18, y: horizon + (p.y / z) * h * 0.18 });
        const a = proj(Math.min(1, zAvant + 0.09));
        const b = proj(p.z);
        if (b.x < -50 || b.x > l + 50 || b.y < -50 || b.y > h + 50) {
          Object.assign(p, nouvelle());
          continue;
        }
        const force = Math.min(1, (1 - p.z) * 1.3);
        const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        g.addColorStop(0, melange(p.teinte, 0));
        g.addColorStop(1, melange(p.teinte, 0.9 * force));
        ctx.strokeStyle = g;
        ctx.lineWidth = 0.5 + force * 2.2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      if (!fige) image = requestAnimationFrame(dessiner);
    };

    image = requestAnimationFrame(dessiner);
    const visibilite = () => {
      cancelAnimationFrame(image);
      if (document.visibilityState === 'visible' && !fige) {
        t0 = performance.now();
        image = requestAnimationFrame(dessiner);
      }
    };
    const redimensionner = () => {
      dimensionner();
      if (fige) requestAnimationFrame(dessiner);
    };
    window.addEventListener('resize', redimensionner);
    window.addEventListener('pointermove', bouger);
    document.addEventListener('visibilitychange', visibilite);
    return () => {
      cancelAnimationFrame(image);
      window.removeEventListener('resize', redimensionner);
      window.removeEventListener('pointermove', bouger);
      document.removeEventListener('visibilitychange', visibilite);
    };
  }, []);

  return <canvas ref={ref} className="fond-grille" aria-hidden="true" />;
}
