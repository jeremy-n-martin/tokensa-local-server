import ollama from "ollama";
import { buildPrompt } from "./prompt.js";

export async function pingModel() {
  try {
    await ollama.list(); // ping local API
    return true;
  } catch {
    return false;
  }
}

type Input = { age: number; niveau?: string; tags: string[] };

const MODEL = process.env.OLLAMA_MODEL ?? "qwen3:4b";

export async function* streamGenerate(input: Input) {
  const system =
    "Tu es un orthophoniste expérimenté. Rédige des textes courts, clairs et professionnels pour les bilans ou exercices.";

  const user = buildPrompt(input);

  let stream: AsyncIterable<any>;
  try {
    stream = await ollama.chat({
      model: MODEL,
      stream: true,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      options: {
        temperature: 0.5,
        top_p: 0.9,
        num_predict: 200,
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
    const text = chunk.message?.content ?? "";
    if (text) yield text;
  }
}
