FROM mhart/alpine-node:14.16

RUN apk update && apk upgrade && apk add git python make g++ gcompat

ADD . /usr/src/rpc

WORKDIR /usr/src/rpc
RUN yarn

CMD yarn rpc