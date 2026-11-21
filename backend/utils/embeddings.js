const { GoogleGenAI } = require("@google/genai");

const EMBEDDING_MODEL =
  process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004";

let genAIClient = null;

/**
 * Lazily initialize and return the GoogleGenAI instance.
 */
function getClient() {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not configured in environment.");
      return null;
    }
    genAIClient = new GoogleGenAI({ apiKey });
  }
  return genAIClient;
}

/**
 * Formats screenshot properties into a semantically dense string for vector embedding.
 * Combines title/name, category, AI-extracted metadata, and OCR content.
 */
function buildScreenshotEmbeddingText(doc) {
  if (!doc) return "";

  const parts = [];

  // 1. Cleaned title / original name
  if (doc.originalName) {
    const cleanName = doc.originalName
      .replace(/\.[^/.]+$/, "") // strip extension
      .replace(/[-_]+/g, " ")   // replace dashes/underscores with spaces
      .trim();
    if (cleanName) {
      parts.push(`Title: ${cleanName}`);
    }
  }

  // 2. Category
  if (doc.category) {
    parts.push(`Category: ${doc.category}`);
  }

  // 3. AI intelligence metadata
  if (doc.aiData && typeof doc.aiData === "object") {
    const metaEntries = [];
    if (doc.aiData.title && doc.aiData.title !== doc.originalName) {
      metaEntries.push(`Subject: ${doc.aiData.title}`);
    }
    if (doc.aiData.amount) {
      metaEntries.push(`Amount: ${doc.aiData.amount}`);
    }
    if (doc.aiData.date) {
      metaEntries.push(`Date: ${doc.aiData.date}`);
    }
    if (doc.aiData.orderId) {
      metaEntries.push(`Order/Ref: ${doc.aiData.orderId}`);
    }
    if (doc.aiData.location) {
      metaEntries.push(`Location: ${doc.aiData.location}`);
    }
    if (doc.aiData.email) {
      metaEntries.push(`Email: ${doc.aiData.email}`);
    }
    if (doc.aiData.phone) {
      metaEntries.push(`Phone: ${doc.aiData.phone}`);
    }

    if (metaEntries.length > 0) {
      parts.push(`Details: ${metaEntries.join(", ")}`);
    }
  }

  // 4. Extracted OCR text (clean multiple whitespace, truncate to ~2500 characters)
  if (doc.extractedText) {
    const cleanOcr = String(doc.extractedText)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2500);

    if (cleanOcr) {
      parts.push(`Text content: ${cleanOcr}`);
    }
  }

  return parts.join("\n").trim();
}

/**
 * Generate embedding vector for arbitrary text using Gemini text-embedding-004.
 * Returns array of numbers (768 dimensions), or null on failure.
 */
async function generateEmbedding(text, maxRetries = 1) {
  if (!text || typeof text !== "string") {
    return null;
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  const client = getClient();
  if (!client) {
    return null;
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: trimmed.slice(0, 8000), // safe token limit
      });

      const vector =
        response.embedding?.values ||
        (Array.isArray(response.embeddings) &&
          response.embeddings[0]?.values) ||
        null;

      if (Array.isArray(vector) && vector.length > 0) {
        return vector;
      }
    } catch (error) {
      if (attempt === maxRetries) {
        console.warn(
          `[Gemini Embedding] Generation failed for text "${trimmed.slice(0, 50)}...":`,
          error.message
        );
        return null;
      }
      // Small backoff before retry
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }

  return null;
}

/**
 * Computes cosine similarity between two numeric vectors.
 * Returns a score between -1 and 1 (typically 0 to 1 for normalized embeddings).
 */
function cosineSimilarity(vecA, vecB) {
  if (
    !Array.isArray(vecA) ||
    !Array.isArray(vecB) ||
    vecA.length === 0 ||
    vecA.length !== vecB.length
  ) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA <= 0 || normB <= 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

module.exports = {
  buildScreenshotEmbeddingText,
  generateEmbedding,
  cosineSimilarity,
  EMBEDDING_MODEL,
};
