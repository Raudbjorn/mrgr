#!/bin/sh
set -eu
export GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local GOCACHE=/tmp/go-cache GOPATH=/tmp/gopath GO111MODULE=off
mkdir -p /tmp/gopath/src/github.com/buger
ln -s /work /tmp/gopath/src/github.com/buger/goreplay
cd '/tmp/gopath/src/github.com/buger/goreplay/raw_socket_listener'
exec /work/h0.test -test.v -test.run '^Test'
