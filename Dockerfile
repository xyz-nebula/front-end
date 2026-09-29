# ---- Build stage ----
FROM node:24.14.1-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_SERVICE_MODE=real
ARG VITE_API_BASE_URL=/api
ARG VITE_API_TIMEOUT_MS=20000
ARG VITE_MOCK_LATENCY_MS=350
ARG VITE_AUDIO_WS_URL=/audio/v1/audio-stream

ENV VITE_SERVICE_MODE=$VITE_SERVICE_MODE \
    VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_API_TIMEOUT_MS=$VITE_API_TIMEOUT_MS \
    VITE_MOCK_LATENCY_MS=$VITE_MOCK_LATENCY_MS \
    VITE_AUDIO_WS_URL=$VITE_AUDIO_WS_URL

RUN npm run build

# ---- Serve stage ----
FROM nginx:1.27-alpine AS serve

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
