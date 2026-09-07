#!/bin/sh
set -eu
export GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local GOCACHE=/tmp/go-cache GOPATH=/tmp/gopath GO111MODULE=off
mkdir -p /tmp/gopath/src/github.com/labstack
ln -s /work /tmp/gopath/src/github.com/labstack/echo
cd '/tmp/gopath/src/github.com/labstack/echo'
go test -vet=off -c -o /work/h0.test
