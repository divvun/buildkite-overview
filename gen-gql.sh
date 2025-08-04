#!/usr/bin/env bash

. ./.env
tgql \
    --bearer "$BUILDKITE_API_KEY" \
    --output generated-api.ts \
    -s JSInt=number \
    https://graphql.buildkite.com/v1
