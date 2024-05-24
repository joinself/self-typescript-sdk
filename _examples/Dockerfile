FROM node:18.15.0-bullseye

RUN apt-get update
RUN apt-get install -y python-is-python3 node-sqlite3

WORKDIR /wd
COPY . .
RUN npm install

WORKDIR /wd/_examples/chat

RUN npm update self-sdk
RUN npm install
RUN npx tsc main.ts

CMD ["node", "./main.js"]
