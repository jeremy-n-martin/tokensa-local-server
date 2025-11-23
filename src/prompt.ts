type Input = { age: number; tags: string[] };

export function buildPrompt({ age, tags }: Input) {
  const indicesList = tags.map((tag) => `- ${tag}`).join("\n");
  const sujet = age < 18 ? "l'enfant" : "l'adulte";

  return [
    "Tu es orthophoniste.",
    `Tâche : rédige un rapport d'orthophoniste en français en exactement deux paragraphes séparés par un saut de ligne : un paragraphe sur la lecture, puis un paragraphe sur l'écriture, en parlant de ${sujet}.`,
    "Contraintes de sortie :",
    "- Réponds en faisant exactement une phrase par puce de la liste des indices ci-dessous (1 indice = 1 phrase).",
    "- Si la liste contient 6 indices, tu dois écrire exactement 6 phrases.",
    "- Ne fusionne jamais plusieurs indices dans une même phrase.",
    "- Répartis les phrases issues des indices liés à la lecture dans le premier paragraphe et celles liées à l'écriture dans le second paragraphe.",
    "- Commence le paragraphe lecture par une tournure du type « Lors des épreuves de lecture, ... » (ou formulation strictement équivalente).",
    "- Commence le paragraphe écriture par une tournure du type « En production écrite, les analyses révèlent ... » (ou formulation strictement équivalente).",
    "- Aucun titre, aucune section, aucune liste à puces dans la réponse, aucune mise en forme Markdown (gras/italique).",
    "- Pas d'introduction type « Rapport », « Contexte », ni de signature.",
    "- Ton professionnel, clinique et bienveillant.",
    "",
    "Consignes de rédaction (Style) :",
    `- Ne parle jamais de « le patient » : réfère-toi systématiquement à ${sujet}.`,
    `- Transforme chaque tag en une phrase complète, descriptive et clinique décrivant l'action, la stratégie ou la difficulté concrète de ${sujet}.`,
    "- Utilise un style proche d'un compte-rendu : phrases longues mais claires, avec des connecteurs logiques (« ainsi que », « également », « en outre », « suggérant », « témoignant de », etc.).",
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
