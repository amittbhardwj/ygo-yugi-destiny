FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE ${PORT:-3001}

CMD ["node", "server/main.js"]
