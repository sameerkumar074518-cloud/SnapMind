const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const ALLOWED_CATEGORIES = [
  "Study",
  "Work",
  "Shopping",
  "Social",
  "Entertainment",
  "Finance",
  "News",
  "Travel",
  "Sports",
  "Personal",
  "Security",
  "Technology",
  "Other",
];

// Groq's OpenAI-compatible chat completions endpoint. Used as the
// secondary vision classifier when Gemini is unavailable (rate limit,
// outage, account/project errors, etc). Requires GROQ_API_KEY.
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
// meta-llama/llama-4-scout-17b-16e-instruct was retired from Groq's
// vision lineup — qwen/qwen3.8-27b is the current supported
// multimodal (image + text) model as of Groq's docs.
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b";

// Groq rejects base64-encoded image requests larger than 4MB.
const GROQ_MAX_BASE64_BYTES = 4 * 1024 * 1024;

/**
 * Builds the shared multimodal classification prompt used by both
 * Gemini and Groq, so the two providers are held to the same
 * instructions and stay consistent with each other.
 *
 * KEY CHANGE: this now asks for a short burst of visual reasoning
 * BEFORE the category, instead of forcing an instant one-word answer.
 * A full chat assistant (Claude/ChatGPT) reasons over the image and
 * text together before committing to a conclusion — a bare
 * "return only the category" prompt throws that reasoning away and
 * makes the model pattern-match instead of actually looking. Letting
 * it "think out loud" for 1-2 sentences first, then state the
 * category on its own final line, recovers most of that benefit
 * while still giving us a single line we can reliably parse.
 */
function buildClassificationPrompt(extractedText) {
  return `
You are an expert screenshot classifier for a screenshot-memory app.

STEP 1 — LOOK: Examine the IMAGE itself first — the app or website,
people, objects, logos, UI, scenes, products, or documents shown.
Use the OCR text below only as secondary, supporting evidence to
confirm or refine what you see; never classify from OCR keywords
alone, especially when the image contains little or no text.

STEP 2 — THINK: In 1-2 short sentences, describe what the screenshot
is fundamentally ABOUT — its main subject or purpose (not an isolated
UI word like "pass", "ticket", or "card" — ask what that item is FOR).
If the image and OCR text conflict, trust the image unless the OCR
text unambiguously names a specific app/brand/subject (e.g. "Netflix",
"OTP", "cricket") that the image alone doesn't make clear.

STEP 3 — CLASSIFY: Pick exactly ONE category from this list:

- Study: education — lectures, exams, assignments, notes, textbooks, courses.
- Work: professional/business — meetings, workplace docs, office tools, projects.
- Shopping: retail products, stores, carts, orders, checkout for physical goods.
- Social: social/messaging apps and feeds — Instagram, WhatsApp, Discord, chats.
- Entertainment: movies, TV, music, YouTube, streaming, or general (non-sport) games.
- Finance: banking, UPI/payments, transactions, investments, cards, balances.
- News: news sites, articles, headlines, journalism.
- Travel: flights, hotels, bookings, maps, trip planning.
- Sports: anything whose core subject is a real-world sport (cricket, football,
  basketball, tennis, etc.) — teams, players, matches, stadiums, scoreboards,
  sports apps/games, fantasy sports, and sport-themed passes/tickets/invites.
  A sports video game or an esports/sports-branded pass is Sports, not
  Entertainment or Shopping, because the subject matter is the sport.
- Personal: personal photos, family/friends, memories, personal documents.
- Security: passwords, OTPs, 2FA, verification, login/account-security screens.
- Technology: code, GitHub, dev tools, software/hardware, AI, technical docs.
- Other: only if, after considering the image and OCR together, there is
  genuinely no identifiable main subject. Last resort — use rarely.

OCR TEXT (supporting evidence only):
${extractedText || "(none detected)"}

OUTPUT FORMAT (strict):
Line 1: your 1-2 sentence reasoning from STEP 2.
Line 2: exactly "CATEGORY: <name>" where <name> is one category from
the list above, with no extra words, punctuation, or explanation on
that line.
`.trim();
}

/**
 * Parses a model response that ends with a "CATEGORY: <name>" line
 * (see buildClassificationPrompt) and matches it against
 * ALLOWED_CATEGORIES. Falls back to scanning the whole response for a
 * category name if the model didn't follow the exact format, so a
 * missing "CATEGORY:" prefix doesn't waste a perfectly good answer.
 *
 * Shared by both the Gemini and Groq code paths so response parsing
 * behaves identically regardless of which provider answered.
 *
 * Returns the matched category name, or null if nothing matched.
 */
function parseCategoryResponse(rawText, providerLabel) {
  if (!rawText) return null;

  const cleanLine = (line) =>
    line
      .replace(/```/g, "")
      .replace(/^category\s*:\s*/i, "")
      .replace(/["']/g, "")
      .replace(/[.:;]+$/g, "")
      .trim();

  const matchAgainstCategories = (text) => {
    const exactMatch = ALLOWED_CATEGORIES.find(
      (item) => item.toLowerCase() === text.toLowerCase()
    );
    if (exactMatch) return exactMatch;

    // Model sometimes wraps the category in extra words. Prefer the
    // LONGEST matching category name to avoid a short category name
    // accidentally matching inside a longer one.
    const detected = ALLOWED_CATEGORIES.filter((item) =>
      text.toLowerCase().includes(item.toLowerCase())
    ).sort((a, b) => b.length - a.length);

    return detected.length > 0 ? detected[0] : null;
  };

  // Prefer the explicit "CATEGORY: <name>" line — this is the line we
  // asked for, so check it first regardless of what reasoning text
  // precedes it.
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const categoryLine = [...lines].reverse().find((l) => /^category\s*:/i.test(l));

  if (categoryLine) {
    const matched = matchAgainstCategories(cleanLine(categoryLine));
    if (matched) {
      console.log(`${providerLabel} category (from CATEGORY line):`, matched);
      return matched;
    }
  }

  // Fallback: no well-formed "CATEGORY:" line found — scan the last
  // line, then the whole response, for a valid category name instead
  // of discarding an otherwise-usable answer.
  const lastLine = lines[lines.length - 1] || "";
  const matchedLastLine = matchAgainstCategories(cleanLine(lastLine));
  if (matchedLastLine) {
    console.log(`${providerLabel} category (from last line):`, matchedLastLine);
    return matchedLastLine;
  }

  const matchedAnywhere = matchAgainstCategories(cleanLine(rawText.replace(/\n/g, " ")));
  if (matchedAnywhere) {
    console.log(`${providerLabel} category (fuzzy match, full text):`, matchedAnywhere);
    return matchedAnywhere;
  }

  console.warn(`${providerLabel} returned an invalid/unrecognized category:`, rawText);
  return null;
}

/**
 * Primary classifier: Gemini multimodal (image + OCR text).
 * Throws on any failure so the caller can fall through to Groq.
 */
async function classifyWithGemini(prompt, base64Image, mimeType) {
  const response = await ai.models.generateContent({
    model: process.env.CLASSIFIER_MODEL || "gemini-2.5-flash",

    contents: [
      {
        inlineData: {
          mimeType: mimeType || "image/jpeg",
          data: base64Image,
        },
      },
      {
        text: prompt,
      },
    ],
  });

  const rawText = response.text?.trim();
  console.log("Gemini raw response:", rawText);

  if (!rawText) {
    throw new Error("Gemini returned an empty response");
  }

  const matched = parseCategoryResponse(rawText, "Gemini");

  if (!matched) {
    throw new Error(`Gemini returned an unrecognized category: ${rawText}`);
  }

  return matched;
}

/**
 * Secondary classifier: Groq (Llama 4 Scout vision), used only when
 * Gemini is unavailable. Groq exposes an OpenAI-compatible chat
 * completions endpoint, so this uses a plain fetch call rather than
 * pulling in an extra SDK dependency.
 *
 * Throws on any failure so the caller can fall through to the
 * OCR-only regex fallback.
 */
async function classifyWithGroq(prompt, base64Image, mimeType) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set");
  }

  // Groq rejects base64 image payloads over 4MB — fail fast instead of
  // spending a request that's guaranteed to 413.
  const approxBytes = Math.ceil((base64Image.length * 3) / 4);
  if (approxBytes > GROQ_MAX_BASE64_BYTES) {
    throw new Error(
      `Image too large for Groq base64 upload (~${(approxBytes / 1024 / 1024).toFixed(
        1
      )}MB, limit 4MB)`
    );
  }

  const response = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_VISION_MODEL,
      temperature: 0,
      // qwen3.8 supports tunable reasoning effort. We already ask for
      // a short reasoning sentence directly in the prompt, so the
      // model's own extended "thinking" mode is unnecessary overhead
      // here — disable it for faster, more predictable output.
      reasoning_effort: "none",
      // Raised from 20 -> 150: the prompt now asks for a short
      // reasoning sentence before the CATEGORY line, so a tight
      // token cap would truncate the answer before it gets there.
      max_tokens: 150,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType || "image/jpeg"};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `Groq API request failed (${response.status}): ${errorBody || response.statusText}`
    );
  }

  const data = await response.json();
  const rawText = data?.choices?.[0]?.message?.content?.trim();

  console.log("Groq raw response:", rawText);

  if (!rawText) {
    throw new Error("Groq returned an empty response");
  }

  const matched = parseCategoryResponse(rawText, "Groq");

  if (!matched) {
    throw new Error(`Groq returned an unrecognized category: ${rawText}`);
  }

  return matched;
}

/**
 * AI-powered multimodal screenshot classification.
 *
 * Tries providers in order, each analyzing the actual image visually
 * with OCR text as supporting context, and each reasoning briefly
 * before committing to a category (see buildClassificationPrompt):
 *   1. Gemini (primary)
 *   2. Groq / Llama 4 Scout vision (secondary — only used if Gemini fails)
 *   3. OCR-only regex fallback (last resort — no image analysis)
 *
 * This means a Gemini outage, rate limit, or account issue no longer
 * dumps every screenshot into "Other" — Groq picks up the slack as
 * long as GROQ_API_KEY is configured.
 */
async function categorizeText(extractedText, imageBuffer, mimeType) {
  if (!imageBuffer) {
    console.warn("No image buffer received. Using OCR fallback.");
    return fallbackCategory(extractedText);
  }

  const base64Image = imageBuffer.toString("base64");
  const prompt = buildClassificationPrompt(extractedText);

  // --------------------------------------------------
  // 1. PRIMARY: GEMINI
  // --------------------------------------------------

  if (process.env.GEMINI_API_KEY) {
    try {
      return await classifyWithGemini(prompt, base64Image, mimeType);
    } catch (error) {
      console.error("Gemini categorization error:", error.message);
    }
  } else {
    console.warn("GEMINI_API_KEY is missing. Skipping Gemini.");
  }

  // --------------------------------------------------
  // 2. SECONDARY: GROQ (only reached if Gemini was skipped or failed)
  // --------------------------------------------------

  if (process.env.GROQ_API_KEY) {
    try {
      const category = await classifyWithGroq(prompt, base64Image, mimeType);
      console.log("Classified via Groq fallback:", category);
      return category;
    } catch (error) {
      console.error("Groq categorization error:", error.message);
    }
  } else {
    console.warn("GROQ_API_KEY is missing. Skipping Groq fallback.");
  }

  // --------------------------------------------------
  // 3. LAST RESORT: OCR-ONLY REGEX FALLBACK
  // --------------------------------------------------

  console.warn("All AI classifiers unavailable. Using OCR fallback.");
  return fallbackCategory(extractedText);
}

/**
 * ----------------------------------------------------
 * FALLBACK CATEGORY
 * ----------------------------------------------------
 *
 * Used when:
 * - Both Gemini and Groq are unavailable, unconfigured, or fail
 * - Image is unavailable
 *
 * This fallback uses OCR text only, so it is intentionally
 * more conservative than the multimodal AI paths. Checks
 * are ordered so that highly specific / unambiguous domains
 * (Sports, Security, Finance, Technology, Study) are tested
 * before broader, easily-confused categories (Work, News,
 * Personal), reducing false positives from generic words like
 * "report" or "login" that can appear across many domains.
 */

function fallbackCategory(text = "") {
  const value = text.toLowerCase();

  // --------------------------------------------------
  // SPORTS (checked early: sport-specific terms are highly
  // distinctive and should win over generic words like
  // "pass", "ticket", "beta", "card" that might otherwise
  // fall through to Other or Shopping)
  // --------------------------------------------------

  if (
    /cricket|football|soccer|basketball|tennis|badminton|hockey|volleyball|baseball|rugby|sports?\b|player|match\b|stadium|scoreboard|score card|scorecard|\bteam\b|tournament|league\b|\bipl\b|fifa|uefa|champions league|premier league|\bgoal\b|wicket|bowler|batsman|batter|innings|overs|athlete|olympics|marathon|esports|fantasy (cricket|football|sports)|beta pass|game pass/.test(
      value
    )
  ) {
    return "Sports";
  }

  // --------------------------------------------------
  // SECURITY
  // --------------------------------------------------

  if (
    /\botp\b|password|authentication|two-factor|2fa|verification code|verify your (account|identity)|passcode|captcha|security (code|alert|settings)|suspicious login|unauthorized access/.test(
      value
    )
  ) {
    return "Security";
  }

  // --------------------------------------------------
  // FINANCE
  // --------------------------------------------------

  if (
    /\bbank\b|payment|\bupi\b|transaction|account balance|credit card|debit card|investment|\bstock\b|mutual fund|\bloan\b|finance|wallet balance|paytm|phonepe|gpay|google pay|net banking|ifsc|nse|bse|crypto|bitcoin/.test(
      value
    )
  ) {
    return "Finance";
  }

  // --------------------------------------------------
  // TECHNOLOGY
  // --------------------------------------------------

  if (
    /github|programming|source code|javascript|typescript|\breact\b|python|\bjava\b|software|\bcomputer\b|technology|developer|coding|terminal|\bapi\b|database|\bhtml\b|\bcss\b|node\.js|\bnpm\b|\bgit\b|\bide\b|compiler|algorithm|machine learning|artificial intelligence/.test(
      value
    )
  ) {
    return "Technology";
  }

  // --------------------------------------------------
  // STUDY
  // --------------------------------------------------

  if (
    /\bexam\b|assignment|lecture|\bcourse\b|\bstudent\b|college|university|\bstudy\b|study notes|question paper|homework|education|classroom|tutorial|textbook|syllabus|semester|\bgpa\b/.test(
      value
    )
  ) {
    return "Study";
  }

  // --------------------------------------------------
  // SHOPPING
  // --------------------------------------------------

  if (
    /amazon|flipkart|\bcart\b|buy now|\border\b|\bproduct\b|shopping|\bprice\b|₹|\$\d|checkout|delivery|wishlist|add to cart|myntra|online store/.test(
      value
    )
  ) {
    return "Shopping";
  }

  // --------------------------------------------------
  // ENTERTAINMENT
  // --------------------------------------------------

  if (
    /netflix|prime video|hotstar|\byoutube\b|spotify|\bmovie\b|\bseries\b|\bmusic\b|\bgame\b|gaming|\bfilm\b|episode|watch now|trailer|playlist|streaming/.test(
      value
    )
  ) {
    return "Entertainment";
  }

  // --------------------------------------------------
  // TRAVEL
  // --------------------------------------------------

  if (
    /\bflight\b|\bhotel\b|booking\.com|\bairport\b|\btravel\b|tourism|\btrip\b|\btrain\b|\bbus\b|\bticket\b|destination|airline|boarding pass|itinerary/.test(
      value
    )
  ) {
    return "Travel";
  }

  // --------------------------------------------------
  // SOCIAL
  // --------------------------------------------------

  if (
    /instagram|facebook|whatsapp|discord|telegram|messenger|\bsocial\b|snapchat|\btwitter\b|x\.com|linkedin|\bchat\b|\bmessage\b|\bdm\b|direct message/.test(
      value
    )
  ) {
    return "Social";
  }

  // --------------------------------------------------
  // NEWS
  // --------------------------------------------------

  if (
    /breaking news|latest news|\bnews\b|headline|newspaper|journalist|\bpolitics\b|\barticle\b/.test(
      value
    )
  ) {
    return "News";
  }

  // --------------------------------------------------
  // WORK
  // --------------------------------------------------

  if (
    /\bmeeting\b|\bbusiness\b|\boffice\b|\bwork\b|\bproject\b|\bemployee\b|\bmanager\b|presentation|\bdeadline\b|\btask\b|\bcompany\b|professional|\bclient\b|invoice/.test(
      value
    )
  ) {
    return "Work";
  }

  // --------------------------------------------------
  // PERSONAL
  // --------------------------------------------------

  if (
    /\bfamily\b|\bfriend\b|birthday|\bpersonal\b|\bmemory\b|memories|vacation photo|\bselfie\b/.test(
      value
    )
  ) {
    return "Personal";
  }

  // --------------------------------------------------
  // DEFAULT
  // --------------------------------------------------

  return "Other";
}

module.exports = {
  categorizeText,
  ALLOWED_CATEGORIES,
};