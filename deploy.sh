#!/bin/bash
set -euo pipefail

pnpm build
mkdir -p release
rm -f release/dist.zip
7z a -tzip release/dist.zip ./dist/*
