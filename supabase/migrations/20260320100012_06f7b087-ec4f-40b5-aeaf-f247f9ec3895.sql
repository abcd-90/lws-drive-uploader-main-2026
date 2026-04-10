-- Admin roles enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
  END IF;
END $$;

-- User roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Role check helper
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- First authenticated user can claim admin if no admin exists yet
CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _has_any_admin BOOLEAN;
BEGIN
  IF _uid IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'admin'
  ) INTO _has_any_admin;

  IF _has_any_admin THEN
    RETURN public.has_role(_uid, 'admin');
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN TRUE;
END;
$$;

-- Policies for user_roles
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin settings table
CREATE TABLE IF NOT EXISTS public.admin_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paid_mode_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  default_plan_key TEXT NOT NULL DEFAULT 'monthly',
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read settings" ON public.admin_settings;
CREATE POLICY "Admins can read settings"
ON public.admin_settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update settings" ON public.admin_settings;
CREATE POLICY "Admins can update settings"
ON public.admin_settings
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert settings" ON public.admin_settings;
CREATE POLICY "Admins can insert settings"
ON public.admin_settings
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.admin_settings (paid_mode_enabled, default_plan_key)
SELECT FALSE, 'monthly'
WHERE NOT EXISTS (SELECT 1 FROM public.admin_settings);

-- Subscription plans table
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  duration_days INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read plans" ON public.subscription_plans;
CREATE POLICY "Authenticated can read plans"
ON public.subscription_plans
FOR SELECT
TO authenticated
USING (TRUE);

DROP POLICY IF EXISTS "Admins can manage plans" ON public.subscription_plans;
CREATE POLICY "Admins can manage plans"
ON public.subscription_plans
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.subscription_plans (plan_key, label, duration_days)
VALUES
  ('weekly', 'Weekly', 7),
  ('monthly', 'Monthly', 30),
  ('yearly', 'Yearly', 365)
ON CONFLICT (plan_key) DO UPDATE
SET label = EXCLUDED.label,
    duration_days = EXCLUDED.duration_days,
    active = TRUE,
    updated_at = now();

-- Activity logs for monitoring
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_email TEXT,
  event_type TEXT NOT NULL,
  source_name TEXT,
  source_id TEXT,
  status TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_event_type ON public.activity_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own activity" ON public.activity_logs;
CREATE POLICY "Users can insert own activity"
ON public.activity_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own activity" ON public.activity_logs;
CREATE POLICY "Users can view own activity"
ON public.activity_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all activity" ON public.activity_logs;
CREATE POLICY "Admins can view all activity"
ON public.activity_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Premium grants audit
CREATE TABLE IF NOT EXISTS public.premium_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  plan_key TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  granted_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_premium_grants_user_id ON public.premium_grants(user_id);
CREATE INDEX IF NOT EXISTS idx_premium_grants_email ON public.premium_grants(user_email);

ALTER TABLE public.premium_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage premium grants" ON public.premium_grants;
CREATE POLICY "Admins can manage premium grants"
ON public.premium_grants
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Keep profile premium state fresh when needed
CREATE OR REPLACE FUNCTION public.refresh_expired_premium()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count INTEGER;
BEGIN
  UPDATE public.profiles
  SET is_pro = FALSE,
      updated_at = now()
  WHERE is_pro = TRUE
    AND pro_expires_at IS NOT NULL
    AND pro_expires_at <= now();

  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

-- Admin action: toggle paid mode
CREATE OR REPLACE FUNCTION public.set_paid_mode(_enabled BOOLEAN, _default_plan_key TEXT)
RETURNS public.admin_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor UUID := auth.uid();
  _result public.admin_settings;
BEGIN
  IF _actor IS NULL OR NOT public.has_role(_actor, 'admin') THEN
    RAISE EXCEPTION 'Only admins can update paid mode';
  END IF;

  UPDATE public.admin_settings
  SET paid_mode_enabled = COALESCE(_enabled, paid_mode_enabled),
      default_plan_key = COALESCE(_default_plan_key, default_plan_key),
      updated_by = _actor,
      updated_at = now()
  WHERE id = (SELECT id FROM public.admin_settings ORDER BY created_at ASC LIMIT 1)
  RETURNING * INTO _result;

  RETURN _result;
END;
$$;

-- Admin action: grant premium by email (weekly/monthly/yearly)
CREATE OR REPLACE FUNCTION public.admin_grant_premium_by_email(_email TEXT, _plan_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _actor UUID := auth.uid();
  _target_user_id UUID;
  _days INTEGER;
  _starts_at TIMESTAMPTZ;
  _expires_at TIMESTAMPTZ;
BEGIN
  IF _actor IS NULL OR NOT public.has_role(_actor, 'admin') THEN
    RAISE EXCEPTION 'Only admins can grant premium';
  END IF;

  IF _email IS NULL OR btrim(_email) = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  SELECT id INTO _target_user_id
  FROM auth.users
  WHERE lower(email) = lower(btrim(_email))
  LIMIT 1;

  IF _target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with this email not found';
  END IF;

  SELECT duration_days INTO _days
  FROM public.subscription_plans
  WHERE plan_key = lower(btrim(_plan_key))
    AND active = TRUE
  LIMIT 1;

  IF _days IS NULL THEN
    RAISE EXCEPTION 'Invalid or inactive plan';
  END IF;

  INSERT INTO public.profiles (user_id, full_name, is_pro, pro_expires_at)
  VALUES (_target_user_id, _email, TRUE, now() + make_interval(days => _days))
  ON CONFLICT (user_id) DO NOTHING;

  PERFORM public.refresh_expired_premium();

  SELECT
    CASE
      WHEN p.pro_expires_at IS NOT NULL AND p.pro_expires_at > now() THEN p.pro_expires_at
      ELSE now()
    END
  INTO _starts_at
  FROM public.profiles p
  WHERE p.user_id = _target_user_id;

  _expires_at := _starts_at + make_interval(days => _days);

  UPDATE public.profiles
  SET is_pro = TRUE,
      pro_expires_at = _expires_at,
      updated_at = now()
  WHERE user_id = _target_user_id;

  INSERT INTO public.premium_grants (user_id, user_email, plan_key, starts_at, expires_at, granted_by)
  VALUES (_target_user_id, lower(btrim(_email)), lower(btrim(_plan_key)), _starts_at, _expires_at, _actor);

  RETURN jsonb_build_object(
    'user_id', _target_user_id,
    'email', lower(btrim(_email)),
    'plan_key', lower(btrim(_plan_key)),
    'starts_at', _starts_at,
    'expires_at', _expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_expired_premium() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_paid_mode(BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_premium_by_email(TEXT, TEXT) TO authenticated;