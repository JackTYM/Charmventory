CREATE OR REPLACE VIEW charm_browse AS
SELECT 
  cd.*,
  (
    SELECT ci.url 
    FROM charm_images ci 
    WHERE ci.style_id = cd.style_id 
      AND ci.url NOT LIKE '%archive.org%'
    ORDER BY ci.created_at ASC 
    LIMIT 1
  ) as primary_image
FROM charm_database cd;

GRANT SELECT ON charm_browse TO authenticated;
GRANT SELECT ON charm_browse TO anonymous;
