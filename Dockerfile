FROM node:12-buster-slim
WORKDIR /usr/src/app

COPY package.json .
COPY package-lock.json .
COPY tsconfig.json .

RUN npm install -g typescript ts-node
RUN npm install
