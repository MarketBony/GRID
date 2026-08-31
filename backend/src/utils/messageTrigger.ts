// ============================================================================
// EXTRACTION DU MESSAGE D'UN TRIGGER POSTGRESQL.
//
// SOURCE DE VERITE UNIQUE de ce decoupage. Il existait en deux endroits — le
// gestionnaire d'erreurs global et la route des tables — et les deux ne
// decoupaient PAS pareil : celui des tables coupait au premier saut de ligne, or
// tout tient sur une seule ligne, et le chef de table lisait
// `severity: "ERREUR", detail: None` a la fin de son message. Exactement la
// classe de defaut deja corrigee une fois dans le gestionnaire global, reintroduite
// en la recopiant. Interdit n.6.
//
// CE QUE PRISMA RENVOIE. Nos triggers levent `raise exception 'RELANCE: ...'`.
// Prisma enveloppe le message du pilote dans sa propre representation :
//
//   ... message: "RELANCE: X n'est pas autorise a vendre Renault.", severity:
//   "ERREUR", detail: None, column: None, hint: None }), transient: false })
//
// ON NE COUPE PAS AU PREMIER GUILLEMET : plusieurs de nos messages en contiennent
// (`la table "Table 1"`). On coupe aux marqueurs de fin de champ du pilote.
// ============================================================================

/// Marqueur de debut. Tout message metier de trigger le porte : c'est ce qui
/// distingue un refus a montrer a l'utilisateur d'une vraie panne technique.
const PREFIXE = 'RELANCE:';

/// Marqueurs de fin, dans l'ordre ou on les cherche.
const FINS = ['", severity:', '\n', '", detail:'] as const;

/// Rend le message metier porte par une exception de trigger, ou `null` si
/// l'erreur n'en est pas une. `null` veut dire << ce n'est pas un refus metier,
/// ne le deguise pas en conflit >>.
export function messageTrigger(e: unknown): string | null {
  const brut = e instanceof Error ? e.message : String(e);
  const debut = brut.indexOf(PREFIXE);
  if (debut < 0) return null;

  let texte = brut.slice(debut + PREFIXE.length);
  for (const fin of FINS) {
    const i = texte.indexOf(fin);
    if (i >= 0) texte = texte.slice(0, i);
  }

  // Prisma echappe les guillemets du message du pilote. Plusieurs de nos triggers
  // citent un libelle entre guillemets (`la table "Table 1"`), et le chef de table
  // lisait `la table \"Table 1\"`. On les remet a l'endroit ici, une fois pour
  // toutes, plutot que de reecrire le texte de chaque trigger.
  return texte.replace(/\\"/g, '"').trim();
}
