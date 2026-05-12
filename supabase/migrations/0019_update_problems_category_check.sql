UPDATE public.problems SET category = 'algebra'      WHERE category = 'structural';
UPDATE public.problems SET category = 'pattern'      WHERE category = 'pattern';
UPDATE public.problems SET category = 'number_theory' WHERE category = 'invariant';
UPDATE public.problems SET category = 'mental_math'  WHERE category = 'mental';

ALTER TABLE public.problems DROP CONSTRAINT problems_category_check;

ALTER TABLE public.problems ADD CONSTRAINT problems_category_check 
  CHECK (category = ANY (ARRAY[
    'multiplication'::text,
    'mental_math'::text,
    'number_theory'::text,
    'pattern'::text,
    'algebra'::text,
    'sequences'::text
  ]));