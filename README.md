# UK Property Analyzer

A web application that analyzes UK property listings from Rightmove, enriching them with nearby rail/tube stations, school attendance data, commute time comparisons, and an AI-powered summary report.

## What You'll Get

Paste any Rightmove property URL and receive a comprehensive report including:

- **Property Summary** — Price, bedrooms, bathrooms, square footage, property type, and main property photo
- **Price per sqft** — Calculated automatically
- **EPC Rating** — Energy Performance Certificate with visual graph
- **Nearest Rail Stations** — Walking times from Google Maps with train operator badges (e.g. Thameslink, GWR)
- **Nearest Tube Stations** — With colour-coded line badges (e.g. Northern, Victoria, Elizabeth)
- **Commute Comparison** — Transit time to Bloomberg HQ and UCL, benchmarked against your current address
- **Schools Attended** — Which primary and secondary schools local children actually attend (from Locrating)
- **AI Summary Report** — Analysis from Claude Opus covering value, location, transport, and schools
- **Saved Properties** — All analyzed properties are auto-saved and accessible from the dashboard
- **Dark Mode** — Toggle between light and dark themes (persists across sessions)
- **Activity Log** — View server-side logs for each analysis

## Data Sources

| Data | Source |
|------|--------|
| Property details, price, photos | Rightmove |
| Coordinates & door number | Postcodes.io + Google Reverse Geocoding |
| Rail & tube stations | Google Places API |
| Walking distances & times | Google Distance Matrix API |
| Tube line information | TfL Unified API |
| Train operators | Wikidata API + static lookup |
| Commute times | Google Distance Matrix API (transit mode) |
| School attendance data | Locrating.com (LSOA/neighbourhood data) |
| AI summary | OpenRouter (Anthropic Claude Opus) |

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

# Optional: Auth for protected routes
AUTH_SECRET=your_auth_secret
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
- **OpenRouter API** — Free tier available at [openrouter.ai](https://openrouter.ai)
- **TfL API** — No key required (free, unauthenticated)

## Architecture

The app uses parallel API calls for fast loading:

```
/api/analyze     → Property data (scrape + geocode) — ~3-5s
  ├→ /api/stations  → Rail & tube stations (parallel)
  ├→ /api/commute   → Commute time comparison (parallel)
  ├→ /api/schools   → School attendance data (parallel)
  └→ /api/ai-analysis → Claude Opus summary (after schools)
```

The Property Summary card appears within 3-5 seconds. Stations, commute times, schools, and AI analysis load independently with their own loading spinners.

## Tech Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Prisma · SQLite · Playwright · Cheerio
