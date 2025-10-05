import express from 'express';
import myntraScraper from '../controllers/myntraProductScraper.js';

const router = express.Router();

// Myntra scraping route
router.get('/myntra-scrape', async (req, res) => {
  try {
    const { productName } = req.query;
    
    // Validation
    if (!productName) {
      return res.status(400).json({
        success: false,
        error: 'Product name is required. Usage: /myntra-scrape?productName=YourProduct'
      });
    }

    console.log(`\n📦 Received request to scrape Myntra for: ${productName}`);
    
    // Call the scraper
    const result = await myntraScraper(productName);
    
    // Return result
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('\n❌ Error in /myntra-scrape route:', error);
    console.error('Error stack:', error.stack);
    
    return res.status(500).json({
      success: false,
      platform: 'Myntra',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// POST endpoint (if needed)
router.post('/myntra-scrape', async (req, res) => {
  try {
    const { productName } = req.body;
    
    if (!productName) {
      return res.status(400).json({
        success: false,
        error: 'Product name is required in request body'
      });
    }

    console.log(`\n📦 POST request to scrape Myntra for: ${productName}`);
    
    const result = await myntraScraper(productName);
    
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('\n❌ Error in POST /myntra-scrape route:', error);
    console.error('Error stack:', error.stack);
    
    return res.status(500).json({
      success: false,
      platform: 'Myntra',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;

// If using CommonJS (module.exports)
// module.exports = router;