import { supabase } from "@/lib/supabase.ts";
import type { Database } from "@/lib/supabase.types.ts";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type EventInsert = Database["public"]["Tables"]["events"]["Insert"];

export interface EventListFilters {
  category?: string;
  type?: string;
  search?: string;
  featured?: boolean;
  startDate?: string;
  endDate?: string;
  minCapacity?: number;
  maxCapacity?: number;
  lat?: number;
  lng?: number;
  radius?: number;
}

export interface EventWithMeta extends EventRow {
  organizer_name?: string;
  avg_rating?: number | null;
  review_count?: number;
}

export async function listEvents(
  filters: EventListFilters = {},
  options: { limit?: number; cursor?: number | null } = {},
): Promise<{ events: EventWithMeta[]; nextCursor: number | null }> {
  const limit = options.limit ?? 12;
  let query = supabase
    .from("events")
    .select(`
      *,
      organizer:users!events_organizer_id_fkey ( name )
    `)
    .eq("status", "active");

  if (filters.category) query = query.eq("category", filters.category);
  if (filters.type) query = query.eq("type", filters.type);
  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }
  if (filters.featured) {
    query = query.eq("is_featured", true).gt("featured_until", new Date().toISOString());
  }
  if (filters.startDate) query = query.gte("date_time", filters.startDate);
  if (filters.endDate) query = query.lte("date_time", filters.endDate);
  if (filters.minCapacity != null) query = query.gte("max_participants", filters.minCapacity);
  if (filters.maxCapacity != null) query = query.lte("max_participants", filters.maxCapacity);

  if (options.cursor != null) {
    query = query.lt("id", options.cursor);
  }

  const { data, error } = await query
    .order("id", { ascending: false })
    .limit(limit + 1);
  if (error) throw error;

  const rows = (data ?? []) as any[];

  const eventIds = rows.slice(0, limit).map((r: any) => r.id);
  const { data: allReviews } = eventIds.length
    ? await supabase.from("reviews").select("event_id, rating").in("event_id", eventIds)
    : { data: [] };
  const byEvent: Record<number, number[]> = {};
  for (const r of allReviews ?? []) {
    const row = r as { event_id: number; rating: number };
    if (!byEvent[row.event_id]) byEvent[row.event_id] = [];
    byEvent[row.event_id].push(row.rating);
  }

  const items = rows.slice(0, limit).map((row: any) => {
    const ratings = byEvent[row.id] ?? [];
    const avg_rating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
    return {
      ...row,
      organizer_name: row.organizer?.name ?? (Array.isArray(row.organizer) ? row.organizer[0]?.name : null),
      avg_rating,
      review_count: ratings.length,
    };
  }) as EventWithMeta[];

  const nextCursor = rows.length > limit ? rows[limit - 1].id : null;

  return { events: items, nextCursor };
}

export async function getEventById(
  eventId: string | number,
  userId?: string | null,
): Promise<
  | (EventWithMeta & {
      participants: {
        id: string;
        name: string;
        phone: string | null;
        booking_status: string;
        payment_status: string;
      }[];
      revenue_total: number;
    })
  | null
> {
  const id = typeof eventId === "string" ? parseInt(eventId, 10) : eventId;
  const { data: event, error } = await supabase
    .from("events")
    .select(`
      *,
      organizer:users!events_organizer_id_fkey ( name )
    `)
    .eq("id", id)
    .single();
  if (error || !event) return null;

  const { data: reviewRows } = await supabase.from("reviews").select("rating").eq("event_id", id);
  const ratings = reviewRows ?? [];
  const avg_rating = ratings.length ? ratings.reduce((s: number, r: any) => s + r.rating, 0) / ratings.length : null;

  const { data: participants } = await supabase
    .from("event_participants")
    .select("id, user_id, booking_status, payment_status, users(id, name, phone)")
    .eq("event_id", id)
    .order("id", { ascending: true });

  const { data: paymentRows } = await supabase
    .from("payments")
    .select("amount, payment_status")
    .eq("event_id", id)
    .in("payment_status", ["confirmed", "success"]);

  const revenueTotal = (paymentRows ?? []).reduce(
    (sum, row) => sum + (row as { amount: number }).amount,
    0,
  );

  const participantsList = (participants ?? []).map((p: any) => ({
    id: p.users?.id ?? p.user_id,
    name: p.users?.name ?? "",
    phone: p.users?.phone ?? null,
    booking_status: p.booking_status ?? "",
    payment_status: p.payment_status ?? "",
  }));

  const e = event as Record<string, unknown>;
  return {
    ...e,
    organizer_name: (e.organizer as { name?: string })?.name ?? "",
    avg_rating,
    review_count: ratings.length,
    participants: participantsList,
    revenue_total: revenueTotal,
  } as EventWithMeta & {
    participants: {
      id: string;
      name: string;
      phone: string | null;
      booking_status: string;
      payment_status: string;
    }[];
    revenue_total: number;
  };
}

export async function createEvent(organizerId: string, payload: Omit<EventInsert, "id" | "organizer_id" | "status">): Promise<{ id: number }> {
  const { data, error } = await (supabase as any)
    .from("events")
    .insert({
      ...payload,
      organizer_id: organizerId,
      status: "pending_payment",
    })
    .select("id")
    .single();
  if (error) throw error;
  const row = data as { id: number } | null;
  if (!row?.id) throw new Error("No id returned");
  return { id: row.id };
}

export async function joinEvent(eventId: number, _userId: string): Promise<void> {
  // Step 1: ensure there is a participant row for this user + event.
  const { data: participant, error: createError } = await (supabase as any).rpc("create_attendee_booking_v2", {
    p_event_id: eventId,
  });
  if (createError) throw createError;

  const row = participant as { id: number } | null;
  if (!row?.id) return;

  // Step 2: move booking into confirmed state, enforcing capacity in the DB.
  const { error: confirmError } = await (supabase as any).rpc("transition_booking_to_confirmed", {
    p_participant_id: row.id,
    p_payment_id: null,
  });
  if (confirmError) throw confirmError;
}

export async function createAnnouncement(eventId: number, content: string): Promise<{ id: number }> {
  const { data, error } = await (supabase as any).from("announcements").insert({ event_id: eventId, content }).select("id").single();
  if (error) throw error;
  return { id: (data as { id: number }).id };
}

export async function inviteByEmail(eventId: number, email: string, userId?: string | null): Promise<void> {
  const { error } = await (supabase as any).from("event_invitations").insert({
    event_id: eventId,
    user_id: userId ?? null,
    email,
  });
  if (error) throw error;
}

export async function getAnnouncements(eventId: number) {
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
