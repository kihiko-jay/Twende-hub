-- 012_booking_state_machine.sql
-- Core booking lifecycle and capacity-related columns.

-- Dedicated enums for attendee booking lifecycle and payment status.
-- These are intentionally separate from the existing booking_status
-- (used for service bookings) and payment_status (used for organizer fees)
-- to keep responsibilities clear.

CREATE TYPE booking_lifecycle_status AS ENUM (
  'draft',
  'pending_payment',
  'confirmed',
  'cancelled',
  'refunded',
  'completed'
);

CREATE TYPE booking_payment_status AS ENUM (
  'unpaid',
  'pending',
  'confirmed',
  'failed',
  'refunded'
);

-- Extend event_participants to carry booking lifecycle and payment state.

ALTER TABLE public.event_participants
  ADD COLUMN booking_status booking_lifecycle_status NOT NULL DEFAULT 'draft',
  ADD COLUMN payment_status booking_payment_status NOT NULL DEFAULT 'unpaid',
  ADD COLUMN payment_id BIGINT NULL REFERENCES public.payments(id),
  ADD COLUMN commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Indexes to support common organiser / capacity queries.

CREATE INDEX IF NOT EXISTS idx_event_participants_event_status
  ON public.event_participants (event_id, booking_status);

CREATE INDEX IF NOT EXISTS idx_event_participants_event_user_status
  ON public.event_participants (event_id, user_id, booking_status);

-- Helpful partial index for fast confirmed-count lookups.

CREATE INDEX IF NOT EXISTS idx_event_participants_confirmed
  ON public.event_participants (event_id)
  WHERE booking_status = 'confirmed';

