FROM mhart/alpine-node:8.9.4

RUN apk update && apk upgrade && apk add git && apk add python && apk add make && apk add g++

RUN npm i -g truffle@4.0.4
VOLUME /usr/src/workspace
WORKDIR /usr/src/workspace
