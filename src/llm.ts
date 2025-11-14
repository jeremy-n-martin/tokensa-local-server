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
    "Tu es un orthophoniste expérimenté. Rédige des textes courts, clairs et professionnels pour les bilans ou exercices. Ne montre pas ton raisonnement ; renvoie uniquement le texte final demandé.";

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
    if (text) yield text;
  }
}

export async function generateOnce(input: Input): Promise<string> {
  try {
    // Appel minimal non-stream, identique à l’exemple fourni
    const user = buildPrompt(input);
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
    const message: string = (data?.message?.content ?? "").trim();
    return message;
  } catch (err: any) {
    const msg = typeof err?.message === "string" ? err.message : "Erreur inconnue";
    return `Erreur de génération: ${msg}. Vérifiez qu'Ollama tourne et que le modèle "${MODEL}" est disponible (ollama pull ${MODEL}).`;
  }
}