#!/bin/sh
set -eu
export GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local GOCACHE=/tmp/go-cache GOPATH=/tmp/gopath GO111MODULE=off
mkdir -p /tmp/gopath/src/github.com/oauth2-proxy
ln -s /work /tmp/gopath/src/github.com/oauth2-proxy/oauth2-proxy
cd '/tmp/gopath/src/github.com/oauth2-proxy/oauth2-proxy'
exec /work/h0.test -test.v -test.run '^Test'
