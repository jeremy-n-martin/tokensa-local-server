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

export async function* streamGenerate(input: Input) {
  const system =
    "Tu es un orthophoniste expérimenté. Rédige des textes courts, clairs et professionnels pour les bilans ou exercices.";

  const user = buildPrompt(input);

  const stream = await ollama.chat({
    model: "qwen3:4b",
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

  for await (const chunk of stream) {
    const text = chunk.message?.content ?? "";
    if (text) yield text;
  }
}
