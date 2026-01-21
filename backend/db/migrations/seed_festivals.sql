BEGIN;

INSERT INTO festival (
  nom,
  location,
  nombre_total_tables,
  date_debut,
  date_fin,
  description,
  stock_tables_standard,
  stock_tables_grandes,
  stock_tables_mairie,
  stock_chaises
)
VALUES
  ('Festival du Jeu 2025', 'Paris', 150, '2025-06-15', '2025-06-18', NULL, 0, 0, 0, 0),
  ('Convention Manga 2025', 'Lyon', 100, '2025-09-10', '2025-09-12', NULL, 0, 0, 0, 0)
ON CONFLICT (nom) DO NOTHING;

WITH festivals AS (
  SELECT id, nom FROM festival WHERE nom IN ('Festival du Jeu 2025', 'Convention Manga 2025')
), zones AS (
  SELECT 'Zone Premium'::varchar AS nom, 40::int AS tables, 120::numeric AS prix_table
  UNION ALL
  SELECT 'Zone Standard', 60, 80
  UNION ALL
  SELECT 'Zone Decouverte', 50, 60
)
INSERT INTO zone_tarifaire (
  festival_id,
  nom,
  nombre_tables_total,
  nombre_tables_disponibles,
  prix_table,
  prix_m2
)
SELECT
  f.id,
  z.nom,
  z.tables,
  z.tables,
  z.prix_table,
  z.prix_table / 4
FROM festivals f
CROSS JOIN zones z
WHERE NOT EXISTS (
  SELECT 1
  FROM zone_tarifaire zt
  WHERE zt.festival_id = f.id AND zt.nom = z.nom
);

COMMIT;
