FROM mhart/alpine-node:14.16

RUN apk update && apk upgrade && apk add git python make g++ gcompat

RUN npm i -g truffle@5.5.30
VOLUME /usr/src/workspace
WORKDIR /usr/src/workspace
