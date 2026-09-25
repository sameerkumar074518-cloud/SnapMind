function cleanText(text) {
  return (text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return "";
}

function extractAmount(text) {
  const match = text.match(
    /(?:₹|rs\.?|inr)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i
  );

  if (!match) {
    return "";
  }

  return match[1].replace(/,/g, "");
}

function extractDate(text) {
  const patterns = [
    /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/,
    /\b(\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/,
    /\b(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4})\b/i,
  ];

  return firstMatch(text, patterns);
}

function extractEmail(text) {
  const match = text.match(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
  );

  return match ? match[0] : "";
}

function extractPhone(text) {
  const match = text.match(
    /(?:\+91[\s-]?)?[6-9]\d{9}\b/
  );

  return match ? match[0] : "";
}

function extractOrderId(text) {
  return firstMatch(text, [
    /(?:order\s*(?:id|no|number)|order)\s*[:#-]?\s*([A-Z0-9-]{4,})/i,
    /(?:transaction\s*(?:id|no|number)|txn\s*(?:id|no))\s*[:#-]?\s*([A-Z0-9-]{4,})/i,
    /(?:booking\s*(?:id|no|number)|pnr)\s*[:#-]?\s*([A-Z0-9-]{4,})/i,
  ]);
}

function extractLocation(text) {
  return firstMatch(text, [
    /(?:address|location|located at)\s*[:\-]?\s*([^|]+)/i,
  ]);
}

function extractTitle(text) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return "";
  }

  return lines[0].slice(0, 120);
}

function extractIntelligence(extractedText, category) {
  const text = cleanText(extractedText);

  if (!text) {
    return {
      title: "",
      date: "",
      amount: "",
      email: "",
      phone: "",
      orderId: "",
      location: "",
      category: category || "Other",
    };
  }

  return {
    title: extractTitle(extractedText),
    date: extractDate(text),
    amount: extractAmount(text),
    email: extractEmail(text),
    phone: extractPhone(text),
    orderId: extractOrderId(text),
    location: extractLocation(text),
    category: category || "Other",
  };
}

module.exports = {
  extractIntelligence,
};