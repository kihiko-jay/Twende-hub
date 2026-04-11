import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Calendar, MapPin, Users, Share2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import * as activityRequests from "@/services/activityRequests.ts";
import { useMeta } from "@/hooks/useMeta.ts";
import { shareOrCopy, buildWhatsAppShareUrl } from "@/lib/share.ts";

export default function ActivityRequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [request, setRequest] =
    useState<activityRequests.ActivityRequestWithMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await activityRequests.getActivityRequestById(id);
        if (!cancelled) {
          setRequest(data);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(
            e?.message ?? "Could not load this activity request. Please try again later.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useMeta({
    title: request
      ? `${request.activity_type} — ${request.location_name} | Twende`
      : "Activity Request | Twende",
    description: request
      ? `Join a group for ${request.activity_type} at ${request.location_name}.`
      : "Find people interested in the same activity and turn it into a Twende event.",
    url:
      typeof window !== "undefined"
        ? window.location.href
        : `https://twende.app${location.pathname}`,
  });

  const handleJoin = async () => {
    if (!id) return;
    if (!user) {
      navigate("/login", { state: { from: location } });
      return;
    }
    setJoining(true);
    setError(null);
    try {
      const result = await activityRequests.joinActivityRequest(id);
      if (result.eventId) {
        navigate(`/events/${result.eventId}`);
        return;
      }
      const refreshed = await activityRequests.getActivityRequestById(id);
      setRequest(refreshed);
    } catch (e: any) {
      setError(
        e?.message ??
          "Could not join this activity request. It may be full or no longer open.",
      );
    } finally {
      setJoining(false);
    }
  };

  const handleShare = async () => {
    if (!request || !id) return;
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://twende.app";
    const url = `${origin}/activity/${id}`;
    await shareOrCopy({
      title: `${request.activity_type} — ${request.location_name}`,
      text: "Join this plan on Twende:",
      url,
    });
  };

  const handleShareWhatsApp = () => {
    if (!request || !id) return;
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://twende.app";
    const url = `${origin}/activity/${id}`;
    const text = `🔥 ${request.activity_type} at ${request.location_name}\n${request.people_joined} people joined, ${Math.max(
      0,
      request.max_people - request.people_joined,
    )} spots left.`;
    const waUrl = buildWhatsAppShareUrl({ text, url });
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return <div className="pt-32 text-center text-stone-600">Loading plan...</div>;
  }

  if (!request) {
    return (
      <div className="pt-32 text-center text-stone-600">
        We couldn&apos;t find this activity request.
      </div>
    );
  }

  const dateLabel = new Date(request.activity_date).toLocaleDateString("en-KE", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const seatsLeft = Math.max(0, request.max_people - request.people_joined);
  const isCreator = user?.id === request.creator_id;
  const isMember = !!request.members.find((m) => m.user_id === user?.id);
  const isConverted = request.status === "converted_to_event" && request.event_id != null;

  return (
    <div className="pt-24 pb-24 bg-warm-off-white min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            {error}
          </div>
        )}

        <div className="card bg-white border border-stone-200 rounded-3xl p-6 md:p-8 mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-olive-drab mb-2">
                Instant Group Adventure
              </p>
              <h1 className="text-2xl md:text-3xl font-serif font-bold text-stone-900">
                {request.activity_type} — {request.location_name}
              </h1>
            </div>
            <button
              type="button"
              onClick={handleShare}
              className="bg-stone-100 text-stone-700 p-2 rounded-full hover:bg-stone-200 transition-colors"
              aria-label="Share this plan"
            >
              <Share2 size={18} />
            </button>
          </div>

          <div className="space-y-2 text-sm text-stone-700 mb-4">
            <div className="flex items-center">
              <Calendar size={16} className="mr-2 text-stone-400" />
              <span>{dateLabel}</span>
            </div>
            <div className="flex items-center">
              <MapPin size={16} className="mr-2 text-stone-400" />
              <span>{request.location_name}</span>
            </div>
            <div className="flex items-center">
              <Users size={16} className="mr-2 text-stone-400" />
              <span>
                <strong>{request.people_joined}</strong> participant{request.people_joined !== 1 ? "s" : ""} going
                {request.max_people != null && (
                  <> · {seatsLeft} spot{seatsLeft !== 1 ? "s" : ""} left</>
                )}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="text-xs text-stone-500">
              {isConverted && request.event_id ? (
                <span>
                  This group has been converted into a Twende event.{" "}
                  <button
                    type="button"
                    onClick={() => navigate(`/events/${request.event_id}`)}
                    className="text-olive-drab font-semibold underline underline-offset-2"
                  >
                    View event
                  </button>
                </span>
              ) : (
                <span>
                  Once at least {request.min_people} people join, we&apos;ll automatically
                  create a Twende event and move everyone there.
                </span>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="w-full sm:w-auto rounded-full bg-green-500 text-white px-5 py-2 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-green-600 transition-colors"
              >
                <span>Share via WhatsApp</span>
              </button>
              {!isConverted && (
                <button
                  type="button"
                  onClick={handleJoin}
                  disabled={joining || isMember}
                  className="w-full sm:w-auto olive-button px-5 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  {joining ? "Joining..." : isMember ? "You’ve joined" : "Join this plan"}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="card bg-white border border-stone-200 rounded-3xl p-6 md:p-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-serif font-bold text-stone-900">
              People in this plan
              <span className="ml-2 font-normal text-stone-500">
                ({request.people_joined} participant{request.people_joined !== 1 ? "s" : ""})
              </span>
            </h2>
            {isCreator && (
              <span className="text-xs text-stone-400">
                You created this activity request.
              </span>
            )}
          </div>
          {request.members.length === 0 ? (
            <p className="text-sm text-stone-500">
              No one has joined yet. Share this link in your WhatsApp groups to get the
              first few people in.
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {request.members.map((member) => {
                const displayName =
                  member.users?.name?.trim() ||
                  (member.user_id === request.creator_id ? "Organizer" : "Participant");
                const initials =
                  member.users?.name
                    ?.split(/\s+/)
                    .map((s) => s[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase() || member.user_id.slice(0, 2).toUpperCase();
                const isCreator = member.user_id === request.creator_id;
                return (
                  <div
                    key={member.id}
                    className="flex items-center space-x-3 bg-stone-50 border border-stone-200 rounded-full px-4 py-2 text-sm"
                  >
                    <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-stone-700 text-xs font-bold">
                      {initials}
                    </div>
                    <span className="text-stone-700">
                      {displayName}
                      {isCreator && (
                        <span className="ml-1.5 text-xs font-medium text-olive-drab">(Organizer)</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] uppercase tracking-[0.25em] text-stone-400">
          Powered by Twende
        </p>
      </div>
    </div>
  );
}

