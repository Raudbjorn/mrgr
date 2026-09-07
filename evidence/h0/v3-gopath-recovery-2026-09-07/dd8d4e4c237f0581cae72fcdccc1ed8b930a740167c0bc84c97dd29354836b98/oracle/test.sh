#!/bin/sh
set -eu
export GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local GOCACHE=/tmp/go-cache GOPATH=/tmp/gopath GO111MODULE=off
mkdir -p /tmp/gopath/src/github.com/aquasecurity
ln -s /work /tmp/gopath/src/github.com/aquasecurity/kube-bench
cd '/tmp/gopath/src/github.com/aquasecurity/kube-bench/check'
exec /work/h0.test -test.v -test.run '^Test'
