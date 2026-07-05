-- =========================================================================
-- MASTER SQL DATABASE RESTORATION SCRIPT
-- Purpose: Restores all tables, triggers, and functions to their original state.
-- Updates: Connected to Make.com Webhook for email notifications.
-- INSTRUCTIONS: Copy this ENTIRE script and run it in the Supabase SQL Editor.
-- =========================================================================

-- 1. ENABLE EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. DEFINE TYPES
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
  END IF;
END $$;


-- 3. CREATE TABLES (Base tables first)
-- User profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT,
  is_pro BOOLEAN DEFAULT false,
  pro_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- User roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Admin settings (stores site configuration)
CREATE TABLE IF NOT EXISTS public.admin_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paid_mode_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  default_plan_key TEXT NOT NULL DEFAULT 'monthly',
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure config_json column exists in case table was created previously without it
ALTER TABLE public.admin_settings ADD COLUMN IF NOT EXISTS config_json JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Uploads tracking
CREATE TABLE IF NOT EXISTS public.uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT,
  upload_speed TEXT DEFAULT '100x',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Subscription plans
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  duration_days INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure updated_at column exists in case table was created previously without it
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

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

-- Premium grants auditing
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

-- Payment Requests Table
CREATE TABLE IF NOT EXISTS public.payment_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT,
  plan_key TEXT NOT NULL,
  plan_label TEXT,
  amount_pkr INTEGER,
  screenshot_url TEXT,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT
);


-- 4. CLEAN UP EXISTING TRIGGERS AND FUNCTIONS (Prevents dependency conflicts)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_welcome_email ON auth.users;
DROP TRIGGER IF EXISTS on_premium_grant_created ON public.premium_grants;
DROP TRIGGER IF EXISTS on_payment_request_approved ON public.payment_requests;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;

DROP FUNCTION IF EXISTS public.send_welcome_email() CASCADE;
DROP FUNCTION IF EXISTS public.send_subscription_confirmation_email() CASCADE;
DROP FUNCTION IF EXISTS public.has_role(UUID, public.app_role) CASCADE;
DROP FUNCTION IF EXISTS public.claim_first_admin() CASCADE;
DROP FUNCTION IF EXISTS public.refresh_expired_premium() CASCADE;
DROP FUNCTION IF EXISTS public.set_paid_mode(BOOLEAN, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.save_site_config(JSONB) CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.admin_grant_premium_by_email(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.admin_approve_payment(UUID, TEXT) CASCADE;


-- 5. DEFINE FUNCTIONS AND UTILITIES
-- Check if user has role
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

-- Claim first admin
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

-- Refresh profiles with expired premium membership
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

-- Set paid mode (toggles subscription payment requirements)
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

-- Save site config dynamic JSON (synchronizes settings live)
CREATE OR REPLACE FUNCTION public.save_site_config(_config JSONB)
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
    RAISE EXCEPTION 'Only admins can update site config';
  END IF;

  UPDATE public.admin_settings
  SET config_json = COALESCE(_config, config_json),
      paid_mode_enabled = COALESCE((_config->>'paidModeEnabled')::boolean, paid_mode_enabled),
      updated_by = _actor,
      updated_at = now()
  WHERE id = (SELECT id FROM public.admin_settings ORDER BY created_at ASC LIMIT 1)
  RETURNING * INTO _result;

  IF _result IS NULL THEN
    INSERT INTO public.admin_settings (config_json, paid_mode_enabled, updated_by)
    VALUES (COALESCE(_config, '{}'::jsonb), COALESCE((_config->>'paidModeEnabled')::boolean, false), _actor)
    RETURNING * INTO _result;
  END IF;

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_site_config(JSONB) TO authenticated;

-- Helper to handle user updated_at field
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- 6. INSERT DEFAULTS AND INITIAL DATA
-- Default plans
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

-- Default admin settings
INSERT INTO public.admin_settings (paid_mode_enabled, default_plan_key, config_json)
SELECT FALSE, 'monthly', '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.admin_settings);


-- 7. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premium_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;


-- 8. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_event_type ON public.activity_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_premium_grants_user_id ON public.premium_grants(user_id);
CREATE INDEX IF NOT EXISTS idx_premium_grants_email ON public.premium_grants(user_email);


-- 9. RLS POLICIES
-- Profiles Policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Uploads Policies
DROP POLICY IF EXISTS "Users can view their own uploads" ON public.uploads;
CREATE POLICY "Users can view their own uploads" ON public.uploads FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own uploads" ON public.uploads;
CREATE POLICY "Users can insert their own uploads" ON public.uploads FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User Roles Policies
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Admin Settings Policies
DROP POLICY IF EXISTS "Anyone can read settings" ON public.admin_settings;
CREATE POLICY "Anyone can read settings" ON public.admin_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can update settings" ON public.admin_settings;
CREATE POLICY "Admins can update settings" ON public.admin_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert settings" ON public.admin_settings;
CREATE POLICY "Admins can insert settings" ON public.admin_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Activity Logs Policies
DROP POLICY IF EXISTS "Users can insert own activity" ON public.activity_logs;
CREATE POLICY "Users can insert own activity" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own activity" ON public.activity_logs;
CREATE POLICY "Users can view own activity" ON public.activity_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all activity" ON public.activity_logs;
CREATE POLICY "Admins can view all activity" ON public.activity_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Premium Grants Policies
DROP POLICY IF EXISTS "Admins can manage premium grants" ON public.premium_grants;
CREATE POLICY "Admins can manage premium grants" ON public.premium_grants FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Subscription Plans Policies
DROP POLICY IF EXISTS "Authenticated can read plans" ON public.subscription_plans;
CREATE POLICY "Authenticated can read plans" ON public.subscription_plans FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Admins can manage plans" ON public.subscription_plans;
CREATE POLICY "Admins can manage plans" ON public.subscription_plans FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Payment Requests Policies
DROP POLICY IF EXISTS "Users insert own" ON public.payment_requests;
CREATE POLICY "Users insert own" ON public.payment_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users view own" ON public.payment_requests;
CREATE POLICY "Users view own" ON public.payment_requests FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin all access" ON public.payment_requests;
CREATE POLICY "Admin all access" ON public.payment_requests FOR ALL USING (true);

-- Storage bucket configurations
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-receipts', 'payment-receipts', true) ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "Anyone can upload receipt" ON storage.objects;
CREATE POLICY "Anyone can upload receipt" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'payment-receipts');

DROP POLICY IF EXISTS "Anyone can view receipt" ON storage.objects;
CREATE POLICY "Anyone can view receipt" ON storage.objects FOR SELECT USING (bucket_id = 'payment-receipts');


-- 10. EMAIL TRIGGERS AND FUNCTIONS (Make.com Integration)
-- WELCOME EMAIL FUNCTION
CREATE OR REPLACE FUNCTION public.send_welcome_email()
RETURNS trigger AS $$
DECLARE
  webhook_url text := 'https://hook.eu2.make.com/k1v3qjqhh93938du64wwlwpemtfmkgwz';
  request_body jsonb;
BEGIN
  BEGIN
    request_body := json_build_object(
      'type', 'welcome',
      'event', 'welcome',
      'to', new.email,
      'email', new.email,
      'subject', 'Welcome to the Future of Nitro Drive! ⚡',
      'html', '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Welcome to Nitro Drive</title>
  <style type="text/css">
    @import url(''https://fonts.googleapis.com/css2?family=Outfit:wght@400;700&display=swap'');
    body { font-family: ''Outfit'', sans-serif, Arial; margin: 0; padding: 0; background-color: #020617; }
    .card { background-color: #1e293b; border-radius: 24px; border: 1px solid #334155; }
    .btn { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff !important; text-decoration: none; padding: 18px 40px; border-radius: 16px; font-weight: 700; display: inline-block; box-shadow: 0 10px 20px -10px rgba(59, 130, 246, 0.5); }
    .feature-box { background-color: #0f172a; padding: 25px; border-radius: 20px; border: 1px solid #1e293b; margin-bottom: 15px; text-align: left; }
  </style>
</head>
<body>
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #020617;">
    <tr>
      <td align="center" style="padding: 60px 20px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom: 40px;">
              <img src="https://ncnypxgushqosmegyzvy.supabase.co/storage/v1/object/public/assests/nitro_drive_3d_logo.png" alt="Nitro Drive Logo" width="140" />
            </td>
          </tr>
          
          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom: 40px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 42px; font-weight: 800; line-height: 1.1; letter-spacing: -1px; text-align: center;">Welcome to the Future of <span style="color: #60a5fa;">Nitro Drive</span></h1>
            </td>
          </tr>

          <!-- Main Content Card -->
          <tr>
            <td class="card" style="padding: 40px;">
              <p style="margin: 0 0 30px 0; color: #94a3b8; font-size: 18px; line-height: 1.6;">Hi there, 👋 <br/><br/>The era of slow cloud management is over. You''ve just unlocked the fastest toolkit for Google Drive. Let''s get you set up.</p>
              
              <!-- Box 1: Quick Start -->
              <div class="feature-box">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td width="50" valign="top">
                      <img src="https://ncnypxgushqosmegyzvy.supabase.co/storage/v1/object/public/assests/quick_start_icon.png" width="45" />
                    </td>
                    <td style="padding-left: 15px;">
                      <h3 style="margin: 0 0 5px 0; color: #ffffff; font-size: 18px; font-weight: 700;">Quick Start Setup</h3>
                      <p style="margin: 0; color: #94a3b8; font-size: 14px; line-height: 1.4;">One-click integration to sync your drive and start processing instantly.</p>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Box 2: Dashboard -->
              <div class="feature-box">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td width="50" valign="top">
                      <img src="https://ncnypxgushqosmegyzvy.supabase.co/storage/v1/object/public/assests/dashboard_icon.png" width="45" />
                    </td>
                    <td style="padding-left: 15px;">
                      <h3 style="margin: 0 0 5px 0; color: #ffffff; font-size: 18px; font-weight: 700;">Live Dashboard</h3>
                      <p style="margin: 0; color: #94a3b8; font-size: 14px; line-height: 1.4;">Monitor your active transfers and automation tasks in real-time.</p>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Box 3: Smart Move -->
              <div class="feature-box">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td width="50" valign="top">
                      <img src="https://ncnypxgushqosmegyzvy.supabase.co/storage/v1/object/public/assests/smart_move_3d.png" width="45" />
                    </td>
                    <td style="padding-left: 15px;">
                      <h3 style="margin: 0 0 5px 0; color: #ffffff; font-size: 18px; font-weight: 700;">Smart File Move</h3>
                      <p style="margin: 0; color: #94a3b8; font-size: 14px; line-height: 1.4;">Batch process and move thousands of files at lightning speed.</p>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Box 4: Secure Vault -->
              <div class="feature-box">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td width="50" valign="top">
                      <img src="https://ncnypxgushqosmegyzvy.supabase.co/storage/v1/object/public/assests/secure_vault_3d.png" width="45" />
                    </td>
                    <td style="padding-left: 15px;">
                      <h3 style="margin: 0 0 5px 0; color: #ffffff; font-size: 18px; font-weight: 700;">Secure Vault</h3>
                      <p style="margin: 0; color: #94a3b8; font-size: 14px; line-height: 1.4;">Enterprise-grade security to keep your data safe and protected.</p>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- CTA -->
              <div style="text-align: center; padding-top: 30px;">
                <a href="https://nitrodrive.site/dashboard" class="btn">Launch Your Workspace</a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 40px;">
              <p style="margin: 0; color: #475569; font-size: 14px; letter-spacing: 1px; text-transform: uppercase;">&copy; 2026 Nitro Drive &bull; The Speed of Light</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>'
    );

    PERFORM net.http_post(
        url:=webhook_url,
        headers:='{"Content-Type": "application/json"}'::jsonb,
        body:=request_body
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- SUBSCRIPTION ACTIVATION EMAIL FUNCTION
CREATE OR REPLACE FUNCTION public.send_subscription_confirmation_email()
RETURNS trigger AS $$
DECLARE
  webhook_url text := 'https://hook.eu2.make.com/k1v3qjqhh93938du64wwlwpemtfmkgwz';
  request_body jsonb;
  plan_label text;
  target_email text;
  activation_date_str text;
  expiry_date_str text;
  plan_days integer;
BEGIN
  BEGIN
    activation_date_str := to_char(now(), 'DD Mon, YYYY');

    IF TG_TABLE_NAME = 'payment_requests' THEN
      target_email := new.user_email;
      
      SELECT duration_days, label INTO plan_days, plan_label 
      FROM public.subscription_plans 
      WHERE plan_key = lower(new.plan_key);
      
      IF plan_label IS NULL THEN
        plan_label := COALESCE(new.plan_label, initcap(new.plan_key));
      END IF;
      
      expiry_date_str := to_char(now() + (COALESCE(plan_days, 30) || ' days')::interval, 'DD Mon, YYYY');
      
    ELSIF TG_TABLE_NAME = 'premium_grants' THEN
      target_email := new.user_email;
      
      SELECT label INTO plan_label 
      FROM public.subscription_plans 
      WHERE plan_key = lower(new.plan_key);
      
      IF plan_label IS NULL THEN
        plan_label := initcap(new.plan_key);
      END IF;
      
      expiry_date_str := to_char(new.expires_at, 'DD Mon, YYYY');
    END IF;

    IF plan_label IS NULL OR plan_label = '' THEN
      plan_label := 'Premium Pro';
    END IF;

    request_body := json_build_object(
      'type', 'vip',
      'event', 'vip',
      'to', target_email,
      'email', target_email,
      'subject', 'Plan Activated! ⚡ Welcome to Nitro Elite',
      'html', '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style type="text/css">
    @import url(''https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;600;800&display=swap'');
    body { font-family: ''Inter'', sans-serif; margin: 0; padding: 0; background-color: #0a0a0a; }
    .invoice-card { background-color: #121212; border-radius: 0; border: 1px solid #262626; box-shadow: 0 40px 100px rgba(0,0,0,0.5); }
    .badge { background: linear-gradient(135deg, #d4af37 0%, #996515 100%); color: #000000; padding: 6px 16px; border-radius: 4px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; display: inline-block; }
    .btn-gold { background-color: #d4af37; color: #000000 !important; text-decoration: none; padding: 20px 45px; font-weight: 800; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; display: inline-block; }
    .divider { height: 1px; background-color: #262626; margin: 30px 0; }
  </style>
</head>
<body>
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0a0a0a; background-image: url(''https://ncnypxgushqosmegyzvy.supabase.co/storage/v1/object/public/assests/luxury_geometric_watermark.png''); background-size: cover; background-position: center;">
    <tr>
      <td align="center" style="padding: 80px 20px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;" class="invoice-card">
          <tr>
            <td align="center" style="padding: 60px 40px 40px 40px; border-bottom: 4px solid #d4af37;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left">
                    <img src="https://ncnypxgushqosmegyzvy.supabase.co/storage/v1/object/public/assests/pro_member_badge.png" alt="Verified" width="50" style="vertical-align: middle; margin-right: 10px;" />
                    <span style="color: #d4af37; font-weight: 800; letter-spacing: 3px; font-size: 12px; text-transform: uppercase; vertical-align: middle;">VIP MEMBERSHIP ACTIVATED</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin: 40px 0 10px 0; color: #ffffff; font-family: ''Playfair Display'', serif; font-size: 48px; line-height: 1; text-align: left;">Welcome to the Elite.</h1>
              <p style="margin: 0; color: #737373; font-size: 16px; text-align: left; line-height: 1.6;">Your Nitro Elite subscription is now active. You have been granted full access to our high-performance infrastructure.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 50px 40px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding-bottom: 40px;">
                    <div class="badge">'' || plan_label || '' PLAN</div>
                  </td>
                  <td align="right" style="padding-bottom: 40px;">
                    <span style="color: #22c55e; font-weight: 800; font-size: 12px;">● LIVE STATUS</span>
                  </td>
                </tr>
              </table>
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="color: #737373; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; padding-bottom: 10px;">Activation Date</td>
                  <td align="right" style="color: #737373; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; padding-bottom: 10px;">Expiry Date</td>
                </tr>
                <tr>
                  <td style="color: #ffffff; font-size: 18px; font-weight: 600;">'' || activation_date_str || ''</td>
                  <td align="right" style="color: #ffffff; font-size: 18px; font-weight: 600;">'' || expiry_date_str || ''</td>
                </tr>
              </table>
              <div class="divider"></div>
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="color: #737373; font-size: 14px; line-height: 1.6;">
                    User Account: <span style="color: #ffffff; font-weight: 600;">'' || target_email || ''</span><br/>
                    Status: <span style="color: #d4af37; font-weight: 600;">PRO MEMBER</span>
                  </td>
                </tr>
              </table>
              <div style="text-align: center; padding-top: 60px;">
                <a href="https://nitrodrive.site/dashboard" class="btn-gold">Access Dashboard</a>
              </div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 40px; background-color: #0f0f0f;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="#" style="color: #737373; text-decoration: none; font-size: 12px; margin: 0 15px;">VIEW RECEIPT</a>
                    <a href="#" style="color: #737373; text-decoration: none; font-size: 12px; margin: 0 15px;">NEED HELP?</a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 30px;">
                    <p style="margin: 0; color: #404040; font-size: 11px; letter-spacing: 2px;">NITRO DRIVE &copy; 2026 &bull; FOR THOSE WHO MOVE FAST</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>'
    );

    PERFORM net.http_post(
        url:=webhook_url,
        headers:='{"Content-Type": "application/json"}'::jsonb,
        body:=request_body
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 11. SETUP DATABASE TRIGGERS
-- Profile creation trigger (Separate name to avoid collisions)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Welcome email trigger (Separate name to avoid collisions)
DROP TRIGGER IF EXISTS on_auth_user_created_welcome_email ON auth.users;
CREATE TRIGGER on_auth_user_created_welcome_email
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.send_welcome_email();

-- Profiles updated_at trigger
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Trigger for manual grants via premium_grants table
DROP TRIGGER IF EXISTS on_premium_grant_created ON public.premium_grants;
CREATE TRIGGER on_premium_grant_created
  AFTER INSERT ON public.premium_grants
  FOR EACH ROW EXECUTE FUNCTION public.send_subscription_confirmation_email();

-- Trigger for payment approvals via payment_requests table
DROP TRIGGER IF EXISTS on_payment_request_approved ON public.payment_requests;
CREATE TRIGGER on_payment_request_approved
  AFTER UPDATE ON public.payment_requests
  FOR EACH ROW 
  WHEN (old.status IS DISTINCT FROM new.status AND new.status = 'approved')
  EXECUTE FUNCTION public.send_subscription_confirmation_email();


-- 12. ADMIN ACTIONS & RPCS
-- Drop existing admin functions to prevent type conflicts
DROP FUNCTION IF EXISTS public.admin_grant_premium_by_email(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_approve_payment(UUID, TEXT);

-- Admin action: grant premium manually by email (weekly/monthly/yearly)
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

GRANT EXECUTE ON FUNCTION public.admin_grant_premium_by_email(TEXT, TEXT) TO authenticated;

-- Admin action: approve payment request (The missing function!)
CREATE OR REPLACE FUNCTION public.admin_approve_payment(_request_id UUID, _admin_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _actor UUID := auth.uid();
  _req RECORD;
  _days INTEGER;
  _starts_at TIMESTAMPTZ;
  _expires_at TIMESTAMPTZ;
BEGIN
  -- 1. Check if caller is admin
  IF _actor IS NULL OR NOT public.has_role(_actor, 'admin') THEN
    RAISE EXCEPTION 'Only admins can approve payments';
  END IF;

  -- 2. Get the payment request details
  SELECT * INTO _req
  FROM public.payment_requests
  WHERE id = _request_id;

  IF _req IS NULL THEN
    RAISE EXCEPTION 'Payment request not found';
  END IF;

  IF _req.status = 'approved' THEN
    RAISE EXCEPTION 'Payment request already approved';
  END IF;

  -- 3. Get plan duration
  SELECT duration_days INTO _days
  FROM public.subscription_plans
  WHERE plan_key = lower(btrim(_req.plan_key))
    AND active = TRUE
  LIMIT 1;

  IF _days IS NULL THEN
    _days := 30; -- default backup
  END IF;

  -- 4. Calculate premium dates (stack on top of active subscription if exists)
  SELECT
    CASE
      WHEN p.pro_expires_at IS NOT NULL AND p.pro_expires_at > now() THEN p.pro_expires_at
      ELSE now()
    END
  INTO _starts_at
  FROM public.profiles p
  WHERE p.user_id = _req.user_id;

  _expires_at := _starts_at + make_interval(days => _days);

  -- 5. Update user profile to pro status
  INSERT INTO public.profiles (user_id, full_name, is_pro, pro_expires_at)
  VALUES (_req.user_id, _req.user_email, TRUE, _expires_at)
  ON CONFLICT (user_id) DO UPDATE
  SET is_pro = TRUE,
      pro_expires_at = _expires_at,
      updated_at = now();

  -- 6. Insert premium grant audit log
  INSERT INTO public.premium_grants (user_id, user_email, plan_key, starts_at, expires_at, granted_by)
  VALUES (_req.user_id, lower(btrim(_req.user_email)), lower(btrim(_req.plan_key)), _starts_at, _expires_at, _actor);

  -- 7. Update payment request status to approved
  UPDATE public.payment_requests
  SET status = 'approved',
      reviewed_at = now(),
      reviewed_by = _admin_email
  WHERE id = _request_id;

  RETURN jsonb_build_object(
    'user_id', _req.user_id,
    'email', _req.user_email,
    'status', 'approved',
    'expires_at', _expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_approve_payment(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_expired_premium() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_paid_mode(BOOLEAN, TEXT) TO authenticated;
