FROM node:20-slim

WORKDIR /app

COPY package*.json ./

# Cài các gói build cho node-gyp và ffmpeg, opus
RUN apt-get update && \
    apt-get install -y --allow-unauthenticated ca-certificates && \
    apt-get install -y --no-install-recommends \
        python3 \
        make \
        g++ \
        ffmpeg \
        libcairo2-dev \
        libpango1.0-dev \
        libjpeg-dev \
        libgif-dev \
        librsvg2-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN npm install

COPY . .

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD node -e "const http = require('http'); \
    const options = { host: 'localhost', port: 3000, path: '/', timeout: 2000 }; \
    http.get(options, (res) => { \
        if (res.statusCode == 200) process.exit(0); \
        else process.exit(1); \
    }).on('error', () => process.exit(1));"

CMD ["npm", "start"]
