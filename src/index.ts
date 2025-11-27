import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { pingModel, generateOnce } from "./llm.js";

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
const PORT = Number(process.env.PORT ?? 3327);
const HOST = process.env.HOST ?? "0.0.0.0";

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
  reply.send({ ok, model: "qwen3:1.7b", ready: ok });
});

// Définition et validation du corps de requête à l'aide de zod.
// Intérêt:
// - S'assurer que l'API reçoit des données conformes (types, contraintes)
// - Éviter des erreurs de logique plus loin dans le pipeline
const BodySchema = z.object({
  age: z.number().min(2).max(120),
  // Champs optionnels pour identifier le patient.
  prenom: z.string().optional(),
  nom: z.string().optional(),
  // Sexe optionnel : true = homme, false = femme, undefined = non précisé.
  homme: z.boolean().optional(),
  tags: z
    .array(
      z.enum([
        "Lecture - Décodage Confusions grapho-phonémiques",
        "Lecture - Décodage Conversion graphème-phonème incorrecte",
        "Lecture - Décodage Itérations",
        "Lecture - Décodage Omissions (lettres, syllabes)",
        "Lecture - Décodage Additions",
        "Lecture - Décodage Inversions",
        "Lecture - Décodage Segmentation inadéquate",
        "Lecture - Décodage Fusions indue",
        "Lecture - Décodage Régularisations",
        "Lecture - Lexicale Paralexies verbales",
        "Lecture - Lexicale Paralexies sémantiques",
        "Lecture - Lexicale Lexicalisations",
        "Lecture - Lexicale Paralexies visuelles",
        "Lecture - Phonologique Omission (phonèmes)",
        "Lecture - Phonologique Ajout (phonèmes)",
        "Lecture - Phonologique Substitution (voisement, articulation)",
        "Lecture - Phonologique Inversion séquentielle",
        "Lecture - Fluence Lecture hachée",
        "Lecture - Fluence Lenteur excessive",
        "Lecture - Fluence Erreurs prosodiques",
        "Lecture - Compréhension Erreurs littérales",
        "Lecture - Compréhension Erreurs inférentielles",
        "Lecture - Compréhension Confusion des anaphores",
        "Lecture - Compréhension Interprétations incohérentes",
        "Écriture - Phonologique Omissions de phonèmes",
        "Écriture - Phonologique Additions de phonèmes",
        "Écriture - Phonologique Substitutions phonologiques",
        "Écriture - Phonologique Inversions",
        "Écriture - Phonologique Segmentation fautive",
        "Écriture - Lexicale Erreurs d'usage",
        "Écriture - Lexicale Confusion homophones lexicaux",
        "Écriture - Lexicale Erreurs lettres muettes",
        "Écriture - Lexicale Erreurs morphèmes dérivationnels",
        "Écriture - Grammaire Accords nom-adjectif",
        "Écriture - Grammaire Accords sujet-verbe",
        "Écriture - Grammaire Erreurs de conjugaison",
        "Écriture - Grammaire Confusion homophones grammaticaux",
        "Écriture - Morphosyntaxe Omissions de mots grammaticaux",
        "Écriture - Morphosyntaxe Ordre des mots incorrect",
        "Écriture - Morphosyntaxe Structures agrammaticales",
        "Écriture - Graphomotricité Formes de lettres incorrectes",
        "Écriture - Graphomotricité Taille et espacement irréguliers",
        "Écriture - Graphomotricité Lenteur d'écriture",
        "Écriture - Graphomotricité Dysgraphie",
        "Écriture - Texte Manque de cohérence",
        "Écriture - Texte Ponctuation insuffisante",
        "Écriture - Texte Absence de connecteurs",
        "Écriture - Texte Répétitions / ruptures discursives"
      ])
    )
    .min(1)
    .max(20)
});

// Route principale de génération: /api/generate
// Réponse JSON : renvoie le texte complet une fois généré.
app.post("/api/generate", async (req, reply) => {
  // Validation du body en premier
  let parsed;
  try {
    parsed = BodySchema.parse(req.body);
  } catch (err) {
    reply.status(400).send({ error: "Invalid request body", details: err });
    return;
  }

  try {
    const text = await generateOnce(parsed);
    reply
      .header("Content-Type", "application/json; charset=utf-8")
      .send({ text, model: "qwen3:1.7b" });
  } catch (err) {
    app.log.error(err, "Erreur génération (JSON)");
    reply.status(500).send({ error: "Generation failed" });
  }
});

app.listen({ host: HOST, port: PORT }).then(() => {
  const displayHost = HOST === "0.0.0.0" ? "0.0.0.0 (toutes interfaces)" : HOST;
  app.log.info(
    `Tokensa local server → http://${displayHost}:${PORT} (configurable via HOST/PORT)`
  );
  
});
