const mongoose = require("mongoose");
const Screenshot = require("../models/Screenshot");
const { generateEmbedding, cosineSimilarity } = require("./embeddings");

// Words that typically don't carry core semantic intent in natural language screenshot queries
const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
  "has", "he", "in", "is", "it", "its", "of", "on", "that", "the",
  "to", "was", "were", "will", "with", "find", "show", "me", "my",
  "get", "search", "saved", "screenshot", "screenshots", "image",
  "images", "pic", "pics", "photo", "photos", "looking", "please"
]);

/**
 * Extracts meaningful keyword tokens from a query string.
 */
function extractQueryKeywords(query) {
  if (!query) return [];
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

/**
 * Escapes regex special characters in a string.
 */
function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

/**
 * Performs keyword search over user's screenshots.
 * Matches originalName, extractedText, category, and aiData fields.
 */
async function performKeywordSearch({
  userId,
  query,
  category,
  startDate,
  endDate,
  important,
  maxCandidates = 100,
}) {
  const baseFilter = {
    userId: new mongoose.Types.ObjectId(userId),
  };

  if (category && category !== "All") {
    baseFilter.category = category;
  }

  if (typeof important === "boolean") {
    baseFilter.important = important;
  }

  if (startDate || endDate) {
    baseFilter.createdAt = {};
    if (startDate) baseFilter.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      baseFilter.createdAt.$lte = end;
    }
  }

  const cleanQuery = query ? query.trim() : "";
  if (!cleanQuery) {
    // If no text query, simply return sorted by recent
    const docs = await Screenshot.find(baseFilter)
      .sort({ createdAt: -1 })
      .limit(maxCandidates);
    return docs.map((doc, idx) => ({
      doc,
      keywordScore: 1 - idx * 0.001,
      rank: idx + 1,
      matchType: "filter",
    }));
  }

  const keywords = extractQueryKeywords(cleanQuery);
  const escapedFull = escapeRegex(cleanQuery);
  const fullRegex = new RegExp(escapedFull, "i");

  // Build OR condition matching full query or individual key terms
  const matchConditions = [
    { originalName: fullRegex },
    { extractedText: fullRegex },
    { category: fullRegex },
    { "aiData.title": fullRegex },
    { "aiData.location": fullRegex },
    { "aiData.orderId": fullRegex },
  ];

  if (keywords.length > 0) {
    for (const kw of keywords) {
      const kwRegex = new RegExp(`\\b${escapeRegex(kw)}`, "i");
      matchConditions.push({ originalName: kwRegex });
      matchConditions.push({ extractedText: kwRegex });
      matchConditions.push({ category: kwRegex });
      matchConditions.push({ "aiData.title": kwRegex });
      matchConditions.push({ "aiData.location": kwRegex });
      matchConditions.push({ "aiData.orderId": kwRegex });
    }
  }

  const queryFilter = {
    ...baseFilter,
    $or: matchConditions,
  };

  const matchedDocs = await Screenshot.find(queryFilter)
    .limit(maxCandidates * 2);

  // Score documents based on relevance:
  // - Full query exact match in originalName: 100 pts
  // - Full query in extractedText: 60 pts
  // - Each keyword match in title: 20 pts
  // - Each keyword match in OCR text: 10 pts
  // - Match in aiData metadata: 15 pts
  const scored = matchedDocs.map((doc) => {
    let score = 0;
    const name = (doc.originalName || "").toLowerCase();
    const ocr = (doc.extractedText || "").toLowerCase();
    const cat = (doc.category || "").toLowerCase();
    const qLower = cleanQuery.toLowerCase();

    if (name.includes(qLower)) score += 100;
    if (ocr.includes(qLower)) score += 60;
    if (cat.includes(qLower)) score += 30;

    for (const kw of keywords) {
      if (name.includes(kw)) score += 20;
      if (ocr.includes(kw)) score += 10;
      if (cat.includes(kw)) score += 15;
      if (doc.aiData) {
        const title = (doc.aiData.title || "").toLowerCase();
        const loc = (doc.aiData.location || "").toLowerCase();
        const orderId = (doc.aiData.orderId || "").toLowerCase();
        if (title.includes(kw)) score += 20;
        if (loc.includes(kw) || orderId.includes(kw)) score += 15;
      }
    }

    return {
      doc,
      keywordScore: score,
    };
  });

  scored.sort((a, b) => b.keywordScore - a.keywordScore);

  return scored.slice(0, maxCandidates).map((item, idx) => ({
    doc: item.doc,
    keywordScore: item.keywordScore,
    rank: idx + 1,
    matchType: "keyword",
  }));
}

/**
 * Performs semantic vector search.
 * Attempts MongoDB Atlas Vector Search ($vectorSearch) first,
 * and transparently falls back to in-memory cosine similarity if Atlas Vector Search is unavailable.
 */
async function performSemanticSearch({
  userId,
  queryVector,
  category,
  startDate,
  endDate,
  important,
  maxCandidates = 100,
}) {
  if (!queryVector || !Array.isArray(queryVector) || queryVector.length === 0) {
    return [];
  }

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const atlasIndexName = process.env.ATLAS_VECTOR_INDEX || "vector_index";

  // 1. Try MongoDB Atlas Vector Search
  try {
    const vectorFilter = {
      userId: userObjectId,
    };
    if (category && category !== "All") {
      vectorFilter.category = category;
    }

    const pipeline = [
      {
        $vectorSearch: {
          index: atlasIndexName,
          path: "embedding",
          queryVector: queryVector,
          numCandidates: Math.max(maxCandidates * 3, 100),
          limit: maxCandidates,
          filter: vectorFilter,
        },
      },
      {
        $project: {
          _id: 1,
          vectorScore: { $meta: "vectorSearchScore" },
        },
      },
    ];

    const atlasResults = await Screenshot.aggregate(pipeline);

    if (Array.isArray(atlasResults) && atlasResults.length > 0) {
      const ids = atlasResults.map((r) => r._id);
      const docs = await Screenshot.find({ _id: { $in: ids } });
      const docMap = new Map(docs.map((d) => [d._id.toString(), d]));

      const results = [];
      atlasResults.forEach((res, idx) => {
        const doc = docMap.get(res._id.toString());
        if (doc) {
          // Check additional date/important filters if supplied
          if (typeof important === "boolean" && doc.important !== important) {
            return;
          }
          if (startDate && new Date(doc.createdAt) < new Date(startDate)) {
            return;
          }
          if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            if (new Date(doc.createdAt) > end) return;
          }

          results.push({
            doc,
            semanticScore: res.vectorScore || 0,
            rank: idx + 1,
            matchType: "semantic",
          });
        }
      });

      return results;
    }
  } catch (atlasError) {
    // Atlas Vector Search not configured or not running in Atlas cluster.
    // Fall back to in-memory cosine similarity below.
    console.info(
      "[Vector Search] Atlas $vectorSearch unavailable, using in-memory cosine similarity fallback:",
      atlasError.message
    );
  }

  // 2. Safe Fallback: In-memory Cosine Similarity
  try {
    const fallbackFilter = {
      userId: userObjectId,
      embedding: { $exists: true, $ne: [] },
    };

    if (category && category !== "All") {
      fallbackFilter.category = category;
    }

    if (typeof important === "boolean") {
      fallbackFilter.important = important;
    }

    if (startDate || endDate) {
      fallbackFilter.createdAt = {};
      if (startDate) fallbackFilter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        fallbackFilter.createdAt.$lte = end;
      }
    }

    // Retrieve user's embedded screenshots with vector data
    const candidates = await Screenshot.find(fallbackFilter)
      .select("+embedding")
      .limit(300);

    if (!candidates || candidates.length === 0) {
      return [];
    }

    const scored = candidates
      .map((doc) => {
        const sim = cosineSimilarity(queryVector, doc.embedding);
        return {
          doc,
          semanticScore: sim,
        };
      })
      .filter((item) => item.semanticScore > 0.28) // meaningful threshold for text-embedding-004
      .sort((a, b) => b.semanticScore - a.semanticScore)
      .slice(0, maxCandidates);

    return scored.map((item, idx) => ({
      doc: item.doc,
      semanticScore: item.semanticScore,
      rank: idx + 1,
      matchType: "semantic",
    }));
  } catch (fallbackError) {
    console.error("[Vector Search] Fallback failed:", fallbackError.message);
    return [];
  }
}

/**
 * Combines keyword and semantic search results using Reciprocal Rank Fusion (RRF).
 * RRF formula: RRF_score = W_sem / (k + rank_sem) + W_kw / (k + rank_kw)
 */
function mergeHybridResults(keywordResults, semanticResults, limit = 50) {
  const K = 60; // Standard RRF smoothing constant
  const W_KEYWORD = 1.0;
  const W_SEMANTIC = 1.25;

  const combinedMap = new Map();

  // Process semantic results
  for (const item of semanticResults) {
    const id = item.doc._id.toString();
    const rrfScore = W_SEMANTIC / (K + item.rank);

    combinedMap.set(id, {
      doc: item.doc,
      rrfScore,
      semanticRank: item.rank,
      semanticScore: item.semanticScore || 0,
      keywordRank: null,
      keywordScore: 0,
      matchReasons: ["semantic"],
    });
  }

  // Process keyword results
  for (const item of keywordResults) {
    const id = item.doc._id.toString();
    const rrfScore = W_KEYWORD / (K + item.rank);

    if (combinedMap.has(id)) {
      const existing = combinedMap.get(id);
      existing.rrfScore += rrfScore;
      existing.keywordRank = item.rank;
      existing.keywordScore = item.keywordScore || 0;
      if (!existing.matchReasons.includes("keyword")) {
        existing.matchReasons.push("keyword");
      }
    } else {
      combinedMap.set(id, {
        doc: item.doc,
        rrfScore,
        semanticRank: null,
        semanticScore: 0,
        keywordRank: item.rank,
        keywordScore: item.keywordScore || 0,
        matchReasons: ["keyword"],
      });
    }
  }

  // Convert map to sorted array
  const ranked = Array.from(combinedMap.values());
  ranked.sort((a, b) => b.rrfScore - a.rrfScore);

  return ranked.slice(0, limit).map((item) => {
    // Clean document before returning to client (ensure embedding is excluded)
    const docObj = item.doc.toObject ? item.doc.toObject() : { ...item.doc };
    delete docObj.embedding;

    return {
      ...docObj,
      _searchMetadata: {
        hybridScore: Number(item.rrfScore.toFixed(4)),
        matchReasons: item.matchReasons,
        semanticScore: item.semanticScore
          ? Number(item.semanticScore.toFixed(3))
          : undefined,
      },
    };
  });
}

/**
 * Main Hybrid Search Entry Point.
 */
async function hybridSearch({
  userId,
  query,
  category,
  startDate,
  endDate,
  important,
  page = 1,
  limit = 50,
}) {
  const cleanQuery = (query || "").trim();
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);

  // 1. If query is empty, perform standard filtered fetch
  if (!cleanQuery) {
    const keywordItems = await performKeywordSearch({
      userId,
      query: "",
      category,
      startDate,
      endDate,
      important,
      maxCandidates: parsedLimit * parsedPage,
    });

    const paginated = keywordItems
      .slice((parsedPage - 1) * parsedLimit, parsedPage * parsedLimit)
      .map((item) => {
        const obj = item.doc.toObject ? item.doc.toObject() : item.doc;
        delete obj.embedding;
        return obj;
      });

    return {
      screenshots: paginated,
      total: keywordItems.length,
      page: parsedPage,
      limit: parsedLimit,
      searchType: "filter",
    };
  }

  // 2. Parallel keyword retrieval and query embedding generation
  const [keywordResults, queryVector] = await Promise.all([
    performKeywordSearch({
      userId,
      query: cleanQuery,
      category,
      startDate,
      endDate,
      important,
      maxCandidates: 100,
    }),
    generateEmbedding(cleanQuery).catch((err) => {
      console.warn(
        "[Hybrid Search] Query embedding generation failed:",
        err.message
      );
      return null;
    }),
  ]);

  // 3. If query embedding succeeded, perform semantic search
  let semanticResults = [];
  if (queryVector) {
    semanticResults = await performSemanticSearch({
      userId,
      queryVector,
      category,
      startDate,
      endDate,
      important,
      maxCandidates: 100,
    });
  }

  // 4. Combine and rank using Reciprocal Rank Fusion
  let searchType = "hybrid";
  if (semanticResults.length > 0 && keywordResults.length === 0) {
    searchType = "semantic";
  } else if (semanticResults.length === 0 && keywordResults.length > 0) {
    searchType = "keyword";
  }

  const merged = mergeHybridResults(
    keywordResults,
    semanticResults,
    parsedLimit * parsedPage
  );

  const paginated = merged.slice(
    (parsedPage - 1) * parsedLimit,
    parsedPage * parsedLimit
  );

  return {
    screenshots: paginated,
    total: merged.length,
    page: parsedPage,
    limit: parsedLimit,
    searchType,
    query: cleanQuery,
  };
}

module.exports = {
  hybridSearch,
  performKeywordSearch,
  performSemanticSearch,
  extractQueryKeywords,
};
