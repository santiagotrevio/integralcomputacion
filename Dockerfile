# ─── Base image ───────────────────────────────────────────────────────────────
FROM node:20-slim

# ─── System deps: Chromium (Puppeteer), Sharp (nativas), SQLite3 ──────────────
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    python3 \
    make \
    g++ \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use the system Chromium (don't download its own)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

# ─── App setup ────────────────────────────────────────────────────────────────
WORKDIR /app

# Install dependencies first (layer cache)
COPY package.json ./
RUN npm install --omit=dev

# Copy application code
COPY . .

# Make sure /data dir exists (volume will be mounted here)
RUN mkdir -p /data

# Expose port
EXPOSE 3000

# ─── Entrypoint ──────────────────────────────────────────────────────────────
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
