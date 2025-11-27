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
// Les champs prenom, nom et homme sont optionnels : s'ils sont fournis, ils
// pourront être utilisés plus tard pour personnaliser le rapport.
type Input = {
  age: number;
  tags: string[];
  prenom?: string;
  nom?: string;
  homme?: boolean;
};

// Décrit la forme de sortie intermédiaire attendue depuis le LLM (JSON).
// On tolère que le modèle oublie un des champs et on le remplace alors par
// une chaîne vide, pour éviter de casser tout le pipeline côté utilisateur.
const RapportSchema = z.object({
  lecture: z.string().optional().default(""),
  ecriture: z.string().optional().default("")
});
type Rapport = z.infer<typeof RapportSchema>;

// Construit un libellé adapté pour désigner le patient, en fonction de l'âge,
// du prénom, du nom et du sexe, selon les règles métier fournies.
function buildPatientLabel(input: Input): string {
  const prenom = input.prenom?.trim();
  const nom = input.nom?.trim();

  // 1) Moins de 18 ans et prénom fourni -> on utilise le prénom.
  if (input.age < 18 && prenom) {
    return prenom;
  }

  // 2) Plus de 18 ans, nom + sexe fournis -> M. / Mme + nom.
  if (input.age > 18 && nom && typeof input.homme === "boolean") {
    const civilite = input.homme ? "M." : "Mme";
    return `${civilite} ${nom}`;
  }

  // 3) Sinon, on reste sur « le patient ».
  return "le patient";
}

// Remplace uniquement la première occurrence de « le patient » dans un
// paragraphe par le libellé calculé, en laissant le reste du texte intact.
function personalizeParagraph(paragraph: string, label: string): string {
  if (!paragraph) return paragraph;
  if (label === "le patient") return paragraph;
  return paragraph.replace("le patient", label);
}

// Corrige quelques incohérences typiques entre les deux paragraphes en
// post-traitement, sans redemander une génération au LLM.
// - Le paragraphe lecture ne doit jamais contenir « En production écrite ».
// - Le paragraphe écriture ne doit jamais contenir « Lors des épreuves de lecture ».
function sanitizeParagraphs(lecture: string, ecriture: string): {
  lecture: string;
  ecriture: string;
} {
  let fixedLecture = lecture;
  let fixedEcriture = ecriture;

  if (fixedLecture.includes("En production écrite")) {
    fixedLecture = fixedLecture.replace(
      /En production écrite/g,
      "Lors des épreuves de lecture"
    );
  }
  if (fixedLecture.includes("En écriture")) {
    fixedLecture = fixedLecture.replace(
      /En écriture/g,
      "Lors des épreuves de lecture"
    );
  }

  if (fixedEcriture.includes("Lors des épreuves de lecture")) {
    fixedEcriture = fixedEcriture.replace(
      /Lors des épreuves de lecture/g,
      "En production écrite"
    );
  }

  return { lecture: fixedLecture, ecriture: fixedEcriture };
}

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
// - Sinon, on utilise une valeur par défaut "qwen3:8b"
const MODEL = process.env.OLLAMA_MODEL ?? "qwen3:8b";

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
        // plus stables et on applique une pénalité de répétition pour limiter
        // la réutilisation mot à mot des mêmes segments.
        options: {
          temperature: 0.2,
          repeat_penalty: 1.3
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

    // Présence ou non de troubles dans chaque domaine.
    const hasLectureTags = input.tags.some((t) => t.startsWith("Lecture"));
    const hasEcritureTags = input.tags.some((t) => t.startsWith("Écriture"));

    // Étape 3 : personnalisation éventuelle de la mention « le patient ».
    const label = buildPatientLabel(input);

    // Si aucun trouble n'est coché pour un des domaines, on remplace
    // entièrement le paragraphe correspondant par une phrase neutre,
    // sans dépendre du LLM. Si des troubles sont cochés mais que le modèle
    // renvoie un paragraphe vide, on fournit une phrase explicite indiquant
    // l'absence de texte généré, plutôt que de renvoyer une erreur.
    let lecture: string;
    if (!hasLectureTags) {
      lecture = "Aucun trouble pour la lecture n'a été observé.";
    } else {
      const rawLecture = rapport.lecture.trim();
      lecture =
        rawLecture.length > 0
          ? personalizeParagraph(rawLecture, label)
          : "Le paragraphe de lecture n'a pas pu être généré automatiquement et devra être complété manuellement.";
    }

    let ecriture: string;
    if (!hasEcritureTags) {
      ecriture = "Aucun trouble pour l'écriture n'a été observé.";
    } else {
      const rawEcriture = rapport.ecriture.trim();
      ecriture =
        rawEcriture.length > 0
          ? personalizeParagraph(rawEcriture, label)
          : "Le paragraphe d'écriture n'a pas pu être généré automatiquement et devra être complété manuellement.";
    }

    // Post-sanitisation minimale pour corriger des formules inversées
    // entre les deux domaines (lecture vs écriture).
    const sanitized = sanitizeParagraphs(lecture, ecriture);

    // [paragraphe écriture]
    const finalText = [sanitized.lecture, "", sanitized.ecriture].join("\n");
    return finalText;
  } catch (err: any) {
    const msg = typeof err?.message === "string" ? err.message : "Erreur inconnue";
    // Au lieu de propager l'erreur, on retourne un message explicite.
    // Cela simplifie la gestion côté client pour un scénario "noob-friendly".
    return `Erreur de génération: ${msg}. Vérifiez qu'Ollama tourne et que le modèle "${MODEL}" est disponible (ollama pull ${MODEL}).`;
  }
}