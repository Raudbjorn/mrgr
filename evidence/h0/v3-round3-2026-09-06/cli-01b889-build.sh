#!/bin/sh
set -eu
export GO111MODULE=off GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local GOCACHE=/tmp/go-cache GOPATH=/tmp/gopath
mkdir -p /tmp/gopath/src/github.com/codegangsta
ln -s /work /tmp/gopath/src/github.com/codegangsta/cli
cp /oracle/focal_test.go /work/h0_focal_test.go
set --
for f in $(go list -f '{{join .GoFiles " "}}' .); do set -- "$@" "$f"; done
go test -vet=off -c -o /work/focal.test "$@" h0_focal_test.go context_test.go helpers_test.go
