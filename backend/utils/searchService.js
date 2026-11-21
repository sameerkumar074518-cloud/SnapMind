
const mongoose = require("mongoose");
const Screenshot = require("../models/Screenshot");
const { generateEmbedding, cosineSimilarity } = require("./embeddings");

// Configurable relevance thresholds.
// Atlas scores and in-memory cosine scores use different scales.
const MIN_ATLAS_VECTOR_SCORE = Number(
  process.env.MIN_ATLAS_VECTOR_SCORE || 0.65
);

const MIN_COSINE_SIMILARITY = Number(
  process.env.MIN_COSINE_SIMILARITY || 0.28
);

// Words that don't carry much search meaning.
const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
  "has", "he", "in", "is", "it", "its", "of", "on", "that", "the",
  "to", "was", "were", "will", "with", "find", "show", "me", "my",
  "get", "search", "saved", "screenshot", "screenshots", "image",
  "images", "pic", "pics", "photo", "photos", "looking", "please"
]);

/**
 * Extract meaningful keywords from a search query.
 */
function extractQueryKeywords(query) {
  if (!query) return [];

  return [
    ...new Set(
      query
        .toLowerCase()
        .replace(/[^a-z0-9\s]/gi, " ")
        .split(/\s+/)
        .filter(
          (token) => token.length > 1 && !STOP_WORDS.has(token)
        )
    ),
  ];
}

/**
 * Escape special regex characters.
 */
function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

/**
 * Build a searchable string from screenshot information.
 */
function getSearchableText(doc) {
  const aiData = doc.aiData || {};

  return [
    doc.originalName,
    doc.extractedText,
    doc.category,
    aiData.title,
    aiData.location,
    aiData.orderId,
    aiData.amount,
    aiData.date,
    aiData.email,
    aiData.phone,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * Build common filters for screenshot searches.
 */
function buildBaseFilter({
  userId,
  category,
  startDate,
  endDate,
  important,
}) {
  const filter = {
    userId: new mongoose.Types.ObjectId(userId),
  };

  if (category && category !== "All") {
    filter.category = category;
  }

  if (typeof important === "boolean") {
    filter.important = important;
  }

  if (startDate || endDate) {
    filter.createdAt = {};

    if (startDate) {
      filter.createdAt.$gte = new Date(startDate);
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  return filter;
}

/**
 * Performs keyword search.
 *
 * For multiword searches, a document must match at least
 * half of the meaningful query keywords.
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
  const baseFilter = buildBaseFilter({
    userId,
    category,
    startDate,
    endDate,
    important,
  });

  const cleanQuery = query ? query.trim() : "";

  // Empty query: return recent screenshots.
  if (!cleanQuery) {
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

  if (keywords.length === 0) {
    return [];
  }

  const escapedFull = escapeRegex(cleanQuery);
  const fullRegex = new RegExp(escapedFull, "i");

  const matchConditions = [
    { originalName: fullRegex },
    { extractedText: fullRegex },
    { category: fullRegex },
    { "aiData.title": fullRegex },
    { "aiData.location": fullRegex },
    { "aiData.orderId": fullRegex },
    { "aiData.amount": fullRegex },
    { "aiData.date": fullRegex },
    { "aiData.email": fullRegex },
    { "aiData.phone": fullRegex },
  ];

  // Individual keyword matches.
  for (const keyword of keywords) {
    const keywordRegex = new RegExp(
      `\\b${escapeRegex(keyword)}`,
      "i"
    );

    matchConditions.push(
      { originalName: keywordRegex },
      { extractedText: keywordRegex },
      { category: keywordRegex },
      { "aiData.title": keywordRegex },
      { "aiData.location": keywordRegex },
      { "aiData.orderId": keywordRegex },
      { "aiData.amount": keywordRegex },
      { "aiData.date": keywordRegex },
      { "aiData.email": keywordRegex },
      { "aiData.phone": keywordRegex }
    );
  }

  const matchedDocs = await Screenshot.find({
    ...baseFilter,
    $or: matchConditions,
  }).limit(maxCandidates * 3);

  const requiredMatches = Math.max(
    1,
    Math.ceil(keywords.length * 0.5)
  );

  const scored = matchedDocs.map((doc) => {
    let score = 0;

    const name = (doc.originalName || "").toLowerCase();
    const ocr = (doc.extractedText || "").toLowerCase();
    const categoryText = (doc.category || "").toLowerCase();
    const aiData = doc.aiData || {};

    const title = (aiData.title || "").toLowerCase();
    const location = (aiData.location || "").toLowerCase();
    const orderId = (aiData.orderId || "").toLowerCase();
    const amount = String(aiData.amount || "").toLowerCase();
    const date = String(aiData.date || "").toLowerCase();
    const email = (aiData.email || "").toLowerCase();
    const phone = String(aiData.phone || "").toLowerCase();

    const qLower = cleanQuery.toLowerCase();

    if (name.includes(qLower)) score += 100;
    if (ocr.includes(qLower)) score += 60;
    if (title.includes(qLower)) score += 80;
    if (categoryText.includes(qLower)) score += 30;

    const searchableText = getSearchableText(doc);

    const matchedKeywords = keywords.filter((keyword) =>
      searchableText.includes(keyword)
    );

    for (const keyword of matchedKeywords) {
      if (name.includes(keyword)) score += 20;
      if (ocr.includes(keyword)) score += 10;
      if (categoryText.includes(keyword)) score += 15;
      if (title.includes(keyword)) score += 20;
      if (location.includes(keyword)) score += 15;
      if (orderId.includes(keyword)) score += 15;
      if (amount.includes(keyword)) score += 15;
      if (date.includes(keyword)) score += 15;
      if (email.includes(keyword)) score += 15;
      if (phone.includes(keyword)) score += 15;
    }

    return {
      doc,
      keywordScore: score,
      matchedKeywordCount: matchedKeywords.length,
    };
  });

  // Reject weak matches that only contain one unrelated query word.
  const relevantResults = scored.filter(
    (item) =>
      item.keywordScore > 0 &&
      item.matchedKeywordCount >= requiredMatches
  );

  relevantResults.sort(
    (a, b) => b.keywordScore - a.keywordScore
  );

  return relevantResults.slice(0, maxCandidates).map((item, idx) => ({
    doc: item.doc,
    keywordScore: item.keywordScore,
    rank: idx + 1,
    matchType: "keyword",
  }));
}

/**
 * Performs semantic vector search.
 *
 * Tries MongoDB Atlas Vector Search first.
 * Uses in-memory cosine similarity if Atlas is unavailable.
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
  if (
    !Array.isArray(queryVector) ||
    queryVector.length !== 768
  ) {
    console.warn("[Vector Search] Invalid query vector.");
    return [];
  }

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const atlasIndexName =
    process.env.ATLAS_VECTOR_INDEX || "vector_index";

  // 1. Try MongoDB Atlas Vector Search.
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
          queryVector,
          numCandidates: Math.max(maxCandidates * 5, 200),
          limit: maxCandidates,
          filter: vectorFilter,
        },
      },
      {
        $project: {
          _id: 1,
          vectorScore: {
            $meta: "vectorSearchScore",
          },
        },
      },
    ];

    const atlasResults = await Screenshot.aggregate(pipeline);

    if (Array.isArray(atlasResults) && atlasResults.length > 0) {
      const ids = atlasResults.map((item) => item._id);

      const docs = await Screenshot.find({
        _id: { $in: ids },
      });

      const docMap = new Map(
        docs.map((doc) => [doc._id.toString(), doc])
      );

      const results = [];

      for (const item of atlasResults) {
        const doc = docMap.get(item._id.toString());

        if (!doc) continue;

        // Apply additional filters.
        if (
          typeof important === "boolean" &&
          doc.important !== important
        ) {
          continue;
        }

        if (
          startDate &&
          new Date(doc.createdAt) < new Date(startDate)
        ) {
          continue;
        }

        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);

          if (new Date(doc.createdAt) > end) {
            continue;
          }
        }

        const score = Number(item.vectorScore) || 0;

        // Reject weak Atlas matches.
        if (score < MIN_ATLAS_VECTOR_SCORE) {
          continue;
        }

        results.push({
          doc,
          semanticScore: score,
          rank: results.length + 1,
          matchType: "semantic",
        });
      }

      console.log(
        `[Vector Search] Atlas returned ${results.length} relevant results.`
      );

      // Atlas successfully returned candidates.
      // Do not add unrelated fallback results.
      return results;
    }

    console.info(
      "[Vector Search] Atlas returned no candidates. Trying fallback."
    );
  } catch (atlasError) {
    console.info(
      "[Vector Search] Atlas unavailable. Using in-memory fallback:",
      atlasError.message
    );
  }

  // 2. In-memory cosine similarity fallback.
  try {
    const fallbackFilter = {
      userId: userObjectId,
      embedding: {
        $exists: true,
        $ne: [],
      },
    };

    if (category && category !== "All") {
      fallbackFilter.category = category;
    }

    if (typeof important === "boolean") {
      fallbackFilter.important = important;
    }

    if (startDate || endDate) {
      fallbackFilter.createdAt = {};

      if (startDate) {
        fallbackFilter.createdAt.$gte = new Date(startDate);
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        fallbackFilter.createdAt.$lte = end;
      }
    }

    const candidates = await Screenshot.find(fallbackFilter)
      .select("+embedding")
      .limit(300);

    if (!candidates.length) {
      return [];
    }

    const scored = candidates
      .filter(
        (doc) =>
          Array.isArray(doc.embedding) &&
          doc.embedding.length === queryVector.length
      )
      .map((doc) => ({
        doc,
        semanticScore: cosineSimilarity(
          queryVector,
          doc.embedding
        ),
      }))
      .filter(
        (item) =>
          item.semanticScore >= MIN_COSINE_SIMILARITY
      )
      .sort(
        (a, b) => b.semanticScore - a.semanticScore
      )
      .slice(0, maxCandidates);

    console.log(
      `[Vector Search] In-memory fallback returned ${scored.length} relevant results.`
    );

    return scored.map((item, idx) => ({
      doc: item.doc,
      semanticScore: item.semanticScore,
      rank: idx + 1,
      matchType: "semantic",
    }));
  } catch (fallbackError) {
    console.error(
      "[Vector Search] Fallback failed:",
      fallbackError.message
    );

    return [];
  }
}

/**
 * Combines keyword and semantic results using
 * Reciprocal Rank Fusion (RRF).
 */
function mergeHybridResults(
  keywordResults,
  semanticResults,
  limit = 50
) {
  const K = 60;
  const W_KEYWORD = 1.0;
  const W_SEMANTIC = 1.25;

  const combinedMap = new Map();

  // Add semantic results.
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

  // Add keyword results.
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

  const ranked = Array.from(combinedMap.values());

  ranked.sort((a, b) => b.rrfScore - a.rrfScore);

  return ranked.slice(0, limit).map((item) => {
    const docObj = item.doc.toObject
      ? item.doc.toObject()
      : { ...item.doc };

    delete docObj.embedding;

    return {
      ...docObj,
      _searchMetadata: {
        hybridScore: Number(item.rrfScore.toFixed(4)),
        matchReasons: item.matchReasons,
        semanticScore: Number(
          item.semanticScore.toFixed(3)
        ),
      },
    };
  });
}

/**
 * Main hybrid search entry point.
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

  const parsedLimit = Math.min(
    Math.max(parseInt(limit, 10) || 50, 1),
    100
  );

  const parsedPage = Math.max(
    parseInt(page, 10) || 1,
    1
  );

  // 1. Empty query: return filtered screenshots.
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
      .slice(
        (parsedPage - 1) * parsedLimit,
        parsedPage * parsedLimit
      )
      .map((item) => {
        const obj = item.doc.toObject
          ? item.doc.toObject()
          : { ...item.doc };

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

  // 2. Run keyword search and query embedding in parallel.
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

    generateEmbedding(cleanQuery, "query").catch((error) => {
      console.warn(
        "[Hybrid Search] Query embedding failed:",
        error.message
      );

      return null;
    }),
  ]);

  // 3. Run semantic search when query embedding is available.
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

  // 4. Combine results using RRF.
  let searchType = "hybrid";

  if (
    semanticResults.length > 0 &&
    keywordResults.length === 0
  ) {
    searchType = "semantic";
  } else if (
    semanticResults.length === 0 &&
    keywordResults.length > 0
  ) {
    searchType = "keyword";
  } else if (
    semanticResults.length === 0 &&
    keywordResults.length === 0
  ) {
    searchType = "no-results";
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

  console.log(
    `[Hybrid Search] Query: "${cleanQuery}" | Keywords: ${keywordResults.length} | Semantic: ${semanticResults.length} | Final: ${merged.length}`
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
