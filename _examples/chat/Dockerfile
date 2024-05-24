FROM node:18.15.0-bullseye
RUN apt-get update
RUN apt-get install -y python-is-python3 node-sqlite3
WORKDIR /usr/example
COPY package.json .
RUN node --version
RUN npm install
COPY . .
RUN npx tsc main.ts
CMD ["node", "./main.js"]
