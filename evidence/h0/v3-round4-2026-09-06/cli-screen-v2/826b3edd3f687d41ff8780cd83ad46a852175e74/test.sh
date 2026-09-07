#!/bin/sh
set -eu
export GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local GOCACHE=/tmp/go-cache GOPATH=/tmp/gopath GOFLAGS='-mod=vendor'
exec /work/h0.test -test.v -test.run '^Test'
