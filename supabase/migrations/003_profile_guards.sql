-- Prevent non-admins from changing privileged profile columns
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT public.is_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Cannot change role';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Cannot change status';
    END IF;
    IF NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
      RAISE EXCEPTION 'Cannot change employee_id';
    END IF;
    IF NEW.joining_date IS DISTINCT FROM OLD.joining_date THEN
      RAISE EXCEPTION 'Cannot change joining_date';
    END IF;
    IF NEW.territory IS DISTINCT FROM OLD.territory THEN
      RAISE EXCEPTION 'Cannot change territory';
    END IF;
    IF NEW.designation IS DISTINCT FROM OLD.designation THEN
      RAISE EXCEPTION 'Cannot change designation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS protect_profile_columns_trigger ON public.profiles;
CREATE TRIGGER protect_profile_columns_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_columns();
