#!/bin/sh
set -eu
export GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local GOCACHE=/tmp/go-cache GOPATH=/tmp/gopath GO111MODULE=off
mkdir -p /tmp/gopath/src/github.com/urfave
ln -s /work /tmp/gopath/src/github.com/urfave/cli
cp /oracle/compat_app_test.go /work/app_test.go
go test -vet=off -c -o /work/h0.test
