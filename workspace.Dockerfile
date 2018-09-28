FROM mhart/alpine-node:10

RUN apk update && apk upgrade && apk add git && apk add python && apk add make && apk add g++

RUN npm i -g truffle@4.1.14
VOLUME /usr/src/workspace
WORKDIR /usr/src/workspace
