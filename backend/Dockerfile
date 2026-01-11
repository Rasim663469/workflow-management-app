# --- Step 1: Build TypeScript ---
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npx tsc -p tsconfig.json --pretty false --noEmitOnError false && \
    echo "👍  TypeScript compilation completed" && \
    ls -la dist


# --- Step 2: Production runtime ---
FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache python3 build-base

COPY --from=build /app/dist ./dist
COPY package*.json ./

RUN npm ci --omit=dev

EXPOSE 4000

CMD ["node", "dist/server.js"]
