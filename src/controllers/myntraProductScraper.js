import puppeteer from 'puppeteer';

class MyntraProductScraper {
  constructor() {
    this.baseUrl = 'https://www.myntra.com/';
  }

  /**
   * Main function to scrape Myntra product details
   * @param {string} productName - The product name to search
   * @returns {Promise<Object>} Product details including price, offers, and rating
   */
  async scrapeProduct(productName) {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080'
      ]
    });

    try {
      const page = await browser.newPage();
      
      await page.setViewport({ width: 1920, height: 1080 });
      
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Navigate to Myntra homepage first
      console.log(`Navigating to Myntra homepage`);
      await page.goto(this.baseUrl, { 
        waitUntil: 'networkidle2',
        timeout: 60000 
      });

      // Wait a bit for the page to settle
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Click on search input and type the product name
      console.log(`Searching for: ${productName}`);
      await page.waitForSelector('.desktop-searchBar', { timeout: 30000 });
      await page.click('.desktop-searchBar');
      await page.type('.desktop-searchBar', productName);
      
      // Wait for search suggestions and press Enter
      await new Promise(resolve => setTimeout(resolve, 1000));
      await page.keyboard.press('Enter');

      // Wait for search results page to load
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });
      
      // Wait for product listing
      await page.waitForSelector('li.product-base', { timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Find first non-sponsored product
      const firstProductUrl = await this.findFirstNonSponsoredProduct(page);
      
      if (!firstProductUrl) {
        throw new Error('No non-sponsored products found');
      }

      console.log(`Found first non-sponsored product: ${firstProductUrl}`);

      // Navigate to product page
      await page.goto(firstProductUrl, { 
        waitUntil: 'networkidle2',
        timeout: 60000 
      });
      
      // Wait for product details to load
      await page.waitForSelector('.pdp-title', { timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Extract product details
      const productDetails = await this.extractProductDetails(page);

      return productDetails;

    } catch (error) {
      console.error('Error scraping product:', error.message);
      throw error;
    } finally {
      await browser.close();
    }
  }

  /**
   * Find the first non-sponsored product link
   * @param {Page} page - Puppeteer page object
   * @returns {Promise<string>} Product URL
   */
  async findFirstNonSponsoredProduct(page) {
    const productUrl = await page.evaluate(() => {
      // Get all product items
      const products = document.querySelectorAll('li.product-base');
      
      for (let product of products) {
        // Check if product is sponsored
        const sponsoredIndicators = product.querySelectorAll('span, div');
        let isSponsored = false;
        
        for (let indicator of sponsoredIndicators) {
          const text = indicator.textContent.toLowerCase().trim();
          if (text === 'sponsored' || text === 'ad') {
            isSponsored = true;
            break;
          }
        }
        
        if (isSponsored) {
          console.log('Skipping sponsored product');
          continue;
        }

        // Get product link - Myntra uses anchor tag with data-refreshpage attribute
        const link = product.querySelector('a[data-refreshpage="true"]');
        
        if (link) {
          const href = link.getAttribute('href');
          if (href) {
            const fullUrl = href.startsWith('http') ? href : 'https://www.myntra.com/' + href;
            console.log('Found non-sponsored product:', fullUrl);
            return fullUrl;
          }
        }
      }
      
      return null;
    });

    return productUrl;
  }

  /**
   * Extract product details from product page
   * @param {Page} page - Puppeteer page object
   * @returns {Promise<Object>} Product details
   */
  async extractProductDetails(page) {
    const details = await page.evaluate(() => {
      const result = {
        title: '',
        brand: '',
        price: null,
        mrp: null,
        discount: null,
        rating: null,
        totalRatings: null,
        offers: [],
        seller: null,
        sizes: []
      };

      // Extract brand
      const brandEl = document.querySelector('.pdp-title');
      result.brand = brandEl ? brandEl.textContent.trim() : '';

      // Extract product name/title
      const titleEl = document.querySelector('.pdp-name');
      result.title = titleEl ? titleEl.textContent.trim() : '';

      // Extract current price
      const priceEl = document.querySelector('.pdp-price strong');
      if (priceEl) {
        const priceText = priceEl.textContent.replace(/[₹,\s]/g, '').trim();
        result.price = parseFloat(priceText);
      }

      // Extract MRP
      const mrpEl = document.querySelector('.pdp-mrp');
      if (mrpEl) {
        const mrpText = mrpEl.textContent.replace(/[₹,\sMRP]/g, '').trim();
        result.mrp = parseFloat(mrpText);
      }

      // Extract discount
      const discountEl = document.querySelector('.pdp-discount');
      if (discountEl) {
        const discountText = discountEl.textContent.match(/\d+/);
        result.discount = discountText ? parseInt(discountText[0]) : null;
      }

      // Extract rating
      const ratingEl = document.querySelector('.index-overallRating div');
      if (ratingEl) {
        const ratingText = ratingEl.textContent.trim();
        result.rating = parseFloat(ratingText);
      }

      // Extract total ratings count
      const ratingsCountEl = document.querySelector('.index-ratingsCount');
      if (ratingsCountEl) {
        const ratingsText = ratingsCountEl.textContent.replace(/[,\sk]/gi, '').match(/[\d.]+/);
        if (ratingsText) {
          const count = ratingsText[0];
          result.totalRatings = count.includes('.') ? 
            parseFloat(count) * 1000 : 
            parseInt(count);
        }
      }

      // Extract offers (top 3)
      const offers = [];
      const offerElements = document.querySelectorAll('.pdp-offers-offer, .pdp-offers-offerLikeBestPrice');
      
      for (let i = 0; i < Math.min(offerElements.length, 3); i++) {
        const titleEl = offerElements[i].querySelector('.pdp-offers-offerTitle');
        if (titleEl) {
          const offerText = titleEl.textContent.trim().replace(/\s+/g, ' ');
          if (offerText && offerText.length > 10) {
            offers.push(offerText);
          }
        }
      }
      
      result.offers = offers.slice(0, 3);

      // Extract seller information
      const sellerEl = document.querySelector('.supplier-productSellerName');
      result.seller = sellerEl ? sellerEl.textContent.trim() : null;

      // Extract available sizes
      const sizeButtons = document.querySelectorAll('.size-buttons-size-button');
      for (let sizeBtn of sizeButtons) {
        const sizeText = sizeBtn.querySelector('.size-buttons-unified-size');
        if (sizeText) {
          result.sizes.push(sizeText.textContent.trim());
        }
      }

      return result;
    });

    return details;
  }
}

// Controller function
export default async function myntraProductScrapper(productName) {
  try {
    console.log(`\n🔍 Searching Myntra for: ${productName}\n`);
    
    const scraper = new MyntraProductScraper();
    const productDetails = await scraper.scrapeProduct(productName);

    // Format output as JSON
    const output = {
      success: true,
      data: {
        brand: productDetails.brand,
        title: productDetails.title,
        price: productDetails.price ? `₹${productDetails.price.toLocaleString('en-IN')}` : 'Not available',
        mrp: productDetails.mrp ? `₹${productDetails.mrp.toLocaleString('en-IN')}` : null,
        discount: productDetails.discount ? `${productDetails.discount}%` : null,
        rating: {
          stars: productDetails.rating,
          totalRatings: productDetails.totalRatings
        },
        topOffers: productDetails.offers.length > 0 ? productDetails.offers : ['No offers available'],
        seller: productDetails.seller || 'Not specified',
        sizes: productDetails.sizes.length > 0 ? productDetails.sizes : ['No sizes available']
      }
    };

    console.log('\n✅ Myntra scraping completed successfully!\n');
    console.log(JSON.stringify(output, null, 2));
    
    return output;

  } catch (error) {
    console.error('\n❌ Myntra scraping failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}