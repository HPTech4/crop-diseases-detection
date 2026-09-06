-- CropCare profile, collection access, and indexes.
-- This migration matches the existing collections + collection_scans schema.

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  avatar TEXT,
  preferences JSONB DEFAULT '{"theme":"light","notifications":true}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.collection_scans (
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  scan_id UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (collection_id, scan_id)
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can view own collections" ON public.collections;
CREATE POLICY "Users can view own collections"
  ON public.collections FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own collections" ON public.collections;
CREATE POLICY "Users can create own collections"
  ON public.collections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own collections" ON public.collections;
CREATE POLICY "Users can update own collections"
  ON public.collections FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own collections" ON public.collections;
CREATE POLICY "Users can delete own collections"
  ON public.collections FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own collection scans" ON public.collection_scans;
CREATE POLICY "Users can view own collection scans"
  ON public.collection_scans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.collections
      WHERE collections.id = collection_id
        AND collections.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can add own scans to collections" ON public.collection_scans;
CREATE POLICY "Users can add own scans to collections"
  ON public.collection_scans FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.collections
      WHERE collections.id = collection_id
        AND collections.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.scans
      WHERE scans.id = scan_id
        AND scans.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can remove own scans from collections" ON public.collection_scans;
CREATE POLICY "Users can remove own scans from collections"
  ON public.collection_scans FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.collections
      WHERE collections.id = collection_id
        AND collections.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS scans_user_created_idx
  ON public.scans (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS collections_user_created_idx
  ON public.collections (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS collection_scans_scan_idx
  ON public.collection_scans (scan_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_set_updated_at ON public.users;
CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Backfill profiles for users that already exist in Supabase Auth.
INSERT INTO public.users (id, email, name)
SELECT id, email, COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1))
FROM auth.users
ON CONFLICT (id) DO NOTHING;
