#!/usr/bin/env bash
docker compose -f docker-compose.dev.yml -f docker-compose.prod.yml down --remove-orphans

