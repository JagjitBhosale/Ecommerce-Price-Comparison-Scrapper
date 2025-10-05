import puppeteer from 'puppeteer';

class AmazonProductScraper {
  constructor() {
    this.baseUrl = 'https://www.amazon.in/s?k=';
  }

  /**
   * Main function to scrape Amazon product details
   * @param {string} productName - The product name to search
   * @returns {Promise<Object>} Product details including price, offers, and rating
   */
  async scrapeProduct(productName) {
    const browser = await puppeteer.launch({
      headless: 'new', // Run in background
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
      
      // Set viewport
      await page.setViewport({ width: 1920, height: 1080 });
      
      // Set user agent to avoid detection
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Navigate to search results
      const searchUrl = this.baseUrl + encodeURIComponent(productName);
      console.log(`Navigating to: ${searchUrl}`);
      
      await page.goto(searchUrl, { 
        waitUntil: 'networkidle2',
        timeout: 60000 
      });
      
      // Wait for search results to load
      await page.waitForSelector('[data-component-type="s-search-result"]', { timeout: 30000 });
      
      // Small delay to ensure all elements are loaded
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Find first non-sponsored product
      const firstProductUrl = await this.findFirstNonSponsoredProduct(page);
      
      if (!firstProductUrl) {
        throw new Error('No non-sponsored products found');
      }

      const productLink = firstProductUrl;

      console.log(`Found first non-sponsored product: ${firstProductUrl}`);

      // Navigate to product page
      await page.goto(firstProductUrl, { 
        waitUntil: 'networkidle2',
        timeout: 60000 
      });
      
      await page.waitForSelector('#productTitle', { timeout: 30000 });
      
      // Wait for page to fully load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Extract product details
      const productDetails = await this.extractProductDetails(page);
      productDetails.productLink = productLink; // Add this line

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
      const results = document.querySelectorAll('[data-component-type="s-search-result"]');
      
      for (let result of results) {
        // Method 1: Check for sponsored attribute
        const isSponsoredByAttr = result.querySelector('[data-component-type="sp-sponsored-result"]') !== null;
        
        // Method 2: Check all spans for "Sponsored" text
        const allSpans = result.querySelectorAll('span');
        let hasSponshoredText = false;
        for (let span of allSpans) {
          const text = span.textContent.toLowerCase().trim();
          if (text === 'sponsored') {
            hasSponshoredText = true;
            break;
          }
        }
        
        // Method 3: Check for sponsored class
        const hasSponsoredClass = result.classList.contains('AdHolder') || 
                                  result.classList.contains('s-sponsored-list-item');
        
        // Method 4: Check for sponsored label element
        const sponsoredLabel = result.querySelector('.puis-sponsored-label-text, .s-label-popover-default');
        const hasSponsoredLabel = sponsoredLabel !== null;
        
        // Skip if sponsored by any method
        if (isSponsoredByAttr || hasSponshoredText || hasSponsoredClass || hasSponsoredLabel) {
          console.log('Skipping sponsored product');
          continue;
        }

        // Get product link from h2 tag
        const link = result.querySelector('h2 a, .s-title-instructions-style a, a.a-link-normal.s-no-outline');
        
        if (link) {
          const href = link.getAttribute('href');
          if (href && href.includes('/dp/')) {
            const fullUrl = href.startsWith('http') ? href : 'https://www.amazon.in' + href;
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
        price: null,
        mrp: null,
        discount: null,
        rating: null,
        totalRatings: null,
        offers: [],
        seller: null,
        availability: null
      };

      // Extract title
      const titleEl = document.querySelector('#productTitle');
      result.title = titleEl ? titleEl.textContent.trim() : '';

      // Extract price - try multiple selectors
      let priceEl = document.querySelector('.a-price.aok-align-center .a-price-whole');
      if (!priceEl) {
        priceEl = document.querySelector('.a-price-whole');
      }
      if (!priceEl) {
        const offscreenPrice = document.querySelector('.a-price .a-offscreen');
        if (offscreenPrice) {
          const priceText = offscreenPrice.textContent.replace(/[₹,]/g, '').trim();
          result.price = parseFloat(priceText);
        }
      } else {
        const priceText = priceEl.textContent.replace(/[₹,]/g, '').trim();
        result.price = parseFloat(priceText);
      }

      // Extract MRP
      const mrpEl = document.querySelector('.a-price.a-text-price .a-offscreen') ||
                    document.querySelector('.basisPrice .a-offscreen');
      if (mrpEl) {
        const mrpText = mrpEl.textContent.replace(/[₹,]/g, '').trim();
        result.mrp = parseFloat(mrpText);
      }

      // Calculate discount
      if (result.price && result.mrp) {
        result.discount = Math.round(((result.mrp - result.price) / result.mrp) * 100);
      } else {
        const discountEl = document.querySelector('.savingsPercentage');
        if (discountEl) {
          result.discount = parseInt(discountEl.textContent.replace(/[-%]/g, ''));
        }
      }

      // Extract rating
      const ratingEl = document.querySelector('[data-hook="rating-out-of-text"]') ||
                       document.querySelector('.a-icon-star span') ||
                       document.querySelector('i.a-icon-star span.a-icon-alt');
      if (ratingEl) {
        const ratingText = ratingEl.textContent.match(/[\d.]+/);
        result.rating = ratingText ? parseFloat(ratingText[0]) : null;
      }

      // Extract total ratings
      const totalRatingsEl = document.querySelector('#acrCustomerReviewText') ||
                            document.querySelector('[data-hook="total-review-count"]');
      if (totalRatingsEl) {
        const ratingsText = totalRatingsEl.textContent.replace(/[,\s]/g, '').match(/\d+/);
        result.totalRatings = ratingsText ? parseInt(ratingsText[0]) : null;
      }

      // Extract offers (top 3)
      const offers = [];
      
      // Try to find offer badges
      const offerBadges = document.querySelectorAll('.promoPriceBlockMessage, #productPromotions_feature_div .a-section');
      for (let i = 0; i < Math.min(offerBadges.length, 3); i++) {
        const offerText = offerBadges[i].textContent.trim().replace(/\s+/g, ' ');
        if (offerText && offerText.length > 10) {
          offers.push(offerText);
        }
      }

      // Alternative: Look for coupon and promotion messages
      if (offers.length < 3) {
        const couponElements = document.querySelectorAll('[data-a-badge-color="sx-coupon"], .promoBadge, #applicablePromotionList .a-list-item');
        for (let i = 0; i < Math.min(couponElements.length, 3 - offers.length); i++) {
          const offerText = couponElements[i].textContent.trim().replace(/\s+/g, ' ');
          if (offerText && offerText.length > 10) {
            offers.push(offerText);
          }
        }
      }

      // Look for bank offers
      if (offers.length < 3) {
        const bankOffers = document.querySelectorAll('.a-section.a-spacing-small');
        for (let elem of bankOffers) {
          if (offers.length >= 3) break;
          const text = elem.textContent.toLowerCase();
          if ((text.includes('offer') || text.includes('cashback') || text.includes('discount')) && 
              elem.textContent.length > 20) {
            offers.push(elem.textContent.trim().replace(/\s+/g, ' ').substring(0, 200));
          }
        }
      }

      result.offers = offers.slice(0, 3);

      // Extract seller
      const sellerEl = document.querySelector('#sellerProfileTriggerId') ||
                       document.querySelector('[data-feature-name="merchant-info"] a') ||
                       document.querySelector('#merchant-info a');
      result.seller = sellerEl ? sellerEl.textContent.trim() : null;

      // Extract availability
      const availEl = document.querySelector('#availability span');
      result.availability = availEl ? availEl.textContent.trim() : null;

      return result;
    });

    return details;
  }
}

// Controller function
export default async function amazonProductScrapper(productName) {
  try {
    console.log(`\n🔍 Searching for: ${productName}\n`);
    
    const scraper = new AmazonProductScraper();
    const productDetails = await scraper.scrapeProduct(productName);

    // Format output as JSON
    const output = {
      success: true,
      data: {
        title: productDetails.title,
        price: productDetails.price ? `₹${productDetails.price.toLocaleString('en-IN')}` : 'Not available',
        mrp: productDetails.mrp ? `₹${productDetails.mrp.toLocaleString('en-IN')}` : null,
        discount: productDetails.discount ? `${productDetails.discount}%` : null,
        rating: {
          stars: productDetails.rating,
          totalReviews: productDetails.totalRatings
        },
        topOffers: productDetails.offers.length > 0 ? productDetails.offers : ['No offers available'],
        seller: productDetails.seller || 'Not specified',
        availability: productDetails.availability,
        productLink: productDetails.productLink 
      }
    };

    console.log('\n✅ Scraping completed successfully!\n');
    console.log(JSON.stringify(output, null, 2));
    
    return output;

  } catch (error) {
    console.error('\n❌ Scraping failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}