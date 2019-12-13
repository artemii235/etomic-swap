FROM mhart/alpine-node:13.3.0

RUN apk update && apk upgrade && apk add git && apk add python && apk add make && apk add g++

RUN npm i -g truffle@5.0.0
VOLUME /usr/src/workspace
WORKDIR /usr/src/workspace
