# ---- Build stage: compile native deps (bcrypt) with full build tools ----
FROM node:22-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

# ---- Runtime stage: slim base, no compilers, just the app ----
FROM node:22-slim

# PostgreSQL client tools for backup functionality
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Pull in already-compiled node_modules from the builder stage instead of
# reinstalling - avoids needing python3/make/g++ (and bcrypt's compiler) in
# the final image.
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Expose port (should match your app)
EXPOSE 3000

# Start the app
CMD ["npm", "start"]
