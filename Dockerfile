FROM node:20-slim

WORKDIR /app

COPY package*.json ./

# Cài các gói build cho node-gyp và opus
RUN apt update && apt install -y python3 make g++ && apt upgrade -y
RUN apt update && apt install -y ffmpeg python3 make g++ && apt upgrade -y

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
