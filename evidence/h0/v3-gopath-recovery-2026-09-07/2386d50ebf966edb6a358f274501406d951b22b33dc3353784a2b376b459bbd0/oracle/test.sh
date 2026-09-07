#!/bin/sh
set -eu
export GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local GOCACHE=/tmp/go-cache GOPATH=/tmp/gopath GO111MODULE=off
mkdir -p /tmp/gopath/src/github.com/dop251
ln -s /work /tmp/gopath/src/github.com/dop251/goja
cd '/tmp/gopath/src/github.com/dop251/goja'
exec /work/h0.test -test.v -test.run '^Test'
