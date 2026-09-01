import { useCallback, useEffect, useMemo, useState } from 'react';
import { chargerReferentiels, type Referentiels, type VendeurReferentiel } from '../services/referentiels';
import type { Marque, Plaque, Site } from '../types';
// `localeCompare('fr')` classe selon la version d'ICU du navigateur : deux
// postes pouvaient donc afficher la meme liste dans deux ordres. Source unique
// du tri : `backend/src/utils/tri.ts`.
import { comparerLibelle } from '../backend/src/utils/tri';

/// Charge les referentiels une fois et fournit les index dont les ecrans ont
/// besoin. Aucun ecran ne reconstruit ces index de son cote : c'est la meme
/// logique que la source de verite unique cote serveur, appliquee au front.
export function useReferentiels() {
  const [donnees, setDonnees] = useState<Referentiels | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);

  const recharger = useCallback(async () => {
    setErreur(null);
    try {
      setDonnees(await chargerReferentiels());
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Chargement impossible.');
    }
  }, []);

  useEffect(() => {
    recharger().finally(() => setChargement(false));
  }, [recharger]);

  const index = useMemo(() => {
    if (!donnees) return null;
    return {
      plaqueParId: new Map<string, Plaque>(donnees.plaques.map((p) => [p.id, p])),
      siteParId: new Map<string, Site>(donnees.sites.map((s) => [s.id, s])),
      marqueParId: new Map<string, Marque>(donnees.marques.map((m) => [m.id, m])),
      /// Vendeurs groupes par site, dans l'ordre des plaques puis des sites :
      /// c'est l'ordre dans lequel un chef de plaque relit ses concessions.
      vendeursParSite: donnees.sites
        .slice()
        .sort((a, b) => {
          const pa = donnees.plaques.find((p) => p.id === a.plaqueId)?.ordre ?? 0;
          const pb = donnees.plaques.find((p) => p.id === b.plaqueId)?.ordre ?? 0;
          return pa - pb || comparerLibelle(a.libelle, b.libelle);
        })
        .map((site) => ({
          site,
          plaque: donnees.plaques.find((p) => p.id === site.plaqueId) ?? null,
          vendeurs: donnees.vendeurs
            .filter((v) => v.siteId === site.id)
            .sort((a, b) => comparerLibelle(a.nom, b.nom)),
        })),
    };
  }, [donnees]);

  /// Mise a jour locale apres un enregistrement, pour ne pas recharger 99
  /// vendeurs a chaque case cochee.
  const majVendeur = useCallback((vendeurId: string, champs: Partial<VendeurReferentiel>) => {
    setDonnees((d) =>
      d
        ? { ...d, vendeurs: d.vendeurs.map((v) => (v.id === vendeurId ? { ...v, ...champs } : v)) }
        : d
    );
  }, []);

  return { donnees, index, chargement, erreur, recharger, majVendeur };
}
