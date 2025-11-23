type Input = { age: number; tags: string[] };

export function buildPrompt({ age, tags }: Input) {
  const indicesList = tags.map((tag) => `- ${tag}`).join("\n");

  return [
    "Tu es orthophoniste.",
    "Tâche : rédige un rapport d'orthophoniste en français en exactement deux paragraphes séparés par un saut de ligne : un paragraphe sur la lecture, puis un paragraphe sur l'écriture.",
    "Contraintes de sortie :",
    "- Réponds en faisant exactement une phrase par puce de la liste des indices ci-dessous (1 indice = 1 phrase).",
    "- Si la liste contient 6 indices, tu dois écrire exactement 6 phrases.",
    "- Ne fusionne jamais plusieurs indices dans une même phrase.",
    "- Répartis les phrases issues des indices liés à la lecture dans le premier paragraphe et celles liées à l'écriture dans le second paragraphe.",
    "- Commence le paragraphe lecture par une tournure du type « Lors des épreuves de lecture, ... » (ou formulation strictement équivalente).",
    "- Commence le paragraphe écriture par une tournure du type « En production écrite, les analyses révèlent ... » (ou formulation strictement équivalente).",
    "- Commence chaque paragraphe par une première phrase qui contient une seule fois l'expression « le patient », puis évite de réutiliser « le patient » dans le reste du paragraphe.",
    "- À l'intérieur de chaque paragraphe, n'insère aucun saut de ligne : toutes les phrases du paragraphe doivent se suivre dans un seul bloc de texte.",
    "- Insère une seule ligne vide entre le paragraphe lecture et le paragraphe écriture.",
    "- Aucun titre, aucune section, aucune liste à puces dans la réponse, aucune mise en forme Markdown (gras/italique).",
    "- Pas d'introduction type « Rapport », « Contexte », ni de signature.",
    "- Ton professionnel, clinique et bienveillant.",
    "",
    "Consignes de rédaction (Style) :",
    "- Utilise « le patient » uniquement dans la première phrase de chaque paragraphe, puis varie ensuite les formulations (pronoms, tournures impersonnelles, reformulations).",
    "- Transforme chaque tag en une phrase complète, descriptive et clinique décrivant l'action, la stratégie ou la difficulté concrète du patient.",
    "- Utilise un style proche d'un compte-rendu : phrases longues mais claires, avec des connecteurs logiques (« de plus », « en outre », « ainsi que », « également », « par ailleurs », « on observe également », « suggérant », « témoignant de », etc.).",
    "- Varie les verbes : « présente », « on observe », « on note », « révèle », « témoignant de », « suggérant », etc.",
    "",
    "Données patient :",
    `Âge : ${age}`,
    "",
    "Liste des indices cliniques (1 indice = 1 phrase) :",
    indicesList,
    "",
    "Rappel : rédige exactement une phrase par indice, en les organisant en deux paragraphes continus : lecture d'abord, puis écriture."
  ].join("\n");
}
