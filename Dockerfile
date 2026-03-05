# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS base
WORKDIR /app

ARG NEXT_PUBLIC_EVOLUTION_API_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_AGNO_BASE_URL
ARG NEXT_PUBLIC_AGNO_DEFAULT_PORT
ARG EVOLUTION_API_URL
ARG AGNO_BASE_URL
ARG AGNO_DEFAULT_PORT
ARG DATABASE_URL
ARG POSTGRES_URL

ENV NEXT_PUBLIC_EVOLUTION_API_URL=${NEXT_PUBLIC_EVOLUTION_API_URL}
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_PUBLIC_AGNO_BASE_URL=${NEXT_PUBLIC_AGNO_BASE_URL}
ENV NEXT_PUBLIC_AGNO_DEFAULT_PORT=${NEXT_PUBLIC_AGNO_DEFAULT_PORT}
ENV EVOLUTION_API_URL=${EVOLUTION_API_URL}
ENV AGNO_BASE_URL=${AGNO_BASE_URL}
ENV AGNO_DEFAULT_PORT=${AGNO_DEFAULT_PORT}
ENV DATABASE_URL=${DATABASE_URL}
ENV POSTGRES_URL=${POSTGRES_URL}

ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_ESLINT=0
ENV NEXT_DISABLE_TYPE_CHECKS=1
ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}

FROM base AS builder
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/pnpm/store pnpm install --frozen-lockfile --prefer-offline
COPY . .
RUN --mount=type=cache,target=/pnpm/store --mount=type=cache,target=/app/.next/cache pnpm build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3001
CMD ["node", "server.js"]
