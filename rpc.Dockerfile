FROM mhart/alpine-node:10

RUN apk update && apk upgrade && apk add git && apk add python && apk add make && apk add g++

ADD . /usr/src/rpc

WORKDIR /usr/src/rpc
RUN yarn

CMD yarn rpc