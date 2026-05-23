ALTER FUNCTION public.user_owns_company(uuid) SET search_path = '';
ALTER FUNCTION public.user_owns_project(uuid) SET search_path = '';

CREATE OR REPLACE FUNCTION public.user_owns_company(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = _company_id AND owner_user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.user_owns_project(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.companies c ON c.id = p.company_id
    WHERE p.id = _project_id AND c.owner_user_id = auth.uid()
  )
$$;