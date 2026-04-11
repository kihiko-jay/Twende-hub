import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, MapPin, Users, PlusCircle } from "lucide-react";
import { ACTIVITY_TYPES } from "@/config/activityTypes.ts";
import * as activityRequests from "@/services/activityRequests.ts";
import { useAuth } from "@/contexts/AuthContext";
import { useMeta } from "@/hooks/useMeta.ts";

export default function FindPeople() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activityType, setActivityType] = useState<string>(ACTIVITY_TYPES[0]);
  const [activityDate, setActivityDate] = useState<string>("");
  const [locationName, setLocationName] = useState<string>("");
  const [minPeople, setMinPeople] = useState<number>(4);
  const [maxPeople, setMaxPeople] = useState<number>(10);

  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [requests, setRequests] = useState<activityRequests.ActivityRequestWithMeta[]>([]);
  const [error, setError] = useState<string | null>(null);

  useMeta({
    title: "Find People for Your Next Adventure | Twende",
    description:
      "Quickly find people interested in the same activity at the same time and location, and turn your plan into a Twende event.",
  });

  const canSearch = useMemo(
    () => Boolean(activityType?.trim() && locationName?.trim()),
    [activityType, locationName],
  );

  const handleDetectLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        if (!locationName) {
          setLocationName("My current location");
        }
      },
      () => {
        // silently ignore location errors; user can still type location.
      },
    );
  };

  const handleSearch = async () => {
    if (!canSearch) return;
    setLoading(true);
    setError(null);
    try {
      const items = await activityRequests.listActivityRequests({
        activityType,
        locationName,
      });
      setRequests(items);
    } catch (e: any) {
      setError(
        e?.message ??
          "Could not load matching activity requests. Please try again in a moment.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!user) return;
    if (!activityType?.trim() || !activityDate?.trim() || !locationName?.trim()) {
      setError("Please choose activity, date, and location before creating a request.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const created = await activityRequests.createActivityRequest(user.id, {
        activity_type: activityType.trim(),
        activity_date: activityDate.trim(),
        location_name: locationName.trim(),
        latitude: latitude ?? 0,
        longitude: longitude ?? 0,
        min_people: minPeople,
        max_people: maxPeople,
      } as any);
      navigate(`/activity/${created.id}`, { replace: false });
    } catch (e: any) {
      setError(
        e?.message ??
          "Could not create activity request. Please check your details and try again.",
      );
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (id: string) => {
    setJoiningId(id);
    setError(null);
    try {
      const result = await activityRequests.joinActivityRequest(id);
      if (result.eventId) {
        navigate(`/events/${result.eventId}`);
        return;
      }
      const refreshed = await activityRequests.getActivityRequestById(id);
      if (refreshed) {
        setRequests((prev) =>
          prev.map((r) => (r.id === refreshed.id ? refreshed : r)),
        );
      }
    } catch (e: any) {
      setError(
        e?.message ??
          "Could not join this activity request. It may be full or no longer open.",
      );
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <div className="pt-24 pb-24 bg-warm-off-white min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-olive-drab mb-2">
            Instant Group Adventure
          </p>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-stone-900 mb-3">
            Find People for Your Next Plan
          </h1>
          <p className="text-stone-600 text-sm md:text-base max-w-2xl">
            Choose an activity and location to find other people interested. We&apos;ll show
            matching plans with their dates — and turn a full group into a Twende event.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            {error}
          </div>
        )}

        <div className="card bg-white border border-stone-200 rounded-3xl p-6 md:p-8 mb-10 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">
                Activity
              </label>
              <select
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 text-sm focus:outline-none"
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
              >
                {ACTIVITY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">
                Date
              </label>
              <input
                type="date"
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 text-sm"
                value={activityDate}
                onChange={(e) => setActivityDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">
                Location
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Where are you thinking of going?"
                  className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 text-sm"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  className="shrink-0 px-3 py-2 rounded-xl border border-stone-200 text-stone-500 hover:text-olive-drab hover:border-olive-drab transition-colors"
                >
                  Use GPS
                </button>
              </div>
              <p className="mt-1 text-xs text-stone-400">
                We&apos;ll use your browser location to find people nearby.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">
                  Min people
                </label>
                <input
                  type="number"
                  min={2}
                  max={20}
                  value={minPeople}
                  onChange={(e) => setMinPeople(Math.max(2, Number(e.target.value) || 2))}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">
                  Max people
                </label>
                <input
                  type="number"
                  min={minPeople}
                  max={30}
                  value={maxPeople}
                  onChange={(e) =>
                    setMaxPeople(
                      Math.max(minPeople, Number(e.target.value) || minPeople),
                    )
                  }
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 text-sm"
                />
              </div>
            </div>
            <div className="md:col-span-2 flex flex-col sm:flex-row gap-3 justify-end">
              <button
                type="button"
                onClick={handleSearch}
                disabled={!canSearch || loading}
                className="w-full sm:w-auto rounded-full border border-stone-300 bg-white px-6 py-3 text-sm font-semibold text-stone-800 hover:border-olive-drab hover:text-olive-drab disabled:opacity-50"
              >
                {loading ? "Searching..." : "See Matching Requests"}
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="w-full sm:w-auto olive-button px-6 py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <PlusCircle size={16} />
                <span>{creating ? "Creating..." : "Create New Request"}</span>
              </button>
            </div>
          </div>
        </div>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-serif font-bold text-stone-900">
            Matching Requests
          </h2>
          {loading && requests.length === 0 ? (
            <p className="text-stone-500 text-sm">Looking for nearby plans...</p>
          ) : requests.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-stone-300 bg-white px-6 py-8 text-center text-sm text-stone-500">
              <p className="mb-2 font-medium text-stone-700">
                No matching activity requests yet.
              </p>
              <p>
                Be the first to create one and share it with your WhatsApp groups to fill it
                quickly.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {requests.map((req) => {
                const dateLabel = new Date(req.activity_date).toLocaleDateString("en-KE", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                });
                const participantsLabel =
                  req.people_joined === 1
                    ? "1 participant going"
                    : `${req.people_joined} participants going`;
                const spotsLabel =
                  req.max_people != null
                    ? ` · ${Math.max(0, req.max_people - req.people_joined)} spots left`
                    : "";
                const isConverted = req.status === "converted_to_event" && req.event_id != null;
                return (
                  <div
                    key={req.id}
                    className="card bg-white border border-stone-200 rounded-3xl p-6 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <h3 className="text-lg font-serif font-bold text-stone-900">
                            {req.activity_type} — {req.location_name}
                          </h3>
                          <p className="text-xs uppercase tracking-widest text-olive-drab mt-1">
                            Instant Group Adventure
                          </p>
                        </div>
                        <span className="rounded-full bg-stone-100 text-[10px] font-bold uppercase tracking-widest px-3 py-1 text-stone-600">
                          {isConverted ? "Converted" : "Open"}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-sm text-stone-600">
                        <div className="flex items-center">
                          <Calendar size={16} className="mr-2 text-stone-400" />
                          <span>
                            <span className="text-stone-500">When: </span>
                            <strong className="text-stone-800">{dateLabel}</strong>
                          </span>
                        </div>
                        <div className="flex items-center">
                          <MapPin size={16} className="mr-2 text-stone-400" />
                          <span>{req.location_name}</span>
                        </div>
                        <div className="flex items-center">
                          <Users size={16} className="mr-2 text-stone-400" />
                          <span>
                            <strong>{participantsLabel}</strong>
                            {spotsLabel}
                            {req.min_people > 0 && ` · Min ${req.min_people} to start`}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-stone-100 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/activity/${req.id}`)}
                        className="text-xs text-stone-500 hover:text-stone-800 underline underline-offset-4"
                      >
                        View details
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          isConverted && req.event_id
                            ? navigate(`/events/${req.event_id}`)
                            : handleJoin(req.id)
                        }
                        disabled={joiningId === req.id || isConverted}
                        className="olive-button px-5 py-2 text-sm disabled:opacity-50"
                      >
                        {isConverted
                          ? "View Event"
                          : joiningId === req.id
                          ? "Joining..."
                          : "Join"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

