type Input = {
  age: number;
  tags: string[];
  prenom?: string;
  nom?: string;
  homme?: boolean;
};

export function buildPrompt({ age, tags, prenom, nom, homme }: Input) {
  const indicesList = tags.map((tag) => `- ${tag}`).join("\n");
  // Préparation d'un nom complet éventuellement utilisable dans le prompt.
  const fullName = [prenom, nom].filter(Boolean).join(" ");
  // Préparation d'une info de genre potentiellement utile plus tard.
  const isHomme = homme === true;

  return [
    "Tu es orthophoniste.",
    "",
    "Tâche : à partir des données patient et de la liste d'indices ci-dessous, produis un OBJET JSON structuré décrivant un rapport d'orthophonie.",
    "",
    "CONTRAINTES GÉNÉRALES :",
    "- Tu DOIS répondre STRICTEMENT en JSON valide (UTF-8), sans aucun texte avant ni après.",
    "- Aucun commentaire, aucune explication hors JSON, aucune mise en forme Markdown.",
    "",
    "SCHÉMA JSON EXACT À RESPECTER :",
    "{",
    '  "lecture": "<paragraphe complet sur la lecture>",',
    '  "ecriture": "<paragraphe complet sur l\'écriture>"',
    "}",
    "",
    "CONTRAINTES SUR LE CONTENU (CHAMP lecture) :",
    '- Le champ "lecture" contient un unique paragraphe (aucun saut de ligne interne).',
    "- La première phrase du paragraphe commence par une tournure du type « Lors des épreuves de lecture, le patient ... » (ou formulation strictement équivalente).",
    "- Ne répète pas ensuite cette tournure exacte dans les phrases suivantes : utilise des formulations variées pour éviter la redondance.",
    "- Les phrases qui décrivent des indices liés à la lecture sont toutes dans ce paragraphe.",
    "",
    "CONTRAINTES SUR LE CONTENU (CHAMP ecriture) :",
    '- Le champ "ecriture" contient un unique paragraphe (aucun saut de ligne interne).',
    "- La première phrase du paragraphe commence par une tournure du type « En production écrite, le patient ... » (ou formulation strictement équivalente).",
    "- Ne répète pas ensuite cette tournure exacte dans les phrases suivantes : utilise des formulations variées pour éviter la redondance.",
    "- Les phrases qui décrivent des indices liés à l'écriture sont toutes dans ce paragraphe.",
    "",
    "CONSIGNES DE RÉDACTION (STYLE) :",
    '- Utilise l’expression « le patient » uniquement dans la première phrase de chaque paragraphe, puis varie ensuite les formulations (pronoms, tournures impersonnelles, reformulations).',
    "- Transforme chaque tag en une phrase complète, descriptive et clinique décrivant l'action, la stratégie ou la difficulté concrète du patient.",
    "- Ne crée pas de nouveaux troubles ou mécanismes cliniques qui ne figurent pas dans la liste des indices : appuie-toi exclusivement sur les difficultés explicitement présentes dans les tags (pas d'hypothèses supplémentaires, pas de notions de « supports visuels » ou d'« images en mots » si elles ne sont pas indiquées).",
    "- Reformule les intitulés bruts des tags en français naturel : ne copie pas mot à mot les libellés, mais rédige des phrases grammaticalement correctes et idiomatiques.",
    "- Utilise un style proche d'un compte-rendu : phrases longues mais claires, avec des connecteurs logiques (« de plus », « en outre », « ainsi que », « également », « par ailleurs », « on observe également », « suggérant », « témoignant de », etc.).",
    "- Varie les verbes : « présente », « on observe », « on note », « révèle », « témoignant de », « suggérant », etc.",
    "- À l'intérieur d'un même paragraphe, chaque phrase doit apporter une information clinique nouvelle : ne reformule pas plusieurs fois la même difficulté avec des tournures très proches.",
    "- Si une difficulté similaire est présente en lecture et en écriture (par exemple homophones, ordre des mots, segmentation), formule-la différemment dans chaque paragraphe (angle clinique, conséquence, contexte) de sorte que les phrases ne soient pas des copies quasi-identiques.",
    "- Évite les répétitions inutiles d'expressions complètes (par exemple ne répète pas plusieurs fois « lors des épreuves de lecture » ou « en production écrite ») : assure une progression discursive fluide.",
    "- Le texte doit être rédigé dans un français correct, sans calques maladroits des intitulés (par exemple « inversions phonologiques » plutôt que « phonologiques inversions », « difficultés au plan graphomoteur » plutôt que « troubles graphomotricités »).",
    "- Ton professionnel, clinique et bienveillant.",
    "- Aucun titre, aucune section, aucune liste à puces, aucune mise en forme Markdown.",
    "- Pas d'introduction type « Rapport », « Contexte », ni de signature.",
    "",
    "VÉRIFICATION FINALE AVANT RÉPONSE :",
    "- Relis mentalement les deux paragraphes et corrige toute faute de grammaire, d'accord ou de syntaxe avant de renvoyer le JSON final.",
    "",
    "CONTRAINTES DE COMPTAGE :",
    "- À partir de la liste des indices ci-dessous, écris exactement une phrase par indice (1 indice = 1 phrase).",
    "- Si la liste contient N indices, la somme des phrases dans lecture + écriture est exactement égale à N.",
    "- Ne fusionne jamais plusieurs indices dans une même phrase.",
    "- N'utilise jamais le même indice pour produire plusieurs phrases différentes : une difficulté clinique donnée doit correspondre à une seule phrase dans l'ensemble du rapport.",
    "",
    "Données patient (contexte) :",
    `Âge : ${age}`,
    "",
    "Liste des indices cliniques (1 indice = 1 phrase) :",
    indicesList
  ].join("\n");
}
