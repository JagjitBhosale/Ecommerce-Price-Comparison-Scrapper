import express from "express";
import flipkartProductScrapper from "../controllers/flipkartProductScrapper.js";

const router = express.Router();

// POST /api/flipkart-scrape { "productName": "..." }
router.post("/flipkart-scrape", async (req, res) => {
  try {
    const { productName } = req.body || {};
    if (!productName || typeof productName !== "string") {
      return res.status(400).json({ error: "productName is required" });
    }

    const result = await flipkartProductScrapper(productName);
    return res.json(result);
  } catch (error) {
    console.error("Error in /flipkart-scrape route:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default router;