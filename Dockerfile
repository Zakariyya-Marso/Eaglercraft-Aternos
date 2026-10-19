# Production Dockerfile for Eaglercraft Minecraft Proxy
FROM node:20-alpine

WORKDIR /app

# Install dependencies (only production packages: ws)
COPY package*.json ./
RUN npm ci --only=production

# Copy application source
COPY server.js ./

# Set environment defaults
ENV PORT=8080
ENV TARGET_HOST=127.0.0.1
ENV TARGET_PORT=25565

EXPOSE 8080

CMD ["node", "server.js"]
