FROM node:24.21.0-alpine

WORKDIR /app

# Copia só os manifests primeiro para o Docker reaproveitar o cache do npm ci.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev"]
