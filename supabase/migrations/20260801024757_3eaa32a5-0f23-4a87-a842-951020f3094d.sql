ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_worthiness_tag_check;

ALTER TABLE public.projects ADD CONSTRAINT projects_worthiness_tag_check
  CHECK (
    worthiness_tag IS NULL
    OR worthiness_tag IN (
      'unusual_problem',
      'dramatic_before_after',
      'customer_stressed',
      'taught_me_something',
      'common_misconception'
    )
  );