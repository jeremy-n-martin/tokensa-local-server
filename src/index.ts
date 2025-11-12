import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { streamGenerate, pingModel } from "./llm.js";

const ORIGIN = "https://tokensa.com";
const BASE_DOMAIN = "tokensa.com";
const ALLOWED_ORIGINS = new Set<string>([
  "https://tokensa.com",
  "https://www.tokensa.com",
  // Dev local (Live Server)
  "http://127.0.0.1:5500",
  "http://localhost:5500"
]);
const isAllowedOrigin = (origin?: string | null) => {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const url = new URL(origin);
    if (
      url.hostname === BASE_DOMAIN ||
      url.hostname.endsWith(`.${BASE_DOMAIN}`)
    ) {
      return true;
    }
  } catch {
    // Ignore parsing errors, fallback below.
  }
  return false;
};
const resolveAllowOrigin = (origin?: string | null) =>
  origin && isAllowedOrigin(origin) ? origin : ORIGIN;
const PORT = 3327;

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: (origin, cb) => {
    // Autoriser requêtes sans Origin (ex: curl, extensions) et origins connus
    if (isAllowedOrigin(origin)) return cb(null, true);
    return cb(null, false);
  },
  methods: ["POST", "GET", "OPTIONS"],
  allowedHeaders: ["content-type", "x-tokensa"],
  hook: "preHandler"
});

// Répondre globalement aux préflight OPTIONS avec PNA + CORS
app.addHook("onRequest", (req, reply, done) => {
  if (req.method === "OPTIONS") {
    const origin = req.headers.origin;
    const allowOrigin = resolveAllowOrigin(origin);
    const acrh = (req.headers["access-control-request-headers"] as string | undefined) ?? "content-type, x-tokensa";
    reply
      .header("Access-Control-Allow-Private-Network", "true")
      .header("Access-Control-Allow-Origin", allowOrigin)
      .header("Access-Control-Allow-Credentials", "true")
      .header("Vary", "Origin")
      .header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
      .header("Access-Control-Allow-Headers", acrh)
      .status(204)
      .send();
    return;
  }
  done();
});

// Ajouter PNA + CORS de manière défensive sur toutes les réponses non-hijackées
app.addHook("onSend", (req, reply, payload, done) => {
  const origin = req.headers.origin;
  const allowOrigin = resolveAllowOrigin(origin);
  reply.header("Access-Control-Allow-Private-Network", "true");
  if (origin) {
    reply.header("Access-Control-Allow-Origin", allowOrigin);
    reply.header("Access-Control-Allow-Credentials", "true");
    reply.header("Vary", "Origin");
  }
  done();
});

app.options("/api/generate", async (req, reply) => {
  // Chrome 142+ : PNA/LNA header requis
  const origin = req.headers.origin;
  const allowOrigin = resolveAllowOrigin(origin);
  // Refléter les headers demandés par la préflight si fournis
  const acrh = req.headers["access-control-request-headers"] as
    | string
    | undefined;
  reply
    .header("Access-Control-Allow-Private-Network", "true")
    // CORS explicites pour la préflight
    .header("Access-Control-Allow-Origin", allowOrigin)
    .header("Access-Control-Allow-Credentials", "true")
    .header("Vary", "Origin")
    .header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
    .header(
      "Access-Control-Allow-Headers",
      acrh ?? "content-type, x-tokensa"
    )
    .status(204)
    .send();
});

app.get("/api/health", async (_, reply) => {
  const ok = await pingModel();
  reply.send({ ok, model: "qwen3:4b", ready: ok });
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
  // Validation du body en premier
  let parsed;
  try {
    parsed = BodySchema.parse(req.body);
  } catch (err) {
    reply.status(400).send({ error: "Invalid request body", details: err });
    return;
  }

  // Configuration CORS + PNA avant tout envoi
  const origin = req.headers.origin;
  const allowOrigin = resolveAllowOrigin(origin);
  
  reply.hijack();
  const res = reply.raw;
  
  // En-têtes CORS/PNA obligatoires
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  res.setHeader("Vary", "Origin");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("X-Accel-Buffering", "no");
  
  // Envoyer les en-têtes immédiatement
  res.writeHead(200);

  try {
    const iter = streamGenerate(parsed);
    for await (const chunk of iter) {
      res.write(chunk);
    }
    res.end();
  } catch (err) {
    app.log.error(err, "Erreur lors du streaming");
    if (!res.writableEnded) {
      res.end();
    }
  }
});

app.listen({ host: "127.0.0.1", port: PORT }).then(() => {
  app.log.info(`Tokensa local server → http://127.0.0.1:${PORT}`);
});
