FROM node:20-slim

# Install Chromium system dependencies and fonts
RUN apt-get update && apt-get install -y \
  ca-certificates \
  fonts-liberation \
  fonts-dejavu-core \
  fonts-liberation2 \
  fonts-noto-color-emoji \
  fonts-roboto \
  fonts-open-sans \
  fontconfig \
  wget \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libxshmfence1 \
  xdg-utils \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# Download and install Virgil font
RUN mkdir -p /usr/share/fonts/truetype/virgil \
  && wget -O /usr/share/fonts/truetype/virgil/Virgil.woff2 https://cdn.jsdelivr.net/gh/excalidraw/excalidraw@master/packages/excalidraw/assets/font/Virgil.woff2 \
  && wget -O /usr/share/fonts/truetype/virgil/Virgil.woff https://cdn.jsdelivr.net/gh/excalidraw/excalidraw@master/packages/excalidraw/assets/font/Virgil.woff \
  && fc-cache -fv

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
