# UK Property Analyzer

A web application that analyzes UK property listings from Rightmove, enriching them with market insights, nearby rail/tube stations, school attendance data, commute time comparisons, and an AI-powered summary report. Designed for home buyers.

## What You'll Get

Paste any Rightmove property URL and receive a comprehensive report including:

- **Property Summary** — Price, bedrooms, bathrooms, square footage, property type, and main property photo
- **Market Insights** — Independent valuation, 5-year growth, council tax band, crime rating, flood risk, and conservation area status
- **Price Analysis** — Compare Rightmove price vs. market estimate to identify overpriced/underpriced properties
- **Price per sqft** — Calculated automatically
- **Plot Size** — Total land area in acres (from HM Land Registry)
- **EPC Rating** — Energy Performance Certificate with visual graph
- **Nearest Rail Stations** — Walking times from Google Maps with train operator badges (e.g. Thameslink, GWR)
- **Nearest Tube Stations** — With colour-coded line badges (e.g. Northern, Victoria, Elizabeth)
- **Commute Comparison** — Transit time to Bloomberg HQ and UCL, benchmarked against your current address
- **Schools Attended** — Which primary and secondary schools local children actually attend (from Locrating)
- **AI Summary Report** — Analysis from Claude Opus covering value, location, transport, schools, and negotiation strategy
- **Saved Properties** — All analyzed properties are auto-saved to a central SQLite database and accessible from the dashboard
- **Parallel Processing** — Multiple searches can be processed in the background simultaneously
- **Mobile Optimized** — Touch-friendly UI with clear actions and mobile-first navigation
- **Modern UI** — Clean, modern aesthetic with dark mode support and custom branding
- **Direct Links** — Click any property image to go straight to the Rightmove listing
- **Activity Log** — View real-time server-side logs for each analysis
- **Navigation** — Easy switching between the property dashboard and detailed analysis views

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
| Property details, price, photos | Rightmove |
| Market valuation, growth, ownership data | PropertyData API (HM Land Registry) |
| Plot size & title information | PropertyData API (HM Land Registry) |
| Crime ratings & flood risk | PropertyData API |
| Coordinates & door number | Postcodes.io + Google Reverse Geocoding |
| Rail & tube stations | Google Places API |
| Walking distances & times | Google Distance Matrix API |
| Tube line information | TfL Unified API |
| Train operators | Wikidata API + static lookup |
| Commute times | Google Distance Matrix API (transit mode) |
| School attendance data | Locrating.com (LSOA/neighbourhood data) |
| AI summary | OpenRouter (Anthropic Claude Opus) |

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
  ├→ /api/commute     → Commute time comparison (parallel)
  ├→ /api/schools     → School attendance data (parallel)
  └→ /api/ai-analysis  → Claude Opus summary (after all data)
```

The Property Summary and Market Insights cards appear within 3-5 seconds. Stations, commute times, schools, and AI analysis load independently with their own loading spinners.

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

## Tech Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Prisma · SQLite · Playwright · Cheerio
