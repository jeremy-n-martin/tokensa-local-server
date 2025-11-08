// Esprit: vous utilisez Mastra pour structurer l'orchestration.
// Ici on garde simple: un "agent" qui prépare le prompt et pourrait tracer/évaluer plus tard.
import { Agent } from '@mastra/agents';

export const orthophonieAgent = new Agent({
  name: 'orthophonie-agent',
  description: 'Construit des prompts d’orthophonie et orchestre Ollama.',
  // hooks/telemetry/tracing: plugger plus tard (Mastra playground/trace)
});
