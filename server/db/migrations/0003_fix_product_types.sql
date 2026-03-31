-- Migration: Fix product type determination and create materialized view
-- This creates a function to determine product type from Pandora style ID prefix
-- and a materialized view that aggregates sightings into clean product data

-- Function to determine product type from Pandora style ID
CREATE OR REPLACE FUNCTION determine_pandora_type(style_id TEXT)
RETURNS TEXT AS $$
DECLARE
  prefix TEXT;
  normalized_id TEXT;
BEGIN
  -- Normalize: uppercase, remove spaces
  normalized_id := UPPER(REGEXP_REPLACE(style_id, '\s+', '', 'g'));

  -- Extract numeric prefix (first 2 digits)
  prefix := SUBSTRING(normalized_id FROM '^([0-9]{2})');

  IF prefix IS NULL THEN
    RETURN 'other';
  END IF;

  -- Pandora style ID prefix mapping (based on official numbering)
  RETURN CASE prefix
    -- Rings: 14-19 prefix
    WHEN '14' THEN 'ring'
    WHEN '15' THEN 'ring'
    WHEN '16' THEN 'ring'
    WHEN '17' THEN 'ring'
    WHEN '18' THEN 'ring'
    WHEN '19' THEN 'ring'

    -- Earrings: 25-29 prefix
    WHEN '25' THEN 'earring'
    WHEN '26' THEN 'earring'
    WHEN '27' THEN 'earring'
    WHEN '28' THEN 'earring'
    WHEN '29' THEN 'earring'

    -- Pendants/Necklaces: 35-39, 69 prefix
    WHEN '35' THEN 'pendant'
    WHEN '36' THEN 'pendant'
    WHEN '37' THEN 'necklace'
    WHEN '38' THEN 'necklace'
    WHEN '39' THEN 'necklace'
    WHEN '69' THEN 'necklace'

    -- Bracelets/Bangles: 55-59 prefix
    WHEN '55' THEN 'bracelet'
    WHEN '56' THEN 'bracelet'
    WHEN '57' THEN 'bangle'
    WHEN '58' THEN 'bracelet'
    WHEN '59' THEN 'bracelet'

    -- Charms/Clips/Muranos: 75-79, 87-89, 97 prefix
    WHEN '74' THEN 'charm'
    WHEN '75' THEN 'clip'      -- Clips often start with 75
    WHEN '76' THEN 'charm'
    WHEN '77' THEN 'murano'    -- Murano glass
    WHEN '78' THEN 'charm'
    WHEN '79' THEN 'charm'     -- Most charms
    WHEN '81' THEN 'charm'
    WHEN '82' THEN 'charm'
    WHEN '87' THEN 'charm'
    WHEN '88' THEN 'charm'
    WHEN '89' THEN 'charm'
    WHEN '97' THEN 'safety_chain'

    -- Special categories
    WHEN '49' THEN 'box'       -- Gift boxes
    WHEN '54' THEN 'keychain'
    WHEN '70' THEN 'ornament'

    ELSE 'other'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to extract collection from product name
CREATE OR REPLACE FUNCTION extract_collection(name TEXT)
RETURNS TEXT AS $$
BEGIN
  IF name IS NULL THEN RETURN NULL; END IF;

  RETURN CASE
    WHEN name ~* '\bDisney\b' THEN 'Disney'
    WHEN name ~* '\bMarvel\b' THEN 'Marvel'
    WHEN name ~* '\bHarry Potter\b' THEN 'Harry Potter'
    WHEN name ~* '\bStar Wars\b' THEN 'Star Wars'
    WHEN name ~* '\bGame of Thrones\b' THEN 'Game of Thrones'
    WHEN name ~* '\bPeanuts\b' THEN 'Peanuts'
    WHEN name ~* '\bPandora ME\b' THEN 'Pandora ME'
    WHEN name ~* '\bMoments\b' THEN 'Moments'
    WHEN name ~* '\bSignature\b' THEN 'Signature'
    WHEN name ~* '\bTimeless\b' THEN 'Timeless'
    WHEN name ~* '\bReflexions\b' THEN 'Reflexions'
    WHEN name ~* '\bEssence\b' THEN 'Essence'
    WHEN name ~* '\b14K\b' OR name ~* '\bGold\b' THEN '14K Gold'
    ELSE NULL
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create materialized view that aggregates sightings into clean product data
CREATE MATERIALIZED VIEW IF NOT EXISTS products_mv AS
WITH ranked_sightings AS (
  SELECT
    style_id,
    extracted_name,
    extracted_price,
    extracted_currency,
    extracted_description,
    image_url,
    catalog_name,
    year,
    season,
    region,
    source_url,
    scraped_by,
    created_at,
    -- Rank sightings: prefer non-generic names, recent data, with images
    ROW_NUMBER() OVER (
      PARTITION BY style_id
      ORDER BY
        CASE WHEN extracted_name IS NOT NULL AND extracted_name !~ '^Product ' THEN 0 ELSE 1 END,
        CASE WHEN image_url IS NOT NULL THEN 0 ELSE 1 END,
        created_at DESC
    ) as rn
  FROM charm_sightings
),
best_sighting AS (
  SELECT * FROM ranked_sightings WHERE rn = 1
),
all_images AS (
  SELECT DISTINCT style_id, image_url
  FROM charm_sightings
  WHERE image_url IS NOT NULL
),
price_history AS (
  SELECT
    style_id,
    MIN(extracted_price) as min_price,
    MAX(extracted_price) as max_price,
    -- Most recent price
    (ARRAY_AGG(extracted_price ORDER BY created_at DESC))[1] as current_price,
    (ARRAY_AGG(extracted_currency ORDER BY created_at DESC))[1] as current_currency
  FROM charm_sightings
  WHERE extracted_price IS NOT NULL
  GROUP BY style_id
)
SELECT
  b.style_id,
  COALESCE(
    NULLIF(b.extracted_name, ''),
    'Unknown ' || b.style_id
  ) as name,
  'Pandora' as brand,
  extract_collection(b.extracted_name) as collection,
  determine_pandora_type(b.style_id)::item_type as type,
  p.current_price as original_price,
  COALESCE(p.current_currency, 'USD') as currency,
  b.region,
  b.extracted_description as description,
  b.image_url as primary_image,
  (SELECT COUNT(*) FROM all_images ai WHERE ai.style_id = b.style_id) as image_count,
  (SELECT COUNT(*) FROM charm_sightings cs WHERE cs.style_id = b.style_id) as sighting_count,
  MIN(cs2.year) as first_seen_year,
  MAX(cs2.year) as last_seen_year,
  b.created_at as first_scraped_at,
  NOW() as refreshed_at
FROM best_sighting b
LEFT JOIN price_history p ON p.style_id = b.style_id
LEFT JOIN charm_sightings cs2 ON cs2.style_id = b.style_id
GROUP BY b.style_id, b.extracted_name, b.extracted_description, b.image_url,
         b.region, b.created_at, p.current_price, p.current_currency;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS products_mv_style_id_idx ON products_mv(style_id);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS products_mv_type_idx ON products_mv(type);
CREATE INDEX IF NOT EXISTS products_mv_collection_idx ON products_mv(collection);
CREATE INDEX IF NOT EXISTS products_mv_name_idx ON products_mv(name);

-- Also fix the existing charm_database table with correct types
UPDATE charm_database
SET type = determine_pandora_type(style_id)::item_type
WHERE type != determine_pandora_type(style_id)::item_type;

-- Update names that are generic "Product X" to use better names from sightings if available
UPDATE charm_database cd
SET name = cs.extracted_name
FROM (
  SELECT DISTINCT ON (style_id)
    style_id,
    extracted_name
  FROM charm_sightings
  WHERE extracted_name IS NOT NULL
    AND extracted_name !~ '^Product '
  ORDER BY style_id, created_at DESC
) cs
WHERE cd.style_id = cs.style_id
  AND cd.name ~ '^Product '
  AND cs.extracted_name IS NOT NULL;

-- Update collections based on names
UPDATE charm_database
SET collection = extract_collection(name)
WHERE collection IS NULL AND extract_collection(name) IS NOT NULL;

COMMENT ON MATERIALIZED VIEW products_mv IS 'Aggregated product data derived from charm_sightings. Refresh with: REFRESH MATERIALIZED VIEW CONCURRENTLY products_mv;';
