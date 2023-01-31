FROM node:19-bullseye-slim

RUN apt-get update && apt-get install -y \
    git \
    python3 \
    make \
    g++ 

ADD . /usr/src/rpc

WORKDIR /usr/src/rpc
RUN yarn

CMD yarn rpc