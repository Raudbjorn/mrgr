#!/bin/sh
set -eu
export GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local GOCACHE=/tmp/go-cache GOPATH=/tmp/gopath GO111MODULE=off
mkdir -p /tmp/gopath/src/github.com/olivere
ln -s /work /tmp/gopath/src/github.com/olivere/elastic
cd '/tmp/gopath/src/github.com/olivere/elastic'
exec /work/h0.test -test.v -test.run '^Test'
