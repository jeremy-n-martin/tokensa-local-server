type Input = { age: number; tags: string[] };

export function buildPrompt({ age, tags }: Input) {
  const indicesList = tags.map((tag) => `- ${tag}`).join("\n");
  
  return [
    "Tu es orthophoniste.",
    "Tâche: rédige un rapport d'orthophoniste en français en deux paragraphes séparés par un saut de ligne : un paragraphe sur la lecture et un paragraphe sur l'écriture.",
    "Contraintes de sortie:",
    "- Réponds en faisant exactement une phrase par puce de la liste des indices ci-dessous.",
    "- Si la liste contient 6 indices, tu dois écrire exactement 6 phrases.",
    "- Ne fusionne jamais plusieurs indices dans une même phrase.",
    "- Classe chaque phrase dans le bon paragraphe (lecture vs écriture) selon le sens de l'indice.",
    "- Si aucun indice ne concerne la lecture, ne fais pas de paragraphe lecture.",
    "- Si aucun indice ne concerne l'écriture, ne fais pas de paragraphe écriture.",
    "- Aucun titre, aucune section, aucune liste à puces dans la réponse, aucune mise en forme Markdown (gras/italique).",
    "- Pas d'introduction type « Rapport », « Contexte », ni de signature.",
    "- Ton professionnel et bienveillant.",
    "",
    "Consignes de rédaction (Style) :",
    "- Évite la répétition robotique de « Le patient présente... ».",
    "- Transforme le tag en une phrase décrivant l'action ou la difficulté concrète du patient.",
    "- Utilise des verbes variés : « commet », « confond », « omet », « a du mal à », « on observe », etc.",
    "- Exemple mauvais qui ne veut rien dire : « Le patient présente des additions. »",
    "- Exemple bon : « Le patient a tendance à ajouter des phonèmes lors du décodage. » ou « On note des ajouts de sons en lecture. »",
    "",
    "Données patient:",
    `Âge: ${age}`,
    "",
    "Liste des indices cliniques (1 indice = 1 phrase) :",
    indicesList,
    "",
    "Rappel: Une phrase unique pour chaque indice de la liste ci-dessus. Sépare bien les paragraphes lecture/écriture par un saut de ligne."
  ].join("\n");
}
