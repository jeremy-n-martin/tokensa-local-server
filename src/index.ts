import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { streamGenerate, pingModel, generateOnce } from "./llm.js";

// ------------------------------------------------------------
// Fichier: index.ts
// Rôle: Point d'entrée du serveur local Tokensa (Fastify)
//       - Configure CORS/PNA (Private Network Access) pour navigateurs récents
//       - Expose des routes HTTP pour la génération de texte (JSON ou streaming)
//       - Valide les entrées avec zod
// Remarque: Les commentaires ci-dessous visent un public débutant et
//           expliquent les notions essentielles de façon académique.
// ------------------------------------------------------------

const ORIGIN = "https://tokensa.com";
const BASE_DOMAIN = "tokensa.com";
// Liste explicite des origines (schéma + host + port) autorisées.
// Cela permet d'autoriser la prod et certains environnements de dev locaux
// tout en bloquant par défaut les autres origines non prévues.
const ALLOWED_ORIGINS = new Set<string>([
  "https://tokensa.com",
  "https://www.tokensa.com",
  // Dev local (Live Server)
  "http://127.0.0.1:5500",
  "http://localhost:5500"
]);
// Vérifie si une origine (en-tête HTTP Origin) est autorisée.
// Principe:
// 1) Si pas d'origine (ex: requêtes curl, extensions, contexte de fond), on autorise.
// 2) Si présente dans la liste blanche, on autorise.
// 3) Sinon, on essaie d'autoriser les sous-domaines du domaine de base (tokensa.com).
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
// Renvoie l'origine à refléter dans les en-têtes CORS:
// - Si l'origine fournie est autorisée, on la renvoie (refléter)
// - Sinon, on tombe sur l'origine "officielle" (ORIGIN).
const resolveAllowOrigin = (origin?: string | null) =>
  origin && isAllowedOrigin(origin) ? origin : ORIGIN;
const PORT = 3327;

// Création de l'application Fastify.
// Le logger activé (logger: true) affiche des informations utiles en console.
const app = Fastify({ logger: true });

// Enregistrement du plugin CORS.
// CORS (Cross-Origin Resource Sharing) permet au navigateur d'autoriser
// des requêtes entre origines différentes (ex: site A -> API B).
// Ici, on contrôle dynamiquement l'origine et on limite méthodes/headers.
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
// Explication:
// - Avant certaines requêtes, le navigateur envoie une requête "préflight" (OPTIONS)
//   pour demander si la vraie requête sera autorisée (méthode/headers/origine).
// - Private Network Access (PNA) exige, pour certaines configurations réseau (ex: localhost),
//   la présence de l'en-tête "Access-Control-Allow-Private-Network: true".
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
// Ce hook s'exécute juste avant l'envoi de la réponse.
// S'il y a un header Origin fourni par le client et qu'il est autorisé,
// on reflète l'origine et autorise les credentials (cookies/headers d'auth).
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

// Route préflight spécifique à /api/generate (optionnel mais explicite).
// Elle montre comment renvoyer proprement toutes les informations CORS/PNA
// lorsque le client interroge précisément cette route en OPTIONS.
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

// Route de santé simple pour vérifier la disponibilité du modèle local.
// Elle interroge brièvement l'API locale d'Ollama via pingModel().
app.get("/api/health", async (_, reply) => {
  const ok = await pingModel();
  reply.send({ ok, model: "qwen3:4b", ready: ok });
});

// Définition et validation du corps de requête à l'aide de zod.
// Intérêt:
// - S'assurer que l'API reçoit des données conformes (types, contraintes)
// - Éviter des erreurs de logique plus loin dans le pipeline
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

// Route principale de génération: /api/generate
// Deux modes de réponse sont proposés:
// 1) JSON (par défaut): renvoie le texte complet une fois généré
// 2) Streaming (si ?stream=1|true): renvoie le texte progressivement (chunk par chunk)
//    utile pour afficher la génération en temps réel côté client.
app.post("/api/generate", async (req, reply) => {
  // Validation du body en premier
  let parsed;
  try {
    parsed = BodySchema.parse(req.body);
  } catch (err) {
    reply.status(400).send({ error: "Invalid request body", details: err });
    return;
  }

  // Sélection du mode : JSON (par défaut) ou streaming si ?stream=1|true
  const q: any = (req as any).query ?? {};
  const streamParam = typeof q.stream === "string" ? q.stream.toLowerCase() : q.stream;
  const shouldStream = streamParam === "1" || streamParam === "true";

  if (!shouldStream) {
    // Réponse JSON classique (pas de hijack -> onSend applique PNA+CORS)
    // Étapes:
    // 1) Appel au générateur non-stream (generateOnce)
    // 2) Renvoi du JSON { text, model }
    try {
      const text = await generateOnce(parsed);
      reply
        .header("Content-Type", "application/json; charset=utf-8")
        .send({ text, model: "qwen3:4b" });
    } catch (err) {
      app.log.error(err, "Erreur génération (JSON)");
      reply.status(500).send({ error: "Generation failed" });
    }
    return;
  }

  // Mode streaming texte brut
  // Différences notables:
  // - On "hijack" la réponse Fastify pour écrire directement sur le socket HTTP
  //   (car la réponse arrive en plusieurs morceaux au fil du temps).
  // - On fixe les en-têtes CORS/PNA nous-mêmes car on sort du flux standard.
  const origin = req.headers.origin;
  const allowOrigin = resolveAllowOrigin(origin);

  reply.hijack();
  const res = reply.raw;

  // En-têtes pour autoriser le streaming cross-origin et désactiver certains buffers.
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  res.setHeader("Vary", "Origin");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("X-Accel-Buffering", "no");

  res.writeHead(200);

  try {
    // On obtient un itérable asynchrone qui émet des morceaux de texte.
    const iter = streamGenerate(parsed);
    for await (const chunk of iter) {
      // Chaque 'chunk' est une portion de texte généré par le modèle.
      // Le client peut l'afficher immédiatement pour un effet "temps réel".
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
