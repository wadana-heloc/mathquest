-- Adds the 8 trick codes present in the AI fallback bank but absent
-- from the initial seed (migration 0009).
--
-- Must be applied BEFORE inserting fallback_bank.json problems —
-- the trick_id FK on public.problems will reject any row whose
-- trick_id doesn't exist in this table.

INSERT INTO public.tricks (id, name, category, description) VALUES
  (
    'A4',
    'Near-Square Identity',
    'algebra',
    '(n+1)² = n² + 2n + 1. Knowing one perfect square lets you derive the next instantly. E.g. knowing 7² = 49: 8² = 49 + 2(7) + 1 = 49 + 15 = 64. And 9² from 8²: 64 + 16 + 1 = 81.'
  ),
  (
    'B2',
    'Perimeter Invariance',
    'number_theory',
    'Rearranging a fixed set of tiles changes perimeter but preserves total area. E.g. four 1×1 tiles arranged 1×4 give perimeter 10; arranged 2×2 give perimeter 8. Area stays 4 in both cases. Teaches that invariants (area) and non-invariants (perimeter) behave differently under rearrangement.'
  ),
  (
    'B3',
    'Conservation of Sum',
    'algebra',
    'Adding the same value to both sides of an equation preserves equality. Multiplying both sides by the same nonzero value preserves equality. This is the foundation of algebraic manipulation. E.g. x + 5 = 12 → subtract 5 from both sides → x = 7.'
  ),
  (
    'B6',
    'Pigeonhole Principle',
    'number_theory',
    'If N items are distributed into fewer than N containers, at least one container must hold more than one item. Proves existence without finding the specific case. E.g. 13 socks in 12 colour slots → at least one colour has 2 or more socks.'
  ),
  (
    'C6',
    'Estimation and Bounds',
    'mental_math',
    'Before computing precisely, establish upper and lower bounds: is the answer closer to 100 or 1000? Is it odd or even? E.g. 47 × 52 ≈ 50 × 50 = 2500, so the actual answer (2444) must be near 2500 — any answer below 2000 or above 3000 is wrong.'
  ),
  (
    'D1',
    'Symmetry and Half-Double',
    'algebra',
    'If a shape, sequence, or arrangement is symmetric, its total is twice its half. Count or sum one side, then double. E.g. symmetric layout with left side 1+2+3+4 = 10 → total = 20. Applies to symmetric expressions: (a+b) + (a−b) = 2a.'
  ),
  (
    'D2',
    'State Transitions',
    'algebra',
    'Track what changes and what stays fixed across a sequence of operations. Identify the invariant — the quantity that does not change — then use it to jump directly to the end state. E.g. a creature gains 3 HP and loses 2 HP each round: net +1 per round, so after 8 rounds it has +8 HP.'
  ),
  (
    'D3',
    'Balance / Equilibrium',
    'algebra',
    'An equation is a balanced system. Any operation applied equally to both sides preserves the balance. This is the foundation of algebra. E.g. 3x = 21: divide both sides by 3 → x = 7. If both sides still balance, the operation was valid.'
  );
