const Tesseract = require("tesseract.js");

async function extractText(imageUrl) {
  console.log("Starting OCR...");

  const result = await Tesseract.recognize(
    imageUrl,
    "eng",
    {
      logger: (info) => {
        if (info.status === "recognizing text") {
          console.log(`OCR progress: ${Math.round(info.progress * 100)}%`);
        }
      },
    }
  );

  console.log("OCR completed! ✅");

  return result.data.text;
}

module.exports = extractText;