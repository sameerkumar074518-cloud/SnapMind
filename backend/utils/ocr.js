
const Tesseract = require("tesseract.js");

async function extractText(imageBuffer) {
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
    throw new Error("A valid image buffer is required for OCR.");
  }

  console.log("Starting OCR using original image buffer...");

  const result = await Tesseract.recognize(
    imageBuffer,
    "eng",
    {
      logger: (info) => {
        if (info.status === "recognizing text") {
          console.log(
            `OCR progress: ${Math.round(info.progress * 100)}%`
          );
        }
      },
    }
  );

  const text = result.data.text || "";

  console.log("OCR completed!");
  console.log("OCR confidence:", result.data.confidence);
  console.log("Extracted text:", text);

  return text;
}

module.exports = extractText;
