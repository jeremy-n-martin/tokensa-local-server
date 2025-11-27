import ollama from "ollama";
import { z } from "zod";
import { buildPrompt } from "./prompt.js";

// ------------------------------------------------------------
// Fichier: llm.ts
// Rôle: Encapsuler l'accès au modèle local (Ollama)
//       - pingModel(): vérifier si l'API locale d'Ollama répond
//       - generateOnce(): générer un texte en une seule fois (JSON)
// Contexte: Ollama expose une API locale (par défaut http://localhost:11434)
//           qui permet d'interagir avec des modèles LLM sur la machine.
// ------------------------------------------------------------

export async function pingModel() {
  try {
    await ollama.list(); // ping local API
    return true;
  } catch {
    return false;  // Si une erreur survient, on renvoie false plutôt que d'échouer.
  }
}

// Décrit la forme d'entrée attendue par les fonctions de génération.
type Input = { age: number; tags: string[] };

// Décrit la forme de sortie intermédiaire attendue depuis le LLM (JSON).
const RapportSchema = z.object({
  lecture: z.string(),
  ecriture: z.string()
});
type Rapport = z.infer<typeof RapportSchema>;

// Tente d'extraire l'objet JSON principal d'une réponse texte.
// Permet d'être un minimum robuste si le modèle ajoute du bruit autour.
function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Aucun objet JSON détecté dans la réponse du modèle.");
  }
  return text.slice(start, end + 1);
}

// Choix du modèle:
// - On lit la variable d'environnement OLLAMA_MODEL si disponible
// - Sinon, on utilise une valeur par défaut "qwen3:1.7b"
const MODEL = process.env.OLLAMA_MODEL ?? "qwen3:1.7b";

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
        stream: false,
        // On réduit légèrement la température pour favoriser des formulations
        // plus stables et moins « fantaisistes » en français.
        options: {
          temperature: 0.2
        }
      })
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${res.statusText}${txt ? ` — ${txt}` : ""}`);
    }
    const data: any = await res.json();
    // L'API d'Ollama renvoie un objet avec une clé 'message' qui porte le 'content'.
    // On nettoie le résultat (trim) pour supprimer espaces/retours superflus en fin.
    const raw: string = (data?.message?.content ?? "").trim();

    // Étape 1 : extraction de l'objet JSON dans la réponse brute.
    const jsonText = extractJsonObject(raw);

    // Étape 2 : parsing JSON, puis validation de la structure avec Zod.
    const parsed = JSON.parse(jsonText);
    const rapport: Rapport = RapportSchema.parse(parsed);

    // Étape 3 : construction de la sortie finale, avec structure rigide.
    const lecture = rapport.lecture.trim();
    const ecriture = rapport.ecriture.trim();

    // Format final imposé :
    // ###RAPPORT_ORTHO###
    // [paragraphe lecture]
    //
    // [paragraphe écriture]
    const finalText = [lecture, "", ecriture].join("\n");
    return finalText;
  } catch (err: any) {
    const msg = typeof err?.message === "string" ? err.message : "Erreur inconnue";
    // Au lieu de propager l'erreur, on retourne un message explicite.
    // Cela simplifie la gestion côté client pour un scénario "noob-friendly".
    return `Erreur de génération: ${msg}. Vérifiez qu'Ollama tourne et que le modèle "${MODEL}" est disponible (ollama pull ${MODEL}).`;
  }
}