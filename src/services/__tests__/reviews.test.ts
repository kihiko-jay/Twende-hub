import { describe, it, expect, vi } from "vitest";
import { supabase } from "@/lib/supabase.ts";
import {
  getReviewsByEventId,
  createReview,
} from "@/services/reviews.ts";

vi.mock("@/lib/supabase.ts");

const mockedSupabase = supabase as any;

describe("reviews service", () => {
  it("getReviewsByEventId returns mapped reviews on happy path", async () => {
    const select = vi.fn().mockReturnThis();
    const eq = vi.fn().mockReturnThis();
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          id: 1,
          event_id: 10,
          user_id: "u1",
          rating: 5,
          comment: "Great",
          created_at: "2024-01-01T00:00:00Z",
          users: { name: "Alice" },
        },
      ],
      error: null,
    });

    mockedSupabase.from.mockReturnValue({ select, eq, order });

    const result = await getReviewsByEventId(10);
    expect(result).toHaveLength(1);
    expect(result[0].user_name).toBe("Alice");
  });

  it("getReviewsByEventId throws on error", async () => {
    const select = vi.fn().mockReturnThis();
    const eq = vi.fn().mockReturnThis();
    const order = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "load error" },
    });

    mockedSupabase.from.mockReturnValue({ select, eq, order });

    await expect(getReviewsByEventId(10)).rejects.toThrow("load error");
  });

  it("createReview inserts correct shape", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    mockedSupabase.from.mockReturnValue({ insert });

    await createReview({
      event_id: 10,
      user_id: "u1",
      rating: 4,
      comment: "Nice",
    });

    expect(mockedSupabase.from).toHaveBeenCalledWith("reviews");
    expect(insert).toHaveBeenCalledWith({
      event_id: 10,
      user_id: "u1",
      rating: 4,
      comment: "Nice",
    });
  });
});

