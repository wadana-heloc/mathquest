-- Atomic wish redemption: balance check + coin deduction + status update +
-- ledger insert all run in one transaction with row-level locks, preventing
-- double-spend without needing SELECT FOR UPDATE from application code.
CREATE OR REPLACE FUNCTION public.redeem_wish(
    p_wish_id  UUID,
    p_child_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wish    public.wish_items%ROWTYPE;
    v_coins   INTEGER;
    v_new_bal INTEGER;
BEGIN
    -- Lock the wish row to block any concurrent redeem attempt
    SELECT * INTO v_wish
    FROM public.wish_items
    WHERE id = p_wish_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'wish_not_found');
    END IF;

    IF v_wish.child_id <> p_child_id THEN
        RETURN jsonb_build_object('error', 'forbidden');
    END IF;

    IF v_wish.status <> 'approved' THEN
        RETURN jsonb_build_object('error', 'invalid_status', 'status', v_wish.status);
    END IF;

    -- Lock the child row to block concurrent coin spend
    SELECT coins INTO v_coins
    FROM public.children
    WHERE id = p_child_id
    FOR UPDATE;

    IF v_coins < v_wish.final_cost THEN
        RETURN jsonb_build_object(
            'error',     'insufficient_coins',
            'required',  v_wish.final_cost,
            'available', v_coins
        );
    END IF;

    v_new_bal := v_coins - v_wish.final_cost;

    UPDATE public.children
    SET coins = v_new_bal
    WHERE id = p_child_id;

    UPDATE public.wish_items
    SET status = 'redeemed', redeemed_at = now()
    WHERE id = p_wish_id;

    INSERT INTO public.coin_transactions (child_id, amount, reason, wish_item_id)
    VALUES (p_child_id, -v_wish.final_cost, 'wish_redemption', p_wish_id);

    RETURN jsonb_build_object(
        'new_balance', v_new_bal,
        'wish_id',     p_wish_id,
        'status',      'redeemed'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_wish(UUID, UUID) TO service_role;
