-- =============================================================================
-- 0010_create_problems.sql
-- -----------------------------------------------------------------------------
-- Creates public.problems and seeds the 40 canonical problems from TDD §08.
--
-- SECURITY NOTE: the columns `answer`, `shortcut_path`, and
-- `shortcut_time_threshold_ms` are NEVER returned to the client. The API
-- layer selects only the safe columns explicitly; this table is the
-- authoritative source for server-side answer verification.
--
-- AI integration (TODO): when the AI engineer's model is ready, POST
-- /problems will call the model, receive a problem object, INSERT it here
-- (getting a stable UUID back), and return it to the client. The 40 seeded
-- rows serve as the dataset until then.
--
-- Source: ERD-MathQuest.drawio and TDD §08 (Problem Catalogue).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Table
-- -----------------------------------------------------------------------------
create table public.problems (
    id                          uuid        primary key default gen_random_uuid(),
    zone                        integer     not null check (zone between 1 and 5),
    category                    text        not null
                                            check (category in (
                                                'arithmetic', 'pattern', 'invariant',
                                                'mental', 'structural', 'algebraic')),
    difficulty                  integer     not null check (difficulty between 1 and 10),
    trick_ids                   text[]      not null default '{}',
    stem                        text        not null,

    -- *** NEVER returned to the client ***
    answer                      text        not null,
    shortcut_path               text,
    shortcut_time_threshold_ms  integer,

    answer_type                 text        not null default 'exact'
                                            check (answer_type in ('exact', 'range', 'set')),
    brute_force_path            text,
    hints                       jsonb       not null default '[]',
    aha_moment                  text,
    flavor_text                 text,
    tags                        text[]      not null default '{}',
    base_coins                  integer     not null default 10,
    estimated_brute_force_seconds integer,
    estimated_trick_seconds     integer,
    created_at                  timestamptz not null default now()
);

create index problems_zone_difficulty_idx on public.problems (zone, difficulty);

comment on table  public.problems                         is 'Math problem catalogue. Seeded with 40 canonical problems; extended by AI-generated rows. answer/shortcut_path/shortcut_time_threshold_ms are server-only — never select them in client-facing queries.';
comment on column public.problems.answer                  is 'Stored as text; cast server-side per answer_type. NEVER returned to the client.';
comment on column public.problems.shortcut_path           is 'Explanation of the shortcut. Server-only for answer verification flow.';
comment on column public.problems.shortcut_time_threshold_ms is 'Duration below which a correct first-attempt response triggers insight_detected. Server-only.';
comment on column public.problems.trick_ids               is 'Array of trick codes (references tricks.id). Exposed server-side only.';

-- -----------------------------------------------------------------------------
-- 2. Row-Level Security
-- -----------------------------------------------------------------------------
alter table public.problems enable row level security;

-- Authenticated users may read problems (API layer controls column projection).
create policy problems_select_authenticated
    on public.problems
    for select
    using (auth.role() = 'authenticated');

-- -----------------------------------------------------------------------------
-- 3. GRANTs
-- -----------------------------------------------------------------------------
grant usage  on schema public             to anon, authenticated, service_role;
grant select on public.problems           to authenticated;
grant select, insert, update, delete
             on public.problems           to service_role;

-- -----------------------------------------------------------------------------
-- 4. Seed data — 40 canonical problems (TDD §08)
-- -----------------------------------------------------------------------------
-- Columns: zone, category, difficulty, trick_ids, stem, answer, answer_type,
--          brute_force_path, shortcut_path, shortcut_time_threshold_ms,
--          hints, aha_moment, flavor_text, tags

insert into public.problems (
    zone, category, difficulty, trick_ids, stem,
    answer, answer_type, brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    base_coins, estimated_brute_force_seconds, estimated_trick_seconds
) values

-- =========================================================================
-- ZONE 1 — PEBBLE SHORE
-- =========================================================================

-- Z1-01
(1, 'arithmetic', 2, ARRAY['C4'], '8 + 7 = ?',
 '15', 'exact', '8+7: count up 7 from 8', 'Near-doubles: 8+8=16, then subtract 1', 2000,
 '[{"level":1,"text":"Are 7 and 8 close to each other?","cost":0},{"level":2,"text":"Try doubling the larger number, then adjust by the difference.","cost":5},{"level":3,"text":"8+8=16, and 7 is one less than 8, so 8+7 = 16-1 = 15.","cost":15}]',
 'When two numbers differ by 1, double the larger and subtract 1.',
 'The tide oracle sets two pebble piles on the shore: 8 and 7. What is the total?',
 ARRAY['addition','near-doubles','zone-1'], 10, 5, 1),

-- Z1-02
(1, 'mental', 2, ARRAY['C3'], '19 + 13 = ?',
 '32', 'exact', '19+13: add digit by digit', 'Round 19 to 20, add 13, subtract 1', 3000,
 '[{"level":1,"text":"Is 19 close to a round number?","cost":0},{"level":2,"text":"Round 19 up to 20, add 13, then compensate.","cost":5},{"level":3,"text":"20+13=33, then subtract 1 because we rounded 19 up by 1: 33-1=32.","cost":15}]',
 'Rounding to the nearest 10 and compensating makes two-digit addition instant.',
 'A coastal merchant counts 19 blue shells then finds 13 more. How many total?',
 ARRAY['addition','near-benchmark','zone-1'], 10, 6, 2),

-- Z1-03
(1, 'mental', 2, ARRAY['C2'], '100 - 37 = ?',
 '63', 'exact', '100-37: borrow across zeros', 'Complement: what adds to 37 to make 100?', 3000,
 '[{"level":1,"text":"What would you need to add to 37 to reach 100?","cost":0},{"level":2,"text":"Work in steps: 37 to 40 is 3, then 40 to 100 is 60.","cost":5},{"level":3,"text":"37+3=40, 40+60=100. The complement is 3+60=63.","cost":15}]',
 'Complements to 100 are always faster than borrowing across zeros.',
 'The shore-keeper lost 37 tide-coins from a chest of 100. How many remain?',
 ARRAY['subtraction','complement','zone-1'], 10, 8, 2),

-- Z1-04
(1, 'mental', 3, ARRAY['C1'], '46 + 38 = ?',
 '84', 'exact', '46+38: add ones then tens', 'Chunking: 46+30=76, then +8', 4000,
 '[{"level":1,"text":"Can you split 38 into a tens part and a units part?","cost":0},{"level":2,"text":"Add the tens first: 46+30, then add the remaining 8.","cost":5},{"level":3,"text":"46+30=76, then 76+8=84.","cost":15}]',
 'Breaking a number into tens and units makes two-digit addition trivial.',
 'The lighthouse keeper stacks 46 red stones and 38 grey stones in a tower.',
 ARRAY['addition','chunking','zone-1'], 10, 10, 3),

-- Z1-05
(1, 'invariant', 3, ARRAY['B1'], 'Odd or even: 13 + 27 + 41 = ?',
 'odd', 'set', 'Calculate 13+27+41=81; check parity', 'Three odds: Odd+Odd=Even, Even+Odd=Odd', 3000,
 '[{"level":1,"text":"Do you need to calculate the exact answer to know the parity?","cost":0},{"level":2,"text":"Think about whether each number is odd or even, and apply the parity rule.","cost":5},{"level":3,"text":"13 odd, 27 odd, 41 odd. Odd+Odd=Even, then Even+Odd=Odd. Answer: odd.","cost":15}]',
 'An odd count of odd numbers always sums to odd — no addition needed.',
 'Three wave patterns on the shore: 13 ripples, then 27, then 41. Odd or even total?',
 ARRAY['parity','number-theory','zone-1'], 10, 8, 1),

-- Z1-06
(1, 'mental', 1, ARRAY['C3'], '99 + 1 = ?',
 '100', 'exact', 'Add: 99+1=100', 'Benchmark: 99 is exactly 1 away from 100', 1000,
 '[{"level":1,"text":"How far is 99 from the nearest round number?","cost":0},{"level":2,"text":"99 is just 1 away from 100.","cost":5},{"level":3,"text":"99+1=100. Landmark numbers like 100 are instant lookups.","cost":15}]',
 'Numbers one step from a landmark are the fastest calculations in math.',
 'The ancient tide clock shows 99. One more tick and it resets.',
 ARRAY['addition','near-benchmark','zone-1'], 10, 2, 1),

-- Z1-07
(1, 'arithmetic', 2, ARRAY['C7'], '50 + 50 + 50 = ?',
 '150', 'exact', 'Add: 50+50=100, 100+50=150', '3 × 50 = 150', 2000,
 '[{"level":1,"text":"How many times does 50 appear?","cost":0},{"level":2,"text":"Turn repeated addition into multiplication: 3 × 50.","cost":5},{"level":3,"text":"3×50=150. Half of 3×100=300 is 150.","cost":15}]',
 'Repeated addition is multiplication in disguise.',
 'Three treasure chests on the shore, each holding 50 gold pebbles.',
 ARRAY['addition','multiplication','grouping','zone-1'], 10, 4, 1),

-- Z1-08
(1, 'pattern', 2, ARRAY['C4'], '7 + 8 + 9 = ?',
 '24', 'exact', 'Add: 7+8=15, 15+9=24', 'Near-triple: 3 × 8 = 24 (middle number × 3)', 2000,
 '[{"level":1,"text":"Is 8 the middle number of 7, 8, 9?","cost":0},{"level":2,"text":"The three numbers are consecutive. Try multiplying the middle number by 3.","cost":5},{"level":3,"text":"7+8+9 = 3×8 = 24. Three consecutive numbers sum to 3 times the middle.","cost":15}]',
 'Three consecutive numbers always sum to three times the middle one.',
 'Three stepping stones: 7, 8, and 9 pebbles high. Count the total.',
 ARRAY['addition','consecutive','pattern','zone-1'], 10, 5, 1),

-- =========================================================================
-- ZONE 2 — ECHO CAVES
-- =========================================================================

-- Z2-01
(2, 'pattern', 3, ARRAY['A2'], '9 × 6 = ?',
 '54', 'exact', '6+6+6+6+6+6+6+6+6=54', '9×6 = 10×6 − 6 = 60 − 6 = 54; digit check: 5+4=9', 2000,
 '[{"level":1,"text":"What is 10×6? How far is 9 from 10?","cost":0},{"level":2,"text":"9×6 = 10×6 − 1×6. Compute 10×6 first.","cost":5},{"level":3,"text":"10×6=60, minus 6=54. Verify: 5+4=9 — the digit-sum rule confirms it.","cost":15}]',
 'Every multiple of 9 has digits that sum to 9.',
 'In the echo cave, a crystal grid glows with 9 rows and 6 columns.',
 ARRAY['multiplication','x9','digit-sum','zone-2'], 10, 10, 1),

-- Z2-02
(2, 'pattern', 3, ARRAY['A2'], '9 × 8 = ?',
 '72', 'exact', '8+8+8+8+8+8+8+8+8=72', '9×8 = 10×8 − 8 = 80 − 8 = 72; digit check: 7+2=9', 2000,
 '[{"level":1,"text":"What is 10×8?","cost":0},{"level":2,"text":"9×8 = 10×8 − 8.","cost":5},{"level":3,"text":"10×8=80, minus 8=72. Verify: 7+2=9 — the digit-sum rule.","cost":15}]',
 'The near-10 trick makes ×9 effortless.',
 'The cave echo multiplies your 9 claps across 8 stone pillars.',
 ARRAY['multiplication','x9','digit-sum','zone-2'], 10, 10, 1),

-- Z2-03
(2, 'pattern', 3, ARRAY['A1'], '11 × 5 = ?',
 '55', 'exact', '10×5+1×5=55', '11×(single digit): repeat the digit — 55', 1000,
 '[{"level":1,"text":"For 11 times a single digit, what do you notice about the answer?","cost":0},{"level":2,"text":"The digit appears twice in the answer.","cost":5},{"level":3,"text":"11×5=55. Single-digit times 11 always gives a mirror number.","cost":15}]',
 '11 times a single digit writes that digit twice.',
 'The cipher stone at the cave entrance reads: 11 × 5. Crack it.',
 ARRAY['multiplication','x11','mirror','zone-2'], 10, 4, 1),

-- Z2-04
(2, 'pattern', 3, ARRAY['A1'], '11 × 7 = ?',
 '77', 'exact', '10×7+1×7=77', '11×(single digit): repeat the digit — 77', 1000,
 '[{"level":1,"text":"Try the ×11 trick for single digits.","cost":0},{"level":2,"text":"For 11 × a single digit, the answer repeats that digit.","cost":5},{"level":3,"text":"11×7=77. The digit 7 appears twice.","cost":15}]',
 'The ×11 mirror rule: a single digit written twice.',
 'The echo doubles your voice: the cave cipher reads 11 × 7.',
 ARRAY['multiplication','x11','mirror','zone-2'], 10, 4, 1),

-- Z2-05
(2, 'pattern', 4, ARRAY['A1'], '11 × 23 = ?',
 '253', 'exact', '10×23+1×23=230+23=253', '11×AB: digits are A, (A+B), B — here 2,(2+3),3 = 253', 2000,
 '[{"level":1,"text":"For 11 × AB, the middle digit is A+B. What are A and B here?","cost":0},{"level":2,"text":"A=2, B=3. Middle digit = 2+3=5. Write 2, 5, 3.","cost":5},{"level":3,"text":"11×23 = 2_(2+3)_3 = 2_5_3 = 253. No carry since 2+3 < 10.","cost":15}]',
 '11 × AB: the outer digits stay, the middle digit is their sum.',
 'The ancient cave calculator displays 11 × 23. Solve it to open the door.',
 ARRAY['multiplication','x11','two-digit','zone-2'], 10, 8, 2),

-- Z2-06
(2, 'mental', 4, ARRAY['A7'], '4 × 25 = ?',
 '100', 'exact', '25+25+25+25=100', '4×25 = 4×(100÷4) = 100', 1000,
 '[{"level":1,"text":"Think of 25 as a fraction of 100. What fraction?","cost":0},{"level":2,"text":"25 = 100÷4, so 4×25 = 4×(100÷4).","cost":5},{"level":3,"text":"4×25=100. Think of 25 as a quarter: four quarters make one whole (100).","cost":15}]',
 '25 is a quarter of 100 — four of them always make 100.',
 'Four cave explorers each find 25 crystals. How many crystals total?',
 ARRAY['multiplication','x25','quarter','zone-2'], 10, 5, 1),

-- Z2-07
(2, 'mental', 4, ARRAY['C5'], '5 × 18 = ?',
 '90', 'exact', '18+18+18+18+18=90', '×5 = ×10÷2: 10×18=180, then 180÷2=90', 2000,
 '[{"level":1,"text":"What is 10×18?","cost":0},{"level":2,"text":"5 is half of 10, so 5×18 = (10×18)÷2.","cost":5},{"level":3,"text":"10×18=180, half of 180=90.","cost":15}]',
 '×5 is always ×10 halved.',
 'Five crystal pillars each hold 18 glowstones.',
 ARRAY['multiplication','x5','halving','zone-2'], 10, 8, 1),

-- Z2-08
(2, 'arithmetic', 3, ARRAY['A3'], '8 × 8 = ?',
 '64', 'exact', '8×8 multiply directly', 'Perfect square: 8² = 64 (doubling chain: 8→16→32→64)', 1000,
 '[{"level":1,"text":"Do you know 8×8 as a perfect square?","cost":0},{"level":2,"text":"Try the doubling chain: 8, 16, 32, 64.","cost":5},{"level":3,"text":"8×8=64. Doubling chain: 8→16→32→64 (double three times).","cost":15}]',
 'Doubling a number three times is the same as multiplying by 8.',
 'An 8×8 crystal grid fills the cave floor.',
 ARRAY['multiplication','perfect-square','zone-2'], 10, 4, 1),

-- Z2-09
(2, 'invariant', 5, ARRAY['B5'], 'Divisible by 9? 4,527',
 'yes', 'set', 'Divide 4527 by 9 = 503', 'Digit sum: 4+5+2+7=18, and 1+8=9 — divisible by 9', 3000,
 '[{"level":1,"text":"What rule tells you if a number is divisible by 9?","cost":0},{"level":2,"text":"Add up all the digits of 4527.","cost":5},{"level":3,"text":"4+5+2+7=18, 1+8=9. Digit sum divisible by 9 means the number is too.","cost":15}]',
 'A number is divisible by 9 if and only if its digit sum is divisible by 9.',
 'The cave elder asks: is the stalagmite count 4,527 divisible by 9?',
 ARRAY['divisibility','digit-sum','number-theory','zone-2'], 10, 12, 2),

-- Z2-10
(2, 'arithmetic', 4, ARRAY['A2','C4'], '6 × 7 = ?',
 '42', 'exact', '6×7: count up by 6', 'Near-square: 6×6=36, then add one more 6', 2000,
 '[{"level":1,"text":"Do you know 6×6? How does 6×7 relate to it?","cost":0},{"level":2,"text":"6×7 = 6×6 + 6. What is 6×6?","cost":5},{"level":3,"text":"6×6=36, plus 6=42.","cost":15}]',
 'Near-square jump: start from a known square and add one row.',
 'Six bats roost in each of 7 cave alcoves.',
 ARRAY['multiplication','near-square','zone-2'], 10, 8, 1),

-- Z2-11
(2, 'mental', 4, ARRAY['C1'], '47 + 38 = ?',
 '85', 'exact', '47+38: add digit by digit', 'Chunking: 47+30=77, then +8=85', 4000,
 '[{"level":1,"text":"Can you split 38 into a tens part and a units part?","cost":0},{"level":2,"text":"Add 30 to 47 first, then add the remaining 8.","cost":5},{"level":3,"text":"47+30=77, then 77+8=85.","cost":15}]',
 'Chunking turns hard two-digit addition into two easy steps.',
 'A cave explorer has 47 blue crystals and finds 38 more.',
 ARRAY['addition','chunking','zone-2'], 10, 8, 2),

-- Z2-12
(2, 'invariant', 3, ARRAY['B1'], 'Is 13 × 7 odd or even?',
 'odd', 'set', 'Calculate 13×7=91; check parity', 'Parity rule: Odd × Odd = Odd — no calculation needed', 1000,
 '[{"level":1,"text":"Do you need to calculate to know if the result is odd or even?","cost":0},{"level":2,"text":"Apply the parity rule: what is odd × odd?","cost":5},{"level":3,"text":"13 is odd, 7 is odd. Odd × Odd = Odd. Answer without calculating.","cost":15}]',
 'Parity is decided before calculation even starts.',
 'The cave oracle poses a riddle: is 13 × 7 odd or even?',
 ARRAY['parity','number-theory','zone-2'], 10, 5, 1),

-- =========================================================================
-- ZONE 3 — IRON SUMMIT
-- =========================================================================

-- Z3-01
(3, 'pattern', 5, ARRAY['A1'], '11 × 37 = ?',
 '407', 'exact', '10×37+1×37=370+37=407', '11×37: 3_(3+7)_7 — sum=10, carry: 3+1=4, mid=0, last=7 → 407', 3000,
 '[{"level":1,"text":"Apply the ×11 trick: digits of 37 are 3 and 7.","cost":0},{"level":2,"text":"Middle digit = 3+7=10. Since 10 ≥ 10, you must carry.","cost":5},{"level":3,"text":"3+7=10: write 0 in the middle, carry 1 left. Left digit: 3+1=4. Result: 407.","cost":15}]',
 'When A+B ≥ 10 in the ×11 rule, carry the 1 into the left digit.',
 'The bridge cipher reads 11 × 37 = ? Solve it or the bridge stays raised.',
 ARRAY['multiplication','x11','carry','two-digit','zone-3'], 10, 12, 3),

-- Z3-02
(3, 'pattern', 6, ARRAY['A1'], '11 × 89 = ?',
 '979', 'exact', '10×89+1×89=890+89=979', '11×89: 8_(8+9)_9 — sum=17, carry: 8+1=9, mid=7, last=9 → 979', 4000,
 '[{"level":1,"text":"Use the ×11 trick on 89. What are A and B?","cost":0},{"level":2,"text":"A=8, B=9. A+B=17 ≥ 10, so there will be a carry.","cost":5},{"level":3,"text":"8+9=17: write 7 in the middle, carry 1. Left digit: 8+1=9. Result: 979.","cost":15}]',
 'The carry rule extends ×11 to work even when digit sum exceeds 9.',
 'The iron forge cipher: 11 × 89. Unlock the furnace.',
 ARRAY['multiplication','x11','carry','two-digit','zone-3'], 10, 15, 3),

-- Z3-03
(3, 'mental', 5, ARRAY['A2','C3'], '9 × 99 = ?',
 '891', 'exact', '9+9+…(99 times)', '9×99 = 9×(100−1) = 900−9 = 891; digit check: 8+9+1=18 divisible by 9', 3000,
 '[{"level":1,"text":"Is 99 close to a round number?","cost":0},{"level":2,"text":"9×99 = 9×(100−1). Expand this.","cost":5},{"level":3,"text":"9×100=900, minus 9=891. Verify: 8+9+1=18, divisible by 9.","cost":15}]',
 'Near-benchmark and ×9 digit-sum are two tricks that confirm each other.',
 'At the summit base, the ancient engraving reads 9 × 99.',
 ARRAY['multiplication','x9','near-100','zone-3'], 10, 20, 2),

-- Z3-04
(3, 'mental', 5, ARRAY['A7'], '25 × 44 = ?',
 '1100', 'exact', '25×44: multiply step by step', '25×44 = 100×44÷4 = 4400÷4 = 1100', 3000,
 '[{"level":1,"text":"What shortcut involves 25 and 100?","cost":0},{"level":2,"text":"25 = 100÷4, so 25×44 = 100×44÷4.","cost":5},{"level":3,"text":"44÷4=11, then 11×100=1100.","cost":15}]',
 'Rearranging ×25 into ÷4×100 turns hard products into easy ones.',
 'The summit toll collector demands 25 × 44 iron coins.',
 ARRAY['multiplication','x25','quarter','zone-3'], 10, 15, 2),

-- Z3-05
(3, 'arithmetic', 6, ARRAY['C7'], '7 × 8 × 9 = ?',
 '504', 'exact', '7×8=56, 56×9: count up', 'Group: 7×8=56, then 56×9 = 56×10−56 = 560−56 = 504', 5000,
 '[{"level":1,"text":"Which two of the three numbers are easiest to multiply first?","cost":0},{"level":2,"text":"Compute 7×8 first, then multiply the result by 9.","cost":5},{"level":3,"text":"7×8=56. Then 56×9=56×10−56=560−56=504.","cost":15}]',
 'Compute the easiest pair first, then multiply by the third.',
 'Three gear ratios at the iron forge: 7, 8, and 9. What is their product?',
 ARRAY['multiplication','grouping','three-factors','zone-3'], 10, 20, 4),

-- Z3-06
(3, 'pattern', 5, ARRAY['A5'], '1 + 3 + 5 + 7 + 9 + 11 = ?',
 '36', 'exact', 'Add sequentially: 1+3=4, 4+5=9, 9+7=16, 16+9=25, 25+11=36', 'Sum of first 6 odd numbers = 6² = 36', 2000,
 '[{"level":1,"text":"How many odd numbers are you adding?","cost":0},{"level":2,"text":"The sum of the first n odd numbers has a beautiful closed form.","cost":5},{"level":3,"text":"There are 6 odd numbers. Sum = 6² = 36. The first n odds always sum to n².","cost":15}]',
 'The sum of the first n odd numbers is always n².',
 'The staircase of the Iron Summit counts 1, 3, 5, 7, 9, 11 steps in rising arcs.',
 ARRAY['addition','consecutive-odds','pattern','zone-3'], 10, 10, 1),

-- Z3-07
(3, 'algebraic', 6, ARRAY['A6'], '8² - 6² = ?',
 '28', 'exact', '64−36=28', 'Difference of squares: (8+6)(8−6) = 14×2 = 28', 2000,
 '[{"level":1,"text":"Is there a formula for the difference of two squares?","cost":0},{"level":2,"text":"a²−b² = (a+b)(a−b). Here a=8, b=6.","cost":5},{"level":3,"text":"(8+6)(8−6) = 14×2 = 28.","cost":15}]',
 'a²−b²=(a+b)(a−b) converts subtraction of squares into a simple product.',
 'The forge master poses a challenge: what is 8 squared minus 6 squared?',
 ARRAY['algebra','difference-of-squares','zone-3'], 10, 10, 2),

-- Z3-08
(3, 'mental', 5, ARRAY['C2','C3'], '1000 - 364 = ?',
 '636', 'exact', '1000-364: borrow step by step', 'Step complement: 364→400 (+36), 400→1000 (+600). Answer: 636', 4000,
 '[{"level":1,"text":"What would you add to 364 to reach 1000?","cost":0},{"level":2,"text":"Work in steps: 364 to the nearest 100, then to 1000.","cost":5},{"level":3,"text":"364+36=400, 400+600=1000. Complement = 36+600 = 636.","cost":15}]',
 'Step up to the nearest round number, then jump to the target.',
 'The iron vault starts at 1000 tokens. The locksmith removes 364 tumblers.',
 ARRAY['subtraction','complement','chunking','zone-3'], 10, 12, 3),

-- Z3-09
(3, 'structural', 5, ARRAY['D5'], '1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 = ?',
 '55', 'exact', 'Add all numbers from 1 to 10 sequentially', 'Triangular: n(n+1)/2 = 10×11÷2 = 55. Or: pair opposites — 5 pairs of 11.', 2000,
 '[{"level":1,"text":"Is there a formula for 1+2+3+...+n?","cost":0},{"level":2,"text":"Pair the numbers from each end: 1+10, 2+9, 3+8, ... What does each pair sum to?","cost":5},{"level":3,"text":"5 pairs each summing to 11: 5×11=55. Or n(n+1)/2 = 10×11÷2 = 55.","cost":15}]',
 'Pair numbers from each end — each pair sums to n+1.',
 'The iron bridge has 10 supports numbered 1 through 10. Sum all support numbers.',
 ARRAY['addition','triangular-numbers','structural','zone-3'], 10, 15, 1),

-- Z3-10
(3, 'mental', 5, ARRAY['A7'], '4 × 25 × 3 = ?',
 '300', 'exact', '4×25=100, 100×3=300', 'Spot 4×25=100 first, then ×3=300', 2000,
 '[{"level":1,"text":"What is 4×25?","cost":0},{"level":2,"text":"Multiply 4×25 first to get a round number, then multiply by 3.","cost":5},{"level":3,"text":"4×25=100, then 100×3=300.","cost":15}]',
 'Spot the 4×25=100 shortcut first — it collapses the problem.',
 'The forge: 4 anvils, each needing 25 strikes, across 3 different blades.',
 ARRAY['multiplication','x25','grouping','zone-3'], 10, 8, 1),

-- Z3-11
(3, 'arithmetic', 4, ARRAY['A2'], '72 ÷ 8 = ?',
 '9', 'exact', '72÷8: trial division', 'Reverse ×9: 9×8=72, so 72÷8=9. Digit check: 7+2=9 confirms multiple of 9', 2000,
 '[{"level":1,"text":"What times 8 gives 72?","cost":0},{"level":2,"text":"Think of division as a multiplication question: ?×8=72.","cost":5},{"level":3,"text":"9×8=72 (digit sum: 7+2=9, confirms multiple of 9). So 72÷8=9.","cost":15}]',
 'Division reverses multiplication — the digit-sum rule confirms the answer.',
 'The iron chest holds 72 keys divided equally among 8 compartments.',
 ARRAY['division','x9','digit-sum','zone-3'], 10, 6, 1),

-- Z3-12
(3, 'mental', 5, ARRAY['C3'], '6 × 99 = ?',
 '594', 'exact', '6×99: multiply directly', '6×99 = 6×(100−1) = 600−6 = 594', 2000,
 '[{"level":1,"text":"Is 99 close to 100?","cost":0},{"level":2,"text":"6×99 = 6×(100−1). Expand.","cost":5},{"level":3,"text":"6×100=600, minus 6=594.","cost":15}]',
 '×99 = ×100 minus one lot of the number. Always.',
 'Six summit torches each burn at the rate of 99 fuel units per hour.',
 ARRAY['multiplication','near-100','zone-3'], 10, 10, 1),

-- =========================================================================
-- ZONE 4 — ADVANCED (scaffolded in MVP)
-- =========================================================================

-- Z4-01
(4, 'pattern', 7, ARRAY['A1','A2'], 'What is 3 × 37?',
 '111', 'exact', '37+37+37=111', '37×3=111. Recognise: 37 × 3k gives repdigit k repeated 3 times.', 3000,
 '[{"level":1,"text":"What is special about the number 37?","cost":0},{"level":2,"text":"3×37=111. What happens with 6×37, 9×37?","cost":5},{"level":3,"text":"37×3=111, 37×6=222, 37×9=333. Multiples of 3 times 37 produce repdigits.","cost":15}]',
 '37×3=111 anchors the beautiful 37-family of repdigit patterns.',
 'The hidden pattern chamber challenges you: what is 3 × 37?',
 ARRAY['multiplication','pattern','repdigit','zone-4'], 10, 8, 2),

-- Z4-02
(4, 'pattern', 8, ARRAY['A1'], 'What is 7 × 11 × 13?',
 '1001', 'exact', '7×11=77, 77×13=1001', '7×11=77, 77×13=770+231=1001. Memorise: 7×11×13=1001.', 5000,
 '[{"level":1,"text":"Try multiplying two of the three numbers first.","cost":0},{"level":2,"text":"7×11=77. Now compute 77×13.","cost":5},{"level":3,"text":"77×13=77×10+77×3=770+231=1001. Worth memorising: 7×11×13=1001.","cost":15}]',
 '7×11×13=1001 is a number-theorist favourite — worth memorising.',
 'Three ancient numbers — 7, 11, and 13 — are carved on the summit gate.',
 ARRAY['multiplication','pattern','identity','zone-4'], 10, 15, 3),

-- Z4-03
(4, 'structural', 7, ARRAY['D5'], 'How many handshakes in a group of 8?',
 '28', 'exact', 'List all pairs from 8 people', 'Handshake formula: n(n−1)/2 = 8×7/2 = 28', 4000,
 '[{"level":1,"text":"Each of 8 people shakes hands with 7 others. But each handshake is counted twice.","cost":0},{"level":2,"text":"Total one-sided handshakes: 8×7=56. Divide by 2 since each handshake involves two people.","cost":5},{"level":3,"text":"8×7÷2=28. Or use the triangular number formula: n(n−1)/2 = 8×7/2 = 28.","cost":15}]',
 'n people shaking hands: n(n−1)/2 is the handshake formula.',
 'Eight summit masters greet each other with exactly one handshake each.',
 ARRAY['combinatorics','triangular-numbers','structural','zone-4'], 10, 20, 2),

-- Z4-04
(4, 'pattern', 8, ARRAY['A3'], 'What is 2¹⁰?',
 '1024', 'exact', 'Multiply 2 ten times: 2×2×2×2×2×2×2×2×2×2', 'Doubling chain: 1→2→4→8→16→32→64→128→256→512→1024. Or: 2^5=32, 32²=1024.', 4000,
 '[{"level":1,"text":"2¹⁰ means multiplying 2 by itself 10 times. Start the doubling chain.","cost":0},{"level":2,"text":"2^10 = (2^5)^2 = 32^2. Can you square 32?","cost":5},{"level":3,"text":"32×32=1024. Or trace the chain: 2→4→8→16→32→64→128→256→512→1024.","cost":15}]',
 '2^10=1024 is the foundation of binary — worth memorising cold.',
 'The doubling crystal: starting at 1, it doubles exactly 10 times.',
 ARRAY['powers','doubling-chain','pattern','zone-4'], 10, 25, 3),

-- Z4-05
(4, 'invariant', 8, ARRAY['B4'], 'What day of the week is 100 days after Tuesday?',
 'thursday', 'set', 'Count 100 days forward from Tuesday', '100 mod 7 = 2 (14×7=98). Tuesday + 2 days = Thursday.', 5000,
 '[{"level":1,"text":"How many full weeks fit into 100 days?","cost":0},{"level":2,"text":"100 ÷ 7 = 14 remainder 2. Only the remainder matters for the day of the week.","cost":5},{"level":3,"text":"100 mod 7 = 2. Tuesday + 2 days = Thursday.","cost":15}]',
 'Day-of-week problems collapse to mod 7 — only the remainder matters.',
 'The summit calendar shows Tuesday. What day will it be 100 days from now?',
 ARRAY['modular-arithmetic','calendar','zone-4'], 10, 15, 2),

-- Z4-06
(4, 'pattern', 7, ARRAY['B5'], 'What is the digit sum of 999,999,999?',
 '81', 'exact', 'Add all 9 digits: 9+9+9+9+9+9+9+9+9=81', '9 nines: 9×9=81', 3000,
 '[{"level":1,"text":"Count the nines. How many are there?","cost":0},{"level":2,"text":"There are 9 nines. Repeated addition becomes multiplication.","cost":5},{"level":3,"text":"9 nines: 9×9=81.","cost":15}]',
 'n copies of digit d gives digit sum n×d.',
 'The great summit stone reads 999,999,999. What is its digit sum?',
 ARRAY['digit-sum','pattern','zone-4'], 10, 10, 1),

-- Z4-07
(4, 'invariant', 9, ARRAY['B1','B4'], 'Is 2¹⁰⁰ divisible by 3?',
 'no', 'set', 'Try to divide 2^100 by 3', 'Powers of 2 mod 3 cycle: 2,1,2,1,... 2^100 mod 3 = 1 ≠ 0. Not divisible.', 5000,
 '[{"level":1,"text":"Think about what powers of 2 look like when divided by 3.","cost":0},{"level":2,"text":"2 mod 3=2, 4 mod 3=1, 8 mod 3=2, 16 mod 3=1. What is the pattern?","cost":5},{"level":3,"text":"2^n mod 3 alternates: 2,1,2,1,... 2^100 (even exponent) mod 3=1, not 0. Answer: no.","cost":15}]',
 'Powers of 2 cycle mod 3 as 2,1,2,1,... and never reach 0.',
 'The ancient summit proof poses the question: is 2 to the power of 100 divisible by 3?',
 ARRAY['modular-arithmetic','powers','number-theory','zone-4'], 10, 20, 3),

-- Z4-08
(4, 'structural', 8, ARRAY['D4'], '1 + 2 + 4 + 8 + 16 + 32 + 64 + 128 + 256 + 512 = ?',
 '1023', 'exact', 'Add all 10 terms sequentially', 'Geometric series: sum of 2^0+2^1+...+2^9 = 2^10 − 1 = 1024−1 = 1023', 4000,
 '[{"level":1,"text":"This is a geometric series. Each term is double the previous.","cost":0},{"level":2,"text":"Sum of 1+2+4+...+2^(n−1) = 2^n − 1. How many terms are there?","cost":5},{"level":3,"text":"10 terms (2^0 to 2^9). Sum = 2^10 − 1 = 1024 − 1 = 1023.","cost":15}]',
 'The geometric series sum formula: 2^n − 1 for n terms starting at 1.',
 'The geometric staircase at the summit: 1, 2, 4, 8, ... up to 512.',
 ARRAY['series','geometric','structural','zone-4'], 10, 25, 2);
