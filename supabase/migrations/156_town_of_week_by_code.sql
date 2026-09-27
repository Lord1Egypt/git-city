-- 156: Town of the week is now the town that coded the most (average per
-- member who coded), not the most visited. Copy only; no data changes.

UPDATE public.emblems
SET description = 'Your town coded the most of every town that week. The number is how many weeks.'
WHERE id = 'town_of_week';
