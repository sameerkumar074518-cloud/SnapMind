const mongoose = require("mongoose");

const screenshotSchema = new mongoose.Schema(
  {
    // User who owns this screenshot
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    originalName: {
      type: String,
      required: true,
    },

    imageUrl: {
      type: String,
      required: true,
    },

    fileType: {
      type: String,
      required: true,
    },

    fileSize: {
      type: Number,
      required: true,
    },

    category: {
      type: String,
      default: "Other",
    },

    extractedText: {
      type: String,
      default: "",
    },

    aiData: {
      type: Object,
      default: {},
    },

    important: {
      type: Boolean,
      default: false,
    },

    // 768-dimensional vector embedding for semantic vector search
    // Excluded from default queries to avoid transmitting large arrays over the wire
    embedding: {
      type: [Number],
      select: false,
      default: undefined,
    },
  },
  {
    timestamps: true,
  }
);

// Optimize query performance with indexes
screenshotSchema.index({ userId: 1, createdAt: -1 });
screenshotSchema.index({ userId: 1, category: 1 });
screenshotSchema.index({
  originalName: "text",
  extractedText: "text",
  category: "text",
});

module.exports = mongoose.model("Screenshot", screenshotSchema);