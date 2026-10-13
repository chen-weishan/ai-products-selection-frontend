# Dockerfile
FROM node:22-alpine AS build
RUN apk add --no-cache openjdk21-jre-headless
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run generate:api \
 && npx ng build --configuration production

FROM nginx:1.30-alpine
COPY nginx/default.conf.template \
     /etc/nginx/templates/default.conf.template
COPY --from=build \
     /src/dist/ai-products-selection-frontend/browser \
     /usr/share/nginx/html
ENV API_URL=http://host.docker.internal:8080
EXPOSE 80