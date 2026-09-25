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

    const prompt = `
You are SnapMind's advanced multimodal screenshot classification AI.

Your job is to classify the screenshot into EXACTLY ONE category.

AVAILABLE CATEGORIES:
${ALLOWED_CATEGORIES.join(", ")}

==================================================
IMPORTANT: VISUAL ANALYSIS FIRST
==================================================

You MUST analyze the actual image visually.

Do NOT classify the screenshot using OCR text alone.

First inspect:
- People
- Objects
- Clothing
- Environment
- Scenes
- Logos
- Applications
- Websites
- UI elements
- Products
- Documents
- Charts
- Sports equipment, jerseys, stadiums, scoreboards, teams
- Locations
- Visual symbols
- Overall visual context

Then use OCR text as SUPPORTING evidence.

OCR is NOT the primary source of classification.

A screenshot may contain:
- very little text
- no readable text
- a filename only
- blurry text
- images/photos with no text

You must STILL classify it using visual understanding.

==================================================
MAIN CLASSIFICATION RULE
==================================================

Choose the category that best represents the MAIN SUBJECT,
MAIN PURPOSE, or MAIN CONTENT of the screenshot as a whole.

Think about what the screenshot is FUNDAMENTALLY ABOUT before
picking a category, not what UI element or document type it is.

Do NOT classify based on a single isolated keyword, a UI pattern
(like "pass", "ticket", "card", "screen"), or surface-level wording.
Look at the SUBJECT MATTER those words refer to.

For example: a "Beta Pass", "Ticket", or "Card" is not automatically
"Other" just because those words are generic — you must ask what the
pass/ticket/card is actually FOR. If it is for a cricket game, esports
tournament, or any sport, the correct category is Sports, not Other.

Use the complete visual + textual context together, and resolve
ambiguity by asking: "What is this screenshot really about, at its core?"

==================================================
CATEGORY GUIDELINES
==================================================

Study:
Educational content, lectures, exams, assignments, textbooks,
notes, students studying, academic websites, college material,
question papers or learning resources.

Work:
Professional work, meetings, business documents, workplace
communication, project management, office tasks or professional
applications. Not personal finance or personal social content.

Shopping:
Products, online stores, shopping carts, product listings,
orders, prices, shopping websites or purchase screens for
physical or retail goods (not game passes or subscriptions).

Social:
Instagram, Facebook, WhatsApp, Discord, Telegram, Messenger,
social feeds, chats, conversations or social interaction.

Entertainment:
Movies, TV shows, Netflix, Prime Video, YouTube entertainment,
Spotify, music, general video games, gaming platforms, or other
entertainment content that is NOT specifically about a real-world
sport (cricket, football, basketball, etc.) — sport-themed content,
including sports video games, esports passes, or sports-branded
game items, belongs in Sports instead, because the subject matter
is the sport itself.

Finance:
Banking, UPI, payments, transactions, investments, stocks,
credit cards, debit cards, account balances or financial apps.

News:
News websites, newspapers, breaking news, news broadcasts,
articles or journalism.

Travel:
Flights, airports, hotels, maps, tourism, destinations,
travel bookings or trip planning.

Sports:
ANY content whose core subject is a sport: cricket, football,
soccer, basketball, tennis, badminton, sports teams, athletes,
players, stadiums, matches, tournaments, leagues, scoreboards,
sports equipment, sporting events, sports apps/games, fantasy
sports, sports betting, and sports-related passes, tickets,
beta invites, or promotional items (e.g. "eCricket Closed Beta
Pass" is Sports because the subject is cricket — the word "Pass"
does NOT make it Other or Shopping).

Personal:
Personal photographs, memories, family/friends photos,
personal documents or personal content that does not fit
another category.

Security:
Passwords, OTPs, authentication, two-factor authentication,
verification, privacy, security settings or account protection.

Technology:
Programming, source code, GitHub, software development,
computers, devices, technical documentation, AI, developer tools
or technology-related content that is not primarily about a
specific sport, finance, or shopping product.

Other:
Use ONLY as a last resort, when the screenshot genuinely has
no identifiable main subject and truly does not fit any category
above, even after considering its visual content, branding, and
subject matter. Do not use Other just because a screenshot has an
unusual UI element like "pass" or "invite" — always classify by
what the pass/invite is actually for.

==================================================
IMPORTANT VISUAL EXAMPLES
==================================================

A photograph of a cricket team on a cricket field
→ Sports

A football match screenshot
→ Sports

An "eCricket Closed Beta Pass" or any cricket-themed app/game pass
→ Sports (subject = cricket, not Other, not Shopping)

A photograph of students inside a classroom
→ Study

A screenshot of a laptop showing source code
→ Technology

A product page showing shoes and a Buy Now button
→ Shopping

A bank account/payment screen
→ Finance

An Instagram feed
→ Social

A Netflix movie screen
→ Entertainment

A generic (non-sport) mobile game screen
→ Entertainment

A flight booking page
→ Travel

A password/OTP verification screen
→ Security

A personal family photograph
→ Personal

==================================================
OCR TEXT
==================================================

${extractedText || "(No OCR text detected)"}

==================================================
CONFLICT RESOLUTION
==================================================

If the visual content and the OCR text seem to disagree, trust the
VISUAL context unless the OCR text clearly and unambiguously
establishes the screenshot's true purpose (e.g. a clear app name,
website name, or subject-specific term like "cricket", "OTP",
"Netflix", "checkout").

==================================================
FINAL INSTRUCTION
==================================================

Analyze the IMAGE first.

Use OCR only to confirm or refine the visual interpretation.

Return EXACTLY ONE category from this list:

${ALLOWED_CATEGORIES.join(", ")}

Return ONLY the category name.

Do not explain your answer.
Do not return JSON.
Do not return multiple categories.
`;

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