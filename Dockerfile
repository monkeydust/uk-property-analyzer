FROM node:20-bookworm

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies for build/playwright)
RUN npm ci

# Install Playwright dependencies (only chromium is needed)
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install --with-deps chromium

# Copy remaining source code
COPY . .

# Create the data directory for SQLite that will be mounted as a volume
RUN mkdir -p /app/data

# Environment to point Prisma to the persistent volume
ENV DATABASE_URL="file:/app/data/production.db"

# Generate prisma client
RUN npx prisma generate

# Build Next.js
RUN npm run build

# Set environment to production
ENV NODE_ENV=production

# Expose port 3000
EXPOSE 3000

# Copy and prepare startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Start: sync DB schema, launch Next.js, warm up key routes in background
CMD ["/app/start.sh"]
