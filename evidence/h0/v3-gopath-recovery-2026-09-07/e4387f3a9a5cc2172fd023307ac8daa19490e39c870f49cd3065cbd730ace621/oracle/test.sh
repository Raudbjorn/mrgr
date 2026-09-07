#!/bin/sh
set -eu
export GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local GOCACHE=/tmp/go-cache GOPATH=/tmp/gopath GO111MODULE=off
mkdir -p /tmp/gopath/src/github.com/muesli
ln -s /work /tmp/gopath/src/github.com/muesli/beehive
cd '/tmp/gopath/src/github.com/muesli/beehive/modules/rssbee'
exec /work/h0.test -test.v -test.run '^Test'
