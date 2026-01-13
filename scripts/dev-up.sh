#!/usr/bin/env bash
set -euo pipefail

compose_files=(-f docker-compose.dev.yml -f docker-compose.prod.yml)

docker compose "${compose_files[@]}" up --build
