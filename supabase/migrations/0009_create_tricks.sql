-- =============================================================================
-- 0009_create_tricks.sql
-- -----------------------------------------------------------------------------
-- Static catalog of math tricks (shortcuts / insights) used in MathQuest.
-- Trick codes match those embedded in the problems table (trick_ids text[]).
--
-- Tricks are referenced by:
--   * public.problems.trick_ids      — which tricks a problem exercises
--   * public.trick_discoveries.trick_id — per-child unlock progress
--
-- Source: ERD-MathQuest.drawio (tricks table) and TDD §05 (Trick Taxonomy).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Table
-- -----------------------------------------------------------------------------
create table public.tricks (
    id          text        primary key,   -- short code e.g. 'A1', 'B2'
    name        text        not null,
    category    text        not null,
    description text        not null
);

comment on table  public.tricks            is 'Static catalog of math shortcut tricks. Seeded at migration; new tricks added manually.';
comment on column public.tricks.id         is 'Short trick code matching problems.trick_ids entries and trick_discoveries.trick_id.';
comment on column public.tricks.category   is 'Grouping used in the journal UI: multiplication | mental_math | number_theory | pattern | algebra | sequences.';

-- -----------------------------------------------------------------------------
-- 2. Seed data
-- All codes sourced from TDD §05 Trick Taxonomy and the 40 sample problems.
-- -----------------------------------------------------------------------------
insert into public.tricks (id, name, category, description) values
    ('A1', '×11 digit-sum rule',        'multiplication', 'For 11 × AB: result is A, (A+B), B. When A+B ≥ 10, carry the 1 into the left digit.'),
    ('A2', '×9 digit-sum rule',         'multiplication', 'Digits of any ×9 result sum to 9 (or a multiple). Also: 9×n = 10n − n.'),
    ('A3', 'Perfect squares',           'multiplication', 'Memorised squares 1²–15² used as anchors for nearby calculations and doubling chains.'),
    ('A5', 'Sum of consecutive odds',   'pattern',        'The sum of the first n odd numbers equals n². e.g. 1+3+5 = 3² = 9.'),
    ('A6', 'Difference of squares',     'algebra',        'a² − b² = (a+b)(a−b). Converts subtraction of squares into a simple product.'),
    ('A7', '×25 shortcut',              'multiplication', '25 = 100÷4, so n×25 = n×100÷4. Most useful when n is divisible by 4.'),
    ('B1', 'Odd/even parity rule',      'number_theory',  'Odd×Odd=Odd. Even×anything=Even. Sum of k odd numbers is odd iff k is odd.'),
    ('B4', 'Modular arithmetic',        'number_theory',  'Use remainders to detect patterns without full computation. e.g. 100 mod 7 = 2.'),
    ('B5', 'Divisibility by 9',         'number_theory',  'A number is divisible by 9 if and only if its digit sum is divisible by 9.'),
    ('C1', 'Left-to-right chunking',    'mental_math',    'Add or subtract in chunks from left to right: 46+38 = 46+30+8 = 76+8 = 84.'),
    ('C2', 'Complement pairs',          'mental_math',    'Identify pairs that sum to 100 or 1000 to convert subtraction into a lookup.'),
    ('C3', 'Near-benchmark rounding',   'mental_math',    'Round to the nearest 10/100 and compensate: 6×99 = 6×100 − 6 = 594.'),
    ('C4', 'Near-doubles',              'mental_math',    'Use the double of one number and adjust by 1 or 2: 8+7 = 8+8−1 = 15.'),
    ('C5', '×5 halving trick',          'mental_math',    '×5 = ×10 ÷ 2. Halve the other number and multiply by 10.'),
    ('C7', 'Grouping and regrouping',   'mental_math',    'Regroup factors for easier computation: 4×25=100, then ×3; or 50+50+50=3×50.'),
    ('D4', 'Geometric series sum',      'sequences',      'Sum of 1+2+4+…+2^(n−1) = 2^n − 1. Each term doubles the previous.'),
    ('D5', 'Triangular numbers',        'sequences',      'Sum of 1+2+…+n = n(n+1)/2. Also the handshake formula for n people.');

-- -----------------------------------------------------------------------------
-- 3. Row-Level Security
-- -----------------------------------------------------------------------------
-- Tricks are read-only from the client perspective. Writes are service_role only.
alter table public.tricks enable row level security;

create policy tricks_select_authenticated
    on public.tricks
    for select
    using (auth.role() = 'authenticated');

-- -----------------------------------------------------------------------------
-- 4. GRANTs
-- -----------------------------------------------------------------------------
grant usage  on schema public             to anon, authenticated, service_role;
grant select on public.tricks             to authenticated;
grant select, insert, update, delete
             on public.tricks             to service_role;
