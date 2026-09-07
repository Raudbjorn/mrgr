#!/bin/sh
set -eu
export GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local GOCACHE=/tmp/go-cache GOPATH=/tmp/gopath GO111MODULE=off
mkdir -p /tmp/gopath/src/github.com/olahol
ln -s /work /tmp/gopath/src/github.com/olahol/melody
cd '/tmp/gopath/src/github.com/olahol/melody'
exec /work/h0.test -test.v -test.run '^Test'
