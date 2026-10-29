import { useEffect, useMemo, useRef, useState } from 'react';
import { duPhoning, mobilisation } from '../../backend/src/utils/agregats';
import { classementPhoning, estVenu, etapeAccueil, fenetrePhoning, projection } from '../../backend/src/utils/vp';
import { Segmente } from '../../components/Segmente';
import { isoLocal, type PropsEcranVp } from './commun';

// ============================================================================
// LE MODE PROJECTION — pour les sites equipes d'un ecran. Lecture seule : on
// l'ouvre en plein ecran et on n'y touche plus. Chaque NOUVELLE commande
// (constatee au rafraichissement) s'annonce ; les commandes deja la au premier
// affichage ne s'annoncent pas.
// ============================================================================

export function Projection({ donnees, maintenant }: PropsEcranVp) {
  const { vp, rdvs, vendeurs, creneaux } = donnees;
  const [mode, setMode] = useState<'phoning' | 'jour'>(() => (isoLocal(maintenant) >= vp.jour ? 'jour' : 'phoning'));
  const cadre = useRef<HTMLDivElement | null>(null);

  const commandes = useMemo(() => rdvs.filter((r) => r.issue === 'commande'), [rdvs]);
  const vues = useRef<Set<string> | null>(null);
  const [annonce, setAnnonce] = useState<{ cle: number; vendeur: string; vehicule: string } | null>(null);
  useEffect(() => {
    const ids = new Set(commandes.map((c) => c.id));
    if (vues.current) {
      const nouvelle = commandes.find((c) => !vues.current!.has(c.id));
      if (nouvelle) {
        const v = vendeurs.find((x) => x.id === nouvelle.vendeurId);
        setAnnonce({ cle: Date.now(), vendeur: v?.nom ?? '', vehicule: `${nouvelle.marque ?? ''} ${nouvelle.typeVehicule}`.trim() });
      }
    }
    vues.current = ids;
  }, [commandes, vendeurs]);
  useEffect(() => {
    if (!annonce) return;
    const t = window.setTimeout(() => setAnnonce(null), 2700);
    return () => window.clearTimeout(t);
  }, [annonce]);

  const effectif = mobilisation(rdvs, vendeurs);
  const nom = (id: string) => vendeurs.find((v) => v.id === id)?.nom ?? '';

  let corps: React.ReactNode;
  if (mode === 'phoning') {
    const f = fenetrePhoning(vp.phoningDu, vp.phoningAu, creneaux);
    const p = f ? projection(rdvs, f, maintenant) : null;
    const classement = classementPhoning(rdvs, vendeurs);
    const objectif = classement.reduce((s, l) => s + (l.objectif ?? 0), 0);
    corps = (
      <>
        <div className="gros">
          <div className="accent"><b>{duPhoning(rdvs).length}</b><span>RDV pris</span></div>
          <div><b>{p ? p.projete : '—'}</b><span>attendus en fin de J2</span></div>
          <div><b>{objectif || '—'}</b><span>objectif</span></div>
        </div>
        <div className="podium">
          {classement.slice(0, 5).map((l) => (
            <div key={l.vendeurId}><span>{l.rang}</span><span>{l.nom}</span><span className="num">{l.rdv}</span></div>
          ))}
        </div>
      </>
    );
  } else {
    const parVendeur = [...effectif]
      .map((id) => ({ id, n: commandes.filter((r) => r.vendeurId === id).length }))
      .sort((a, b) => b.n - a.n || nom(a.id).localeCompare(nom(b.id)))
      .slice(0, 5);
    const derniere = [...commandes].sort((a, b) => (a.sortiLe ?? '').localeCompare(b.sortiLe ?? '')).pop();
    corps = (
      <>
        <div className="gros">
          <div className="accent"><b>{commandes.length}</b><span>commandes</span></div>
          {/* Les RDV du phoning venus, SUR les RDV du phoning : les visiteurs a
              part. Il affichait 16 / 15 a Massagettes (14 venus + 2 visiteurs),
              le defaut deja corrige sur la tablette le 20/10. */}
          <div>
            <b>{duPhoning(rdvs).filter(estVenu).length}<span style={{ fontSize: '.4em', opacity: 0.6 }}> / {duPhoning(rdvs).length}</span></b>
            <span>
              clients venus
              {rdvs.length > duPhoning(rdvs).length && ` · + ${rdvs.length - duPhoning(rdvs).length} visiteur${rdvs.length - duPhoning(rdvs).length > 1 ? 's' : ''}`}
            </span>
          </div>
          <div><b>{rdvs.filter((r) => etapeAccueil(r) === 'avec_vendeur').length}</b><span>avec un vendeur, maintenant</span></div>
        </div>
        <div className="podium">
          {parVendeur.map((l, i) => (
            <div key={l.id}><span>{i + 1}</span><span>{nom(l.id)}</span><span className="num">{l.n}</span></div>
          ))}
        </div>
        {derniere && (
          <div className="fil">Dernière commande : {nom(derniere.vendeurId)} · {derniere.marque ?? ''} {derniere.typeVehicule}</div>
        )}
      </>
    );
  }

  return (
    <div className="page vp-page">
      <section className="vp-ecran actif">
        <div className="app-head">
          <h2>Projection</h2>
          <div className="droite">
            <Segmente
              options={[{ valeur: 'phoning', libelle: 'Phoning' }, { valeur: 'jour', libelle: 'Jour J' }]}
              valeur={mode}
              onChange={setMode}
              etiquette="Ce que montre l’écran"
            />
            <button type="button" className="btn" onClick={() => void cadre.current?.requestFullscreen?.()}>
              Plein écran
            </button>
          </div>
        </div>
        <div className="vp-projection verre" ref={cadre}>
          {corps}
          {annonce && mode === 'jour' && (
            <div className="flash" key={annonce.cle}>
              <div>
                Commande !<small>{annonce.vendeur} · {annonce.vehicule}</small>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
