FROM node:16-alpine as build-stage

WORKDIR /app

RUN apk add --no-cache rsync

COPY package.json package-lock.json /app/
RUN npm ci

COPY create_dist.sh \
    webpack.config.js \
    /app/

COPY src /app/src

RUN npm run build

# Stage 2: Nginx pour la production
FROM nginxinc/nginx-unprivileged:alpine as prod-stage
COPY --from=build-stage /app/dist /usr/share/nginx/html

