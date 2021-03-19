FROM mhart/alpine-node:12.4.0

RUN apk update && apk upgrade && apk add git && apk add python && apk add make && apk add g++ && apk add autoconf && apk add libtool && apk add automake

ADD . /usr/src/rpc

WORKDIR /usr/src/rpc
RUN yarn

CMD yarn rpc