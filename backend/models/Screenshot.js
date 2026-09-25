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
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Screenshot", screenshotSchema);