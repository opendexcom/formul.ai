# Build stage
FROM node:22-alpine AS build

WORKDIR /app

# Copy package files for dependency installation
COPY package.json ./

# Install dependencies
# removed usage of npm ci because package-lock.json is locked per system 
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the application
CMD [ "npm", "run", "dev", "--", "--host", "0.0.0.0" ]