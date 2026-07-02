FROM node:18-alpine

WORKDIR /app

# Install build dependencies for some npm packages (if needed)
RUN apk add --no-cache python3 make g++

# Copy dependency files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY . .

# Expose the Node.js backend port
EXPOSE 8000

ENV NODE_ENV=production
ENV PORT=8000

# Start the Node.js server
CMD ["npm", "start"]
