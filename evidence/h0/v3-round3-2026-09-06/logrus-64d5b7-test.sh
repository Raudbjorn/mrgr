#!/bin/sh
set -eu
export GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local GOCACHE=/tmp/go-cache GOPATH=/tmp/gopath GOFLAGS='-mod=vendor -gcflags=all=-l'
exec /work/focal.test -test.v -test.run '^Test'
