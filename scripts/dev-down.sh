#!/usr/bin/env bash
set -euo pipefail

FILES=(-f docker-compose.dev.yml -f docker-compose.prod.yml)

echo "[dev-down] docker compose down..."
if sudo docker compose "${FILES[@]}" down --remove-orphans; then
  echo "[dev-down] OK"
  exit 0
fi

echo "[dev-down] down a echoue (permission denied) -> fallback force"

# Kill PIDs + rm -f pour les containers du projet (adapter le filtre si besoin)
for id in $(sudo docker ps -aq --filter "name=secureapp_"); do
  pid=$(sudo docker inspect -f '{{.State.Pid}}' "$id" 2>/dev/null || echo "")
  echo "[dev-down] force kill container=$id pid=$pid"
  if [ -n "$pid" ] && [ "$pid" != "0" ]; then
    sudo kill -9 "$pid" 2>/dev/null || true
  fi
  sudo docker rm -f "$id" 2>/dev/null || true
done

echo "[dev-down] done."
