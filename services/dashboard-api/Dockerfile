# Cloud Run image for the dashboard API (docs/intelligence/dashboard-api.md). Standard library only.
# Pin the base image by digest when deploying.
FROM node:22-slim
WORKDIR /app
COPY keys.mjs server.mjs ./
USER node
ENV NODE_ENV=production
CMD ["node", "server.mjs"]
