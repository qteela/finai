FROM node:20-alpine

WORKDIR /app

# Install dependency dulu supaya layer ini ter-cache selama package.json tidak berubah
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 3000

# Jalan sebagai user biasa (bukan root)
USER node
CMD ["node", "server.js"]
