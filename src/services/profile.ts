import { supabase } from "@/lib/supabase.ts";
import type { Database } from "@/lib/supabase.types.ts";

type UserRow = Database["public"]["Tables"]["users"]["Row"];

export type UserProfile = Pick<
  UserRow,
  "id" | "name" | "email" | "role" | "bio" | "phone" | "created_at" | "avatar_url"
>;

export async function getCurrentUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, role, bio, phone, created_at, avatar_url")
    .eq("id", userId)
    .single();
  if (error || !data) return null;
  return data as UserProfile;
}

export async function updateProfile(
  userId: string,
  updates: { name?: string; bio?: string | null; phone?: string | null; avatar_url?: string | null }
): Promise<void> {
  const { error } = await (supabase as any)
    .from("users")
    .update(updates)
    .eq("id", userId);
  if (error) throw error;
}

export interface UserEventSummary {
  id: number;
  title: string;
  location: string;
  date_time: string;
  cover_image: string | null;
  category: string;
  duration: string | null;
  organizer_name: string;
  avg_rating: number | null;
  has_reviewed?: number;
  status: string;
}

export async function getMyEvents(userId: string): Promise<{
  joined: UserEventSummary[];
  organized: UserEventSummary[];
}> {
  const { data: joinedRows } = await supabase
    .from("event_participants")
    .select(`
      events (
        id, title, location, date_time, cover_image, category, duration, status,
        organizer:users!events_organizer_id_fkey ( name )
      )
    `)
    .eq("user_id", userId);

  const joined: UserEventSummary[] = [];
  for (const row of joinedRows ?? []) {
    const e = (row as any).events;
    if (!e) continue;
    const org = e.organizer;
    joined.push({
      id: e.id,
      title: e.title,
      location: e.location,
      date_time: e.date_time,
      cover_image: e.cover_image,
      category: e.category,
      duration: e.duration,
      organizer_name: Array.isArray(org) ? org[0]?.name ?? "" : org?.name ?? "",
      avg_rating: null,
      status: e.status,
    });
  }

  const { data: organizedRows } = await supabase
    .from("events")
    .select("id, title, location, date_time, cover_image, category, duration, status")
    .eq("organizer_id", userId);

  const organized: UserEventSummary[] = (organizedRows ?? []).map((e: any) => ({
    id: e.id,
    title: e.title,
    location: e.location,
    date_time: e.date_time,
    cover_image: e.cover_image,
    category: e.category,
    duration: e.duration,
    organizer_name: "",
    avg_rating: null,
    status: e.status,
  }));

  return { joined, organized };
}

export interface BookingSummary {
  id: number;
  event_title: string;
  status: string;
  total_price: number | null;
  make?: string;
  model?: string;
  photographer_name?: string;
  organizer_name?: string;
}

export async function getMyBookings(userId: string): Promise<{
  vehicleBookings: BookingSummary[];
  photographerBookings: BookingSummary[];
  myServiceVehicleBookings: BookingSummary[];
  myServicePhotographerBookings: BookingSummary[];
}> {
  const { data: vbRows } = await supabase
    .from("vehicle_bookings")
    .select("id, status, total_price, organizer_id, vehicles(make, model), events(title), users!vehicle_bookings_organizer_id_fkey(name)")
    .or(`organizer_id.eq.${userId},vehicles.owner_id.eq.${userId}`);

  const { data: pbRows } = await supabase
    .from("photographer_bookings")
    .select("id, status, total_price, organizer_id, events(title), users!photographer_bookings_organizer_id_fkey(name)")
    .or(`organizer_id.eq.${userId},photographers.user_id.eq.${userId}`);

  const vehicleBookings: BookingSummary[] = [];
  const myServiceVehicleBookings: BookingSummary[] = [];
  for (const r of vbRows ?? []) {
    const row = r as any;
    const item = {
      id: row.id,
      event_title: row.events?.title ?? "",
      status: row.status,
      total_price: row.total_price,
      make: row.vehicles?.make,
      model: row.vehicles?.model,
      organizer_name: row.users?.name,
    };
    if (row.organizer_id === userId) vehicleBookings.push(item);
    else myServiceVehicleBookings.push(item);
  }

  const photographerBookings: BookingSummary[] = [];
  const myServicePhotographerBookings: BookingSummary[] = [];
  for (const r of pbRows ?? []) {
    const row = r as any;
    const item = {
      id: row.id,
      event_title: row.events?.title ?? "",
      status: row.status,
      total_price: row.total_price,
      photographer_name: row.users?.name,
      organizer_name: row.users?.name,
    };
    if (row.organizer_id === userId) photographerBookings.push(item);
    else myServicePhotographerBookings.push(item);
  }

  return {
    vehicleBookings,
    photographerBookings,
    myServiceVehicleBookings,
    myServicePhotographerBookings,
  };
}
