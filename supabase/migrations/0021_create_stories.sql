CREATE TABLE public.stories (
    id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    child_id    UUID        NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    chapters    JSONB       NOT NULL,
    word_count  INTEGER     NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast latest-story lookup per child
CREATE INDEX stories_child_id_created_at_idx
    ON public.stories(child_id, created_at DESC);

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stories TO service_role;
GRANT SELECT, INSERT ON public.stories TO authenticated;
