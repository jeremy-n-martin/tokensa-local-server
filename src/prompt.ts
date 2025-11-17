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
    "Ton rôle en tant qu'orthophoniste est de rédiger un rapport en francais comme ceci :",
    "[EXEMPLE]Lors des épreuves de lecture, l'enfant présente des itérations fréquentes,",
    "traduisant des reprises successives de mots ou de segments, ainsi que des ",
    "additions de lettres ou de syllabes. On observe également une segmentation ",
    "inadéquate, suggérant une difficulté à structurer correctement la chaîne écrite.",
    " La fluence de lecture est ralentie, avec une lenteur excessive qui impacte la ",
    "En production écrite, les analyses révèlent des substitutions phonologiques,",
    "témoignant d'une fragilité persistante dans le traitement phonémique. L'enfant",
    "produit également des erreurs liées aux lettres muettes, ainsi qu'une confusion",
    "dans l'usage des homophones grammaticaux. L'écriture manuscrite ",
    "se caractérise par une irrégularité de la taille et de l'espacement des lettres,",
    "associée à une dysgraphie, affectant la lisibilité et la stabilité du tracé.",
    "fluidité générale et la compréhension implicite.[EXEMPLE FIN]",
    "--------------------------------",
    "Maintenant, voici le profil du patient :",
    toon,
    "--------------------------------",
    "Soit professionnel dans ta réponse et bienveillant."
  ].join("\n");
}
