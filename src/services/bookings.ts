import { supabase } from "@/lib/supabase.ts";
import type { Database } from "@/lib/supabase.types.ts";
import type { BookingStatus } from "@/lib/supabase.types.ts";

export async function createVehicleBooking(params: {
  event_id: number;
  vehicle_id: number;
  organizer_id: string;
  total_price?: number | null;
  notes?: string | null;
}): Promise<{ id: number }> {
  const { data, error } = await (supabase as any)
    .from("vehicle_bookings")
    .insert(params)
    .select("id")
    .single();
  if (error) throw error;
  const id = (data as { id: number }).id;

  // Fire-and-forget notification email to vehicle owner via backend.
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (token) {
      await fetch(`/api/vehicle-bookings/${id}/notify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
    }
  } catch {
    // ignore errors
  }

  return { id };
}

export async function createPhotographerBooking(params: {
  event_id: number;
  photographer_id: number;
  organizer_id: string;
  total_price?: number | null;
  notes?: string | null;
}): Promise<{ id: number }> {
  const { data, error } = await (supabase as any)
    .from("photographer_bookings")
    .insert(params)
    .select("id")
    .single();
  if (error) throw error;
  const id = (data as { id: number }).id;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (token) {
      await fetch(`/api/photographer-bookings/${id}/notify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
    }
  } catch {
    // ignore errors
  }

  return { id };
}

export async function updateVehicleBookingStatus(bookingId: number, status: BookingStatus): Promise<void> {
  const { error } = await (supabase as any).from("vehicle_bookings").update({ status }).eq("id", bookingId);
  if (error) throw error;
}

export async function updatePhotographerBookingStatus(bookingId: number, status: BookingStatus): Promise<void> {
  const { error } = await (supabase as any).from("photographer_bookings").update({ status }).eq("id", bookingId);
  if (error) throw error;
}

export async function getVehicleBookingsForEvent(eventId: number) {
  const { data, error } = await supabase
    .from("vehicle_bookings")
    .select("*, vehicles(make, model, capacity), users!vehicle_bookings_organizer_id_fkey(name)")
    .eq("event_id", eventId);
  if (error) throw error;
  return data ?? [];
}

export async function getPhotographerBookingsForEvent(eventId: number) {
  const { data, error } = await supabase
    .from("photographer_bookings")
    .select("*, photographers(specialties, users!photographers_user_id_fkey(name))")
    .eq("event_id", eventId);
  if (error) throw error;
  return data ?? [];
}

export async function getAvailableVehicles(minCapacity?: number) {
  let q = supabase
    .from("vehicles")
    .select("*, users!vehicles_owner_id_fkey(name)")
    .eq("status", "available");
  if (minCapacity != null) q = q.gte("capacity", minCapacity);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getAvailablePhotographers() {
  const { data, error } = await supabase
    .from("photographers")
    .select("*, users!photographers_user_id_fkey(name)")
    .eq("status", "available");
  if (error) throw error;
  return data ?? [];
}
