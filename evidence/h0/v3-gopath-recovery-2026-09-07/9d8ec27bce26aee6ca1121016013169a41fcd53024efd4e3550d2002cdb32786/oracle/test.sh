#!/bin/sh
set -eu
export GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local GOCACHE=/tmp/go-cache GOPATH=/tmp/gopath GO111MODULE=off
mkdir -p /tmp/gopath/src/github.com/go-yaml
ln -s /work /tmp/gopath/src/github.com/go-yaml/yaml
cd '/tmp/gopath/src/github.com/go-yaml/yaml'
exec /work/h0.test -test.v -test.run '^Test'
