-- Warm-up lines drop their `highlighted` flag: every line becomes a plain `{ "text": ... }`.
UPDATE "plan_sessions"
SET "warmup_lines" = (
  SELECT COALESCE(jsonb_agg(jsonb_build_object('text', line->>'text') ORDER BY ord), '[]'::jsonb)
  FROM jsonb_array_elements("warmup_lines") WITH ORDINALITY AS t(line, ord)
)
WHERE jsonb_typeof("warmup_lines") = 'array' AND jsonb_array_length("warmup_lines") > 0;
