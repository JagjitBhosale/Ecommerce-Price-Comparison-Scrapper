import puppeteer from 'puppeteer';

class FlipkartProductScraper {
  constructor() {
    this.baseUrl = 'https://www.flipkart.com/search?q=';
  }

  /**
   * Main function to scrape Flipkart product details
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
      
      // Wait for search results to load - using the new selector
      await page.waitForSelector('div.slAVV4, div.tUxRFH, div._75nlfW', { timeout: 30000 });
      
      // Small delay to ensure all elements are loaded
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Find first non-sponsored product
      const firstProductUrl = await this.findFirstNonSponsoredProduct(page);
      
      if (!firstProductUrl) {
        throw new Error('No non-sponsored products found');
      }

      // Store the product URL to include in response
     const productLink = firstProductUrl;

      console.log(`Found first non-sponsored product: ${firstProductUrl}`);

      // Navigate to product page
      await page.goto(firstProductUrl, { 
        waitUntil: 'networkidle2',
        timeout: 60000 
      });
      
      // Wait for product page to load - updated selectors
      await page.waitForSelector('h1._6EBuvT span.VU-ZEz, span.B_NuCI', { timeout: 30000 });
      
      // Wait for page to fully load
      await new Promise(resolve => setTimeout(resolve, 3000));

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
      // Multiple possible container selectors for search results
      const containers = document.querySelectorAll('div.slAVV4, div.tUxRFH, div._75nlfW, div._4zPITb, div[data-tkid]');
      
      for (let container of containers) {
        // Skip if container has sponsored indicators
        const sponsoredTexts = ['sponsored', 'ad', 'promoted'];
        const containerText = container.textContent?.toLowerCase() || '';
        
        // Check for sponsored badges or text
        const hasSponsored = container.querySelector('.Z0Na3m, ._630qWQ, .ZB6XBm, [class*="sponsor"], [class*="ad"]');
        
        // Also check if any parent has sponsored class
        let parentElement = container.parentElement;
        let isParentSponsored = false;
        while (parentElement && parentElement !== document.body) {
          if (parentElement.classList.contains('Pvc1Aq') || 
              parentElement.classList.contains('_3tfP8f')) {
            isParentSponsored = true;
            break;
          }
          parentElement = parentElement.parentElement;
        }
        
        if (hasSponsored || isParentSponsored) {
          console.log('Skipping sponsored product');
          continue;
        }

        // Look for product link with multiple possible selectors
        const link = container.querySelector('a.VJA3rP, a.s1Q9rs, a._2rpwqI, a.CGtC98, a._1fQZEK, a[href*="/p/"]');
        
        if (link) {
          const href = link.getAttribute('href');
          if (href && href.includes('/p/')) {
            const fullUrl = href.startsWith('http') ? href : 'https://www.flipkart.com' + href;
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
        totalReviews: null,
        offers: [],
        seller: null,
        availability: null,
        delivery: null
      };

      // Extract title - updated selectors
      const titleEl = document.querySelector('h1._6EBuvT span.VU-ZEz, span.B_NuCI, h1.yhB1nd');
      result.title = titleEl ? titleEl.textContent.trim() : '';

      // Extract current price - updated selectors
      const priceEl = document.querySelector('div.Nx9bqj, div._30jeq3._16Jk6d, div._25b18c ._30jeq3');
      if (priceEl) {
        const priceText = priceEl.textContent.replace(/[₹,]/g, '').trim();
        result.price = parseFloat(priceText);
      }

      // Extract MRP - updated selectors
      const mrpEl = document.querySelector('div.yRaY8j, div._3I9_wc._2p6lqe, div._25b18c ._3I9_wc');
      if (mrpEl) {
        const mrpText = mrpEl.textContent.replace(/[₹,]/g, '').trim();
        result.mrp = parseFloat(mrpText);
      }

      // Calculate or extract discount
      if (result.price && result.mrp) {
        result.discount = Math.round(((result.mrp - result.price) / result.mrp) * 100);
      } else {
        const discountEl = document.querySelector('div.UkUFwK span, div._3Ay6Sb span');
        if (discountEl) {
          const discountText = discountEl.textContent.replace(/[-%\soff]/g, '').trim();
          result.discount = parseInt(discountText);
        }
      }

      // Extract rating - updated selectors
      const ratingEl = document.querySelector('div.XQDdHH, div._3LWZlK, div._2d4LTz');
      if (ratingEl) {
        const ratingText = ratingEl.textContent.trim();
        const ratingMatch = ratingText.match(/[\d.]+/);
        if (ratingMatch) {
          result.rating = parseFloat(ratingMatch[0]);
        }
      }

      // Extract total ratings and reviews
      const ratingsReviewsEl = document.querySelector('span.Wphh3N, span._2_R_DZ');
      if (ratingsReviewsEl) {
        const text = ratingsReviewsEl.textContent.trim();
        const ratingsMatch = text.match(/([\d,]+)\s*Ratings/);
        const reviewsMatch = text.match(/([\d,]+)\s*Reviews/);
        
        if (ratingsMatch) {
          result.totalRatings = parseInt(ratingsMatch[1].replace(/,/g, ''));
        }
        if (reviewsMatch) {
          result.totalReviews = parseInt(reviewsMatch[1].replace(/,/g, ''));
        }
      }

      // Extract offers (top 3)
      const offers = [];
      const offerElements = document.querySelectorAll('li.kF1Ml8, li._16eBzU, div._3c5u7X');
      
      for (let i = 0; i < Math.min(offerElements.length, 3); i++) {
        const offerText = offerElements[i].textContent.trim().replace(/\s+/g, ' ');
        if (offerText && offerText.length > 10) {
          // Clean up the offer text
          const cleanText = offerText.replace(/T&C.*$/i, '').trim();
          if (cleanText && !offers.includes(cleanText)) {
            offers.push(cleanText);
          }
        }
      }
      
      result.offers = offers.slice(0, 3);

      // Extract seller
      const sellerEl = document.querySelector('#sellerName span, div.yeLeBC span, div._1RLviY');
      if (sellerEl) {
        const sellerText = sellerEl.textContent.trim();
        // Extract just the seller name, not the rating
        const sellerMatch = sellerText.match(/^([^0-9★]+)/);
        result.seller = sellerMatch ? sellerMatch[1].trim() : sellerText;
      }

      // Extract availability
      const availEl = document.querySelector('div._2JC05C span, div._3jaf0C, button.QqFHMw:disabled');
      if (availEl) {
        if (availEl.textContent.includes('Add to cart') && availEl.disabled) {
          result.availability = 'Out of Stock';
        } else {
          result.availability = 'In Stock';
        }
      } else {
        // If add to cart button exists and is not disabled
        const cartBtn = document.querySelector('button.QqFHMw.vslbG+:not(:disabled)');
        result.availability = cartBtn ? 'In Stock' : 'Check availability';
      }

      // Extract delivery info
      const deliveryEl = document.querySelector('div.Y8v7Fl, div._2VIMRi span, div.YhUgfO');
      if (deliveryEl) {
        result.delivery = deliveryEl.textContent.trim();
      }

      return result;
    });



    return details;
  }
}

// Controller function
export default async function flipkartProductScrapper(productName) {
  try {
    console.log(`\n🔍 Searching Flipkart for: ${productName}\n`);
    
    const scraper = new FlipkartProductScraper();
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
          totalRatings: productDetails.totalRatings,
          totalReviews: productDetails.totalReviews
        },
        topOffers: productDetails.offers.length > 0 ? productDetails.offers : ['No offers available'],
        seller: productDetails.seller || 'Not specified',
        availability: productDetails.availability,
        delivery: productDetails.delivery,
        productLink: productDetails.productLink // Product Link
      }
    };

    console.log('\n✅ Flipkart scraping completed successfully!\n');
    console.log(JSON.stringify(output, null, 2));
    
    return output;

  } catch (error) {
    console.error('\n❌ Flipkart scraping failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}