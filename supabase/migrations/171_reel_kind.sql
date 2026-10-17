-- A watched reel is about the Brasil map or just the city: a comment on a
-- city reel gives its dev a building in the city and nothing more.

ALTER TABLE public.brasil_reels ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'brasil' CHECK (kind IN ('brasil', 'city'));

NOTIFY pgrst, 'reload schema';
