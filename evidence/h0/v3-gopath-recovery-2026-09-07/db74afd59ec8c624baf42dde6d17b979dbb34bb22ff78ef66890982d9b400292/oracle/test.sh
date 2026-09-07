#!/bin/sh
set -eu
export GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local GOCACHE=/tmp/go-cache GOPATH=/tmp/gopath GO111MODULE=off
mkdir -p /tmp/gopath/src/github.com/x-motemen
ln -s /work /tmp/gopath/src/github.com/x-motemen/gore
cd '/tmp/gopath/src/github.com/x-motemen/gore'
exec /work/h0.test -test.v -test.run '^Test'
