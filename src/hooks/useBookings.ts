import { useState, useEffect, useCallback } from "react";
import * as bookingsService from "@/services/bookings.ts";

export function useVehicleBookingsForEvent(eventId: string | number | undefined) {
  const [bookings, setBookings] = useState<Awaited<ReturnType<typeof bookingsService.getVehicleBookingsForEvent>>>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (eventId === undefined) return;
    const id = typeof eventId === "string" ? parseInt(eventId, 10) : eventId;
    if (Number.isNaN(id)) {
      setBookings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await bookingsService.getVehicleBookingsForEvent(id);
      setBookings(data);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { vehicleBookings: bookings, loading, refetch: fetch };
}

export function usePhotographerBookingsForEvent(eventId: string | number | undefined) {
  const [bookings, setBookings] = useState<Awaited<ReturnType<typeof bookingsService.getPhotographerBookingsForEvent>>>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (eventId === undefined) return;
    const id = typeof eventId === "string" ? parseInt(eventId, 10) : eventId;
    if (Number.isNaN(id)) {
      setBookings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await bookingsService.getPhotographerBookingsForEvent(id);
      setBookings(data);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { photographerBookings: bookings, loading, refetch: fetch };
}
