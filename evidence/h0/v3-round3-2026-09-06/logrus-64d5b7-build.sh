#!/bin/sh
set -eu
export GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local GOCACHE=/tmp/go-cache GOPATH=/tmp/gopath GOFLAGS='-mod=vendor -gcflags=all=-l'
cp /oracle/focal_test.go /work/h0_focal_test.go
go test -vet=off -c -o /work/focal.test
