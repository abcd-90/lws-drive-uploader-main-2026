-- =========================================================================
-- MIGRATION: COUPON CODE SYSTEM
-- Purpose: Setup coupons table, redemptions table, RLS policies, and RPC function
-- =========================================================================

-- 1. CREATE TABLES
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  plan_key TEXT NOT NULL DEFAULT 'weekly',
  duration_days INTEGER NOT NULL DEFAULT 7,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  max_uses INTEGER, -- NULL means unlimited
  used_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (coupon_id, user_id)
);

-- 2. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

-- 3. RLS POLICIES FOR COUPONS
DROP POLICY IF EXISTS "Admins manage coupons" ON public.coupons;
CREATE POLICY "Admins manage coupons"
  ON public.coupons
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. RLS POLICIES FOR REDEMPTIONS
DROP POLICY IF EXISTS "Admins manage redemptions" ON public.coupon_redemptions;
CREATE POLICY "Admins manage redemptions"
  ON public.coupon_redemptions
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. SECURE APPLY_COUPON RPC FUNCTION
CREATE OR REPLACE FUNCTION public.apply_coupon(_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _user_email TEXT;
  _coupon_id UUID;
  _plan_key TEXT;
  _duration_days INTEGER;
  _active BOOLEAN;
  _max_uses INTEGER;
  _used_count INTEGER;
  _already_redeemed BOOLEAN;
  _starts_at TIMESTAMPTZ;
  _expires_at TIMESTAMPTZ;
BEGIN
  -- Authenticate user
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'You must be logged in to apply a coupon.');
  END IF;

  -- Get user email
  SELECT email INTO _user_email FROM auth.users WHERE id = _user_id;

  -- Lookup coupon
  SELECT id, plan_key, duration_days, active, max_uses, used_count
  INTO _coupon_id, _plan_key, _duration_days, _active, _max_uses, _used_count
  FROM public.coupons
  WHERE lower(code) = lower(trim(_code))
  LIMIT 1;

  -- Validation
  IF _coupon_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Invalid coupon code.');
  END IF;

  IF NOT _active THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'This coupon is no longer active.');
  END IF;

  IF _max_uses IS NOT NULL AND _used_count >= _max_uses THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'This coupon has reached its usage limit.');
  END IF;

  -- Check double redemption
  SELECT EXISTS (
    SELECT 1 FROM public.coupon_redemptions
    WHERE coupon_id = _coupon_id AND user_id = _user_id
  ) INTO _already_redeemed;

  IF _already_redeemed THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'You have already redeemed this coupon code.');
  END IF;

  -- Calculate expires_at
  SELECT
    CASE
      WHEN p.pro_expires_at IS NOT NULL AND p.pro_expires_at > now() THEN p.pro_expires_at
      ELSE now()
    END
  INTO _starts_at
  FROM public.profiles p
  WHERE p.user_id = _user_id;

  _expires_at := _starts_at + (_duration_days || ' days')::interval;

  -- Update user profile
  INSERT INTO public.profiles (user_id, is_pro, pro_expires_at, full_name)
  VALUES (_user_id, TRUE, _expires_at, _user_email)
  ON CONFLICT (user_id) DO UPDATE
  SET is_pro = TRUE,
      pro_expires_at = _expires_at,
      updated_at = now();

  -- Record redemption
  INSERT INTO public.coupon_redemptions (coupon_id, user_id)
  VALUES (_coupon_id, _user_id);

  -- Update coupon usage count
  UPDATE public.coupons
  SET used_count = used_count + 1
  WHERE id = _coupon_id;

  -- Record premium grant audit log
  INSERT INTO public.premium_grants (user_id, user_email, plan_key, starts_at, expires_at, granted_by)
  VALUES (
    _user_id, 
    _user_email, 
    _plan_key, 
    _starts_at, 
    _expires_at, 
    '00000000-0000-0000-0000-000000000000'::uuid -- Special system UUID for coupon grants
  );

  RETURN jsonb_build_object(
    'success', TRUE, 
    'message', 'Coupon applied successfully! PRO plan activated until ' || to_char(_expires_at, 'DD Mon, YYYY'),
    'expires_at', _expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_coupon(TEXT) TO authenticated;
