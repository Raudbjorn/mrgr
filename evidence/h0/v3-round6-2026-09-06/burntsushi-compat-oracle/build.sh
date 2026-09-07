#!/bin/sh
set -eu
export GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local GOCACHE=/tmp/go-cache GOPATH=/tmp/gopath GO111MODULE=off
mkdir -p /tmp/gopath/src/github.com/burntsushi
ln -s /work /tmp/gopath/src/github.com/burntsushi/toml
cd '/work'
cp /oracle/000_h0_init_test.go /work/000_h0_init_test.go
go test -vet=off -c -o /work/h0.test
