type Input = { age: number; niveau?: string; tags: string[] };

export function buildPrompt({ age, niveau, tags }: Input) {
  const tagsTxt = tags.map((t) => `- ${t}`).join("\n");

  return [
    `Profil patient : ${age} ans${niveau ? `, niveau ${niveau}` : ""}.`,
    `Troubles ou axes ciblés :\n${tagsTxt}`,
    "Produit : un court texte orthophonique comprenant :",
    "- Un résumé du profil et des besoins",
    "- 3 à 5 propositions d’activités ou objectifs de séance",
    "- Un ton professionnel et bienveillant",
    "Longueur maximale : 200 tokens."
  ].join("\n");
}
