# Offering UK Property Analyzer as a Service — Options & Ideas

## Context

You've built a property analysis tool that takes a Rightmove URL and returns a rich JSON blob containing: property details, price, EPC, nearest stations with walking times, and schools attended data. Right now it's a Next.js web app you run locally. You want to know how you could offer this to other people or apps.

## What You Already Have

Your app already has two working API endpoints:

| Endpoint | Input | Output |
|----------|-------|--------|
| `POST /api/analyze` | `{ url: "rightmove.co.uk/..." }` | Full property JSON (price, beds, EPC, stations, etc.) |
| `GET /api/schools?address=...` | Address string | Schools attended with Ofsted ratings |

These are already REST API endpoints. If you deployed this app to a server, anyone with the URL could call them right now. That's the starting point.

---

## Option 1: Simple REST API (Easiest — what you basically have)

**What it is:** You deploy your Next.js app to a server. Other people send HTTP requests, get JSON back. Exactly like calling `curl` against your local app, but on the internet.

**How someone would use it:**
```
POST https://your-domain.com/api/analyze
Body: { "url": "https://www.rightmove.co.uk/properties/123456" }
→ Returns the full property JSON
```

**What you'd need to add:**
- **API keys** — so you know who's calling and can limit abuse. A simple `x-api-key` header that you check before processing requests
- **Rate limiting** — e.g. 100 requests per hour per API key, so one user can't hog all your resources
- **A single combined endpoint** — right now property + schools are two separate calls. You could offer a `/api/property` endpoint that returns everything in one go (the JSON structure you already built with schools included)
- **Deploy somewhere** — a VPS (like a £5/month DigitalOcean or Hetzner server) since you need Playwright (headless browser), which rules out serverless platforms like Vercel

**Pros:** Dead simple, you're 80% there already
**Cons:** Each request takes 15-30 seconds (Playwright scraping is slow), so it doesn't scale well to lots of users

---

## Option 2: REST API with a Job Queue (Better for production)

**What it is:** Same REST API, but instead of making the caller wait 30 seconds, you immediately return a job ID. The caller polls back to check when it's done.

**How someone would use it:**
```
Step 1: POST /api/analyze  { url: "..." }
     → Returns: { jobId: "abc123", status: "processing" }

Step 2: GET /api/jobs/abc123  (poll every few seconds)
     → Returns: { status: "processing" } ... eventually ...
     → Returns: { status: "complete", data: { ...full property JSON... } }
```

**What you'd need to add:**
- A simple database or Redis to store jobs and results
- A background worker that processes the Playwright scraping
- API keys + rate limiting (same as Option 1)

**Pros:** Callers don't get timeouts, you can queue multiple requests, feels more professional
**Cons:** More moving parts to build and maintain

---

## Option 3: Webhook/Callback Model

**What it is:** Caller submits a URL and a callback URL. When processing is done, YOU send the result to THEM.

**How someone would use it:**
```
POST /api/analyze
{ url: "rightmove.co.uk/...", callbackUrl: "https://their-app.com/webhook/property" }
→ Returns: { jobId: "abc123", status: "accepted" }

... 30 seconds later, YOUR server sends a POST to their callbackUrl with the full result
```

**Pros:** No polling needed, great for integration into other apps
**Cons:** More complex, the caller needs to have a server to receive the webhook

---

## Option 4: Sell Access to the Web App (Simplest business model)

**What it is:** Don't build an API at all. Just put your existing web UI behind a login page. Charge per month or per lookup.

**How someone would use it:** They log in, paste a Rightmove URL, get the nice visual results + copy the JSON.

**What you'd need to add:**
- User authentication (login/signup)
- A payment system (Stripe)
- Usage tracking

**Pros:** Zero API work, your UI is already built and polished
**Cons:** Limited to manual use, can't be integrated into other apps

---

## How Credentials & Customer Access Work

There are **two layers** of credentials — yours and your customers':

### Your credentials (hidden, server-side only)
These never leave your server. Your customers never see them:
- **Locrating email/password** — your account, stored in `.env` on your server
- **Google Maps API key** — your key, stored in `.env` on your server
- Playwright scrapes Rightmove — no credentials needed, but runs on your server

Your server is the middleman. It uses YOUR credentials to talk to Locrating, Google, etc. and returns the processed result.

### Customer credentials (API keys YOU generate for them)
You create a simple API key for each customer — just a random string like `pk_a8f3bc91d4e7`. They include it in every request:

```
curl -X POST https://your-domain.com/api/property \
  -H "x-api-key: pk_a8f3bc91d4e7" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.rightmove.co.uk/properties/123456"}'
```

### The flow visualised:

```
Customer's app                    Your server                     Third-party services
─────────────                    ───────────                     ────────────────────
                                 .env file:
                                   LOCRATING_EMAIL=you@email.com
                                   LOCRATING_PASSWORD=secret
                                   GOOGLE_MAPS_API_KEY=AIza...
                                   API_KEYS=pk_a8f3bc91d4e7,pk_b2c4...

1. POST /api/property ──────►  2. Check x-api-key header
   x-api-key: pk_a8f3...          Is "pk_a8f3..." in our list? ✓
   body: { url: "..." }
                                3. Scrape Rightmove ──────────►  Rightmove.co.uk
                                   (Playwright, no auth needed)   ◄── HTML page

                                4. Get schools ───────────────►  Locrating.com
                                   (using YOUR login)             ◄── School data

                                5. Get walking times ──────────► Google Maps API
                                   (using YOUR API key)           ◄── Distance data

                                6. Combine everything into JSON

   ◄──────────────────────────  7. Return full JSON to customer
```

### Key point:
- Your customers **never touch** Locrating, Google, or Rightmove directly
- They just call YOUR API with the key you gave them
- You pay for the Google Maps usage, the Locrating account, the server
- You charge customers enough to cover those costs + profit
- If a customer abuses it, you revoke their key

### How you'd manage API keys (simple version to start):
Just a comma-separated list in your `.env` file:
```
API_KEYS=pk_customer1_a8f3bc91,pk_customer2_d4e7f123,pk_customer3_9b2c4d56
```
Later you could move this to a database with usage tracking, but env vars work fine for 5-10 customers.

---

## My Recommendation: Start with Option 1, design for Option 2

The practical path:

1. **Create a single combined endpoint** `/api/property` that returns everything (property + schools) in one JSON response — you already have the merged JSON structure
2. **Add API key auth** — simple middleware that checks an `x-api-key` header
3. **Add basic rate limiting** — in-memory or Redis-based, per API key
4. **Deploy to a VPS** — a simple Linux server with Node.js + Playwright
5. **Later**, if demand grows, add the job queue (Option 2) so requests don't timeout

## Implementation Plan

### Files to create/modify

| # | Task | File |
|---|------|------|
| 1 | Create combined `/api/property` endpoint | `src/app/api/property/route.ts` (new) |
| 2 | API key middleware | `src/lib/middleware/apiKey.ts` (new) |
| 3 | Rate limiting middleware | `src/lib/middleware/rateLimit.ts` (new) |
| 4 | Wire middleware into property route | `src/app/api/property/route.ts` |
| 5 | Keep existing UI routes unprotected (or add optional auth later) | No changes needed |

### Step 1: Combined `/api/property` endpoint

A new `POST /api/property` that:
- Accepts `{ url: "rightmove.co.uk/...", includeSchools?: boolean }`
- Calls the existing Rightmove scraper internally
- If `includeSchools` is true (default), also calls the schools scraper
- Returns the combined JSON (property + schoolsAttended) in one response
- Reuses existing functions: `scrapeProperty()` from `src/lib/scraper/rightmove.ts`, `getAttendedSchools()` from `src/lib/scraper/locrating.ts`

### Step 2: API key auth middleware

Simple function that:
- Reads `x-api-key` header from the request
- Checks it against a list of valid keys (stored in env var or a simple JSON file to start)
- Returns 401 if invalid
- Attaches the key identity to the request for rate limiting

### Step 3: Rate limiting

Simple in-memory rate limiter:
- Tracks requests per API key per time window (e.g. 50/hour)
- Returns 429 Too Many Requests if exceeded
- Can be upgraded to Redis later for multi-server deployment

### Step 4: Wire it together

The `/api/property` route handler:
1. Check API key → 401 if invalid
2. Check rate limit → 429 if exceeded
3. Validate input (must be a Rightmove URL)
4. Run property scraper
5. Run schools scraper (if requested)
6. Return combined JSON

## Verification

1. `npx tsc --noEmit` — no TypeScript errors
2. `npx next build` — clean build
3. Test without API key: `curl -X POST http://localhost:3000/api/property -d '{"url":"..."}' -H "Content-Type: application/json"` → 401
4. Test with API key: `curl -X POST http://localhost:3000/api/property -H "x-api-key: test-key" -d '{"url":"..."}' -H "Content-Type: application/json"` → full JSON response with property + schools
5. Test rate limiting: rapid-fire requests → 429 after threshold
6. Existing UI (`/`) continues to work without any API key
