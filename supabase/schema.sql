-- ============================================================
-- NexBookings — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ── Enums ────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('super_admin', 'owner', 'manager', 'receptionist');
CREATE TYPE unit_type AS ENUM ('room', 'cottage', 'villa', 'apartment');
CREATE TYPE occupancy_type AS ENUM ('single', 'double');
CREATE TYPE meal_plan AS ENUM ('BB', 'HB', 'FB', 'none');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled');
CREATE TYPE booking_source AS ENUM ('manual', 'whatsapp_ai');
CREATE TYPE payment_type AS ENUM ('deposit', 'balance');

-- ── Tables ───────────────────────────────────────────────────

-- One row per business / owner account
CREATE TABLE accounts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Mirrors auth.users with role + account membership
CREATE TABLE users (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email       text NOT NULL,
  full_name   text,
  role        user_role NOT NULL DEFAULT 'owner',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Properties (lodges, cottages, etc.) — one account can have many
CREATE TABLE properties (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name        text NOT NULL,
  logo_url    text,
  currency    text NOT NULL DEFAULT 'KES',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Rooms / units within a property
CREATE TABLE rooms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name        text NOT NULL,
  unit_type   unit_type NOT NULL DEFAULT 'room',
  max_pax     integer NOT NULL DEFAULT 2,
  base_rate   numeric(10,2) NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Bookings per room
CREATE TABLE bookings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id        uuid NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  property_id    uuid NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  guest_name     text NOT NULL,
  guest_email    text,
  guest_phone    text,
  check_in       date NOT NULL,
  check_out      date NOT NULL,
  occupancy_type occupancy_type NOT NULL DEFAULT 'double',
  meal_plan      meal_plan NOT NULL DEFAULT 'BB',
  pax            integer NOT NULL DEFAULT 1,
  status         booking_status NOT NULL DEFAULT 'pending',
  source         booking_source NOT NULL DEFAULT 'manual',
  total_amount   numeric(10,2) NOT NULL DEFAULT 0,
  notes          text,
  created_by     uuid NOT NULL REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_out_after_check_in CHECK (check_out > check_in)
);

-- Payments against a booking (always entered manually)
CREATE TABLE payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount          numeric(10,2) NOT NULL,
  payment_type    payment_type NOT NULL DEFAULT 'deposit',
  discount_amount numeric(10,2) NOT NULL DEFAULT 0,
  discount_pct    numeric(5,2) NOT NULL DEFAULT 0,
  document_url    text,
  notes           text,
  recorded_by     uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Scopes managers/receptionists to specific properties
CREATE TABLE staff_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, property_id)
);

-- ── Indexes ──────────────────────────────────────────────────

CREATE INDEX idx_users_account_id        ON users(account_id);
CREATE INDEX idx_properties_account_id   ON properties(account_id);
CREATE INDEX idx_rooms_property_id       ON rooms(property_id);
CREATE INDEX idx_bookings_room_id        ON bookings(room_id);
CREATE INDEX idx_bookings_property_id    ON bookings(property_id);
CREATE INDEX idx_bookings_check_in       ON bookings(check_in);
CREATE INDEX idx_bookings_check_out      ON bookings(check_out);
CREATE INDEX idx_payments_booking_id     ON payments(booking_id);
CREATE INDEX idx_staff_assignments_user  ON staff_assignments(user_id);

-- ── Signup trigger ───────────────────────────────────────────
-- Fires after every new auth.users row.
-- Self-signup path: creates accounts + users rows, role = owner.
-- Invite path: the edge function creates users rows directly
--   with service role, so we detect that by checking if an
--   account_id was passed in raw_user_meta_data.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_account_id uuid;
  meta_account_id uuid;
  meta_role user_role;
BEGIN
  -- Read optional metadata set by the invite edge function
  meta_account_id := (NEW.raw_user_meta_data->>'account_id')::uuid;
  meta_role       := (NEW.raw_user_meta_data->>'role')::user_role;

  IF meta_account_id IS NOT NULL AND meta_role IS NOT NULL THEN
    -- ── Invite path ──────────────────────────────────────────
    -- account already exists; just create the users row
    INSERT INTO public.users (id, account_id, email, full_name, role)
    VALUES (
      NEW.id,
      meta_account_id,
      NEW.email,
      NEW.raw_user_meta_data->>'full_name',
      meta_role
    );
  ELSE
    -- ── Self-signup path ─────────────────────────────────────
    -- Create a new account, then a users row as owner
    INSERT INTO public.accounts (owner_id, business_name)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'business_name', 'My Business')
    )
    RETURNING id INTO new_account_id;

    INSERT INTO public.users (id, account_id, email, full_name, role)
    VALUES (
      NEW.id,
      new_account_id,
      NEW.email,
      NEW.raw_user_meta_data->>'full_name',
      'owner'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Row Level Security ───────────────────────────────────────

ALTER TABLE accounts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms            ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_assignments ENABLE ROW LEVEL SECURITY;

-- ── Helper function ──────────────────────────────────────────
-- Returns the calling user's account_id without hitting the
-- users table more than once per query. SECURITY DEFINER means
-- it runs as the function owner (postgres), not the caller,
-- so RLS on users doesn't block it — safe because we only
-- expose the caller's own account_id.

CREATE OR REPLACE FUNCTION public.my_account_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account_id FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.my_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- ── accounts policies ─────────────────────────────────────────

CREATE POLICY "Users can view their own account"
  ON accounts FOR SELECT
  USING (id = public.my_account_id());

CREATE POLICY "Owners can update their own account"
  ON accounts FOR UPDATE
  USING (owner_id = auth.uid());

-- ── users policies ────────────────────────────────────────────

CREATE POLICY "Users can view teammates in same account"
  ON users FOR SELECT
  USING (account_id = public.my_account_id());

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (id = auth.uid());

-- Owners and managers can insert users (invite flow hits this
-- via service role, but this covers direct inserts too)
CREATE POLICY "Owners can insert users into their account"
  ON users FOR INSERT
  WITH CHECK (
    account_id = public.my_account_id()
    AND public.my_role() IN ('owner', 'super_admin')
  );

-- ── properties policies ───────────────────────────────────────

CREATE POLICY "Account members can view their properties"
  ON properties FOR SELECT
  USING (account_id = public.my_account_id());

CREATE POLICY "Owners can insert properties"
  ON properties FOR INSERT
  WITH CHECK (
    account_id = public.my_account_id()
    AND public.my_role() IN ('owner', 'super_admin')
  );

CREATE POLICY "Owners can update their properties"
  ON properties FOR UPDATE
  USING (
    account_id = public.my_account_id()
    AND public.my_role() IN ('owner', 'super_admin')
  );

CREATE POLICY "Owners can delete their properties"
  ON properties FOR DELETE
  USING (
    account_id = public.my_account_id()
    AND public.my_role() IN ('owner', 'super_admin')
  );

-- ── rooms policies ────────────────────────────────────────────

-- Rooms are scoped to properties; we join to check account ownership
-- or staff assignment.

CREATE POLICY "Account members and assigned staff can view rooms"
  ON rooms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = rooms.property_id
        AND p.account_id = public.my_account_id()
    )
    OR
    EXISTS (
      SELECT 1 FROM staff_assignments sa
      WHERE sa.property_id = rooms.property_id
        AND sa.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners and managers can insert rooms"
  ON rooms FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = rooms.property_id
        AND p.account_id = public.my_account_id()
    )
    AND public.my_role() IN ('owner', 'manager', 'super_admin')
  );

CREATE POLICY "Owners and managers can update rooms"
  ON rooms FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = rooms.property_id
        AND p.account_id = public.my_account_id()
    )
    AND public.my_role() IN ('owner', 'manager', 'super_admin')
  );

CREATE POLICY "Owners can delete rooms"
  ON rooms FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = rooms.property_id
        AND p.account_id = public.my_account_id()
    )
    AND public.my_role() IN ('owner', 'super_admin')
  );

-- ── bookings policies ─────────────────────────────────────────

CREATE POLICY "Staff can view bookings for their properties"
  ON bookings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = bookings.property_id
        AND p.account_id = public.my_account_id()
    )
    OR
    EXISTS (
      SELECT 1 FROM staff_assignments sa
      WHERE sa.property_id = bookings.property_id
        AND sa.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can insert bookings for their properties"
  ON bookings FOR INSERT
  WITH CHECK (
    (
      EXISTS (
        SELECT 1 FROM properties p
        WHERE p.id = bookings.property_id
          AND p.account_id = public.my_account_id()
      )
      OR
      EXISTS (
        SELECT 1 FROM staff_assignments sa
        WHERE sa.property_id = bookings.property_id
          AND sa.user_id = auth.uid()
      )
    )
    AND public.my_role() IN ('owner', 'manager', 'receptionist', 'super_admin')
  );

CREATE POLICY "Staff can update bookings for their properties"
  ON bookings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = bookings.property_id
        AND p.account_id = public.my_account_id()
    )
    OR
    EXISTS (
      SELECT 1 FROM staff_assignments sa
      WHERE sa.property_id = bookings.property_id
        AND sa.user_id = auth.uid()
    )
  );

-- ── payments policies ─────────────────────────────────────────

CREATE POLICY "Staff can view payments for their bookings"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      JOIN properties p ON p.id = b.property_id
      WHERE b.id = payments.booking_id
        AND (
          p.account_id = public.my_account_id()
          OR EXISTS (
            SELECT 1 FROM staff_assignments sa
            WHERE sa.property_id = p.id AND sa.user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "Staff can insert payments for their bookings"
  ON payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings b
      JOIN properties p ON p.id = b.property_id
      WHERE b.id = payments.booking_id
        AND (
          p.account_id = public.my_account_id()
          OR EXISTS (
            SELECT 1 FROM staff_assignments sa
            WHERE sa.property_id = p.id AND sa.user_id = auth.uid()
          )
        )
    )
  );

-- ── staff_assignments policies ────────────────────────────────

CREATE POLICY "Account members can view staff assignments"
  ON staff_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = staff_assignments.property_id
        AND p.account_id = public.my_account_id()
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "Owners can manage staff assignments"
  ON staff_assignments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = staff_assignments.property_id
        AND p.account_id = public.my_account_id()
    )
    AND public.my_role() IN ('owner', 'super_admin')
  );

CREATE POLICY "Owners can delete staff assignments"
  ON staff_assignments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = staff_assignments.property_id
        AND p.account_id = public.my_account_id()
    )
    AND public.my_role() IN ('owner', 'super_admin')
  );
