# UK Property Analyzer

A web application that analyzes UK property listings from Rightmove, enriching them with market insights, nearby rail/tube stations, school attendance data, commute time breakdowns, and an AI-powered summary report. Designed for home buyers.

## What You'll Get

Paste any Rightmove property URL and receive a comprehensive report including:

- **Property Summary** — Price, bedrooms, bathrooms, square footage, property type, and main property photo
- **Market Insights** — Independent valuation, 5-year growth, council tax band, crime rating, flood risk, and conservation area status
- **Price Analysis** — Compare Rightmove price vs. market estimate to identify overpriced/underpriced properties
- **Price per sqft** — Calculated automatically
- **Plot Size** — Total land area in acres (from HM Land Registry)
- **EPC Rating** — Energy Performance Certificate with visual graph
- **Nearest Rail Stations** — Walking times from Google Maps with train operator badges (e.g. Thameslink, GWR)
- **Nearest Tube Stations** — With colour-coded line badges (e.g. Metropolitan, Northern, Elizabeth). Dual-purpose stations (e.g. Chalfont & Latimer) are correctly shown in both rail and tube lists
- **Commute Breakdown** — Step-by-step transit journey to Bloomberg HQ and UCL showing walk → train → tube → walk legs with line names, station-to-station detail, and stop counts
- **Schools Attended** — Which primary and secondary schools local children actually attend (from Locrating)
- **AI Summary Report** — Analysis from Gemini Flash covering value, location, transport, schools, and negotiation strategy
- **Saved Properties** — All analyzed properties are auto-saved to a central SQLite database and accessible from the dashboard
- **Parallel Processing** — Multiple searches can be processed in the background simultaneously
- **Mobile Optimized** — Touch-friendly UI with clear actions and mobile-first navigation
- **Modern UI** — Clean, modern aesthetic with dark mode support and custom branding
- **Direct Links** — Click any property image to go straight to the Rightmove listing
- **Activity Log** — View real-time server-side logs for each analysis
- **Navigation** — Easy switching between the property dashboard and detailed analysis views
- **API Credits Display** — Live PropertyData and OpenRouter credit balances shown in the header

## Home Buyer Focus

This tool is designed specifically for home buyers, not investors or renters. Features include:

- **Market Valuation** — Independent estimate to assess if a property is fairly priced
- **Negotiation Insights** — AI analysis of pricing relative to market value
- **5-Year Growth Trends** — Understand long-term capital appreciation potential
- **Ownership Costs** — Council tax band, conservation area restrictions, and risks
- **Safety & Environment** — Crime ratings and flood risk assessments

## Data Sources

| Data | Source |
|------|--------|
| Property details, price, photos | Rightmove (packed `__PAGE_MODEL` decoder) |
| Market valuation, growth, ownership data | PropertyData API (HM Land Registry) |
| Plot size & title information | PropertyData API (HM Land Registry) |
| Crime ratings & flood risk | PropertyData API |
| Coordinates & door number | Google Reverse Geocoding + Rightmove PAGE_MODEL |
| Rail & tube stations | Google Places API |
| Walking distances & times | Google Distance Matrix API |
| Tube line information | TfL Unified API + built-in station line map |
| Train operators | Wikidata API + static lookup |
| Commute journey breakdown | Google Directions API (transit mode) |
| School attendance data | Locrating.com (LSOA/neighbourhood data) |
| AI summary | OpenRouter (Google Gemini Flash) |

### About PropertyData

The app integrates with [PropertyData](https://propertydata.co.uk), the UK's most comprehensive property data API, providing:
- Independent market valuations based on comparable sales
- 5-year capital growth trends by postcode
- HM Land Registry title information (plot sizes, tenure)
- Council tax bands
- Crime and flood risk assessments
- Conservation area status

PropertyData requires an API key. Sign up at [propertydata.co.uk/api](https://propertydata.co.uk/api/pricing).

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/monkeydust/uk-property-analyzer.git
cd uk-property-analyzer
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env` file in the root directory:

```env
# Google Maps (required for stations, geocoding & commute times)
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# OpenRouter (required for AI summary)
OPENROUTER_API_KEY=your_openrouter_api_key

# PropertyData (required for market insights & plot sizes)
PROPERTYDATA_API_KEY=your_propertydata_api_key

# Optional: Auth for protected routes
AUTH_SECRET=your_auth_secret
SITE_PASSWORD=your_site_password
```

### 4. Initialize the database

```bash
npx prisma generate
npx prisma db push
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## API Keys Needed

- **Google Maps API** — Enable Places API, Geocoding API, Distance Matrix API, and Directions API
- **PropertyData API** — Required for market insights. Packages from £28/month at [propertydata.co.uk/api/pricing](https://propertydata.co.uk/api/pricing)
- **OpenRouter API** — Free tier available at [openrouter.ai](https://openrouter.ai)
- **TfL API** — No key required (free, unauthenticated)

## Architecture

The app uses parallel API calls for fast loading:

```
/api/analyze     → Property data (scrape + geocode) — ~3-5s
  ├→ /api/market-data → Market valuation & risks (parallel)
  ├→ /api/stations    → Rail & tube stations (parallel)
  ├→ /api/commute     → Step-by-step commute breakdown (parallel)
  ├→ /api/schools     → School attendance data (parallel)
  ├→ /api/plot-size   → Land registry plot size (parallel)
  └→ /api/ai-analysis → AI summary (after all data)
```

The Property Summary and Market Insights cards appear within 3-5 seconds. Stations, commute times, schools, and AI analysis load independently with their own loading spinners.

### Rightmove Scraper

The scraper handles Rightmove's packed JSON encoding (`window.__PAGE_MODEL`):
1. **Detection**: Identifies the `__PAGE_MODEL` script tag with `{ data: "...", encoding: "on" }` wrapper
2. **Unpacking**: Parses the packed array format where numeric values are indices into a shared lookup array
3. **Extraction**: Reads structured property data (postcode, coordinates, bedrooms, EPC, sizings) from the decoded object
4. **Fallback**: Legacy `window.PAGE_MODEL` (plain JSON) is still supported for older listings

### Market Data Flow

1. **Address Matching**: The property address is matched to a UPRN (Unique Property Reference Number) via PropertyData
2. **UPRN to Title**: The UPRN is used to find the HM Land Registry title number
3. **Data Aggregation**: Multiple PropertyData endpoints are queried in parallel:
   - `/valuation-sale` — Market estimate based on comparables
   - `/growth` — 5-year capital growth trends
   - `/council-tax` — Local authority tax band
   - `/crime` — Area crime rating
   - `/flood-risk` — Flood risk assessment
   - `/conservation-area` — Planning restrictions
4. **Fallback Logic**: If the exact address isn't in the UPRN database (common with new builds), the system uses nearby properties on the same street (marked with * in the UI)

### Station Classification

Stations are fetched via Google Places API with cross-referencing against a built-in tube line database:
- Stations typed as `train_station` by Google but also serving tube lines (e.g. Chalfont & Latimer = Metropolitan line) are correctly shown in both rail and tube lists
- Tube line colours and badges are mapped from the built-in station database

## Tech Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Prisma · SQLite · Playwright · Cheerio
