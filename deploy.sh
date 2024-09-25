#!/bin/bash

pnpm build
rm -f release/dist.zip
7z a -tzip release/dist.zip ./dist/*
