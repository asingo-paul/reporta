-- The AI narrative is now three parts, not one: an executive summary, a list
-- of recommendations, and a forward-looking conclusion. `ai_summary` keeps the
-- summary (the part the agency edits); the other two are stored alongside and
-- rendered as their own PDF sections.
alter table reports add column if not exists ai_recommendations jsonb;
alter table reports add column if not exists ai_conclusion text;
