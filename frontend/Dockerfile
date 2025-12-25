# Stage 1: Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy application code
COPY . .

# Build the application
RUN yarn build

# Stage 2: Production stage
FROM node:20-alpine

WORKDIR /app

# Install serve to run the production build
RUN yarn global add serve

# Copy built assets from build stage
COPY --from=build /app/build ./build

# Expose port
EXPOSE 3000

# Serve the production build
CMD ["serve", "-s", "build", "-l", "3000"]

