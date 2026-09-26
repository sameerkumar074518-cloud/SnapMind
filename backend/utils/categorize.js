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

/**
 * AI-powered multimodal screenshot classification.
 *
 * Gemini analyzes:
 * 1. The actual image visually
 * 2. OCR extracted text
 * 3. Overall context
 *
 * Visual understanding is prioritized over OCR.
 */
async function categorizeText(extractedText, imageBuffer, mimeType) {
  try {
    // --------------------------------------------------
    // GEMINI API KEY CHECK
    // --------------------------------------------------

    if (!process.env.GEMINI_API_KEY) {
      console.warn(
        "GEMINI_API_KEY is missing. Using fallback category."
      );

      return fallbackCategory(extractedText);
    }

    if (!imageBuffer) {
      console.warn(
        "No image buffer received. Using OCR fallback."
      );

      return fallbackCategory(extractedText);
    }

    // --------------------------------------------------
    // CONVERT IMAGE TO BASE64
    // --------------------------------------------------

    const base64Image = imageBuffer.toString("base64");

    // --------------------------------------------------
    // MULTIMODAL CLASSIFICATION PROMPT
    // --------------------------------------------------
    //
    // Kept concise on purpose: long, example-heavy prompts tend to make
    // the model pattern-match on keywords/examples rather than actually
    // reasoning about the screenshot's core subject. This version leads
    // with a clear visual-first instruction, gives tight one-line
    // category definitions, and states the few genuinely tricky
    // disambiguation rules (sports vs. generic gaming/shopping/other)
    // explicitly instead of via long example lists.

    const prompt = `
You are an expert screenshot classifier for a screenshot-memory app.

TASK: Look at the IMAGE first. Identify what it is fundamentally
ABOUT (its main subject/purpose) — the app or website, the people,
objects, logos, UI, scenes, or documents shown. Use the OCR text
below only as secondary, supporting evidence to confirm or refine
what you see; never classify from OCR keywords alone, especially
when the image contains little or no text.

If the image and OCR text ever conflict, trust the image unless the
OCR text unambiguously names a specific app/brand/subject (e.g.
"Netflix", "OTP", "cricket") that the image alone doesn't make clear.

Pick exactly ONE category from this list, choosing the one that best
matches the screenshot's core subject as a whole (not an isolated UI
word like "pass", "ticket", or "card" — ask what that item is FOR):

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

Respond with ONLY the single category name from the list above.
No punctuation, no explanation, no JSON, no extra words.
`.trim();

    // --------------------------------------------------
    // GEMINI MULTIMODAL REQUEST
    // --------------------------------------------------

    const response = await ai.models.generateContent({
      model:
        process.env.CLASSIFIER_MODEL ||
        "gemini-2.5-flash",

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

    // --------------------------------------------------
    // GET GEMINI RESPONSE
    // --------------------------------------------------

    let category = response.text?.trim();

    console.log("Gemini raw category response:", category);

    if (!category) {
      console.warn(
        "Gemini returned an empty response. Using fallback."
      );

      return fallbackCategory(extractedText);
    }

    // --------------------------------------------------
    // CLEAN GEMINI RESPONSE
    // --------------------------------------------------

    category = category
      .replace(/```/g, "")
      .replace(/["']/g, "")
      .replace(/\n/g, " ")
      .replace(/[.:;]+$/g, "")
      .trim();

    // --------------------------------------------------
    // EXACT CATEGORY MATCH
    // --------------------------------------------------

    const exactMatch = ALLOWED_CATEGORIES.find(
      (item) =>
        item.toLowerCase() === category.toLowerCase()
    );

    if (exactMatch) {
      console.log("Final category (exact match):", exactMatch);

      return exactMatch;
    }

    // --------------------------------------------------
    // HANDLE EXTRA GEMINI TEXT
    // --------------------------------------------------
    // Gemini sometimes wraps the category in extra words
    // (e.g. "Category: Sports" or "The answer is Sports.").
    // Prefer the LONGEST matching category name to avoid a
    // short category name accidentally matching inside a
    // longer one (there are no current collisions, but this
    // keeps the matching robust as categories evolve).

    const detectedCategories = ALLOWED_CATEGORIES.filter((item) =>
      category.toLowerCase().includes(item.toLowerCase())
    ).sort((a, b) => b.length - a.length);

    if (detectedCategories.length > 0) {
      const detectedCategory = detectedCategories[0];

      console.log(
        "Gemini detected category (fuzzy match):",
        detectedCategory
      );

      return detectedCategory;
    }

    // --------------------------------------------------
    // INVALID GEMINI RESPONSE
    // --------------------------------------------------

    console.warn(
      "Gemini returned an invalid/unrecognized category:",
      category
    );

    return fallbackCategory(extractedText);
  } catch (error) {
    // --------------------------------------------------
    // GEMINI ERROR FALLBACK
    // --------------------------------------------------

    console.error(
      "Gemini categorization error:",
      error.message
    );

    return fallbackCategory(extractedText);
  }
}

/**
 * ----------------------------------------------------
 * FALLBACK CATEGORY
 * ----------------------------------------------------
 *
 * Used when:
 * - Gemini API is unavailable
 * - API key is missing
 * - Gemini returns invalid output
 * - Image is unavailable
 *
 * This fallback uses OCR text only, so it is intentionally
 * more conservative than the multimodal Gemini path. Checks
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