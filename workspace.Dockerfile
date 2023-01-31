FROM node:19-bullseye-slim

RUN apt-get update && apt-get install -y \
    git \
    python3 \
    make \
    g++ 

RUN npm i -g truffle@5.7.3
VOLUME /usr/src/workspace
WORKDIR /usr/src/workspace
