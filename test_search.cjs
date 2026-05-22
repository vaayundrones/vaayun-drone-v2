const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', error => console.error('BROWSER ERROR:', error.message));

  await page.goto('http://localhost:5173/');
  
  // Wait for the search input
  await page.waitForSelector('.search-input');

  // Type in the search input
  await page.type('.search-input', 'para');
  
  // Wait a second for debounce and fetch
  await new Promise(r => setTimeout(r, 1500));

  // See how many products are rendered
  const products = await page.$$('.product-card');
  console.log(`Found ${products.length} product-card elements.`);
  
  if (products.length === 0) {
    const html = await page.evaluate(() => document.body.innerHTML);
    console.log("HTML:", html.substring(0, 1000));
  }

  await browser.close();
})();
