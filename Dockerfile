# Use official Node.js v22 image
FROM node:22

# Set working directory
WORKDIR /app

# Copy package files and install dependencies first (for better cache)
COPY package*.json ./
RUN npm install --production

# Copy the rest of the app code
COPY . .

# Expose port (should match your app)
EXPOSE 3000

# Start the app
CMD ["npm", "start"]
