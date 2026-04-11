import { useState, useEffect, useCallback } from "react";
import * as profileService from "@/services/profile.ts";
import type { UserProfile, UserEventSummary, BookingSummary } from "@/services/profile.ts";

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [events, setEvents] = useState<{ joined: UserEventSummary[]; organized: UserEventSummary[] }>({ joined: [], organized: [] });
  const [bookings, setBookings] = useState<{
    vehicleBookings: BookingSummary[];
    photographerBookings: BookingSummary[];
    myServiceVehicleBookings: BookingSummary[];
    myServicePhotographerBookings: BookingSummary[];
  }>({
    vehicleBookings: [],
    photographerBookings: [],
    myServiceVehicleBookings: [],
    myServicePhotographerBookings: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!userId) return null;
    return profileService.getCurrentUserProfile(userId);
  }, [userId]);

  const fetchAll = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setEvents({ joined: [], organized: [] });
      setBookings({
        vehicleBookings: [],
        photographerBookings: [],
        myServiceVehicleBookings: [],
        myServicePhotographerBookings: [],
      });
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [p, e, b] = await Promise.all([
        profileService.getCurrentUserProfile(userId),
        profileService.getMyEvents(userId),
        profileService.getMyBookings(userId),
      ]);
      setProfile(p ?? null);
      setEvents(e);
      setBookings(b);
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Failed to load profile"));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const updateProfile = useCallback(
    async (updates: { name?: string; bio?: string | null; phone?: string | null; avatar_url?: string | null }) => {
      if (!userId) throw new Error("Not authenticated");
      await profileService.updateProfile(userId, updates);
      const p = await fetchProfile();
      if (p) setProfile(p);
    },
    [userId, fetchProfile]
  );

  return {
    profile,
    events,
    bookings,
    loading,
    error,
    refetch: fetchAll,
    updateProfile,
  };
}
