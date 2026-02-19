# UK Property Analyzer

A web application that analyzes UK property listings from Rightmove, enriching them with nearby rail/tube stations, school attendance data, and AI-powered insights.

## What You'll Get

Paste any Rightmove property URL and receive a comprehensive report including:

- **Property Details** — Price, bedrooms, bathrooms, square footage, property type
- **Price per Sq Ft** — Calculated automatically
- **EPC Rating** — Energy Performance Certificate with visual graph
- **Nearest Rail Stations** — Walking times from Google Maps
- **Nearest Tube Stations** — For London properties
- **Schools Attended** — Which primary and secondary schools local children actually attend (from Locrating)
- **AI Analysis** — Two summary reports from different AI models (Gemini & Claude)

## Data Sources

| Data | Source |
|------|--------|
| Property details, price, photos | Rightmove |
| Coordinates & door number | Postcodes.io + Google Reverse Geocoding |
| Rail & tube stations | Google Places API |
| Walking distances & times | Google Distance Matrix API |
| School attendance data | Locrating.com (LSOA/neighbourhood data) |
| AI summaries | OpenRouter (Google Gemini, Anthropic Claude) |

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
# Google Maps (required for stations & geocoding)
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# OpenRouter (required for AI summaries)
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

- **Google Maps API** — Enable Places API, Geocoding API, and Distance Matrix API
- **OpenRouter API** — Free tier available at [openrouter.ai](https://openrouter.ai)

## Tech Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS · Prisma · SQLite · Playwright · Cheerio