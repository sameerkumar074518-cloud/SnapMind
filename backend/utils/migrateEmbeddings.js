require("dotenv").config();
const mongoose = require("mongoose");
const Screenshot = require("../models/Screenshot");
const { buildScreenshotEmbeddingText, generateEmbedding } = require("./embeddings");

/**
 * Migrates screenshots that do not currently have an embedding.
 * Safe and idempotent: only processes documents where embedding is missing or empty.
 */
async function migrateMissingEmbeddings({ batchSize = 10, maxDocs = 500, delayMs = 250 } = {}) {
  const query = {
    $or: [
      { embedding: { $exists: false } },
      { embedding: null },
      { embedding: { $size: 0 } },
    ],
  };

  const totalMissing = await Screenshot.countDocuments(query);
  console.log(`[Migration] Found ${totalMissing} screenshots missing embeddings.`);

  if (totalMissing === 0) {
    return {
      totalMissing: 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
      remaining: 0,
    };
  }

  const docsToProcess = await Screenshot.find(query)
    .limit(maxDocs)
    .sort({ createdAt: -1 });

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  console.log(`[Migration] Beginning processing for up to ${docsToProcess.length} screenshots...`);

  for (let i = 0; i < docsToProcess.length; i += batchSize) {
    const batch = docsToProcess.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (doc) => {
        processed++;
        try {
          const text = buildScreenshotEmbeddingText(doc);
          if (!text) {
            console.log(`[Migration] Doc ${doc._id} has no text content; skipping.`);
            return;
          }

          const vector = await generateEmbedding(text);
          if (vector && Array.isArray(vector) && vector.length > 0) {
            await Screenshot.updateOne(
              { _id: doc._id },
              { $set: { embedding: vector } }
            );
            succeeded++;
          } else {
            failed++;
            console.warn(`[Migration] Doc ${doc._id}: embedding generation returned empty.`);
          }
        } catch (err) {
          failed++;
          console.error(`[Migration] Error processing doc ${doc._id}:`, err.message);
        }
      })
    );

    if (i + batchSize < docsToProcess.length && delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  const remaining = await Screenshot.countDocuments(query);
  console.log(
    `[Migration] Completed. Processed: ${processed}, Succeeded: ${succeeded}, Failed: ${failed}, Remaining: ${remaining}`
  );

  return {
    totalMissing,
    processed,
    succeeded,
    failed,
    remaining,
  };
}

// Standalone CLI runner
if (require.main === module) {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI or MONGO_URI is required to run migration.");
    process.exit(1);
  }

  mongoose
    .connect(mongoUri)
    .then(async () => {
      console.log("Connected to MongoDB for embedding migration.");
      const result = await migrateMissingEmbeddings({
        batchSize: 5,
        maxDocs: 1000,
        delayMs: 300,
      });
      console.log("Migration summary:", result);
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error("Migration script failed:", err);
      process.exit(1);
    });
}

module.exports = {
  migrateMissingEmbeddings,
};
