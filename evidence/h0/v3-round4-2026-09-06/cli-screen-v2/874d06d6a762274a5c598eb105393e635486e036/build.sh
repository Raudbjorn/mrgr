#!/bin/sh
set -eu
export GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local GOCACHE=/tmp/go-cache GOPATH=/tmp/gopath GOFLAGS='-mod=vendor'
go test -vet=off -c -o /work/h0.test
