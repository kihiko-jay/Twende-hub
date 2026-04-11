import { useState, useEffect, useCallback } from "react";
import * as eventsService from "@/services/events.ts";
import type { EventWithMeta } from "@/services/events.ts";
import type { EventListFilters } from "@/services/events.ts";

export function useEvents(filters: EventListFilters = {}) {
  const [events, setEvents] = useState<EventWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchPage = useCallback(
    async (reset = false) => {
      if (reset) {
        setEvents([]);
        setCursor(null);
        setHasMore(true);
      }
      if (!hasMore && !reset) return;

      setLoading(true);
      setError(null);
      try {
        const { events: page, nextCursor } = await eventsService.listEvents(filters, {
          limit: 12,
          cursor: reset ? null : cursor,
        });
        setEvents((prev) => (reset ? page : [...prev, ...page]));
        setCursor(nextCursor);
        setHasMore(nextCursor !== null);
      } catch (e) {
        setError(e instanceof Error ? e : new Error("Failed to load events"));
      } finally {
        setLoading(false);
      }
    },
    [
      cursor,
      hasMore,
      filters.category,
      filters.type,
      filters.search,
      filters.featured,
      filters.startDate,
      filters.endDate,
      filters.minCapacity,
      filters.maxCapacity,
    ],
  );

  useEffect(() => {
    fetchPage(true);
  }, [fetchPage]);

  return { events, loading, error, fetchMore: () => fetchPage(false), hasMore, refetch: () => fetchPage(true) };
}

export function useFeaturedEvents() {
  const [events, setEvents] = useState<EventWithMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    eventsService.listEvents({ featured: true }).then((data) => {
      if (mounted) setEvents(data);
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  return { featuredEvents: events, loading };
}

export function useEvent(id: string | undefined) {
  const [event, setEvent] = useState<Awaited<ReturnType<typeof eventsService.getEventById>>>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await eventsService.getEventById(id, undefined);
      setEvent(data);
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Failed to load event"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) {
      setEvent(null);
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    setError(null);
    eventsService.getEventById(id, undefined).then((data) => {
      if (mounted) setEvent(data);
    }).catch((e) => {
      if (mounted) setError(e instanceof Error ? e : new Error("Failed to load event"));
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [id]);

  return { event, loading, error, refetch };
}
