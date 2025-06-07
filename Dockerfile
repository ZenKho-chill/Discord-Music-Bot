# Chọn image base
FROM node:20

# Tạo thư mục trong container
WORKDIR /app

# Copy package.json và package-lock.json vào container
COPY package*.json ./

# Cài đặt các dependencies
RUN npm install

# Copy toàn bộ mã nguồn vào container
COPY . .

# Chạy bot Discord
CMD ["node", "index.js"]
