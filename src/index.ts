import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { streamGenerate, pingModel } from "./llm.js";

const ORIGIN = "https://tokensa.com";
const ALLOWED_ORIGINS = new Set<string>([
  "https://tokensa.com",
  "https://www.tokensa.com"
]);
const PORT = 3327;

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: (origin, cb) => {
    // Autoriser requêtes sans Origin (ex: curl, extension) et origins de la liste
    if (!origin || ALLOWED_ORIGINS.has(origin)) return cb(null, true);
    return cb(null, false);
  },
  methods: ["POST", "GET", "OPTIONS"],
  allowedHeaders: ["content-type", "x-tokensa"],
  hook: "preHandler"
});

app.options("/api/generate", async (req, reply) => {
  // Chrome 142+ : PNA/LNA header requis
  const origin = req.headers.origin;
  const allowOrigin =
    origin && ALLOWED_ORIGINS.has(origin) ? origin : ORIGIN;
  // Refléter les headers demandés par la préflight si fournis
  const acrh = req.headers["access-control-request-headers"] as
    | string
    | undefined;
  reply
    .header("Access-Control-Allow-Private-Network", "true")
    // CORS explicites pour la préflight
    .header("Access-Control-Allow-Origin", allowOrigin)
    .header("Vary", "Origin")
    .header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
    .header(
      "Access-Control-Allow-Headers",
      acrh ?? "content-type, x-tokensa"
    )
    .status(204)
    .send();
});

app.get("/api/health", async (req, reply) => {
  const origin = req.headers.origin;
  const allowOrigin =
    origin && ALLOWED_ORIGINS.has(origin) ? origin : ORIGIN;
  reply.header("Access-Control-Allow-Origin", allowOrigin);
  reply.header("Vary", "Origin");
  const ok = await pingModel();
  reply.send({ ok, model: "qwen2.5:1.5b-instruct", ready: ok });
});

const TAGS_ENUM = [
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
] as const;

const BodySchema = z.preprocess((raw) => {
  const body = (raw ?? {}) as Record<string, unknown>;
  const ageValue = body.age;
  const age =
    typeof ageValue === "number"
      ? ageValue
      : typeof ageValue === "string"
      ? Number(ageValue)
      : NaN;

  const tagsValue = (body as any).tags;
  const tagsArray: unknown[] = Array.isArray(tagsValue)
    ? tagsValue
    : tagsValue != null
    ? [tagsValue]
    : [];

  return {
    age,
    niveau: typeof body.niveau === "string" ? body.niveau : undefined,
    tags: tagsArray
  };
}, z.object({
  age: z.coerce.number().min(2).max(120),
  niveau: z.string().optional(),
  tags: z.array(z.enum(TAGS_ENUM)).min(1).max(6)
}));

app.post("/api/generate", async (req, reply) => {
  // Ajout manuel des en-têtes CORS car on écrit sur reply.raw (stream)
  const origin = req.headers.origin;
  const allowOrigin =
    origin && ALLOWED_ORIGINS.has(origin) ? origin : ORIGIN;
  reply.header("Access-Control-Allow-Origin", allowOrigin);
  reply.header("Vary", "Origin");
  reply.header("Content-Type", "text/plain; charset=utf-8");
  reply.header("Transfer-Encoding", "chunked");
  reply.header("X-Accel-Buffering", "no");

  let parsed;
  try {
    parsed = BodySchema.parse(req.body);
  } catch (err) {
    req.log.warn({ msg: "Invalid request body for /api/generate", body: req.body, err });
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
