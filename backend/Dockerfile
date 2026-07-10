FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

RUN addgroup -S nodejs && adduser -S appuser -G nodejs

USER appuser

ENV NODE_ENV=production

EXPOSE 5000

CMD ["node", "src/server.js"]