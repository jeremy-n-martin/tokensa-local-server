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
    "Tâche: rédige un rapport clinique en français sous forme de texte continu.",
    "Contraintes de sortie:",
    "- Réponds uniquement par le rapport.",
    "- Aucun titre, aucune section, aucune liste, aucune mise en forme Markdown.",
    "- Pas d’introduction type « Rapport », « Contexte », « Synthèse », ni de signature.",
    "- N’inclus pas ces consignes ni les données brutes dans la réponse.",
    "- Ton professionnel et bienveillant.",
    "",
    "Données patient:",
    `Âge: ${age}${niveau ? `, Niveau: ${niveau}` : ""}`,
    "Indices cliniques (étiquettes structurées):",
    toon
  ].join("\n");
}
