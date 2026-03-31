# Scraper Implementation Plan

## Overview
Adding new scrapers for authorized Pandora retailers. For each site:
1. Research: Find API endpoints (preferred) or determine web scraping approach
2. Check archive.org coverage for historical data
3. Implement scraper module

**Important**: Only scrape Pandora products (filter by brand)

---

## Sites

### 1. Albert's Jewelers
- **URL**: https://www.albertsjewelers.com/
- **Research Status**: [x] Complete
- **API Found**: [ ] No public API (AJAX endpoints are CSRF-protected)
- **Web Scrape Needed**: [x] Yes - HTML parsing required
- **Archive.org Coverage**: [x] 2001-present (500+ snapshots, but /pandora section newer)
- **Implementation**: [x] **DONE** - `server/scrapers/modules/alberts.ts`
- **Notes**:
  - **Platform**: iShow (custom jewelry e-commerce)
  - **Best Source**: `sitemap.xml` lists all product URLs
  - **URL Pattern**: `/pandora/{slug}/{product-id}/en`
  - **Rate Limit**: 30-second crawl-delay in robots.txt - scraper respects this
  - **Products**: 1,931 Pandora products in sitemap
  - **Images**: S3 hosted (s3.us-west-1.amazonaws.com/laravo-cloud/)
  - **Note**: Slow scraper due to 30-sec delay - run monthly

---

### 2. Ben Bridge Jewelers
- **URL**: https://www.benbridge.com/
- **Research Status**: [x] Complete
- **API Found**: [ ] N/A - No longer sells Pandora
- **Web Scrape Needed**: [ ] N/A
- **Archive.org Coverage**: [x] 2012-2023 (~10,775 snapshots!) - **ARCHIVE ONLY**
- **Implementation**: [x] **DONE** - `server/scrapers/modules/benbridge-archive.ts`
- **Notes**:
  - **Platform**: Salesforce Commerce Cloud (Demandware)
  - **IMPORTANT**: Ben Bridge **no longer sells Pandora** - /pandora returns 404
  - **Historical data only** via archive.org
  - **Approach**: Fetch archived sitemaps (2020-2021), extract Pandora URLs, parse product pages
  - **Products**: ~855 Pandora products found in 2021 sitemap
  - Style ID extracted from `<title>` tag: "Product Name - STYLEID | Ben Bridge"
  - **NOTE**: Requires archive.org to be accessible (may be blocked on some networks)

---

### 3. Boolchand's
- **URL**: https://www.boolchand.com/
- **Research Status**: [x] Complete
- **API Found**: [x] Discovery API (POST)
- **Web Scrape Needed**: [x] Browser mode (Cloudflare bypass via Puppeteer)
- **Archive.org Coverage**: [x] 2016-2025 (~2,399 snapshots)
- **Implementation**: [x] **DONE** - `server/scrapers/modules/boolchands.ts`
- **Notes**:
  - **Platform**: Experro CMS + BigCommerce backend
  - **Pandora Products**: 1,278 unique (across Charms, Necklaces categories)
  - **Approach**: Browser-based fetch to bypass Cloudflare, POST to Discovery API
  - Response structure: `Data.records[]` with `brand_esi`, `images_ej` (JSON strings)
  - Code at: `server/scrapers/modules/boolchands.ts`

---

### 4. Elisa Ilana
- **URL**: https://elisailana.com/
- **Research Status**: [x] Complete
- **API Found**: [x] Shopify JSON API
- **Web Scrape Needed**: [ ] No - API available
- **Archive.org Coverage**: [x] 2021-2026 (100+ snapshots)
- **Implementation**: [x] **DONE** - `server/scrapers/modules/elisa-ilana.ts`
- **Notes**:
  - **Platform**: Shopify (Impulse theme)
  - **Pandora Products**: 1,014 unique (scrapes multiple collections, dedupes)
  - **Collections scraped**: pandora-charms (660), pandora-rings (173), pandora-necklaces (78), pandora-earrings (97), pandora-14k-gold (6)
  - **Protection**: Cloudflare, Blockify fraud filter

---

### 5. Hannoush Jewelers
- **URL**: https://www.hannoush.com/
- **Research Status**: [x] Complete
- **API Found**: [x] Shopify JSON API
- **Web Scrape Needed**: [ ] No - API available
- **Archive.org Coverage**: [x] None (site migrated to Shopify ~Sept 2024)
- **Implementation**: [x] **DONE** - `server/scrapers/modules/hannoush.ts`
- **Notes**:
  - **Platform**: Shopify (behind Cloudflare)
  - **Pandora Products**: 180 (Shopify API caps collection endpoint at ~180)
  - **API Endpoint**: `/collections/pandora/products.json?limit=50&page={N}`
  - **Data**: SKU, price, images, availability all in JSON
  - **Limitation**: Shopify storefront API caps at ~180 products per collection

---

### 6. Amazon Pandora Store
- **URL**: https://www.amazon.com/stores/Pandora/page/92129C8C-F186-4FB0-81A4-C5E3D24F5D97
- **Research Status**: [x] Complete
- **API Found**: [ ] PA-API exists but requires Amazon Associates status
- **Web Scrape Needed**: N/A - **NOT VIABLE**
- **Archive.org Coverage**: [x] 2021-2024 (sparse, ~2 snapshots)
- **Implementation**: [ ] **SKIP** unless you have Amazon Associates account
- **Notes**:
  - **Heavy anti-bot**: Cloudflare, JS rendering, CAPTCHA, blocks Claude/ChatGPT
  - **Legal risk**: ToS violations for scraping
  - **PA-API option**: Requires active Amazon Associates account with sales
  - **Archive limited**: Only 2 snapshots, JS-rendered content incomplete
  - Contact: api-services-support@amazon.com for enterprise access

---

### 7. Smyth Jewelers
- **URL**: https://www.smythjewelers.com/
- **Research Status**: [x] Complete
- **API Found**: [x] Shopify JSON API available
- **Web Scrape Needed**: N/A
- **Archive.org Coverage**: [ ] None for Pandora URLs
- **Implementation**: N/A - **SKIP**
- **Notes**:
  - **Platform**: Shopify
  - **DOES NOT SELL PANDORA** - No Pandora collection found
  - General jewelry store (Maryland-based)

---

### 8. Potter & Ranch
- **URL**: https://www.potterranch.com/
- **Research Status**: [x] Complete
- **API Found**: N/A
- **Web Scrape Needed**: N/A
- **Archive.org Coverage**: N/A
- **Implementation**: N/A - **SKIP**
- **Notes**: **NOT A JEWELRY RETAILER** - This is a Quarter Horse breeding ranch in Arizona. Wrong site.

---

### 9. REEDS Jewelers (reeds.com)
- **URL**: https://www.reeds.com/
- **Research Status**: [x] Complete
- **API Found**: [ ] No public API (Magento REST requires auth)
- **Web Scrape Needed**: [x] Yes - HTML parsing required
- **Archive.org Coverage**: [x] 2019-2025 (~360 snapshots) - JS-rendered, won't work
- **Implementation**: N/A - **SKIP**
- **Notes**:
  - **Platform**: Magento 2 (Apache/PHP)
  - **Protection**: DataDome + Akamai (heavy anti-bot)
  - **Pandora URL**: `/jewelry-brands/pandora.html`
  - **DIFFERENT COMPANY** from reedsjewelers.com (Wilmington, NC based)
  - **SKIP**: Archive pages are JS-rendered with no product data in HTML
  - Live scraping not viable due to DataDome + Akamai protection

---

### 10. Reeds Jewelers (reedsjewelers.com)
- **URL**: https://www.reedsjewelers.com/
- **Research Status**: [x] Complete
- **API Found**: [ ] No public API
- **Web Scrape Needed**: [x] Yes - HTML parsing required
- **Archive.org Coverage**: [ ] None for Pandora URLs
- **Implementation**: [ ] Not Started
- **Notes**:
  - **Platform**: Magento 2 (WeltPixel theme, behind Cloudflare)
  - **DIFFERENT COMPANY** from reeds.com (WNY family-owned, 112+ years)
  - **Pandora URL**: `/brands/pandora`
  - Lower priority - no archive coverage, Cloudflare protection

---

### 11. The Source Jewelers
- **URL**: https://www.thesourcejewelers.com/
- **Research Status**: [x] Complete
- **API Found**: [ ] No public API
- **Web Scrape Needed**: [x] Yes - HTML parsing required
- **Archive.org Coverage**: [ ] None for Pandora URLs
- **Implementation**: [ ] Not Started
- **Notes**:
  - **Platform**: Custom jewelry platform (shopfinejewelry.com backend)
  - Images via jewelryimages.net CDN
  - Rochester, NY based
  - Need to verify if they sell Pandora

---

## Research Checklist (per site)

1. **Check for API**:
   - Open browser DevTools Network tab
   - Navigate to Pandora/charms section
   - Look for JSON/XHR requests
   - Check for GraphQL endpoints
   - Look for `/api/`, `/v1/`, `graphql` in URLs

2. **Identify Platform**:
   - Shopify: Look for `cdn.shopify.com`, `/products.json`
   - BigCommerce: Look for `/api/storefront/`
   - Magento: Look for `/rest/V1/` or `/graphql`
   - WooCommerce: Look for `/wp-json/wc/`
   - Salesforce Commerce Cloud: Look for `demandware`

3. **Check Archive.org**:
   - Query: `https://web.archive.org/cdx/search/cdx?url=DOMAIN/pandora*&matchType=prefix&output=json&limit=5`
   - Note date range and snapshot count

4. **Filter Strategy**:
   - URL contains "pandora"
   - Brand field = "Pandora"
   - Category/collection filtering

---

## Progress Summary

| Site | Research | API | Products | Archive | Implement? |
|------|----------|-----|----------|---------|------------|
| Albert's Jewelers | **DONE** | Sitemap | 1,931 | 500+ | Done (HTML) |
| Ben Bridge | **DONE** | Archive | 855+ | 10,775 | Done (archive) |
| Boolchand's | **DONE** | POST API (browser) | 1,278 | 2,399 | Done |
| Elisa Ilana | **DONE** | Shopify | 1,014 | 100+ | Done |
| Hannoush | **DONE** | Shopify | 180 | None | Done |
| Amazon | Done | PA-API only | ? | 2 | Skip |
| Smyth Jewelers | Done | Shopify | 0 | None | Skip (no Pandora) |
| Potter & Ranch | Done | N/A | N/A | N/A | Skip (horse ranch) |
| REEDS (reeds.com) | Done | No | ? | 360 (JS) | Skip (JS-rendered) |
| Reeds (reedsjewelers.com) | Done | No | ? | None | Low priority |
| The Source Jewelers | Done | No | ? | None | Maybe (verify Pandora) |

## Priority Order for Implementation

1. **Hannoush** - Shopify API, 180 products - **DONE**
2. **Elisa Ilana** - Shopify API, 1,014 products - **DONE**
3. **Boolchand's** - POST API (browser), 1,278 products - **DONE**
4. **Ben Bridge (Archive)** - 855 products in 2021 sitemap - **DONE**
5. **Albert's Jewelers** - Sitemap + HTML, 1,931 products - **DONE**
6. **REEDS reeds.com** - JS-rendered, no product data in HTML - **SKIP**

## Implementation Complete

All viable scrapers have been implemented:
- **Live retailers**: Hannoush, Elisa Ilana, Boolchand's, Albert's
- **Archive**: Ben Bridge (historical data via archive.org)
- **Skipped**: Amazon (ToS), Smyth (no Pandora), Potter & Ranch (not jewelry), REEDS (JS), reedsjewelers (no archive), The Source (unverified)

Total estimated products: ~5,400 Pandora products across all sources
