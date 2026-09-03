-- Persist the computed metric table and the AI-summary fallback flag on the
-- report itself, so the frontend renders exactly the same numbers the PDF was
-- built from (one source of truth, no JS/Rust re-derivation) and can show when
-- the executive summary fell back to the deterministic template.
alter table reports add column if not exists metrics_json jsonb;
alter table reports add column if not exists ai_summary_is_fallback boolean not null default false;
