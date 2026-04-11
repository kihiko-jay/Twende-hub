-- Eventjump initial schema for Supabase Postgres
-- Run this in Supabase SQL Editor or via: supabase db push

-- Enums for type safety
CREATE TYPE user_role AS ENUM (
  'visitor', 'organizer', 'participant', 'admin',
  'vehicle_owner', 'photographer', 'vendor'
);

CREATE TYPE provider_status AS ENUM ('available', 'unavailable', 'maintenance');
CREATE TYPE booking_status AS ENUM ('pending', 'accepted', 'rejected', 'completed', 'cancelled');
CREATE TYPE event_visibility AS ENUM ('public', 'private');
CREATE TYPE event_status AS ENUM ('draft', 'pending_payment', 'active', 'cancelled');
CREATE TYPE payment_type AS ENUM ('creation', 'feature');
CREATE TYPE payment_status AS ENUM ('pending', 'success', 'failed');
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'rejected');

-- Profiles linked to Supabase Auth (id = auth.users.id)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'participant',
  bio TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.users FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Service role can manage users"
  ON public.users FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Photographers
CREATE TABLE public.photographers (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  portfolio_url TEXT,
  bio TEXT,
  equipment TEXT,
  base_rate INTEGER NOT NULL,
  specialties TEXT,
  status provider_status NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.photographers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read available photographers"
  ON public.photographers FOR SELECT USING (true);

CREATE POLICY "Owners can manage their photographer profile"
  ON public.photographers FOR ALL USING (auth.uid() = user_id);

-- Vehicles
CREATE TABLE public.vehicles (
  id BIGSERIAL PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER,
  capacity INTEGER NOT NULL,
  base_rate INTEGER NOT NULL,
  image_url TEXT,
  status provider_status NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read available vehicles"
  ON public.vehicles FOR SELECT USING (true);

CREATE POLICY "Owners can manage their vehicles"
  ON public.vehicles FOR ALL USING (auth.uid() = owner_id);

-- Events (must exist before photographer_bookings, vehicle_bookings, etc.)
CREATE TABLE public.events (
  id BIGSERIAL PRIMARY KEY,
  organizer_id UUID NOT NULL REFERENCES public.users(id),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Group',
  location TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  date_time TIMESTAMPTZ NOT NULL,
  max_participants INTEGER NOT NULL,
  participant_fee INTEGER NOT NULL DEFAULT 0,
  visibility event_visibility NOT NULL DEFAULT 'public',
  status event_status NOT NULL DEFAULT 'pending_payment',
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  featured_until TIMESTAMPTZ,
  cover_image TEXT,
  duration TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Event invitations (must exist before policies that reference it)
CREATE TABLE public.event_invitations (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  email TEXT,
  status invitation_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, email)
);

ALTER TABLE public.event_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers and invited can read"
  ON public.event_invitations FOR SELECT USING (
    user_id = auth.uid()
    OR email = (SELECT email FROM public.users WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
  );

CREATE POLICY "Organizers can insert"
  ON public.event_invitations FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
  );

CREATE POLICY "Public and invited can read active public events"
  ON public.events FOR SELECT USING (
    status = 'active' AND (
      visibility = 'public'
      OR organizer_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.event_invitations ei
        WHERE ei.event_id = events.id
          AND (ei.user_id = auth.uid() OR ei.email = (SELECT email FROM public.users WHERE id = auth.uid()))
      )
    )
  );

CREATE POLICY "Organizers can read own events"
  ON public.events FOR SELECT USING (organizer_id = auth.uid());

CREATE POLICY "Authenticated can create events"
  ON public.events FOR INSERT WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Organizers can update own events"
  ON public.events FOR UPDATE USING (organizer_id = auth.uid());

-- Event participants
CREATE TABLE public.event_participants (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants and organizers can read"
  ON public.event_participants FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "Authenticated can join"
  ON public.event_participants FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Photographer bookings
CREATE TABLE public.photographer_bookings (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  photographer_id BIGINT NOT NULL REFERENCES public.photographers(id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status booking_status NOT NULL DEFAULT 'pending',
  total_price INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.photographer_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers and photographers can read"
  ON public.photographer_bookings FOR SELECT USING (
    organizer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.photographers p WHERE p.id = photographer_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Organizers can create"
  ON public.photographer_bookings FOR INSERT WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Photographers can update status"
  ON public.photographer_bookings FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.photographers p WHERE p.id = photographer_id AND p.user_id = auth.uid())
  );

-- Vehicle bookings
CREATE TABLE public.vehicle_bookings (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  vehicle_id BIGINT NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status booking_status NOT NULL DEFAULT 'pending',
  total_price INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.vehicle_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers and vehicle owners can read"
  ON public.vehicle_bookings FOR SELECT USING (
    organizer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND v.owner_id = auth.uid())
  );

CREATE POLICY "Organizers can create"
  ON public.vehicle_bookings FOR INSERT WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Vehicle owners can update status"
  ON public.vehicle_bookings FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND v.owner_id = auth.uid())
  );

-- Payments
CREATE TABLE public.payments (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id),
  event_id BIGINT NOT NULL REFERENCES public.events(id),
  amount INTEGER NOT NULL,
  payment_type payment_type NOT NULL DEFAULT 'creation',
  payment_status payment_status NOT NULL DEFAULT 'pending',
  transaction_reference TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own payments"
  ON public.payments FOR SELECT USING (auth.uid() = user_id);

-- Reviews
CREATE TABLE public.reviews (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reviews"
  ON public.reviews FOR SELECT USING (true);

CREATE POLICY "Authenticated can insert own review"
  ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Chat messages
CREATE TABLE public.chat_messages (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants and organizers can read chat"
  ON public.chat_messages FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.event_participants ep WHERE ep.event_id = event_id AND ep.user_id = auth.uid())
  );

CREATE POLICY "Participants and organizers can insert"
  ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Announcements
CREATE TABLE public.announcements (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read announcements"
  ON public.announcements FOR SELECT USING (true);

CREATE POLICY "Organizers can manage announcements"
  ON public.announcements FOR ALL USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
  );

-- Trigger: create public.users row on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'participant')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Indexes for common queries
CREATE INDEX idx_events_status_date ON public.events(status, date_time);
CREATE INDEX idx_events_organizer ON public.events(organizer_id);
CREATE INDEX idx_event_participants_event ON public.event_participants(event_id);
CREATE INDEX idx_payments_event ON public.payments(event_id);
CREATE INDEX idx_chat_messages_event ON public.chat_messages(event_id);
