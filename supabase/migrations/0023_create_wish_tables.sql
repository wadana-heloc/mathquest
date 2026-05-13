-- wish_items: one row per wish, tracks the full lifecycle
CREATE TABLE public.wish_items (
    id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    child_id          UUID        NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    title             TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
    ai_suggested_cost INTEGER,
    final_cost        INTEGER,
    ai_category       TEXT        CHECK (ai_category IN ('screen_time', 'food', 'toy', 'experience', 'other')),
    ai_reasoning      TEXT,
    status            TEXT        NOT NULL DEFAULT 'pending_approval'
                                  CHECK (status IN ('pending_approval', 'approved', 'rejected', 'redeemed', 'delivered')),
    parent_note       TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at       TIMESTAMPTZ,
    redeemed_at       TIMESTAMPTZ,
    delivered_at      TIMESTAMPTZ
);

CREATE INDEX wish_items_child_id_idx ON public.wish_items(child_id);
CREATE INDEX wish_items_status_idx   ON public.wish_items(status);

ALTER TABLE public.wish_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wish_items TO service_role;
GRANT SELECT, INSERT ON public.wish_items TO authenticated;

-- coin_transactions: immutable ledger — never UPDATE or DELETE rows
CREATE TABLE public.coin_transactions (
    id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    child_id     UUID        NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    amount       INTEGER     NOT NULL,
    reason       TEXT        NOT NULL,
    wish_item_id UUID        REFERENCES public.wish_items(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX coin_transactions_child_id_idx ON public.coin_transactions(child_id);

ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.coin_transactions TO service_role;
GRANT SELECT ON public.coin_transactions TO authenticated;
