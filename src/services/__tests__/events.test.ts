import { describe, it, expect, vi } from "vitest";
import { supabase } from "@/lib/supabase.ts";
import { listEvents, joinEvent } from "@/services/events.ts";

vi.mock("@/lib/supabase.ts");

const mockedSupabase = supabase as any;

describe("events service", () => {
  it("listEvents applies base active status filter", async () => {
    const select = vi.fn().mockReturnThis();
    const eq = vi.fn().mockReturnThis();
    const order = vi.fn().mockReturnThis();
    const limit = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });

    mockedSupabase.from.mockReturnValue({
      select,
      eq,
      order,
      limit,
    });

    await listEvents();
    expect(eq).toHaveBeenCalledWith("status", "active");
  });

  it("listEvents applies category and search filters", async () => {
    const select = vi.fn().mockReturnThis();
    const eq = vi.fn().mockReturnThis();
    const or = vi.fn().mockReturnThis();
    const order = vi.fn().mockReturnThis();
    const limit = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });

    mockedSupabase.from.mockReturnValue({
      select,
      eq,
      or,
      order,
      limit,
    });

    await listEvents({ category: "hiking", search: "mt kenya" });

    expect(eq).toHaveBeenCalledWith("category", "hiking");
    expect(or).toHaveBeenCalledWith(
      "title.ilike.%mt kenya%,description.ilike.%mt kenya%",
    );
  });

  it("joinEvent calls create_attendee_booking_v2 and transition_booking_to_confirmed", async () => {
    mockedSupabase.rpc
      .mockResolvedValueOnce({
        data: { id: 123 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: null,
      });

    await joinEvent(10, "u1");

    expect(mockedSupabase.rpc).toHaveBeenNthCalledWith(1, "create_attendee_booking_v2", {
      p_event_id: 10,
    });
    expect(mockedSupabase.rpc).toHaveBeenNthCalledWith(2, "transition_booking_to_confirmed", {
      p_participant_id: 123,
      p_payment_id: null,
    });
  });
});

