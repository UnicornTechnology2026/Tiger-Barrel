-- Field Agent Tracker - Production Schema
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'agent')) DEFAULT 'agent',
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  profile_photo_url TEXT,
  employee_id TEXT UNIQUE,
  address TEXT,
  designation TEXT,
  territory TEXT,
  joining_date DATE,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'suspended')) DEFAULT 'active',
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_status ON public.profiles(status);
CREATE INDEX idx_profiles_territory ON public.profiles(territory);

-- ============================================================
-- OUTLETS
-- ============================================================
CREATE TABLE public.outlets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  outlet_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  owner_name TEXT,
  phone TEXT,
  address TEXT NOT NULL,
  city TEXT,
  area TEXT,
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude >= -90 AND latitude <= 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude >= -180 AND longitude <= 180),
  geofence_radius INTEGER NOT NULL DEFAULT 100 CHECK (geofence_radius > 0 AND geofence_radius <= 5000),
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outlets_status ON public.outlets(status);
CREATE INDEX idx_outlets_area ON public.outlets(area);
CREATE INDEX idx_outlets_city ON public.outlets(city);

-- ============================================================
-- OUTLET ASSIGNMENTS
-- ============================================================
CREATE TABLE public.outlet_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agent_id, outlet_id, assigned_date)
);

CREATE INDEX idx_assignments_agent ON public.outlet_assignments(agent_id);
CREATE INDEX idx_assignments_outlet ON public.outlet_assignments(outlet_id);
CREATE INDEX idx_assignments_date ON public.outlet_assignments(assigned_date);
CREATE INDEX idx_assignments_active ON public.outlet_assignments(active) WHERE active = TRUE;

-- ============================================================
-- VISITS
-- ============================================================
CREATE TABLE public.visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE RESTRICT,
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  check_in_latitude DOUBLE PRECISION,
  check_in_longitude DOUBLE PRECISION,
  check_in_accuracy DOUBLE PRECISION,
  check_out_latitude DOUBLE PRECISION,
  check_out_longitude DOUBLE PRECISION,
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')) DEFAULT 'pending',
  duration_minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_visits_agent ON public.visits(agent_id);
CREATE INDEX idx_visits_outlet ON public.visits(outlet_id);
CREATE INDEX idx_visits_status ON public.visits(status);
CREATE INDEX idx_visits_check_in ON public.visits(check_in_time);
CREATE INDEX idx_visits_agent_check_in ON public.visits(agent_id, check_in_time);
-- ============================================================
-- LOCATION LOGS
-- ============================================================
CREATE TABLE public.location_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES public.visits(id) ON DELETE SET NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_location_agent ON public.location_logs(agent_id);
CREATE INDEX idx_location_visit ON public.location_logs(visit_id);
CREATE INDEX idx_location_time ON public.location_logs(recorded_at DESC);

-- ============================================================
-- PHOTOS
-- ============================================================
CREATE TABLE public.photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE RESTRICT,
  visit_id UUID NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_photos_agent ON public.photos(agent_id);
CREATE INDEX idx_photos_outlet ON public.photos(outlet_id);
CREATE INDEX idx_photos_visit ON public.photos(visit_id);
CREATE INDEX idx_photos_created ON public.photos(created_at DESC);

-- ============================================================
-- COMMENTS
-- ============================================================
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE RESTRICT,
  visit_id UUID NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL CHECK (char_length(comment_text) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comments_agent ON public.comments(agent_id);
CREATE INDEX idx_comments_outlet ON public.comments(outlet_id);
CREATE INDEX idx_comments_visit ON public.comments(visit_id);

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL CHECK (char_length(message_text) <= 2000),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX idx_messages_receiver ON public.messages(receiver_id);
CREATE INDEX idx_messages_sender ON public.messages(sender_id);
CREATE INDEX idx_messages_unread ON public.messages(receiver_id) WHERE is_read = FALSE;

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_actor ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_time ON public.audit_logs(created_at DESC);

-- ============================================================
-- APP SETTINGS
-- ============================================================
CREATE TABLE public.app_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.app_settings (key, value) VALUES
  ('default_geofence_radius', '100'),
  ('min_gps_accuracy', '50'),
  ('max_photo_size_mb', '20'),
  ('max_photos_per_visit', '10'),
  ('allowed_photo_types', 'image/jpeg,image/png,image/webp'),
  ('tracking_enabled', 'true');

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER outlets_updated_at BEFORE UPDATE ON public.outlets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER visits_updated_at BEFORE UPDATE ON public.visits
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER comments_updated_at BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'agent')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- HELPER: get current user role
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlet_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- PROFILES policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can update own limited fields"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can manage all profiles"
  ON public.profiles FOR ALL
  USING (public.is_admin());

-- OUTLETS policies
CREATE POLICY "Admins full access outlets"
  ON public.outlets FOR ALL
  USING (public.is_admin());

CREATE POLICY "Agents can view assigned outlets"
  ON public.outlets FOR SELECT
  USING (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.outlet_assignments oa
      WHERE oa.outlet_id = outlets.id
        AND oa.agent_id = auth.uid()
        AND oa.active = TRUE
    )
  );

-- ASSIGNMENTS policies
CREATE POLICY "Admins manage assignments"
  ON public.outlet_assignments FOR ALL
  USING (public.is_admin());

CREATE POLICY "Agents view own assignments"
  ON public.outlet_assignments FOR SELECT
  USING (agent_id = auth.uid() OR public.is_admin());

-- VISITS policies
CREATE POLICY "Admins full visits"
  ON public.visits FOR ALL
  USING (public.is_admin());

CREATE POLICY "Agents manage own visits"
  ON public.visits FOR ALL
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

-- LOCATION LOGS
CREATE POLICY "Admins view all locations"
  ON public.location_logs FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Agents insert own locations"
  ON public.location_logs FOR INSERT
  WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents view own locations"
  ON public.location_logs FOR SELECT
  USING (agent_id = auth.uid() OR public.is_admin());

-- PHOTOS
CREATE POLICY "Admins full photos"
  ON public.photos FOR ALL
  USING (public.is_admin());

CREATE POLICY "Agents manage own photos"
  ON public.photos FOR ALL
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

-- COMMENTS
CREATE POLICY "Admins full comments"
  ON public.comments FOR ALL
  USING (public.is_admin());

CREATE POLICY "Agents manage own comments"
  ON public.comments FOR ALL
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

-- MESSAGES
CREATE POLICY "Users see own messages"
  ON public.messages FOR SELECT
  USING (sender_id = auth.uid() OR receiver_id = auth.uid() OR public.is_admin());

CREATE POLICY "Admins can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (public.is_admin() OR sender_id = auth.uid());

CREATE POLICY "Users can mark own messages read"
  ON public.messages FOR UPDATE
  USING (receiver_id = auth.uid())
  WITH CHECK (receiver_id = auth.uid());

-- AUDIT LOGS (admin only)
CREATE POLICY "Admins view audit"
  ON public.audit_logs FOR SELECT
  USING (public.is_admin());

CREATE POLICY "System insert audit"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);

-- SETTINGS
CREATE POLICY "Anyone authenticated can read settings"
  ON public.app_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage settings"
  ON public.app_settings FOR ALL
  USING (public.is_admin());

-- ============================================================
-- STORAGE BUCKET (run in Supabase dashboard or via API)
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES ('outlet-photos', 'outlet-photos', false, 5242880, ARRAY['image/jpeg','image/png','image/webp']);
