#!/bin/sh
set -eu
export GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local GOCACHE=/tmp/go-cache GOPATH=/tmp/gopath GO111MODULE=off
mkdir -p /tmp/gopath/src/github.com/adnanh
ln -s /work /tmp/gopath/src/github.com/adnanh/webhook
cd '/tmp/gopath/src/github.com/adnanh/webhook/hook'
exec /work/h0.test -test.v -test.run '^Test'
