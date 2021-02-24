FROM node:10-buster
WORKDIR /usr/src/app

COPY package.json .
COPY package-lock.json .
COPY tsconfig.json .

RUN npm install -g typescript ts-node
RUN npm install
