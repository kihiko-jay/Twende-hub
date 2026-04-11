FROM node:22-alpine AS base

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

RUN npm run build

FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production

COPY --from=base /app /app

EXPOSE 3000

CMD ["npm", "run", "dev"]

