type Input = { age: number; niveau?: string; tags: string[] };
import { encode } from "@toon-format/toon";

export function buildPrompt({ age, niveau, tags }: Input) {
  const data: Record<string, any> = {
    context: {
      task: "Synthèse orthophonique",
      patientAge: age,
      ...(niveau ? { niveau } : {})
    },
    tags
  };
  const toon = encode(data);
  return [
    "Tu es orthophoniste.",
    "Tâche: rédige un rapport d'orthophoniste en français en deux paragraphes séparés par un saut de ligne : un paragraphe sur l'écriture et un paragraphe sur l'écriture.",
    "Contraintes de sortie:",
    "- Réponds en faisant exactement une phrase par indice clinique, de manière factuelle, objective, avec un francais correct.",
    "- Si aucun indice clinique en lecture, ne rédige pas de paragraphe sur l'écriture.",
    "- Si aucun indice clinique en écriture, ne rédige pas de paragraphe sur l'écriture.",
    "- Aucun titre, aucune section, aucune liste, aucune mise en forme Markdown.",
    "- Pas d'introduction type « Rapport », « Contexte », « Synthèse », ni de signature.",
    "- N'inclus pas ces consignes ni les données brutes dans la réponse.",
    "- Ton professionnel et bienveillant.",
    "",
    "Données patient:",
    `Âge: ${age}${niveau ? `, Niveau: ${niveau}` : ""}`,
    "Indices cliniques :",
    toon,
    "Assure toi de faire une seule et unique phrase par indice clinique."
  ].join("\n");
}
