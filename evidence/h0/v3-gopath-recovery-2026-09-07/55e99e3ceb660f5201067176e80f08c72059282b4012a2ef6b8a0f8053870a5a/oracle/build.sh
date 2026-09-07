#!/bin/sh
set -eu
export GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local GOCACHE=/tmp/go-cache GOPATH=/tmp/gopath GO111MODULE=off
mkdir -p /tmp/gopath/src/github.com/sirupsen
ln -s /work /tmp/gopath/src/github.com/sirupsen/logrus
go test -vet=off -c -o /work/h0.test
