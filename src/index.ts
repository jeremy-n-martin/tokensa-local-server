import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { streamGenerate, pingModel } from "./llm.js";

const ORIGIN = "https://tokensa.com";
const PORT = 3327;

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: ORIGIN,
  methods: ["POST", "GET", "OPTIONS"],
  allowedHeaders: ["content-type", "x-tokensa"],
  hook: "preHandler"
});

app.options("/api/generate", async (_, reply) => {
  // Chrome 142+ : PNA/LNA header requis
  reply.header("Access-Control-Allow-Private-Network", "true").send();
});

app.get("/api/health", async (_, reply) => {
  const ok = await pingModel();
  reply.send({ ok, model: "qwen2.5:1.5b-instruct", ready: ok });
});

const BodySchema = z.object({
  age: z.number().min(2).max(120),
  niveau: z.string().optional(),
  tags: z
    .array(
      z.enum([
        "dyslexie",
        "dysorthographie",
        "dyspraxie",
        "dysphasie",
        "begaiement",
        "TDAH",
        "dyscalculie",
        "articulation",
        "comprehension",
        "phonologie"
      ])
    )
    .min(1)
    .max(6)
});

app.post("/api/generate", async (req, reply) => {
  reply.header("Content-Type", "text/plain; charset=utf-8");
  reply.header("Transfer-Encoding", "chunked");
  reply.header("X-Accel-Buffering", "no");

  let parsed;
  try {
    parsed = BodySchema.parse(req.body);
  } catch {
    reply.status(400).send("Bad request");
    return;
  }

  const iter = streamGenerate(parsed);
  for await (const chunk of iter) {
    reply.raw.write(chunk);
  }
  reply.raw.end();
});

app.listen({ host: "127.0.0.1", port: PORT }).then(() => {
  app.log.info(`Tokensa local server → http://127.0.0.1:${PORT}`);
});
