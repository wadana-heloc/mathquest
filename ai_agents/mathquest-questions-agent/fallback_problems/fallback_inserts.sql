-- Fallback bank import — generated 2026-05-06
-- 80 problems across 25 tricks
-- Skipped: BOSS — non-integer difficulty keys, skip

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    1,
    'pattern',
    3,
    'A1',
    ARRAY['A1'],
    'The cipher gate reads: 11 × 14 = ?',
    '154',
    'exact',
    '10 × 14 + 1 × 14 = 140 + 14 = 154',
    'Digit-sum: 1 + 4 = 5. Sandwich the sum between the digits: 1(5)4 = 154.',
    4000,
    '[{"level": 1, "text": "Look at the two digits of 14. What happens when you multiply any two-digit number by 11?", "cost": 0}, {"level": 2, "text": "Try adding the two digits of 14 together.", "cost": 5}, {"level": 3, "text": "Place that sum between the original two digits to form the three-digit answer.", "cost": 15}]'::jsonb,
    'When multiplying by 11, the middle digit is the sum of the two digits of the other number (when that sum is less than 10).',
    'The ancient cipher gate displays 11 × 14. Solve it to pass through.',
    ARRAY['multiplication', '×11', 'two-digit', 'zone-1'],
    4,
    'discovery'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'pattern',
    6,
    'A1',
    ARRAY['A1'],
    'The stone tablet reads: 11 × 39 = ?',
    '429',
    'exact',
    '11 × 39 = 11 × 40 − 11 = 440 − 11 = 429',
    'Digit-sum: 3 + 9 = 12 (≥10, so carry). Units digit is 2, carry 1 into the first digit: (3+1)(2)(9) = 429.',
    5000,
    '[{"level": 1, "text": "Add the two digits of 39 and check: is the sum less than 10?", "cost": 0}, {"level": 2, "text": "The digit sum is \u2265 10. Write only the units digit in the middle position, and carry 1 into the leading digit.", "cost": 5}, {"level": 3, "text": "Add the carry to the leading digit of 39, keep the units digit of the sum in the middle, and the trailing digit stays the same.", "cost": 15}]'::jsonb,
    'When the digit sum is 10 or more, carry the tens digit into the hundreds place: the first digit grows by 1.',
    'A stone tablet at the dungeon entrance shows 11 × 39. Only those who solve it may enter.',
    ARRAY['multiplication', '×11', 'carry', 'zone-3'],
    5,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'pattern',
    7,
    'A1',
    ARRAY['A1'],
    '11 × 89',
    '979',
    'exact',
    '11×80=880, 11×9=99, total=979',
    '8+9=17 → carry: 8+1=9, mid=7, last=9 → 979',
    4000,
    '[{"level": 1, "text": "Add the digits of 89: 8+9 = ?", "cost": 0}, {"level": 2, "text": "The sum of the digits is 10 or more. What does a carry do to the first digit of 89?", "cost": 5}, {"level": 3, "text": "You have the carry digit, the middle digit (from 17 mod 10), and the last digit of 89. Assemble them left to right.", "cost": 15}]'::jsonb,
    'Large digit sums still follow the carry rule — methodically.',
    'The toughest summit cipher: 11 × 89.',
    ARRAY['multiplication', '×11', 'carry', 'zone-3'],
    6,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    1,
    'pattern',
    3,
    'A2',
    ARRAY['A2'],
    'Nine gear-locks each need 8 keys. How many keys in total?',
    '72',
    'exact',
    '8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 = 72',
    '9 × 8 = 10 × 8 − 8 = 80 − 8 = 72',
    3500,
    '[{"level": 1, "text": "9 is very close to 10. Can you use 10 \u00d7 8 to help?", "cost": 0}, {"level": 2, "text": "What is 10 \u00d7 8? From that result, subtract one group of 8 \u2014 because 9 groups is one fewer than 10.", "cost": 5}, {"level": 3, "text": "Subtract 8 from the result of 10 \u00d7 8.", "cost": 15}]'::jsonb,
    '9 × n = 10n − n: multiply by 10 (easy), then subtract the original number once.',
    'Nine gear-locks guard the treasure vault. Each needs exactly 8 keys. How many keys must the adventurer carry?',
    ARRAY['multiplication', '×9', 'complement', 'zone-1'],
    4,
    'discovery'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    2,
    'pattern',
    4,
    'A2',
    ARRAY['A2'],
    'The cave creature''s weakness code is always a 9-multiple. What is 9 × 6?',
    '54',
    'exact',
    'Count by 6 nine times',
    '10×6−6=54; digit-sum: 5+4=9 ✓',
    2000,
    '[{"level": 1, "text": "What is 10 \u00d7 6? How does 9 \u00d7 6 compare to that?", "cost": 0}, {"level": 2, "text": "9 groups of 6 is the same as 10 groups of 6, minus one group. Set up that subtraction.", "cost": 5}, {"level": 3, "text": "You know what 10\u00d76 equals. How many sixes is that more than 9 sixes?", "cost": 15}]'::jsonb,
    'Every multiple of 9 has digits that sum to 9 (or a multiple of 9).',
    'The cave creature''s weakness code is always a 9-multiple. What is 9 × 6?',
    ARRAY['multiplication', '×9', 'zone-2'],
    4,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'pattern',
    6,
    'A2',
    ARRAY['A2'],
    'The ancient cipher wheel shows: 9 × 47 = ?',
    '423',
    'exact',
    '9 × 47 = 9 × 40 + 9 × 7 = 360 + 63 = 423',
    '9 × 47 = 10 × 47 − 47 = 470 − 47 = 423',
    5000,
    '[{"level": 1, "text": "9 is one less than 10. What is 10 \u00d7 47?", "cost": 0}, {"level": 2, "text": "Once you have 10 \u00d7 47, subtract one group of 47 \u2014 because 9 \u00d7 47 has one fewer group.", "cost": 5}, {"level": 3, "text": "Subtract 47 from the result of 10 \u00d7 47.", "cost": 15}]'::jsonb,
    '9 × n = 10n − n. For larger numbers this avoids messy column multiplication.',
    'The cipher wheel at the temple entrance spins to reveal 9 × 47. Decode it before time runs out.',
    ARRAY['multiplication', '×9', 'two-digit', 'zone-3'],
    5,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'pattern',
    7,
    'A2',
    ARRAY['A2'],
    'The summit creature''s weakness: 9 × 99. Can you use two tricks together?',
    '891',
    'exact',
    '9×99 long multiplication',
    'Benchmark: 9×100−9=891; digit-sum: 8+9+1=18 ✓',
    3000,
    '[{"level": 1, "text": "What is 9 \u00d7 100?", "cost": 0}, {"level": 2, "text": "99 is very close to 100. How could you rewrite 9 \u00d7 99 as a difference that involves 9 \u00d7 100?", "cost": 5}, {"level": 3, "text": "You have 9\u00d7100 and need to remove 9\u00d71. Carry out that subtraction.", "cost": 15}]'::jsonb,
    'Use benchmark (×100 then subtract) AND confirm with digit-sum.',
    'The summit creature''s weakness: 9 × 99. Can you use two tricks together?',
    ARRAY['multiplication', '×9', 'benchmark', 'zone-3'],
    6,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    1,
    'pattern',
    3,
    'A3',
    ARRAY['A3'],
    'A crystal doubles in power twice. It starts at 15. What is 4 × 15?',
    '60',
    'exact',
    '15 + 15 + 15 + 15 = 60',
    'Double 15 → 30. Double again → 60.',
    3500,
    '[{"level": 1, "text": "4 = 2 \u00d7 2. Can you get to 4 \u00d7 15 by doubling twice?", "cost": 0}, {"level": 2, "text": "Start by doubling 15 once.", "cost": 5}, {"level": 3, "text": "Double your result one more time to reach 4 \u00d7 15.", "cost": 15}]'::jsonb,
    '4 × n = double then double again. You never have to multiply by 4 directly.',
    'A crystal absorbs energy and doubles in power twice. Starting at 15, what is its final power?',
    ARRAY['multiplication', '×4', 'doubling', 'zone-1'],
    4,
    'discovery'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    2,
    'pattern',
    4,
    'A3',
    ARRAY['A3'],
    'The bridge load doubles at each gate. Starting load is 8, doubled 3 times. What is the final load?',
    '64',
    'exact',
    '8×8 memorised or repeated addition',
    'Doubling chain: 8→16→32→64',
    1000,
    '[{"level": 1, "text": "What is 8 doubled?", "cost": 0}, {"level": 2, "text": "Double your result one more time.", "cost": 5}, {"level": 3, "text": "How many doublings has the chain gone through so far? How many does it need in total?", "cost": 15}]'::jsonb,
    '8×8 = double 8 three times: 8→16→32→64.',
    'The bridge load doubles at each gate. Starting load is 8, doubled 3 times. What is the final load?',
    ARRAY['multiplication', 'doubling', 'zone-2'],
    4,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'pattern',
    6,
    'A3',
    ARRAY['A3'],
    'Eight dungeon rooms each hold 23 gems. How many gems total?',
    '184',
    'exact',
    '8 × 23 = 8 × 20 + 8 × 3 = 160 + 24 = 184',
    'Doubling chain: 23 → 46 → 92 → 184',
    5000,
    '[{"level": 1, "text": "8 = 2 \u00d7 2 \u00d7 2. Can you reach 8 \u00d7 23 by doubling three times?", "cost": 0}, {"level": 2, "text": "Double 23 once, then double that result.", "cost": 5}, {"level": 3, "text": "Double your current result one final time.", "cost": 15}]'::jsonb,
    '8 × n = double, double, double. Three doublings instead of one hard multiplication.',
    'Eight dungeon rooms line the corridor, each holding exactly 23 gems. The gatekeeper demands the total.',
    ARRAY['multiplication', '×8', 'doubling-chain', 'zone-3'],
    5,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    1,
    'pattern',
    3,
    'A4',
    ARRAY['A4'],
    'You know that 6² = 36. Use the near-square pattern to find 7².',
    '49',
    'exact',
    '7 × 7 = 49 (direct multiplication)',
    '7² = 6² + 2×6 + 1 = 36 + 12 + 1 = 49',
    4000,
    '[{"level": 1, "text": "7 = 6 + 1. There is a pattern connecting consecutive perfect squares.", "cost": 0}, {"level": 2, "text": "7\u00b2 = 6\u00b2 + something. That something involves 6.", "cost": 5}, {"level": 3, "text": "Apply the formula (n+1)\u00b2 = n\u00b2 + 2n + 1 using n = 6.", "cost": 15}]'::jsonb,
    'Each perfect square is the previous one plus twice the previous root plus 1: (n+1)² = n² + 2n + 1.',
    'The wizard''s tome shows 6² = 36 and asks: what is 7²? You already know the secret pattern.',
    ARRAY['squares', 'near-square', 'pattern', 'zone-1'],
    4,
    'discovery'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'pattern',
    5,
    'A4',
    ARRAY['A4'],
    'What is 8²? (Use what you know about 7².)',
    '64',
    'exact',
    '8×8 = 64 (memorised or repeated doubling)',
    '(n+1)² = n²+2n+1. 7²=49, so 8²=49+14+1=64',
    2000,
    '[{"level": 1, "text": "You already know 7\u00b2=49. How does 8\u00b2 relate to 7\u00b2?", "cost": 0}, {"level": 2, "text": "Adding one row and one column to a 7\u00d77 grid adds 7+7+1 extra tiles.", "cost": 5}, {"level": 3, "text": "You have the new row of tiles and the new column of tiles. There is also a corner tile that belongs to neither row nor column. Count all three groups and add them to 7\u00b2.", "cost": 15}]'::jsonb,
    '(n+1)² = n²+2n+1. Knowing any perfect square gives the next one instantly.',
    'The summit tiling chamber expands by one row and one column each round. Last round the floor was 7×7. What is the new area?',
    ARRAY['squares', 'near-square', 'pattern', 'zone-3'],
    5,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'pattern',
    6,
    'A4',
    ARRAY['A4'],
    'If 11² = 121, what is 12²?',
    '144',
    'exact',
    '12 × 12 = 12 × 10 + 12 × 2 = 120 + 24 = 144',
    '12² = 11² + 2×11 + 1 = 121 + 22 + 1 = 144',
    5000,
    '[{"level": 1, "text": "12 = 11 + 1. How does 12\u00b2 relate to 11\u00b2?", "cost": 0}, {"level": 2, "text": "There is a formula connecting (n+1)\u00b2 to n\u00b2. Set up the expression with n = 11.", "cost": 5}, {"level": 3, "text": "Substitute 11\u00b2 = 121 into the formula and compute the sum.", "cost": 15}]'::jsonb,
    'Once you know one perfect square you can chain forward: each square equals the previous plus 2n plus 1.',
    'The oracle states: 11² = 121. Now find 12² to unlock the next chamber.',
    ARRAY['squares', 'near-square', 'two-digit', 'zone-3'],
    5,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    1,
    'pattern',
    3,
    'A5',
    ARRAY['A5'],
    'What is 1 + 3 + 5 + 7?',
    '16',
    'exact',
    '1 + 3 = 4, then 4 + 5 = 9, then 9 + 7 = 16',
    'Count the odd numbers: there are 4. Sum = 4² = 16.',
    3500,
    '[{"level": 1, "text": "How many odd numbers are in the list?", "cost": 0}, {"level": 2, "text": "Count the terms. The sum of the first n odd numbers always equals n\u00b2.", "cost": 5}, {"level": 3, "text": "Square the count of odd numbers in the list.", "cost": 15}]'::jsonb,
    'The sum of the first n odd numbers always equals n². Count the terms, then square that count.',
    'Four glowing stones line the path: 1, 3, 5, 7. Their combined power unlocks the gate.',
    ARRAY['addition', 'odd-numbers', 'perfect-square', 'zone-1'],
    4,
    'discovery'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'pattern',
    5,
    'A5',
    ARRAY['A5'],
    'The staircase has steps of size 1, 3, 5, 7, 9, 11. What is the total height?',
    '36',
    'exact',
    'Add sequentially: 1+3=4, +5=9, +7=16, +9=25, +11=36',
    'Six odd numbers: 6² = 36',
    2000,
    '[{"level": 1, "text": "How many odd numbers are you adding?", "cost": 0}, {"level": 2, "text": "If you arranged these steps as a square staircase, what shape would fill it perfectly?", "cost": 5}, {"level": 3, "text": "You counted 6 odd numbers, so the formula gives 6\u00b2. Calculate that square.", "cost": 15}]'::jsonb,
    'The sum of the first n odd numbers = n². Count the odds: there are 6, so 6²=36.',
    'The staircase has steps of size 1, 3, 5, 7, 9, 11. What is the total height?',
    ARRAY['addition', 'odd-numbers', 'pattern', 'zone-3'],
    5,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'pattern',
    6,
    'A5',
    ARRAY['A5'],
    'What is 1 + 3 + 5 + 7 + 9 + 11 + 13?',
    '49',
    'exact',
    '1+3=4, 4+5=9, 9+7=16, 16+9=25, 25+11=36, 36+13=49',
    'Seven odd numbers → 7² = 49.',
    4000,
    '[{"level": 1, "text": "Count how many odd numbers appear in the sum.", "cost": 0}, {"level": 2, "text": "There are 7 terms. The sum of the first n odd numbers equals n\u00b2.", "cost": 5}, {"level": 3, "text": "Square the number of terms to get the sum.", "cost": 15}]'::jsonb,
    'No matter how many consecutive odd numbers you add starting from 1, the answer is always a perfect square.',
    'Seven runes carved in stone read 1, 3, 5, 7, 9, 11, 13. Their combined energy is the key.',
    ARRAY['addition', 'odd-numbers', 'perfect-square', 'zone-3'],
    5,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    2,
    'pattern',
    4,
    'A6',
    ARRAY['A6'],
    'The vault code is 8² − 5². What is it?',
    '39',
    'exact',
    '8² = 64, 5² = 25. 64 − 25 = 39.',
    'a² − b² = (a+b)(a−b). So (8+5)(8−5) = 13 × 3 = 39.',
    4000,
    '[{"level": 1, "text": "a\u00b2 \u2212 b\u00b2 has a special factoring rule. Can you factor it?", "cost": 0}, {"level": 2, "text": "a\u00b2 \u2212 b\u00b2 = (a+b)(a\u2212b). Apply this with a=8 and b=5.", "cost": 5}, {"level": 3, "text": "Multiply (a+b) by (a\u2212b) to find the answer.", "cost": 15}]'::jsonb,
    'a² − b² = (a+b)(a−b). A difference of squares becomes two small multiplications.',
    'The vault door requires the answer to 8² − 5². Type the code before the timer expires.',
    ARRAY['subtraction', 'squares', 'difference-of-squares', 'zone-2'],
    4,
    'discovery'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'pattern',
    6,
    'A6',
    ARRAY['A6'],
    'Two creatures have power 8² and 6². Their power difference is the key.',
    '28',
    'exact',
    '64−36=28',
    'Difference of squares: (8+6)(8−6) = 14×2 = 28',
    2000,
    '[{"level": 1, "text": "Do you know a factoring rule for a\u00b2\u2212b\u00b2?", "cost": 0}, {"level": 2, "text": "Can you rewrite 8\u00b2\u22126\u00b2 using the sum (8+6) and the difference (8\u22126) somehow?", "cost": 5}, {"level": 3, "text": "You found two smaller numbers to multiply instead of squaring. Carry out that multiplication.", "cost": 15}]'::jsonb,
    'a²−b² = (a+b)(a−b). Factor first, then multiply — much easier.',
    'Two creatures have power 8² and 6². Their power difference is the key.',
    ARRAY['algebra', 'difference-of-squares', 'zone-3'],
    5,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'pattern',
    7,
    'A6',
    ARRAY['A6'],
    'The bridge cipher reads: 13² − 10² = ?',
    '69',
    'exact',
    '13² = 169, 10² = 100. 169 − 100 = 69.',
    '(13+10)(13−10) = 23 × 3 = 69.',
    5000,
    '[{"level": 1, "text": "a\u00b2 \u2212 b\u00b2 factors into two expressions involving a and b.", "cost": 0}, {"level": 2, "text": "a\u00b2 \u2212 b\u00b2 = (a+b)(a\u2212b). Calculate (a+b) and (a\u2212b) for a=13, b=10.", "cost": 5}, {"level": 3, "text": "Multiply the two factors you found.", "cost": 15}]'::jsonb,
    'The difference-of-squares identity turns a hard subtraction of large squares into two tiny multiplications.',
    'The ancient bridge cipher shows 13² − 10². Solve it or the drawbridge stays raised.',
    ARRAY['subtraction', 'squares', 'difference-of-squares', 'zone-3'],
    6,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    2,
    'pattern',
    3,
    'A7',
    ARRAY['A7'],
    'The vault combination always hides a factor of 4. What is 4 × 25?',
    '100',
    'exact',
    '25+25+25+25',
    '25 = 100÷4, so 4×25 = 100',
    1000,
    '[{"level": 1, "text": "How many 25s make 50?", "cost": 0}, {"level": 2, "text": "You know two 25s make 50. How many 25s would make double that?", "cost": 5}, {"level": 3, "text": "You found what two 25s make. What does doubling that give you?", "cost": 15}]'::jsonb,
    '4 groups of 25 make 100 — four quarters make a whole.',
    'The vault combination always hides a factor of 4. What is 4 × 25?',
    ARRAY['multiplication', '×25', 'zone-2'],
    4,
    'discovery'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    2,
    'pattern',
    4,
    'A7',
    ARRAY['A7'],
    'The merchant sells 25 × 16 gold coins. How many?',
    '400',
    'exact',
    '25 × 16 = 25 × 10 + 25 × 6 = 250 + 150 = 400',
    '25 = 100 ÷ 4. So 25 × 16 = (100 × 16) ÷ 4 = 1600 ÷ 4 = 400.',
    4000,
    '[{"level": 1, "text": "25 is one quarter of 100. Can you multiply by 100 first?", "cost": 0}, {"level": 2, "text": "Multiply 16 by 100, then divide by 4 because 25 = 100 \u00f7 4.", "cost": 5}, {"level": 3, "text": "Divide the result of 100 \u00d7 16 by 4.", "cost": 15}]'::jsonb,
    '25 × n = (100 × n) ÷ 4. Multiply by 100 (easy), then halve twice.',
    'A merchant stacks 25 bags of 16 gold coins each. The vault keeper needs the total before sealing the vault.',
    ARRAY['multiplication', '×25', 'divide-by-4', 'zone-2'],
    4,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'pattern',
    7,
    'A7',
    ARRAY['A7'],
    'The treasure map reads: 25 × 44 = ?',
    '1100',
    'exact',
    '25 × 44 = 25 × 40 + 25 × 4 = 1000 + 100 = 1100',
    '25 × 44 = (100 × 44) ÷ 4 = 4400 ÷ 4 = 1100.',
    5000,
    '[{"level": 1, "text": "25 = 100 \u00f7 4. Start by multiplying 44 by 100.", "cost": 0}, {"level": 2, "text": "Multiply 44 by 100 to get the scaled product.", "cost": 5}, {"level": 3, "text": "Divide the result of 100 \u00d7 44 by 4.", "cost": 15}]'::jsonb,
    'Multiplying by 25 is the same as multiplying by 100 and dividing by 4 — two easy steps.',
    'The treasure map encodes 25 × 44. Decode it to find the number of paces to the chest.',
    ARRAY['multiplication', '×25', 'divide-by-4', 'zone-3'],
    6,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    1,
    'invariant',
    2,
    'B1',
    ARRAY['B1'],
    'Only the odd-total door unlocks the next path. Is 13 + 27 + 41 odd or even?',
    'Odd',
    'set',
    'Calculate: 13+27=40, 40+41=81',
    'Three odd numbers → odd+odd=even, even+odd=odd',
    3000,
    '[{"level": 1, "text": "Before adding, look at each number: is it odd or even?", "cost": 0}, {"level": 2, "text": "What happens when you add two odd numbers together?", "cost": 5}, {"level": 3, "text": "You found the parity of the first pair. Now combine that result with the third number''s parity.", "cost": 15}]'::jsonb,
    'Count odd addends: if odd count is odd, the sum is odd. No calculation needed.',
    'Only the odd-total door unlocks the next path. Is 13+27+41 odd or even?',
    ARRAY['parity', 'invariant', 'zone-1'],
    3,
    'discovery'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    1,
    'invariant',
    3,
    'B1',
    ARRAY['B1'],
    '15 × 9 = ?',
    '135',
    'exact',
    '15 × 9 = 15 × 10 − 15 = 150 − 15 = 135',
    'Both 15 and 9 are odd → product must be odd. Any even answer is instantly wrong. Then 15 × 9 = 150 − 15 = 135.',
    4000,
    '[{"level": 1, "text": "Are both 15 and 9 odd or even?", "cost": 0}, {"level": 2, "text": "What is the parity of a product when both factors are odd?", "cost": 5}, {"level": 3, "text": "Use 15 \u00d7 10 as a starting point, then subtract one group of 15.", "cost": 15}]'::jsonb,
    'Checking parity before multiplying eliminates wrong answers instantly and narrows the search space.',
    'The dungeon counter tracks 15 × 9 traps. Knowing parity lets you verify the answer fast.',
    ARRAY['multiplication', 'parity', 'odd-even', 'zone-1'],
    4,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    2,
    'invariant',
    4,
    'B1',
    ARRAY['B1'],
    'A forked cave path. Only the odd product opens the left tunnel. Is 13 × 7 odd or even?',
    'Odd',
    'set',
    '13×7=91 (odd)',
    'Odd × Odd = Odd — no calculation needed',
    1000,
    '[{"level": 1, "text": "Is 13 odd or even? Is 7 odd or even?", "cost": 0}, {"level": 2, "text": "What rule covers odd \u00d7 odd?", "cost": 5}, {"level": 3, "text": "You have identified both numbers as odd and applied the odd \u00d7 odd rule. What does that rule say the product must be?", "cost": 15}]'::jsonb,
    'Odd × Odd is always Odd.',
    'A forked cave path. Only the odd product opens the left tunnel. Is 13 × 7 odd or even?',
    ARRAY['parity', 'invariant', 'zone-2'],
    4,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'invariant',
    6,
    'B1',
    ARRAY['B1'],
    '47 × 51 = ?',
    '2397',
    'exact',
    '47 × 51 = 47 × 50 + 47 × 1 = 2350 + 47 = 2397',
    'Both 47 and 51 are odd → product is odd. Then 47 × 51 = 47 × 50 + 47 = 2350 + 47 = 2397.',
    6000,
    '[{"level": 1, "text": "Are 47 and 51 odd or even? What does that tell you about their product?", "cost": 0}, {"level": 2, "text": "Both are odd, so the product is odd \u2014 eliminate all even guesses. Now use 47 \u00d7 50 as a starting point.", "cost": 5}, {"level": 3, "text": "Add one more group of 47 to the result of 47 \u00d7 50.", "cost": 15}]'::jsonb,
    'Parity is the fastest check: before computing, know whether the answer is odd or even to eliminate wrong answers.',
    'The cipher lock shows 47 × 51. A wrong guess resets the dungeon. Check parity first.',
    ARRAY['multiplication', 'parity', 'two-digit', 'zone-3'],
    5,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    2,
    'invariant',
    4,
    'B2',
    ARRAY['B2'],
    '12 unit tiles are rearranged from a 3×4 rectangle into a 2×6 rectangle. What is the area of the new shape?',
    '12',
    'exact',
    '2 × 6 = 12',
    'Area is invariant under rearrangement of tiles. Total tiles = 12, so area = 12 regardless of shape.',
    4000,
    '[{"level": 1, "text": "When you rearrange tiles, does the total number of tiles change?", "cost": 0}, {"level": 2, "text": "The total number of tiles is the area, and that count is unchanged by rearrangement.", "cost": 5}, {"level": 3, "text": "The area equals the number of tiles \u2014 count them in the original rectangle.", "cost": 15}]'::jsonb,
    'Area is invariant under rearrangement: shuffling tiles changes shape and perimeter, but area is always the tile count.',
    'The floor tiles in the crystal chamber can shift into different rectangles. The area does not change — can you see why?',
    ARRAY['area', 'invariant', 'perimeter', 'zone-2'],
    4,
    'discovery'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'invariant',
    5,
    'B2',
    ARRAY['B2'],
    'A 2×6 rectangle and a 3×4 rectangle — which has the larger perimeter?',
    '2×6 (perimeter 16 vs 14)',
    'exact',
    'Count sides of each shape individually',
    'P(2×6)=2(2+6)=16; P(3×4)=2(3+4)=14. Same area (12), different perimeter.',
    4000,
    '[{"level": 1, "text": "Calculate the area of each rectangle. Are they equal?", "cost": 0}, {"level": 2, "text": "Now calculate the perimeter of each: perimeter = 2\u00d7(length+width).", "cost": 5}, {"level": 3, "text": "You have both rectangles and the perimeter formula. Which rectangle has the larger sum of its two side lengths?", "cost": 15}]'::jsonb,
    'Equal area does NOT mean equal perimeter. The more elongated the shape, the larger the perimeter.',
    'Two summit floor tiles have the same area of 12 squares but different shapes. The wider tile opens a secret door. Which perimeter is larger?',
    ARRAY['perimeter', 'invariant', 'geometry', 'zone-3'],
    5,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'invariant',
    7,
    'B2',
    ARRAY['B2'],
    '12 unit tiles form a 1×12 line. What is the perimeter?',
    '26',
    'exact',
    'Perimeter of a 1×12 rectangle = 2 × (1 + 12) = 2 × 13 = 26',
    'Area is invariant (= 12 tiles always), but perimeter changes with shape. A 1×12 line: perimeter = 2(1+12) = 26.',
    5000,
    '[{"level": 1, "text": "Does rearranging tiles change the perimeter, or only the area?", "cost": 0}, {"level": 2, "text": "Perimeter changes with shape (unlike area). For a 1\u00d712 rectangle, use perimeter = 2(length + width).", "cost": 5}, {"level": 3, "text": "Apply the perimeter formula to the dimensions 1 and 12.", "cost": 15}]'::jsonb,
    'Area is the invariant (fixed by tile count); perimeter is not invariant and must be calculated for each specific shape.',
    'The tiles rearrange into a long corridor 1 tile wide and 12 tiles long. How long is the boundary?',
    ARRAY['perimeter', 'invariant', 'rectangle', 'zone-3'],
    6,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    1,
    'invariant',
    3,
    'B3',
    ARRAY['B3'],
    'x + 7 = 15. What is x?',
    '8',
    'exact',
    'Try x = 8: 8 + 7 = 15. Correct.',
    'Subtract 7 from both sides: x = 15 − 7 = 8.',
    3500,
    '[{"level": 1, "text": "The equation is balanced. What operation can you apply to both sides to isolate x?", "cost": 0}, {"level": 2, "text": "Subtract 7 from both sides to keep the balance.", "cost": 5}, {"level": 3, "text": "After subtracting 7 from both sides, read off x from the simplified right-hand side.", "cost": 15}]'::jsonb,
    'An equation is a balance: any operation applied equally to both sides preserves it.',
    'The enchanted scale shows x + 7 = 15. What weight is x?',
    ARRAY['algebra', 'balance', 'addition', 'zone-1'],
    4,
    'discovery'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'invariant',
    5,
    'B3',
    ARRAY['B3'],
    'A balance holds 3×□ on the left and 24 on the right. What is □?',
    '8',
    'exact',
    'Trial: try 7 (21≠24), try 8 (24=24) ✓',
    'Divide both sides by 3: □ = 24÷3 = 8',
    3000,
    '[{"level": 1, "text": "The balance is level: the left total equals the right total.", "cost": 0}, {"level": 2, "text": "If 3 equal weights total 24, how do you find one weight?", "cost": 5}, {"level": 3, "text": "Both sides are equal. If you divide the right side by 3, you must do the same to the left. Carry out that division.", "cost": 15}]'::jsonb,
    'Dividing both sides of a balanced equation by the same nonzero number keeps it balanced.',
    'The summit balance beam must stay level. Three identical weights sit on the left pan; 24 stones on the right. What does each weight measure?',
    ARRAY['algebra', 'balance', 'invariant', 'zone-3'],
    5,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'invariant',
    6,
    'B3',
    ARRAY['B3'],
    '2x + 5 = 17. What is x?',
    '6',
    'exact',
    'Try x = 6: 2×6 + 5 = 12 + 5 = 17. Correct.',
    'Subtract 5 from both sides: 2x = 12. Divide both sides by 2: x = 6.',
    4000,
    '[{"level": 1, "text": "What operation removes the + 5 from the left side while keeping the equation balanced?", "cost": 0}, {"level": 2, "text": "Subtract 5 from both sides to simplify.", "cost": 5}, {"level": 3, "text": "After isolating 2x, divide both sides by 2.", "cost": 15}]'::jsonb,
    'Solve equations step by step: undo addition first, then undo multiplication, applying each operation to both sides.',
    'The magic mirror shows 2x + 5 = 17. Solve for x to reveal the portal code.',
    ARRAY['algebra', 'balance', 'two-step', 'zone-3'],
    5,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    2,
    'invariant',
    5,
    'B4',
    ARRAY['B4'],
    'What is the remainder when 100 is divided by 7?',
    '2',
    'exact',
    '7 × 14 = 98. 100 − 98 = 2.',
    'Find the largest multiple of 7 that fits in 100: 7 × 14 = 98. Remainder = 100 − 98 = 2.',
    5000,
    '[{"level": 1, "text": "What is the largest multiple of 7 that is less than or equal to 100?", "cost": 0}, {"level": 2, "text": "Find the largest multiple of 7 that fits in 100, then see how far 100 is above it.", "cost": 5}, {"level": 3, "text": "Subtract that largest multiple from 100 to find the remainder.", "cost": 15}]'::jsonb,
    'Modular arithmetic finds remainders by locating the nearest multiple below the target.',
    'The clock tower runs on a 7-hour cycle. After 100 hours, where in the cycle is it?',
    ARRAY['modular', 'remainder', 'division', 'zone-2'],
    5,
    'discovery'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'invariant',
    6,
    'B4',
    ARRAY['B4'],
    'A rotating door has 7 positions (0–6). It starts at position 0 and advances 1 step per move. What position is it after 45 moves?',
    '3',
    'exact',
    'Count 45 steps cycling 0→1→2→3→4→5→6→0→…',
    '45 mod 7 = 45 − 6×7 = 45−42 = 3',
    3000,
    '[{"level": 1, "text": "The door resets every 7 steps. How many complete cycles fit in 45 moves?", "cost": 0}, {"level": 2, "text": "How many complete cycles of 7 fit inside 45? Use that count to find the leftover.", "cost": 5}, {"level": 3, "text": "6 complete cycles account for 42 moves. Subtract 42 from 45 to find the remainder.", "cost": 15}]'::jsonb,
    'Cyclic systems repeat every N steps. Divide by N and take the remainder — that is the position.',
    'The summit''s rotating door cycles through 7 positions and resets. Starting at 0, after 45 steps which position does it show?',
    ARRAY['modular-arithmetic', 'clock', 'invariant', 'zone-3'],
    5,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    4,
    'invariant',
    8,
    'B4',
    ARRAY['B4'],
    'What is the remainder when 365 is divided by 7?',
    '1',
    'exact',
    '7 × 52 = 364. 365 − 364 = 1.',
    '7 × 52 = 364. 365 − 364 = 1. Remainder = 1.',
    6000,
    '[{"level": 1, "text": "How many complete weeks fit in 365 days?", "cost": 0}, {"level": 2, "text": "Calculate how many complete multiples of 7 fit in 365.", "cost": 5}, {"level": 3, "text": "Subtract the total days in complete weeks from 365.", "cost": 15}]'::jsonb,
    '365 days = 52 weeks + 1 day. This is why consecutive years start one weekday later.',
    'The dungeon calendar runs in 7-day cycles. After 365 days, which position in the cycle holds the chest?',
    ARRAY['modular', 'remainder', 'days', 'zone-4'],
    6,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    1,
    'invariant',
    3,
    'B5',
    ARRAY['B5'],
    'The digit sum of 4518 is 4+5+1+8 = 18. What is 4518 ÷ 9?',
    '502',
    'exact',
    '4500 ÷ 9 = 500. 18 ÷ 9 = 2. Total = 502.',
    'Digit sum = 18, which is divisible by 9, so 4518 is divisible by 9. Then 4518 ÷ 9 = 502.',
    5000,
    '[{"level": 1, "text": "The digit sum is 18. Is 18 divisible by 9?", "cost": 0}, {"level": 2, "text": "Yes, so 4518 is divisible by 9 with no remainder. Split 4518 into two simpler parts for division.", "cost": 5}, {"level": 3, "text": "Divide 4500 by 9, then divide 18 by 9, and add the two partial quotients.", "cost": 15}]'::jsonb,
    'If the digit sum is divisible by 9, the whole number is too — confirm this before dividing.',
    'The potion recipe calls for 4518 drops split equally into 9 vials. The digit sum tells you if it divides evenly.',
    ARRAY['divisibility', 'digit-sum', 'division-by-9', 'zone-1'],
    4,
    'discovery'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    2,
    'invariant',
    4,
    'B5',
    ARRAY['B5'],
    'Only the divisible-by-9 key opens this chest. Test 4,527.',
    'Yes',
    'set',
    'Long division: 4527÷9',
    'Digit sum: 4+5+2+7=18, 1+8=9 ✓',
    3000,
    '[{"level": 1, "text": "Add all the digits of 4,527 together.", "cost": 0}, {"level": 2, "text": "You have the digit sum. Now ask: is that sum itself divisible by 9?", "cost": 5}, {"level": 3, "text": "What numbers between 1 and 20 are divisible by 9? Is your digit sum one of them?", "cost": 15}]'::jsonb,
    'Sum the digits. If that sum is divisible by 9, so is the number.',
    'Only the divisible-by-9 key opens this chest. Test 4,527.',
    ARRAY['divisibility', 'digit-sum', 'zone-2'],
    4,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'invariant',
    6,
    'B5',
    ARRAY['B5'],
    'The digit sum of 3726 is 3+7+2+6 = 18. What is 3726 ÷ 9?',
    '414',
    'exact',
    '3600 ÷ 9 = 400. 126 ÷ 9 = 14. Total = 414.',
    'Digit sum = 18, divisible by 9. 3726 ÷ 9: 3600÷9=400, 126÷9=14, total=414.',
    5000,
    '[{"level": 1, "text": "The digit sum is 18. What does that tell you about divisibility by 9?", "cost": 0}, {"level": 2, "text": "18 is divisible by 9, so 3726 divides evenly. Split 3726 into manageable chunks for division.", "cost": 5}, {"level": 3, "text": "Divide 3600 by 9, then divide 126 by 9, and add the two partial quotients.", "cost": 15}]'::jsonb,
    'Digit sum divisibility is a free pre-check: know the answer divides evenly before you start the division.',
    'Three floors of the crystal tower each hold parts of 3726 mana crystals split among 9 guardians.',
    ARRAY['divisibility', 'digit-sum', 'division-by-9', 'zone-3'],
    5,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    2,
    'invariant',
    4,
    'B6',
    ARRAY['B6'],
    'Socks come in 7 colours. You cannot see in the dark. How many socks must you grab to guarantee a matching pair?',
    '8',
    'exact',
    'Worst case: you pick one of each colour (7 socks). The 8th must match one already held.',
    '7 colours = 7 containers. After 7 picks you might have one of each colour. Pick 8 → guaranteed match.',
    5000,
    '[{"level": 1, "text": "In the worst case, how many socks can you pick before being forced to repeat a colour?", "cost": 0}, {"level": 2, "text": "In the worst case you can pick one of each colour without a match. How many picks does the guarantee require after that?", "cost": 5}, {"level": 3, "text": "One more pick beyond the maximum no-match scenario guarantees a repeated colour.", "cost": 15}]'::jsonb,
    'Pigeonhole principle: if you have more items (picks) than containers (colours), at least one container must hold more than one item.',
    'The sock drawer in the dark dungeon holds socks of 7 colours. Grab enough to guarantee a matching pair.',
    ARRAY['pigeonhole', 'logic', 'worst-case', 'zone-2'],
    4,
    'discovery'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'invariant',
    6,
    'B6',
    ARRAY['B6'],
    'There are 8 creatures but only 7 nesting spots. Must at least two creatures share a spot?',
    'Yes',
    'set',
    'Try to assign each creature a unique spot — impossible with only 7 spots',
    '8 items in 7 containers → at least one container holds ≥2 (Pigeonhole Principle)',
    3000,
    '[{"level": 1, "text": "How many creatures are there? How many spots?", "cost": 0}, {"level": 2, "text": "Can you give each of 8 creatures a unique spot when only 7 spots exist?", "cost": 5}, {"level": 3, "text": "You have more creatures than spots. What must be true about at least one spot?", "cost": 15}]'::jsonb,
    'If you have more objects than containers, at least one container must hold more than one object — guaranteed, no counting needed.',
    'Eight summit creatures are looking for nesting spots, but only 7 spots exist. Can every creature have its own spot?',
    ARRAY['pigeonhole', 'combinatorics', 'invariant', 'zone-3'],
    5,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'invariant',
    7,
    'B6',
    ARRAY['B6'],
    '13 adventurers are in a room. There are 12 months in the year. What is the minimum number of adventurers guaranteed to share a birth month?',
    '2',
    'exact',
    '12 adventurers could each have a different birth month. The 13th must share with someone.',
    '12 months (containers), 13 people (items). By pigeonhole, at least ⌈13/12⌉ = 2 people share a month.',
    6000,
    '[{"level": 1, "text": "How many people can have different birth months before someone must share?", "cost": 0}, {"level": 2, "text": "There are only 12 distinct months. How many people can be placed without any overlap?", "cost": 5}, {"level": 3, "text": "Once all 12 months are claimed, the very next person must repeat \u2014 think about the minimum overlap this creates.", "cost": 15}]'::jsonb,
    'Pigeonhole: n+1 items in n containers guarantees at least one container holds 2 or more items.',
    'The guild recruits 13 adventurers. The archivist notes there are only 12 birth months. At least how many share a month?',
    ARRAY['pigeonhole', 'logic', 'birthdays', 'zone-3'],
    6,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    1,
    'mental',
    2,
    'C1',
    ARRAY['C1'],
    'The first bridge section needs 46 planks; the second needs 38. How many planks in total?',
    '84',
    'exact',
    '46+38 column addition with carry',
    'Chunking: 46+30=76, +8=84',
    4000,
    '[{"level": 1, "text": "Can you split 38 into a tens part and a units part?", "cost": 0}, {"level": 2, "text": "Add the tens part of 38 to 46 first. What do you get?", "cost": 5}, {"level": 3, "text": "What is left to add after you have taken care of the tens part of 38?", "cost": 15}]'::jsonb,
    'Break the second number into tens and units; add the tens first.',
    'The first bridge section needs 46 planks; the second needs 38. How many planks in total?',
    ARRAY['addition', 'chunking', 'zone-1'],
    3,
    'discovery'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    1,
    'mental',
    3,
    'C1',
    ARRAY['C1'],
    '47 + 38 = ?',
    '85',
    'exact',
    '47 + 38: units 7+8=15, write 5 carry 1, tens 4+3+1=8. Answer: 85.',
    'Split 38 into 30 + 8. Add 30 first: 47+30=77. Then add 8: 77+8=85.',
    3500,
    '[{"level": 1, "text": "Can you break 38 into a tens part and a units part before adding?", "cost": 0}, {"level": 2, "text": "Split 38 into 30 and 8. Add the tens part to 47 first.", "cost": 5}, {"level": 3, "text": "After adding the tens chunk, add the units chunk to complete the sum.", "cost": 15}]'::jsonb,
    'Chunking into tens and units makes each addition step easy. Never add awkward two-digit numbers in one go.',
    'Two gem chests hold 47 and 38 gems. The dungeon map needs the total to unlock the door.',
    ARRAY['addition', 'chunking', 'two-digit', 'zone-1'],
    4,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    2,
    'mental',
    5,
    'C1',
    ARRAY['C1'],
    'The Echo Caves bridge has 47 identical planks, each weighing 6 stones. What is the total load?',
    '282',
    'exact',
    '6+6+6+… (47 times) or long multiplication',
    'Chunk: 40×6=240, 7×6=42, 240+42=282',
    3000,
    '[{"level": 1, "text": "Can you split 47 into a tens part and a units part?", "cost": 0}, {"level": 2, "text": "Multiply each part by 6 separately. What do you get for the tens part?", "cost": 5}, {"level": 3, "text": "You found 40\u00d76 and 7\u00d76. What do you need to do with those two results?", "cost": 15}]'::jsonb,
    'Splitting a two-digit number into tens and units, then multiplying each part separately, is always faster than repeated addition.',
    'The Echo Caves bridge has 47 identical planks, each weighing 6 stones. What is the total load?',
    ARRAY['multiplication', 'chunking', 'zone-2'],
    5,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'mental',
    6,
    'C1',
    ARRAY['C1'],
    '236 + 147 = ?',
    '383',
    'exact',
    '236 + 147: units 6+7=13 write 3 carry 1; tens 3+4+1=8; hundreds 2+1=3. Answer: 383.',
    'Add hundreds first: 236+100=336. Then add tens: 336+40=376. Then units: 376+7=383.',
    5000,
    '[{"level": 1, "text": "Break 147 into 100 + 40 + 7. Add each chunk one at a time.", "cost": 0}, {"level": 2, "text": "Add 100 to 236 first, then add 40 to that result.", "cost": 5}, {"level": 3, "text": "Add the remaining 7 to complete the sum.", "cost": 15}]'::jsonb,
    'Chunking by place value turns a three-digit addition into three trivial additions.',
    'The armoury holds 236 swords and receives 147 more. The quartermaster needs the total inventory.',
    ARRAY['addition', 'chunking', 'three-digit', 'zone-3'],
    5,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    1,
    'mental',
    2,
    'C2',
    ARRAY['C2'],
    'You need exactly 100 crystals for the potion. You already have 37. How many more do you need?',
    '63',
    'exact',
    'Column subtraction: borrow from tens',
    'Complement pair: 37+63=100',
    3000,
    '[{"level": 1, "text": "What number added to 37 gives a round number first?", "cost": 0}, {"level": 2, "text": "You found the gap from 37 to your round number. How far is that round number from 100?", "cost": 5}, {"level": 3, "text": "You have the two pieces: the step to the round number, and the rest of the way to 100. Add those two pieces together.", "cost": 15}]'::jsonb,
    'Every number has a complement that reaches 100 — learn the pairs and the answer appears instantly.',
    'You need exactly 100 crystals for the potion. You already have 37. How many more do you need?',
    ARRAY['subtraction', 'complement-100', 'zone-1'],
    3,
    'discovery'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    1,
    'mental',
    3,
    'C2',
    ARRAY['C2'],
    '63 + ? = 100',
    '37',
    'exact',
    '100 − 63 = 37',
    'Complement of 63: units pair → 3+7=10, tens pair → 6+3+1(carry)=10. Complement = 37.',
    3500,
    '[{"level": 1, "text": "What number added to 63 gives exactly 100?", "cost": 0}, {"level": 2, "text": "Think about the units digit first: what must you add to 3 to reach the next multiple of 10?", "cost": 5}, {"level": 3, "text": "After finding the units complement, find the tens complement and combine both digits.", "cost": 15}]'::jsonb,
    'Every number from 1 to 99 has a unique complement to 100. Knowing these pairs makes subtraction instant.',
    'The enchanted scales must reach exactly 100. One side holds 63. What weight completes the balance?',
    ARRAY['addition', 'complement-100', 'mental', 'zone-1'],
    4,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'mental',
    6,
    'C2',
    ARRAY['C2'],
    '348 + 152 = ?',
    '500',
    'exact',
    '348 + 152: units 8+2=10 write 0 carry 1; tens 4+5+1=10 write 0 carry 1; hundreds 3+1+1=5. Answer: 500.',
    '48 + 52 = 100 (complement pair). So 348 + 152 = 300 + 100 + 100 = 500.',
    4000,
    '[{"level": 1, "text": "Look at the last two digits: 48 and 52. Do they sum to a round number?", "cost": 0}, {"level": 2, "text": "48 and 52 are complement pairs that sum to 100. Use that to simplify the calculation.", "cost": 5}, {"level": 3, "text": "Combine the hundreds digits with the complement result to find the total.", "cost": 15}]'::jsonb,
    'Spotting complement pairs inside larger numbers lets you collapse hard additions into round-number arithmetic.',
    'Two gem deposits contain 348 and 152 crystals. The vault keeper wants the total before closing.',
    ARRAY['addition', 'complement-100', 'three-digit', 'zone-3'],
    5,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'mental',
    7,
    'C2',
    ARRAY['C2'],
    'The scaled potion puzzle: two ingredients must total exactly 1,000. You have 364. How many more?',
    '636',
    'exact',
    'Column subtraction with multiple borrows',
    'Complement: 364+636=1,000',
    4000,
    '[{"level": 1, "text": "What does 364 need to reach 400?", "cost": 0}, {"level": 2, "text": "You found the gap from 364 to 400. Now, how far is 400 from 1,000?", "cost": 5}, {"level": 3, "text": "You found the gap from 364 to 400, and the gap from 400 to 1000. Add those two gaps together.", "cost": 15}]'::jsonb,
    'Complement-to-1000: find what makes 364 reach 1000.',
    'The scaled potion puzzle: two ingredients must total exactly 1,000. You have 364. How many more?',
    ARRAY['subtraction', 'complement-1000', 'zone-3'],
    6,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    1,
    'mental',
    2,
    'C3',
    ARRAY['C3'],
    'The price tag reads 19 coins; the tax is 13. What is the exact total you must pay?',
    '32',
    'exact',
    '19+10=29, +3=32',
    'Benchmark: 19+1=20, then +12 = 32',
    3000,
    '[{"level": 1, "text": "Is 19 close to a rounder number?", "cost": 0}, {"level": 2, "text": "How much do you need to add to 19 to reach 20?", "cost": 5}, {"level": 3, "text": "Add that small piece to 19 first, then add the rest of 13.", "cost": 15}]'::jsonb,
    'Numbers close to a round ten are fastest when nudged to that ten first.',
    'The price tag reads 19 coins; the tax is 13. What is the exact total you must pay?',
    ARRAY['addition', 'benchmark', 'zone-1'],
    3,
    'discovery'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    1,
    'mental',
    3,
    'C3',
    ARRAY['C3'],
    'Three chests each hold 50 gold pieces. What is the total treasure?',
    '150',
    'exact',
    '50+50=100, +50=150',
    'Benchmark: 3 groups of 50 → 3×5×10 = 150',
    2000,
    '[{"level": 1, "text": "How many equal groups of 50 do you have?", "cost": 0}, {"level": 2, "text": "What is 3 times 5, ignoring the zero for now?", "cost": 5}, {"level": 3, "text": "You found 3\u00d75. How does knowing that help you find 3\u00d750?", "cost": 15}]'::jsonb,
    'Repeated equal groups near a round number are fastest with benchmark reasoning.',
    'Three chests each hold 50 gold pieces. What is the total treasure?',
    ARRAY['addition', 'benchmark', 'multiplication-preview', 'zone-1'],
    4,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    2,
    'mental',
    4,
    'C3',
    ARRAY['C3'],
    '97 + 36 = ?',
    '133',
    'exact',
    '97 + 36: units 7+6=13 write 3 carry 1; tens 9+3+1=13 write 3 carry 1; hundreds 1. Answer: 133.',
    '97 is 3 below 100. Add 3 to reach 100: 100+36=136. Subtract the 3 we added: 136−3=133.',
    4000,
    '[{"level": 1, "text": "97 is very close to 100. Round up to 100 first.", "cost": 0}, {"level": 2, "text": "After rounding up to 100, add 36 to your benchmark, then plan a small correction.", "cost": 5}, {"level": 3, "text": "Subtract the rounding adjustment from the benchmark sum.", "cost": 15}]'::jsonb,
    'Adjust to the nearest benchmark (100, 50, 25), do the easy addition, then correct for the adjustment.',
    'The potion shelf has 97 vials. The cart delivers 36 more. Count them quickly before the wizard returns.',
    ARRAY['addition', 'benchmark', 'adjustment', 'zone-2'],
    4,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'mental',
    7,
    'C3',
    ARRAY['C3'],
    '498 + 247 = ?',
    '745',
    'exact',
    '498 + 247: units 8+7=15 write 5 carry 1; tens 9+4+1=14 write 4 carry 1; hundreds 4+2+1=7. Answer: 745.',
    '498 is 2 below 500. 500+247=747. Subtract the 2 we added: 747−2=745.',
    5000,
    '[{"level": 1, "text": "498 is close to 500. Round up to 500 first.", "cost": 0}, {"level": 2, "text": "After rounding, add 247 to the benchmark, then plan a correction.", "cost": 5}, {"level": 3, "text": "Subtract the rounding correction from the benchmark sum.", "cost": 15}]'::jsonb,
    'The benchmark technique works for any near-round number: round, add, correct. Three steps faster than column addition.',
    'Two caravans carry 498 and 247 gold pieces to the capital. The treasurer must log the total before midnight.',
    ARRAY['addition', 'benchmark', 'three-digit', 'zone-3'],
    6,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    1,
    'mental',
    2,
    'C4',
    ARRAY['C4'],
    'Two mirror creatures face each other — one has strength 8, the other 7. What is their combined force?',
    '15',
    'exact',
    'Count up from 8 seven times',
    'Near-doubles: 7+7+1 = 15',
    2000,
    '[{"level": 1, "text": "Look at the two numbers. How close are they to each other?", "cost": 0}, {"level": 2, "text": "What is 7 + 7? How far is 8 + 7 from that?", "cost": 5}, {"level": 3, "text": "You know 7 + 7. What single step separates 8 + 7 from that double?", "cost": 15}]'::jsonb,
    'Any pair differing by 1 = double the smaller + 1.',
    'Two mirror creatures face each other — one has strength 8, the other 7. What is their combined force?',
    ARRAY['addition', 'near-doubles', 'zone-1'],
    3,
    'discovery'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    1,
    'mental',
    3,
    'C4',
    ARRAY['C4'],
    '7 + 8 = ?',
    '15',
    'exact',
    'Count up from 7: 8, 9, 10, 11, 12, 13, 14, 15.',
    'Near-doubles: 7 + 7 = 14, then add 1 more for the extra 1 in 8. 14 + 1 = 15.',
    2500,
    '[{"level": 1, "text": "7 and 8 differ by only 1. Can you use the double of one of them?", "cost": 0}, {"level": 2, "text": "Double the smaller number. Then note that 8 is exactly 1 more than 7.", "cost": 5}, {"level": 3, "text": "Add 1 to the double of the smaller number to account for the difference.", "cost": 15}]'::jsonb,
    'Near-doubles: when two numbers differ by 1, double the smaller and add 1. Much faster than counting up.',
    'Two treasure piles hold 7 and 8 gems. How many gems total?',
    ARRAY['addition', 'near-doubles', 'single-digit', 'zone-1'],
    4,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'mental',
    6,
    'C4',
    ARRAY['C4'],
    '28 + 29 = ?',
    '57',
    'exact',
    '28 + 29: units 8+9=17 write 7 carry 1; tens 2+2+1=5. Answer: 57.',
    'Near-doubles: 28 + 28 = 56, then add 1 for the extra 1 in 29. 56 + 1 = 57.',
    3500,
    '[{"level": 1, "text": "28 and 29 differ by 1. What is the double of 28?", "cost": 0}, {"level": 2, "text": "Double 28, then add 1 because 29 is one more than 28.", "cost": 5}, {"level": 3, "text": "Add 1 to the double of 28 to get the final answer.", "cost": 15}]'::jsonb,
    'Near-doubles scale up: 28+29 is just as easy as 7+8 once you use the same trick.',
    'Two patrols log 28 and 29 sightings. The captain needs the combined count before the briefing.',
    ARRAY['addition', 'near-doubles', 'two-digit', 'zone-3'],
    5,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    1,
    'mental',
    3,
    'C5',
    ARRAY['C5'],
    '5 × 18 = ?',
    '90',
    'exact',
    '5 × 18 = 5 × 10 + 5 × 8 = 50 + 40 = 90',
    '5 = 10 ÷ 2. So 5 × 18 = (10 × 18) ÷ 2 = 180 ÷ 2 = 90.',
    3000,
    '[{"level": 1, "text": "5 is half of 10. Can you use 10 \u00d7 18 first?", "cost": 0}, {"level": 2, "text": "Multiply 18 by 10, then halve the result because 5 is half of 10.", "cost": 5}, {"level": 3, "text": "Halve the result of 10 \u00d7 18.", "cost": 15}]'::jsonb,
    '5 × n = (10 × n) ÷ 2. Always multiply by 10 first (append a zero), then halve.',
    'Five adventurers each carry 18 potions. Multiply by 5 to find the total.',
    ARRAY['multiplication', '×5', 'half-of-ten', 'zone-1'],
    4,
    'discovery'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    2,
    'mental',
    4,
    'C5',
    ARRAY['C5'],
    'The five-sided trap scales: each side is 18 units. What is the total perimeter?',
    '90',
    'exact',
    '18+18+18+18+18',
    '×5 via half-of-ten: 10×18÷2 = 90',
    2000,
    '[{"level": 1, "text": "What is 10 \u00d7 18?", "cost": 0}, {"level": 2, "text": "5 and 10 are related by a factor of 2. How could knowing 10 \u00d7 18 help you find 5 \u00d7 18?", "cost": 5}, {"level": 3, "text": "You have a number to halve. What is half of that even number?", "cost": 15}]'::jsonb,
    '×5 = multiply by 10 then halve.',
    'The five-sided trap scales: each side is 18 units. What is the total perimeter?',
    ARRAY['multiplication', '×5', 'zone-2'],
    4,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'mental',
    6,
    'C5',
    ARRAY['C5'],
    '5 × 76 = ?',
    '380',
    'exact',
    '5 × 76 = 5 × 70 + 5 × 6 = 350 + 30 = 380',
    '10 × 76 = 760. Halve it: 760 ÷ 2 = 380.',
    4000,
    '[{"level": 1, "text": "What is 10 \u00d7 76?", "cost": 0}, {"level": 2, "text": "10 \u00d7 76 gives you twice what you need. Halve it to get 5 \u00d7 76.", "cost": 5}, {"level": 3, "text": "Divide the result of 10 \u00d7 76 by 2.", "cost": 15}]'::jsonb,
    '5 × n = half of 10n. For any number, multiplying by 5 is faster than repeated addition.',
    'Five towers each hold 76 stone blocks. How many blocks in total?',
    ARRAY['multiplication', '×5', 'half-of-ten', 'zone-3'],
    5,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'mental',
    5,
    'C6',
    ARRAY['C6'],
    'Without calculating exactly, is 48 × 52 closer to 2,000 or 2,500?',
    '2,500',
    'set',
    '48×52 long multiplication',
    'Bound: 48×52 ≈ 50×50=2,500. Exact: (50−2)(50+2)=2500−4=2496',
    3000,
    '[{"level": 1, "text": "Round 48 and 52 each to the nearest ten. What multiplication does that suggest?", "cost": 0}, {"level": 2, "text": "50\u00d750 = 2,500. Will 48\u00d752 be larger or smaller than that?", "cost": 5}, {"level": 3, "text": "50\u00d750 is your anchor. One factor is 2 less, the other is 2 more \u2014 how does that affect the product, and is the result inside the gate''s range?", "cost": 15}]'::jsonb,
    'Bound first: 48 and 52 are both near 50. 50×50=2,500. The answer must be close to that.',
    'The gate only opens if your estimate lands between 2,400 and 2,600. Is 48×52 in that range?',
    ARRAY['estimation', 'bounds', 'mental', 'zone-3'],
    5,
    'discovery'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'mental',
    6,
    'C6',
    ARRAY['C6'],
    '47 × 52 = ?',
    '2444',
    'exact',
    '47 × 52 = 47 × 50 + 47 × 2 = 2350 + 94 = 2444',
    'Estimate: ≈50×50=2500. Exact: 47×52 = 47×50+47×2 = 2350+94 = 2444.',
    6000,
    '[{"level": 1, "text": "Round both numbers to 50. What is the rough estimate?", "cost": 0}, {"level": 2, "text": "Break 52 into a round number plus a small leftover. Can you use that split to simplify the multiplication?", "cost": 5}, {"level": 3, "text": "You now have two smaller multiplications. What do you do with the two results to get the final answer?", "cost": 15}]'::jsonb,
    'Estimating first sets bounds. If your precise answer falls outside those bounds, you know to recheck.',
    'The cartographer estimates 47 × 52 map squares. Set your bounds first, then calculate precisely.',
    ARRAY['multiplication', 'estimation', 'bounds', 'zone-3'],
    5,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    4,
    'mental',
    8,
    'C6',
    ARRAY['C6'],
    '198 × 32 = ?',
    '6336',
    'exact',
    '198 × 32 = 190 × 32 + 8 × 32 = 6080 + 256 = 6336',
    '198 ≈ 200. (200−2)×32 = 6400−64 = 6336.',
    7000,
    '[{"level": 1, "text": "198 is very close to 200. What is 200 \u00d7 32?", "cost": 0}, {"level": 2, "text": "Multiply 200 by 32, then adjust downward because 198 = 200 \u2212 2.", "cost": 5}, {"level": 3, "text": "Subtract 2 \u00d7 32 from the result of 200 \u00d7 32.", "cost": 15}]'::jsonb,
    'Near-round multiplication: compute from the round number, then adjust by the small difference.',
    'The siege engine fires 198 shots in 32 volleys. The commander needs the total shot count fast.',
    ARRAY['multiplication', 'estimation', 'near-round', 'zone-4'],
    6,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    2,
    'mental',
    4,
    'C7',
    ARRAY['C7'],
    '4 × 63 = ?',
    '252',
    'exact',
    '63 × 4: units 3×4=12 write 2 carry 1; tens 6×4+1=25. Answer: 252.',
    'Left-to-right: 4×60=240 first, then 4×3=12. Total: 240+12=252.',
    4000,
    '[{"level": 1, "text": "Start with the most significant digit. What is 4 \u00d7 60?", "cost": 0}, {"level": 2, "text": "Multiply 4 by the tens part of 63, then multiply 4 by the units part separately.", "cost": 5}, {"level": 3, "text": "Add the two partial products together.", "cost": 15}]'::jsonb,
    'Left-to-right multiplication gives a useful approximation immediately and refines it — you know the ballpark before you finish.',
    'Four wagons each carry 63 barrels. The toll collector calculates from left to right.',
    ARRAY['multiplication', 'left-to-right', 'two-digit', 'zone-2'],
    4,
    'discovery'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'mental',
    6,
    'C7',
    ARRAY['C7'],
    'Three sequential summit gates each multiply the load: 7, then 8, then 9.',
    '504',
    'exact',
    '7×8=56 (known), then 56×9 long',
    'Left-to-right: 7×8=56, 56×9=504',
    5000,
    '[{"level": 1, "text": "What is 7 \u00d7 8?", "cost": 0}, {"level": 2, "text": "Now multiply that result by 9.", "cost": 5}, {"level": 3, "text": "You have 56\u00d79. Use the benchmark: 56\u00d710 minus 56\u00d71. Carry out that subtraction.", "cost": 15}]'::jsonb,
    'Work left-to-right: compute the first pair, then multiply by the third.',
    'Three sequential summit gates each multiply the load: 7, then 8, then 9.',
    ARRAY['multiplication', 'left-to-right', 'zone-3'],
    5,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'mental',
    7,
    'C7',
    ARRAY['C7'],
    '7 × 86 = ?',
    '602',
    'exact',
    '86 × 7: units 6×7=42 write 2 carry 4; tens 8×7+4=60. Answer: 602.',
    'Left-to-right: 7×80=560, then 7×6=42. Total: 560+42=602.',
    5000,
    '[{"level": 1, "text": "Start with the tens digit of 86. What is 7 \u00d7 80?", "cost": 0}, {"level": 2, "text": "Multiply 7 by 80, then separately multiply 7 by 6.", "cost": 5}, {"level": 3, "text": "Add the two partial products to complete the multiplication.", "cost": 15}]'::jsonb,
    'Left-to-right multiplication produces the most significant digits first, so you always have a useful partial answer.',
    'Seven battalions each march 86 paces. The general needs the total distance before the signal.',
    ARRAY['multiplication', 'left-to-right', 'two-digit', 'zone-3'],
    6,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    2,
    'structural',
    4,
    'D1',
    ARRAY['D1'],
    'Sum the symmetric staircase: 1 + 2 + 3 + 4 + 4 + 3 + 2 + 1 = ?',
    '20',
    'exact',
    '1+2=3, 3+3=6, 6+4=10, 10+4=14, 14+3=17, 17+2=19, 19+1=20.',
    'The sequence is symmetric. Sum one half: 1+2+3+4=10. Double it: 10×2=20.',
    5000,
    '[{"level": 1, "text": "The pattern goes up then back down symmetrically. What is the sum of the first half?", "cost": 0}, {"level": 2, "text": "Sum just the ascending half of the sequence (1+2+3+4).", "cost": 5}, {"level": 3, "text": "Double the half-sum to get the full total.", "cost": 15}]'::jsonb,
    'In any symmetric arrangement, find the total by summing one half and doubling.',
    'The staircase in the tower rises then falls: 1, 2, 3, 4, 4, 3, 2, 1 steps per floor. Total steps?',
    ARRAY['symmetry', 'addition', 'doubling', 'zone-2'],
    4,
    'discovery'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'structural',
    5,
    'D1',
    ARRAY['D1'],
    'A symmetric treasure layout has 9 items on the left half and a mirror image on the right, plus 1 item in the centre. How many items in total?',
    '19',
    'exact',
    'Count every item individually',
    'Symmetry: left = right = 9. Total = 2×9+1 = 19',
    2000,
    '[{"level": 1, "text": "Does the layout look the same on both sides of the centre?", "cost": 0}, {"level": 2, "text": "If you count just the left half (9 items), what does the right half contain?", "cost": 5}, {"level": 3, "text": "You know the left count and there is 1 in the centre. What does the right half contribute, and how do you combine all three parts?", "cost": 15}]'::jsonb,
    'Symmetric structures only need one half counted — then double and add any central element.',
    'The summit treasure chamber is perfectly symmetric. Count one side, double it, add the centre piece.',
    ARRAY['symmetry', 'structural', 'zone-3'],
    5,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'structural',
    7,
    'D1',
    ARRAY['D1'],
    'Sum the symmetric pattern: 5 + 7 + 9 + 11 + 11 + 9 + 7 + 5 = ?',
    '64',
    'exact',
    '5+7=12, 12+9=21, 21+11=32, 32+11=43, 43+9=52, 52+7=59, 59+5=64.',
    'Symmetric: sum one half: 5+7+9+11=32. Double: 32×2=64.',
    5000,
    '[{"level": 1, "text": "The sequence is symmetric around the middle. Sum just the first four terms.", "cost": 0}, {"level": 2, "text": "Sum the first four terms, then use symmetry to find the total without adding the rest.", "cost": 5}, {"level": 3, "text": "Double the half-sum.", "cost": 15}]'::jsonb,
    'Symmetry is a shortcut: count one side, double the result, and you are done.',
    'The crystal bridge has a symmetric arch: 5, 7, 9, 11, 11, 9, 7, 5 stones per section. Total stones?',
    ARRAY['symmetry', 'addition', 'doubling', 'zone-3'],
    6,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    2,
    'structural',
    4,
    'D2',
    ARRAY['D2'],
    'A creature gains 5 HP and loses 3 HP each round. What is its net HP change after 6 rounds?',
    '12',
    'exact',
    'Track each round: +2, +2, +2, +2, +2, +2 = 12.',
    'Net change per round = 5 − 3 = 2. After 6 rounds: 2 × 6 = 12.',
    4000,
    '[{"level": 1, "text": "What is the net change per single round?", "cost": 0}, {"level": 2, "text": "Find the net change per round by combining the gain and the loss.", "cost": 5}, {"level": 3, "text": "Multiply the net change per round by 6.", "cost": 15}]'::jsonb,
    'Find the invariant change per step, then multiply by the number of steps. Never track each step individually.',
    'The dungeon creature regenerates and takes damage each round. Find the net result after 6 rounds.',
    ARRAY['state-transitions', 'net-change', 'multiplication', 'zone-2'],
    4,
    'discovery'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'structural',
    6,
    'D2',
    ARRAY['D2'],
    'A creature doubles its size each turn, but always loses 1 unit after doubling. It starts at size 3. What is its size after 3 turns?',
    '17',
    'exact',
    'Step through each turn manually',
    'Track state: turn1=3×2-1=5, turn2=5×2-1=9, turn3=9×2-1=17',
    4000,
    '[{"level": 1, "text": "What is the rule the creature follows each turn?", "cost": 0}, {"level": 2, "text": "Apply the rule to the starting size of 3. What is the size after turn 1?", "cost": 5}, {"level": 3, "text": "You have the result after turn 2. Apply the rule one more time: double it, then subtract 1.", "cost": 15}]'::jsonb,
    'Identify the rule (the transition), apply it step by step — the invariant is the rule itself.',
    'The shifting summit creature obeys a fixed rule every turn: double, then lose 1. It starts at size 3. What size is it after 3 turns?',
    ARRAY['state-transitions', 'structural', 'zone-3'],
    5,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'structural',
    7,
    'D2',
    ARRAY['D2'],
    'Start at 100. Each step: multiply by 2, then subtract 50. What is the value after 3 steps?',
    '450',
    'exact',
    'Step 1: 100×2=200, 200−50=150. Step 2: 150×2=300, 300−50=250. Step 3: 250×2=500, 500−50=450.',
    'Track the state transition f(x) = 2x − 50. Step 1: f(100)=150. Step 2: f(150)=250. Step 3: f(250)=450.',
    7000,
    '[{"level": 1, "text": "What is the result after just the first step?", "cost": 0}, {"level": 2, "text": "Apply the rule to 100 to get step 1''s result, then apply the same rule to that result for step 2.", "cost": 5}, {"level": 3, "text": "Apply the rule one final time to step 2''s result.", "cost": 15}]'::jsonb,
    'State transition problems: apply the rule step by step, carrying each result forward.',
    'A magical spring doubles its water and loses 50 litres each day. Starting at 100, what remains after 3 days?',
    ARRAY['state-transitions', 'iteration', 'multiplication', 'zone-3'],
    6,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    2,
    'structural',
    4,
    'D3',
    ARRAY['D3'],
    '3x = 21. What is x?',
    '7',
    'exact',
    'Try x = 7: 3 × 7 = 21. Correct.',
    'Divide both sides by 3 to keep the equation balanced: x = 21 ÷ 3 = 7.',
    3500,
    '[{"level": 1, "text": "The equation is balanced. What operation isolates x on one side?", "cost": 0}, {"level": 2, "text": "Divide both sides by 3.", "cost": 5}, {"level": 3, "text": "After dividing both sides by 3, x equals 21 \u00f7 3.", "cost": 15}]'::jsonb,
    'Divide both sides by the same number to isolate the variable without breaking the balance.',
    'Three equal treasure chests hold 21 coins combined. One chest holds x coins. What is x?',
    ARRAY['algebra', 'balance', 'division', 'zone-2'],
    4,
    'discovery'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'structural',
    5,
    'D3',
    ARRAY['D3'],
    'A balance holds (□ + 5) on the left and 17 on the right. What is □?',
    '12',
    'exact',
    'Trial: try 10 (15≠17), try 12 (17=17) ✓',
    'Subtract 5 from both sides: □ = 17−5 = 12',
    2000,
    '[{"level": 1, "text": "What is on the left side of the balance besides \u25a1?", "cost": 0}, {"level": 2, "text": "If you remove 5 from the left, what must you remove from the right to keep it balanced?", "cost": 5}, {"level": 3, "text": "After removing 5 from both sides, what single number remains on the right side of the balance?", "cost": 15}]'::jsonb,
    'Subtracting the same value from both sides of a balanced equation keeps it balanced — and isolates the unknown.',
    'The equilibrium lock: (□ + 5) balances 17. Remove the same weight from both sides to reveal □.',
    ARRAY['algebra', 'balance', 'equilibrium', 'zone-3'],
    5,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'structural',
    7,
    'D3',
    ARRAY['D3'],
    '5x + 3 = 28. What is x?',
    '5',
    'exact',
    'Try x = 5: 5×5 + 3 = 25 + 3 = 28. Correct.',
    'Subtract 3 from both sides: 5x = 25. Divide both sides by 5: x = 5.',
    4000,
    '[{"level": 1, "text": "Remove the + 3 from the left side first. Apply the same operation to both sides.", "cost": 0}, {"level": 2, "text": "Subtract 3 from both sides to isolate the 5x term.", "cost": 5}, {"level": 3, "text": "Once the x-term is isolated, divide both sides by its coefficient.", "cost": 15}]'::jsonb,
    'Two-step equations: undo addition/subtraction first, then undo multiplication/division.',
    'The alchemist''s formula is 5x + 3 = 28. Solve for x to unlock the secret ingredient.',
    ARRAY['algebra', 'balance', 'two-step', 'zone-3'],
    6,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    2,
    'structural',
    5,
    'D4',
    ARRAY['D4'],
    '1 + 2 + 4 + 8 + 16 = ?',
    '31',
    'exact',
    '1+2=3, 3+4=7, 7+8=15, 15+16=31.',
    '5 terms in a doubling series starting at 1: sum = 2⁵ − 1 = 32 − 1 = 31.',
    4000,
    '[{"level": 1, "text": "Each term is double the previous. How many terms are there?", "cost": 0}, {"level": 2, "text": "5 terms. The sum formula is 2\u207f \u2212 1 where n is the number of terms.", "cost": 5}, {"level": 3, "text": "Calculate 2 raised to the power of 5, then subtract 1.", "cost": 15}]'::jsonb,
    'The sum of a doubling series starting at 1 is always one less than the next power of 2.',
    'A rumour spreads: 1 person tells 2, each tells 2 more, for 5 rounds. Total people who heard it?',
    ARRAY['geometric-series', 'powers-of-2', 'doubling', 'zone-2'],
    5,
    'discovery'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'structural',
    7,
    'D4',
    ARRAY['D4'],
    'A doubling curse starts at 1 and doubles 9 more times (10 terms total). What is the sum of all terms?',
    '1023',
    'exact',
    'Add: 1+2+4+8+16+32+64+128+256+512 = 1023',
    'Sum of geometric series (ratio 2, n=10): 2¹⁰−1 = 1024−1 = 1023',
    4000,
    '[{"level": 1, "text": "Write out the first few terms: 1, 2, 4, 8 \u2026 What do you notice about the sum vs the next term?", "cost": 0}, {"level": 2, "text": "Compare each running total (1, 1+2, 1+2+4\u2026) to the next term in the sequence. What pattern do you see?", "cost": 5}, {"level": 3, "text": "You spotted the pattern between the sum and the next term. Apply that pattern when the 10th term is 512. What is the next term, and how does that give you the sum?", "cost": 15}]'::jsonb,
    'Sum of a doubling series of n terms = 2ⁿ−1. After 10 doublings: 2¹⁰−1=1023.',
    'The doubling curse inscription reads: 1, 2, 4, 8 … continuing for 10 terms. The total sum is the key to lifting it.',
    ARRAY['geometric-series', 'doubling', 'structural', 'zone-3'],
    6,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    4,
    'structural',
    8,
    'D4',
    ARRAY['D4'],
    '1 + 2 + 4 + 8 + 16 + 32 + 64 + 128 = ?',
    '255',
    'exact',
    '1+2=3, 3+4=7, 7+8=15, 15+16=31, 31+32=63, 63+64=127, 127+128=255.',
    '8 terms doubling from 1: sum = 2⁸ − 1 = 256 − 1 = 255.',
    5000,
    '[{"level": 1, "text": "Count the terms. Is there a formula for summing a doubling series?", "cost": 0}, {"level": 2, "text": "8 terms. Sum = 2\u207f \u2212 1 where n = number of terms.", "cost": 5}, {"level": 3, "text": "Calculate 2 raised to the power of 8, then subtract 1.", "cost": 15}]'::jsonb,
    'The sum of a doubling series is approximately twice its largest term: 128 × 2 − 1 = 255.',
    'Eight generations of a dragon family: 1, 2, 4, 8, 16, 32, 64, 128. Total descendants?',
    ARRAY['geometric-series', 'powers-of-2', 'doubling', 'zone-4'],
    6,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    2,
    'structural',
    4,
    'D5',
    ARRAY['D5'],
    '6 adventurers each shake hands with every other adventurer exactly once. How many handshakes?',
    '15',
    'exact',
    '5+4+3+2+1 = 15.',
    'Triangular number formula: n(n−1)÷2 = 6×5÷2 = 30÷2 = 15.',
    4000,
    '[{"level": 1, "text": "Each adventurer shakes hands with every other one. Count unique pairs.", "cost": 0}, {"level": 2, "text": "Number of pairs from n people = n(n\u22121)\u00f72. With n=6: apply 6\u00d75\u00f72.", "cost": 5}, {"level": 3, "text": "Multiply n(n\u22121) and then halve the result.", "cost": 15}]'::jsonb,
    'Handshake problems and staircase sums share the triangular number formula: n(n−1)÷2.',
    'Six guild members meet for the first time. Each shakes hands with every other. How many handshakes occur?',
    ARRAY['triangular-numbers', 'combinations', 'formula', 'zone-2'],
    4,
    'discovery'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'structural',
    5,
    'D5',
    ARRAY['D5'],
    'A merchant pays tribute to 10 guilds: 1 gold coin to guild 1, 2 to guild 2, and so on up to 10 gold coins to guild 10. What is the total paid?',
    '55',
    'exact',
    'Add sequentially: 1+2=3, 3+3=6, 6+4=10, 10+5=15, 15+6=21, 21+7=28, 28+8=36, 36+9=45, 45+10=55',
    'Triangular number: 10×11÷2 = 55',
    2000,
    '[{"level": 1, "text": "If you pair the smallest and largest payments, what do you get?", "cost": 0}, {"level": 2, "text": "1+10=11, 2+9=11, \u2026 How many such pairs are there?", "cost": 5}, {"level": 3, "text": "You found how many pairs there are and what each pair totals. Combine those two facts.", "cost": 15}]'::jsonb,
    'Sum 1 to n = n(n+1)÷2. Gauss''s trick.',
    'The merchant reaches the summit and pays 1 gold to the first guild, 2 to the second, and so on up to 10. The treasury needs the total before the gates close.',
    ARRAY['addition', 'triangular-numbers', 'zone-3'],
    5,
    'practice'
);

INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    3,
    'structural',
    7,
    'D5',
    ARRAY['D5'],
    '1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 = ?',
    '55',
    'exact',
    '1+2=3, 3+3=6, 6+4=10, 10+5=15, 15+6=21, 21+7=28, 28+8=36, 36+9=45, 45+10=55.',
    'Sum of 1 to n = n(n+1)÷2. Here n=10: 10×11÷2 = 110÷2 = 55.',
    4000,
    '[{"level": 1, "text": "Is there a formula for the sum of the first n whole numbers?", "cost": 0}, {"level": 2, "text": "Sum = n(n+1)\u00f72. With n=10: apply 10\u00d711\u00f72.", "cost": 5}, {"level": 3, "text": "Compute n(n+1) first, then halve the result.", "cost": 15}]'::jsonb,
    '1+2+…+n = n(n+1)÷2. Pairing smallest and largest: 1+10=11, 2+9=11, … five pairs of 11.',
    'Ten floors of the tower each add one step to the staircase. Total steps from floor 1 to floor 10?',
    ARRAY['triangular-numbers', 'summation', 'formula', 'zone-3'],
    6,
    'practice'
);

