FROM node:8.11.1-alpine

ENV NODE_ENV=production

RUN mkdir /app
WORKDIR /app
COPY package.json package-lock.json /app/

ENV NPM_CONFIG_LOGLEVEL info
RUN npm i

COPY . /app

EXPOSE 8080
USER node

CMD ["npm", "start"]
