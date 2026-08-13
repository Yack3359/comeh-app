import Anthropic from "@anthropic-ai/sdk";

const EXTRACTION_MODEL = "claude-sonnet-5";
const MAX_OUTPUT_TOKENS = 2048;

let client: Anthropic | null = null;

function getClient() {
  if (client) {
    return client;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY n'est pas configurée : l'extraction IA des imports est indisponible.",
    );
  }

  client = new Anthropic({ apiKey });
  return client;
}

export type SupportedDocumentMediaType =
  | "application/pdf"
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/webp";

function isPdf(mediaType: string): mediaType is "application/pdf" {
  return mediaType === "application/pdf";
}

function documentContentBlock(
  base64Data: string,
  mediaType: SupportedDocumentMediaType,
): Anthropic.DocumentBlockParam | Anthropic.ImageBlockParam {
  if (isPdf(mediaType)) {
    return {
      type: "document",
      source: { type: "base64", media_type: mediaType, data: base64Data },
    };
  }

  return {
    type: "image",
    source: { type: "base64", media_type: mediaType, data: base64Data },
  };
}

async function extractStructured<T>(
  toolName: string,
  tool: Anthropic.Tool,
  systemPrompt: string,
  userInstruction: string,
  base64Data: string,
  mediaType: SupportedDocumentMediaType,
): Promise<T> {
  const response = await getClient().messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          documentContentBlock(base64Data, mediaType),
          { type: "text", text: userInstruction },
        ],
      },
    ],
    tools: [tool],
    tool_choice: { type: "tool", name: toolName },
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );

  if (!toolUse) {
    throw new Error(
      "L'extraction IA n'a renvoyé aucun résultat structuré exploitable.",
    );
  }

  return toolUse.input as T;
}

export type ExtractedExpense = {
  amount: string;
  date: string;
  type: "hebergement" | "deplacement";
  description: string;
  relatedEvent?: string;
  confidence: "high" | "medium" | "low";
  notes?: string;
};

const expenseExtractionTool: Anthropic.Tool = {
  name: "record_expense_extraction",
  description:
    "Enregistre les informations extraites d'une note de frais (facture ou reçu d'hébergement ou de déplacement).",
  input_schema: {
    type: "object",
    properties: {
      amount: {
        type: "string",
        description:
          "Montant total TTC de la facture, en nombre décimal avec un point (ex: 123.45). Laisser vide si illisible.",
      },
      date: {
        type: "string",
        description: "Date de la dépense au format AAAA-MM-JJ.",
      },
      type: {
        type: "string",
        enum: ["hebergement", "deplacement"],
        description: "Nature de la dépense.",
      },
      description: {
        type: "string",
        description:
          "Résumé court : fournisseur/hôtel, lieu, objet de la dépense.",
      },
      relatedEvent: {
        type: "string",
        description:
          "Nom de la compétition ou du déplacement concerné, si mentionné sur le document.",
      },
      confidence: {
        type: "string",
        enum: ["high", "medium", "low"],
        description: "Confiance globale dans l'exactitude de l'extraction.",
      },
      notes: {
        type: "string",
        description:
          "Informations ambiguës ou champs non trouvés, à signaler à l'utilisateur pour vérification manuelle.",
      },
    },
    required: ["amount", "date", "type", "description", "confidence"],
  },
};

export async function extractExpenseFromDocument(
  base64Data: string,
  mediaType: SupportedDocumentMediaType,
): Promise<ExtractedExpense> {
  return extractStructured<ExtractedExpense>(
    expenseExtractionTool.name,
    expenseExtractionTool,
    "Tu extrais les informations d'une note de frais (facture, reçu) pour la commission escrime handisport (COMEH). " +
      "Réponds uniquement via l'outil fourni. Si une information est absente, illisible ou ambiguë, laisse le champ vide " +
      "ou signale-le dans 'notes' plutôt que d'inventer une valeur.",
    "Extrais les informations de cette note de frais.",
    base64Data,
    mediaType,
  );
}

export type ExtractedResult = {
  athleteName?: string;
  opponentName?: string;
  competitionName?: string;
  date?: string;
  rank?: number;
  seedRank?: number;
  poolRank?: number;
  won?: boolean;
  scoreFor?: number;
  scoreAgainst?: number;
  round?: string;
  confidence: "high" | "medium" | "low";
  notes?: string;
};

const resultsExtractionTool: Anthropic.Tool = {
  name: "record_results_extraction",
  description:
    "Enregistre la liste des résultats sportifs (classements et/ou assauts individuels) trouvés dans un document de feuille de résultats.",
  input_schema: {
    type: "object",
    properties: {
      results: {
        type: "array",
        description: "Un élément par ligne de résultat identifiée dans le document.",
        items: {
          type: "object",
          properties: {
            athleteName: {
              type: "string",
              description: "Nom complet du tireur de la COMEH (prénom nom).",
            },
            opponentName: {
              type: "string",
              description:
                "Nom complet de l'adversaire, si le document décrit un assaut individuel.",
            },
            competitionName: {
              type: "string",
              description: "Nom de la compétition, si mentionné.",
            },
            date: {
              type: "string",
              description: "Date de la compétition au format AAAA-MM-JJ, si disponible.",
            },
            rank: {
              type: "integer",
              description: "Classement final dans la compétition, si applicable.",
            },
            seedRank: {
              type: "integer",
              description: "Classement initial (avant compétition), si mentionné.",
            },
            poolRank: {
              type: "integer",
              description: "Classement à l'issue des poules, si le tireur est concerné.",
            },
            won: {
              type: "boolean",
              description: "Victoire (true) ou défaite (false) pour un résultat de poule ou de tableau.",
            },
            scoreFor: {
              type: "integer",
              description: "Nombre de touches marquées par le tireur de la COMEH (ex: 15 dans 15-12).",
            },
            scoreAgainst: {
              type: "integer",
              description: "Nombre de touches marquées par l'adversaire (ex: 12 dans 15-12).",
            },
            round: {
              type: "string",
              description: "Phase/tour de la compétition (poule, tableau de 16, finale...).",
            },
            confidence: {
              type: "string",
              enum: ["high", "medium", "low"],
            },
            notes: {
              type: "string",
              description: "Ambiguïtés ou informations manquantes à vérifier manuellement.",
            },
          },
          required: ["confidence"],
        },
      },
    },
    required: ["results"],
  },
};

export async function extractResultsFromDocument(
  base64Data: string,
  mediaType: SupportedDocumentMediaType,
): Promise<ExtractedResult[]> {
  const parsed = await extractStructured<{ results: ExtractedResult[] }>(
    resultsExtractionTool.name,
    resultsExtractionTool,
    "Tu extrais les résultats sportifs d'escrime (classements et/ou assauts individuels) d'un document de compétition " +
      "pour la commission escrime handisport (COMEH). Réponds uniquement via l'outil fourni, une entrée par résultat trouvé. " +
      "Si une information est absente ou illisible, laisse-la vide plutôt que d'inventer une valeur, et signale-le dans 'notes'.",
    "Extrais tous les résultats de ce document.",
    base64Data,
    mediaType,
  );

  return parsed.results;
}
