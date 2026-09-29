INSERT INTO "Department" ("id", "slug", "name", "sortOrder", "isActive", "accentHex", "softHex", "deepHex", "createdAt", "updatedAt")
VALUES
  ('dept_gift_hamper', 'gift-hamper', 'Gift Hamper', 30, true, '#0F766E', '#CCEBE6', '#134E4A', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_festive', 'festive', 'Festive', 40, true, '#B91C1C', '#FBE3C8', '#7F1D1D', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "Category" ("id", "slug", "name", "description", "sortOrder", "isActive", "departmentId", "createdAt", "updatedAt")
SELECT v.id, v.slug, v.name, v.description, v."sortOrder", true, d."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  VALUES
    ('cat_gift_hampers', 'gift-hampers', 'Gift Hampers', 'Curated boxes of our bakes, ready to gift.', 80, 'gift-hamper'),
    ('cat_festive_specials', 'festive-specials', 'Festive Specials', 'Seasonal bakes for every celebration.', 90, 'festive')
) AS v(id, slug, name, description, "sortOrder", dept_slug)
JOIN "Department" d ON d."slug" = v.dept_slug
ON CONFLICT ("slug") DO NOTHING;
