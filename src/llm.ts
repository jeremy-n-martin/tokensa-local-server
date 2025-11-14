import ollama from "ollama";
import { buildPrompt } from "./prompt.js";

// ------------------------------------------------------------
// Fichier: llm.ts
// Rôle: Encapsuler l'accès au modèle local (Ollama)
//       - pingModel(): vérifier si l'API locale d'Ollama répond
//       - streamGenerate(): générer un texte en flux (streaming)
//       - generateOnce(): générer un texte en une seule fois (JSON)
// Contexte: Ollama expose une API locale (par défaut http://localhost:11434)
//           qui permet d'interagir avec des modèles LLM sur la machine.
// ------------------------------------------------------------

export async function pingModel() {
  try {
    await ollama.list(); // ping local API
    // Explication:
    // On tente d'appeler une méthode légère d'Ollama. Si cela fonctionne,
    // on considère que le service tourne et qu'au moins l'API répond.
    return true;
  } catch {
    // Si une erreur survient, on renvoie false plutôt que d'échouer.
    return false;
  }
}

// Décrit la forme d'entrée attendue par les fonctions de génération.
// - age: l'âge de la personne (utilisé pour contextualiser le texte)
// - niveau: niveau scolaire/linguistique éventuel
// - tags: liste de mots-clés indiquant les besoins (ex: "dyslexie")
type Input = { age: number; niveau?: string; tags: string[] };

// Choix du modèle:
// - On lit la variable d'environnement OLLAMA_MODEL si disponible
// - Sinon, on utilise une valeur par défaut "qwen3:1.7b"
const MODEL = process.env.OLLAMA_MODEL ?? "qwen3:1.7b";

export async function* streamGenerate(input: Input) {
  // Rôle: produire progressivement des morceaux de texte (chunks) en réponse au prompt.
  // Cela permet à un client d'afficher le texte au fur et à mesure.
  const system =
    "Tu es un orthophoniste expérimenté. Rédige des textes courts, clairs et professionnels pour les bilans ou exercices. Ne montre pas ton raisonnement ; renvoie uniquement le texte final demandé.";

  // Le prompt "user" est construit à partir de l'entrée normalisée côté serveur.
  // L'intérêt est d'avoir une fonction dédiée à la construction du prompt:
  // - logique réutilisable
  // - tests unitaires possibles
  const user = buildPrompt(input);

  let stream: AsyncIterable<any>;
  try {
    // Appel à l'API locale d'Ollama pour une conversation "chat".
    // On fournit deux messages:
    // - system: donne des instructions de rôle/ton au modèle
    // - user: contient la demande spécifique (le prompt)
    // 'stream: true' indique que l'on souhaite un flux de tokens.
    stream = await ollama.chat({
      model: MODEL,
      stream: true,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      options: {
        // Paramètres de génération courants (influencent créativité et diversité)
        // - temperature: plus élevé => plus créatif
        // - top_p: nucleus sampling (filtrer la masse de probabilité)
        // - num_predict: nombre maximal de tokens à prédire
        // - seed: graine aléatoire (reproductibilité)
        temperature: 0.5,
        top_p: 0.9,
        num_predict: 320,
        seed: 42
      }
    });
  } catch (err: any) {
    const msg =
      typeof err?.message === "string" ? err.message : "Erreur inconnue";
    // Émettre un message lisible côté client plutôt que renvoyer un flux vide
    yield `Erreur de génération: ${msg}. Vérifiez qu'Ollama tourne et que le modèle "${MODEL}" est disponible (ollama pull ${MODEL}).\n`;
    return;
  }

  for await (const chunk of stream) {
    // Certaines versions/implémentations renvoient du texte dans delta/response
    const text = chunk.message?.content ?? chunk.delta ?? chunk.response ?? "";
    // On ne transmet que les morceaux non vides;
    // côté client, ces morceaux seront concaténés à mesure de la réception.
    if (text) yield text;
  }
}

export async function generateOnce(input: Input): Promise<string> {
  try {
    // Appel minimal non-stream, identique à l’exemple fourni
    const user = buildPrompt(input);
    // Ici, on appelle directement l'endpoint HTTP d'Ollama pour une génération non-stream.
    // Différence avec streamGenerate:
    // - on attend la complétion totale
    // - on récupère le résultat final en une fois (JSON)
    const res = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: user }],
        stream: false
      })
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${res.statusText}${txt ? ` — ${txt}` : ""}`);
    }
    const data: any = await res.json();
    // L'API d'Ollama renvoie un objet avec une clé 'message' qui porte le 'content'.
    // On nettoie le résultat (trim) pour supprimer espaces/retours superflus en fin.
    const message: string = (data?.message?.content ?? "").trim();
    return message;
  } catch (err: any) {
    const msg = typeof err?.message === "string" ? err.message : "Erreur inconnue";
    // Au lieu de propager l'erreur, on retourne un message explicite.
    // Cela simplifie la gestion côté client pour un scénario "noob-friendly".
    return `Erreur de génération: ${msg}. Vérifiez qu'Ollama tourne et que le modèle "${MODEL}" est disponible (ollama pull ${MODEL}).`;
  }
}