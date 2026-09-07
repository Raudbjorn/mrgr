#!/bin/sh
set -eu
exec /work/focal.test -test.v -test.run '^TestFocalPut$'
