require("dotenv").config();

const express = require("express");
const cors = require("cors");
const authenticateToken = require("./middleware/auth");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");
const mongoose = require("mongoose");
const dns = require("dns");
const Screenshot = require("./models/Screenshot");
const User = require("./models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const extractText = require("./utils/ocr");
const { sendPasswordResetEmail, sendWelcomeVerificationEmail } = require("./utils/email");
const { categorizeText } = require("./utils/categorize");
const { extractIntelligence } = require("./utils/intelligence");

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const app = express();
const PORT = 5000;

mongoose
  .connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  })
  .then(() => {
    console.log("MongoDB connected successfully! ✅");
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
  });

app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

app.get("/", (req, res) => {
  res.json({
    message: "SnapMind backend is running 🚀",
  });
});

// Register a new user
// Register a new user
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate an email verification token (only its hash is stored).
    const rawVerifyToken = crypto.randomBytes(32).toString("hex");
    const verifyTokenHash = crypto
      .createHash("sha256")
      .update(rawVerifyToken)
      .digest("hex");

    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      isEmailVerified: false,
      emailVerificationTokenHash: verifyTokenHash,
      emailVerificationExpires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    });

    await user.save();

    const verifyUrl = `${process.env.FRONTEND_URL}/?verifyToken=${rawVerifyToken}`;

    try {
      await sendWelcomeVerificationEmail(user.email, user.name, verifyUrl);
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      // Account still exists; user can request this to be resolved manually,
      // or you can add a "resend verification" endpoint later.
    }

    res.status(201).json({
      success: true,
      message:
        "Account created! Please check your email to verify your account before logging in.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);

    res.status(500).json({
      success: false,
      message: "Could not create account.",
    });
  }
});

// Upload a screenshot (protected — screenshot is tied to the authenticated user)
app.post(
  "/api/upload",
  authenticateToken,
  upload.single("screenshot"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No screenshot received.",
        });
      }

      console.log("Uploading screenshot to Cloudinary...");

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "snapmind/screenshots",
          resource_type: "image",
        },
        async (error, result) => {
          if (error) {
            console.error("Cloudinary error:", error);

            return res.status(500).json({
              success: false,
              message: "Cloudinary upload failed.",
            });
          }

          try {
            console.log("Cloudinary upload successful!");
            console.log("URL:", result.secure_url);

            console.log("Running OCR on screenshot...");

            const extractedText = await extractText(result.secure_url);

            console.log("Extracted text:");
            console.log(extractedText);

            console.log("Classifying screenshot using Gemini AI...");

const category = await categorizeText(
  extractedText,
  req.file.buffer,
  req.file.mimetype
);

console.log("Gemini assigned category:", category);

            console.log("Extracting screenshot intelligence...");

            const aiData = extractIntelligence(
              extractedText,
              category
            );

            console.log("Extracted intelligence:");
            console.log(aiData);

            const screenshot = new Screenshot({
              userId: req.user.userId,
              originalName: req.file.originalname,
              imageUrl: result.secure_url,
              fileType: req.file.mimetype,
              fileSize: req.file.size,
              extractedText: extractedText,
              category: category,
              aiData: aiData,
            });

            await screenshot.save();

            console.log("Screenshot saved to MongoDB! ✅");

            res.json({
              success: true,
              message: "Screenshot uploaded and saved successfully!",
              file: {
                name: req.file.originalname,
                size: req.file.size,
                type: req.file.mimetype,
                url: result.secure_url,
              },
              screenshot,
            });
          } catch (dbError) {
            console.error("MongoDB save error:", dbError);

            res.status(500).json({
              success: false,
              message: "Image uploaded, but MongoDB save failed.",
            });
          }
        }
      );

      streamifier
        .createReadStream(req.file.buffer)
        .pipe(uploadStream);

    } catch (error) {
      console.error("Upload error:", error);

      res.status(500).json({
        success: false,
        message: "Something went wrong while uploading.",
      });
    }
  }
);

// Verify email using the link sent at signup
app.post("/api/auth/verify-email", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Verification token is required.",
      });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "This verification link is invalid or has expired.",
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationTokenHash = null;
    user.emailVerificationExpires = null;

    await user.save();

    res.json({
      success: true,
      message: "Your email has been verified. You can now log in.",
    });
  } catch (error) {
    console.error("Verify email error:", error);

    res.status(500).json({
      success: false,
      message: "Could not verify email.",
    });
  }
});

// Login user
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

        const passwordMatches = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in. Check your inbox for the verification link.",
      });
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.json({
      success: true,
      message: "Login successful!",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      success: false,
      message: "Could not log in.",
    });
  }
});

// Request a password reset email
app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({
      email: normalizedEmail,
    });

    // Same response whether account exists or not
    const genericResponse = {
      success: true,
      message:
        "If an account exists for that email, a password reset link has been sent.",
    };

    if (!user) {
      return res.json(genericResponse);
    }

    // Generate secure reset token
    const rawToken = crypto.randomBytes(32).toString("hex");

    // Store only hashed token in database
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    user.resetPasswordTokenHash = tokenHash;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000;

    await user.save();

    const resetUrl =
      `${process.env.FRONTEND_URL}/?resetToken=${rawToken}`;

    try {
      await sendPasswordResetEmail(user.email, resetUrl);
    } catch (emailError) {
      console.error("Failed to send reset email:", emailError);

      user.resetPasswordTokenHash = null;
      user.resetPasswordExpires = null;

      await user.save();

      // TEMPORARY DEBUG — remove debugMessage/debugCode once this is fixed.
      // Exposes the raw SMTP error so it's easy to read in the Network tab.
      return res.status(500).json({
        success: false,
        message: "Could not send reset email. Please try again.",
        debugMessage: emailError.message,
        debugCode: emailError.code,
      });
    }

    res.json(genericResponse);
  } catch (error) {
    console.error("Forgot password error:", error);

    res.status(500).json({
      success: false,
      message: "Something went wrong.",
    });
  }
});

// Reset password using emailed token
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: "Token and new password are required.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpires: {
        $gt: Date.now(),
      },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "This reset link is invalid or has expired.",
      });
    }

    user.password = await bcrypt.hash(password, 12);

    // Make token single-use
    user.resetPasswordTokenHash = null;
    user.resetPasswordExpires = null;

    await user.save();

    res.json({
      success: true,
      message: "Your password has been reset. You can now log in.",
    });
  } catch (error) {
    console.error("Reset password error:", error);

    res.status(500).json({
      success: false,
      message: "Could not reset password.",
    });
  }
});

// Get all saved screenshots (protected — only the logged-in user's own screenshots)
app.get("/api/screenshots", authenticateToken, async (req, res) => {
  try {
    const screenshots = await Screenshot.find({
      userId: req.user.userId,
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      screenshots,
    });
  } catch (error) {
    console.error("Fetch screenshots error:", error);

    res.status(500).json({
      success: false,
      message: "Could not fetch screenshots.",
    });
  }
});

// Toggle a screenshot's "important" flag (protected — owner only)
app.patch(
  "/api/screenshots/:id/important",
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { important } = req.body;

      const screenshot = await Screenshot.findById(id);

      if (!screenshot) {
        return res.status(404).json({
          success: false,
          message: "Screenshot not found.",
        });
      }

      if (screenshot.userId.toString() !== req.user.userId) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this screenshot.",
        });
      }

      screenshot.important = Boolean(important);

      await screenshot.save();

      res.json({
        success: true,
        screenshot,
      });
    } catch (error) {
      console.error("Update important error:", error);

      res.status(500).json({
        success: false,
        message: "Could not update screenshot.",
      });
    }
  }
);

// Delete a screenshot (protected — owner only)
app.delete(
  "/api/screenshots/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Find the screenshot
      const screenshot = await Screenshot.findById(id);

      if (!screenshot) {
        return res.status(404).json({
          success: false,
          message: "Screenshot not found.",
        });
      }

      // Make sure the screenshot belongs to the logged-in user
      if (screenshot.userId.toString() !== req.user.userId) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to delete this screenshot.",
        });
      }

      // Delete image from Cloudinary
      if (screenshot.imageUrl) {
        try {
          // Extract Cloudinary public_id from the URL
          const urlParts = screenshot.imageUrl.split("/");

          const uploadIndex = urlParts.indexOf("upload");

          if (uploadIndex !== -1) {
            let publicIdWithExtension = urlParts
              .slice(uploadIndex + 2)
              .join("/");

            // Remove file extension
            publicIdWithExtension = publicIdWithExtension.replace(
              /\.[^/.]+$/,
              ""
            );

            await cloudinary.uploader.destroy(publicIdWithExtension, {
              resource_type: "image",
            });

            console.log(
              "Cloudinary image deleted:",
              publicIdWithExtension
            );
          }
        } catch (cloudinaryError) {
          // Don't stop MongoDB deletion if Cloudinary deletion fails
          console.error(
            "Cloudinary deletion failed:",
            cloudinaryError.message
          );
        }
      }

      // Delete screenshot from MongoDB
      await Screenshot.findByIdAndDelete(id);

      console.log("Screenshot deleted from MongoDB:", id);

      res.json({
        success: true,
        message: "Screenshot deleted successfully.",
        deletedId: id,
      });
    } catch (error) {
      console.error("Delete screenshot error:", error);

      res.status(500).json({
        success: false,
        message: "Could not delete screenshot.",
      });
    }
  }
);

app.use((error, req, res, next) => {
  console.error("SERVER ERROR:", error);

  res.status(400).json({
    success: false,
    message: error.message,
  });
});

app.listen(PORT, () => {
  console.log(`SnapMind server running on http://localhost:${PORT}`);
});