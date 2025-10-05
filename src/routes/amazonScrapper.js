import express from "express";
import amazonProductScrapper from "../controllers/amazonProductScrapper.js";

const router = express.Router();

// POST /api/amazon-scrape { "productName": "..." }
router.post("/amazon-scrape", async (req, res) => {
  try {
    const { productName } = req.body || {};
    if (!productName || typeof productName !== "string") {
      return res.status(400).json({ error: "productName is required" });
    }

    const result = await amazonProductScrapper(productName);
    return res.json(result);
  } catch (error) {
    console.error("Error in /amazon-scrape route:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default router;
