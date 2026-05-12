FROM node:18-alpine

WORKDIR /app

# Install root deps
COPY package*.json ./
RUN npm ci

# Install client deps
COPY client/package*.json ./client/
RUN cd client && npm ci

# Copy all source
COPY . .

# Build client
RUN npm run build

EXPOSE ${PORT:-3001}

CMD ["node", "server/main.js"]
