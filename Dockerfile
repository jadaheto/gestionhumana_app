# ---- build ----
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install -g npm@11.21.0 && npm ci
COPY . .
RUN npm run build

# ---- runtime ----
FROM node:24-alpine
RUN apk add --no-cache poppler-utils
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install -g npm@11.21.0 && npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY database ./database
EXPOSE 3001
CMD ["node", "dist/main.js"]
