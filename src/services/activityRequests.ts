import { supabase } from "@/lib/supabase.ts";
import type { Database } from "@/lib/supabase.types.ts";

type ActivityRequestRow = Database["public"]["Tables"]["activity_requests"]["Row"];
type ActivityRequestInsert = Database["public"]["Tables"]["activity_requests"]["Insert"];
type ActivityRequestMemberRow = Database["public"]["Tables"]["activity_request_members"]["Row"];

/** Member row with joined user name (when RLS allows). */
export interface ActivityRequestMemberWithUser extends ActivityRequestMemberRow {
  users?: { id: string; name: string } | null;
}

export interface ActivityRequestWithMeta extends ActivityRequestRow {
  members: ActivityRequestMemberWithUser[];
  people_joined: number;
}

export interface ActivityRequestListFilters {
  activityType?: string;
  activityDate?: string;
  locationName?: string;
  status?: string;
}

export async function listActivityRequests(
  filters: ActivityRequestListFilters = {},
): Promise<ActivityRequestWithMeta[]> {
  let query = supabase
    .from("activity_requests")
    .select(
      `
        *,
        members:activity_request_members(*, users(id, name))
      `,
    )
    .eq("status", filters.status ?? "open");

  if (filters.activityType) {
    query = query.eq("activity_type", filters.activityType);
  }
  if (filters.activityDate) {
    query = query.eq("activity_date", filters.activityDate);
  }
  if (filters.locationName?.trim()) {
    query = query.ilike("location_name", `%${filters.locationName.trim()}%`);
  }

  const { data, error } = await query
    .order("activity_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as unknown as (ActivityRequestRow & { members?: ActivityRequestMemberWithUser[] })[];

  return rows.map((row) => {
    const members = row.members ?? [];
    return {
      ...(row as ActivityRequestRow),
      members,
      people_joined: members.length,
    };
  });
}

export async function getActivityRequestById(id: string): Promise<ActivityRequestWithMeta | null> {
  const { data, error } = await supabase
    .from("activity_requests")
    .select(
      `
        *,
        members:activity_request_members(*, users(id, name))
      `,
    )
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  if (!data) return null;

  const row = data as unknown as ActivityRequestRow & { members?: ActivityRequestMemberWithUser[] };
  const members = row.members ?? [];

  return {
    ...(row as ActivityRequestRow),
    members,
    people_joined: members.length,
  };
}

export async function createActivityRequest(
  creatorId: string,
  payload: Omit<ActivityRequestInsert, "id" | "creator_id" | "created_at" | "status">,
): Promise<ActivityRequestWithMeta> {
  // Step 1: create the request.
  const { data: requestRow, error: requestError } = await (supabase as any)
    .from("activity_requests")
    .insert({
      ...payload,
      creator_id: creatorId,
    } as ActivityRequestInsert)
    .select("id")
    .single();

  if (requestError) throw requestError;
  const baseRow = requestRow as Pick<ActivityRequestRow, "id">;

  // Step 2: ensure the creator is a member.
  const { error: memberError } = await (supabase as any).from("activity_request_members").insert({
    request_id: baseRow.id,
    user_id: creatorId,
  });
  if (memberError && memberError.code !== "23505") {
    throw memberError;
  }

  // Re-fetch with members so UI has an up-to-date picture.
  const refreshed = await getActivityRequestById(baseRow.id);
  if (!refreshed) {
    throw new Error("Failed to load created activity request");
  }
  return refreshed;
}

export async function joinActivityRequest(requestId: string): Promise<{
  requestId: string;
  eventId: number | null;
}> {
  const { data, error } = await (supabase as any).rpc("join_activity_request", {
    p_request_id: requestId,
    p_user_id: null,
  });
  if (error) throw error;

  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        request_id: string;
        event_id: number | null;
      }
    | null;

  if (!row) {
    return { requestId, eventId: null };
  }

  return {
    requestId: row.request_id,
    eventId: row.event_id,
  };
}

