import { supabase } from "@/lib/supabase.ts";

export interface ReviewWithUser {
  id: number;
  event_id: number;
  user_id: string;
  user_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export async function getReviewsByEventId(eventId: number): Promise<ReviewWithUser[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("id, event_id, user_id, rating, comment, created_at, users!reviews_user_id_fkey(name)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    event_id: r.event_id,
    user_id: r.user_id,
    user_name: r.users?.name ?? "",
    rating: r.rating,
    comment: r.comment,
    created_at: r.created_at,
  }));
}

export async function createReview(params: {
  event_id: number;
  user_id: string;
  rating: number;
  comment?: string | null;
}): Promise<void> {
  const { error } = await (supabase as any).from("reviews").insert(params);
  if (error) throw error;
}
