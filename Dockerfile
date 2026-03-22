FROM mcr.microsoft.com/playwright:v1.42.1-focal

# Set up environment
ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=production
ENV HEADLESS=true
ENV PORT=7860

# Create app directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Install Playwright browsers and their system dependencies
# Also install xvfb to provide a virtual display
RUN apt-get update && apt-get install -y xvfb && npx playwright install chromium --with-deps

# Copy source code
COPY . .

# Expose port
EXPOSE 7860

# Run the bot with xvfb-run
CMD ["xvfb-run", "--server-args=-screen 0 1280x1024x24", "node", "bot.js"]
