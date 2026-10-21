# Production image for Ours: a self-contained Next.js server (standalone output).
#   docker build --build-arg APP_BUILD=$(git rev-parse HEAD) -t ours .
#   docker run -p 3000:3000 -e DATABASE_URL=... -e APP_PIN=... ours
# On start it applies db/schema.sql (idempotent), then serves on $PORT.

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:24-alpine AS build
WORKDIR /app
ARG APP_BUILD=dev
ENV NEXT_TELEMETRY_DISABLED=1 BUILD_STANDALONE=1 APP_BUILD=$APP_BUILD
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/db ./db
COPY --from=build --chown=node:node /app/scripts/setup.mjs ./scripts/setup.mjs
USER node
EXPOSE 3000
# Liveness only: a database check every 30 s would keep a serverless Postgres from ever sleeping.
# (Start-up already waited for the database; /api/health/ready is there for load balancers.)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Set SKIP_DB_SETUP=1 when a separate job applies the schema. If setup fails, the container exits.
CMD ["sh", "-c", "if [ \"$SKIP_DB_SETUP\" != 1 ]; then node scripts/setup.mjs || exit 1; fi; exec node server.js"]
