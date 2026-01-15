#!/usr/bin/env bash
set -euo pipefail

container="secureapp_db_prod"
data_dir="backend/data"
sql_file="backend/db/import_external.sql"

if [ ! -d "$data_dir" ]; then
  echo "Dossier manquant: $data_dir" >&2
  exit 1
fi

for file in editeur.csv jeu.csv jeu_mecanism.csv mecanism.csv typeJeu.csv; do
  if [ ! -f "$data_dir/$file" ]; then
    echo "Fichier manquant: $data_dir/$file" >&2
    exit 1
  fi
done

docker cp "$data_dir/editeur.csv" "$container:/tmp/editeur.csv"
docker cp "$data_dir/jeu.csv" "$container:/tmp/jeu.csv"
docker cp "$data_dir/jeu_mecanism.csv" "$container:/tmp/jeu_mecanism.csv"
docker cp "$data_dir/mecanism.csv" "$container:/tmp/mecanism.csv"
docker cp "$data_dir/typeJeu.csv" "$container:/tmp/typeJeu.csv"
docker cp "$sql_file" "$container:/tmp/import_external.sql"

docker exec -i "$container" psql -U secureapp -d secureapp -f /tmp/import_external.sql
