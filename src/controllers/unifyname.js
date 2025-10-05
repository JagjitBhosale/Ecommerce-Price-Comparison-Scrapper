import { GoogleGenerativeAI } from "@google/generative-ai";

export const unifyname = async (req, res) => {
  try {
    const { link } = req.body;

    if (!link)
      return res.status(400).json({ error: "Please provide a product link." });

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey)
      return res
        .status(500)
        .json({ error: "Missing GOOGLE_API_KEY in .env file" });

    // Initialize Gemini client properly
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Create the prompt
    const prompt = `
      You are a product name extraction and normalization AI.
      Given a product link from any e-commerce platform,
      extract the main product name (brand + model + essential specs) and return 
      a clean, unified product name suitable for searching across all platforms.
      Now process this link: ${link}
      Return only the unified product name. No explanation.
    `;

    // Make the API call (same as curl)
    const result = await model.generateContent({
      contents: [{ parts: [{ text: prompt }] }],
    });

    const response = result.response;
    const unifiedName = response.text().trim();

    res.json({ unifiedProductName: unifiedName });
  } catch (error) {
    console.error("🔥 Gemini API Error:", error.message);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
};
