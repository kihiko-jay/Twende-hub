import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/hooks/useEvents';
import { useVehicleBookingsForEvent, usePhotographerBookingsForEvent } from '@/hooks/useBookings';
import * as eventsService from '@/services/events';
import * as reviewsService from '@/services/reviews';
import * as chatService from '@/services/chat';
import { apiFetch, ApiError } from '@/lib/apiClient.ts';
import { logCriticalAction } from '@/lib/logger.ts';
import { Calendar, MapPin, Users, Share2, CheckCircle, ArrowLeft, Star, MessageSquare, Send, Zap, PlusCircle, Camera, Megaphone, Clock, Flag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useMeta } from "@/hooks/useMeta.ts";
import { shareOrCopy, buildWhatsAppShareUrl } from "@/lib/share.ts";

interface Message {
  id: number;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
}

export default function EventDetail() {
  const { id } = useParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const { event, loading, error, refetch: refetchEvent } = useEvent(id);
  const { vehicleBookings, refetch: refetchVb } = useVehicleBookingsForEvent(id);
  const { photographerBookings, refetch: refetchPb } = usePhotographerBookingsForEvent(id);

  const [reviews, setReviews] = useState<Awaited<ReturnType<typeof reviewsService.getReviewsByEventId>>>([]);
  const [announcements, setAnnouncements] = useState<Awaited<ReturnType<typeof eventsService.getAnnouncements>>>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [joining, setJoining] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'chat' | 'reviews' | 'transport' | 'photography' | 'announcements'>('info');
  const [newMessage, setNewMessage] = useState('');
  const [newAnnouncement, setNewAnnouncement] = useState('');
  const [submittingAnnouncement, setSubmittingAnnouncement] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [participantSearch, setParticipantSearch] = useState("");
  const [participantPaymentFilter, setParticipantPaymentFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [chatAuthError, setChatAuthError] = useState<string | null>(null);
  const [reportedMessageIds, setReportedMessageIds] = useState<number[]>([]);
  const [reportingMessageId, setReportingMessageId] = useState<number | null>(null);
  const [reportReason, setReportReason] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const eventIdNum = id ? parseInt(id, 10) : NaN;

  useEffect(() => {
    if (!id || Number.isNaN(eventIdNum)) return;
    reviewsService.getReviewsByEventId(eventIdNum)
      .then(setReviews)
      .catch((e) => {
        setNetworkError('Unable to load reviews. Please try again.');
        logCriticalAction('load_reviews_failed', { eventId: eventIdNum, error: e });
      });
    eventsService.getAnnouncements(eventIdNum)
      .then(setAnnouncements)
      .catch((e) => {
        setNetworkError('Unable to load announcements. Please try again.');
        logCriticalAction('load_announcements_failed', { eventId: eventIdNum, error: e });
      });
  }, [id, eventIdNum]);

  useEffect(() => {
    if (activeTab !== 'chat' || !user || !id || Number.isNaN(eventIdNum)) return;

    let mounted = true;
    let unsubscribe = () => {};

    chatService
      .fetchMessages(eventIdNum)
      .then((rows) => {
        if (mounted) {
          setMessages(rows);
          setChatAuthError(null);
        }
      })
      .catch(() => {
        if (mounted) setChatAuthError('Could not connect to event chat.');
      });

    unsubscribe = chatService.subscribeToMessages(eventIdNum, (message) => {
      if (!mounted) return;
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [activeTab, id, user, eventIdNum]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newMessage.trim()) return;
    try {
      await chatService.sendMessage(eventIdNum, user.id, newMessage);
      setNewMessage('');
    } catch {
      setChatAuthError('Could not send your message. Please try again.');
    }
  };


  const handleReportMessage = async (messageId: number) => {
    try {
      await chatService.reportMessage(messageId, reportReason);
      setReportedMessageIds((prev) => [...prev, messageId]);
      setReportingMessageId(null);
      setReportReason('');
    } catch {
      setNetworkError('Could not report this message. Please try again.');
    }
  };

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnouncement.trim() || !user || Number.isNaN(eventIdNum)) return;
    setSubmittingAnnouncement(true);
    try {
      const created = await eventsService.createAnnouncement(eventIdNum, newAnnouncement);
      setAnnouncements(prev => [{ id: created.id, event_id: eventIdNum, content: newAnnouncement, created_at: new Date().toISOString() }, ...prev]);
      setNewAnnouncement('');
    } catch (err) {
      setNetworkError('Could not post announcement. Please try again.');
      logCriticalAction('announcement_create_failed', { eventId: eventIdNum, error: err });
    } finally {
      setSubmittingAnnouncement(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || Number.isNaN(eventIdNum)) return;
    setSubmittingReview(true);
    try {
      await reviewsService.createReview({ event_id: eventIdNum, user_id: user.id, rating: reviewRating, comment: reviewComment || null });
      const updated = await reviewsService.getReviewsByEventId(eventIdNum);
      setReviews(updated);
      setReviewComment('');
    } catch (err: any) {
      const isDuplicate = err?.code === '23505' || err?.message?.includes('unique');
      setNetworkError(
        isDuplicate
          ? "You've already submitted a review for this event."
          : 'Could not submit review. Please try again.',
      );
      logCriticalAction('review_create_failed', { eventId: eventIdNum, error: err });
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleFeatureEvent = async () => {
    if (!token) return;
    try {
      const data = await apiFetch<{ checkout_request_id?: string; eventId?: number; type?: string }>('/api/payments/initiate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ event_id: id, type: 'feature' }),
        retryCount: 1,
      });
      if (data.checkout_request_id) {
        navigate(`/payment?event_id=${data.eventId ?? eventIdNum}&type=feature&checkout_request_id=${encodeURIComponent(data.checkout_request_id)}`);
        return;
      }
      setNetworkError('Could not start feature payment. Please try again.');
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Could not start feature payment. Please try again.';
      setNetworkError(msg);
      logCriticalAction('feature_payment_failed', { eventId: id, error: err });
    }
  };

  const handleJoin = async () => {
    if (!user) return navigate('/login');
    if (Number.isNaN(eventIdNum)) return;
    if (event?.participant_fee && event.participant_fee > 0) {
      navigate(`/payment?event_id=${eventIdNum}&type=participant&amount=${event.participant_fee}`);
      return;
    }
    setJoining(true);
    try {
      await eventsService.joinEvent(eventIdNum, user.id);
      refetchEvent();
      refetchVb();
      refetchPb();
    } catch (err) {
      const msg =
        err instanceof Error && /full|capacity/i.test(err.message)
          ? 'This event has reached its maximum capacity.'
          : 'Could not join the event. Please try again.';
      setNetworkError(msg);
      logCriticalAction('event_join_failed', { eventId: eventIdNum, userId: user.id, error: err });
    } finally {
      setJoining(false);
    }
  };

  const handleShare = async () => {
    await shareOrCopy({
      title: event.title,
      text: (event.description ?? "").substring(0, 100) + "...",
      url: window.location.href,
    });
  };

  const handleShareWhatsApp = () => {
    const text = `🔥 ${event.title}\n${event.participants.length} people going, ${seatsLeft} spots left.`;
    const url = window.location.href;
    const waUrl = buildWhatsAppShareUrl({ text, url });
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  if (loading) return <div className="pt-32 text-center">Loading event...</div>;
  if (error) {
    const isNetwork = (error as any).code === 'NETWORK_ERROR' || !navigator.onLine;
    return (
      <div className="pt-32 flex flex-col items-center space-y-4">
        <p className="text-stone-700 font-medium">
          {isNetwork
            ? 'We could not load this event due to a network problem.'
            : 'We could not load this event right now.'}
        </p>
        <button
          onClick={() => refetchEvent()}
          className="olive-button px-6 py-2 text-sm"
        >
          Try again
        </button>
      </div>
    );
  }
  if (!event) return <div className="pt-32 text-center">Event not found.</div>;

  const isJoined = event.participants.some(p => p.id === user?.id);
  const isFull = event.participants.length >= event.max_participants;
  const eventIsPast = new Date(event.date_time) < new Date();
  const hasReviewed = !!(user && reviews.some((r) => r.user_id === user.id));
  const isOrganizer = user?.id === event.organizer_id;
  const totalParticipants = event.participants.length;
  const paidParticipants = event.participants.filter(
    (p: any) => p.payment_status === "confirmed" || p.payment_status === "success",
  ).length;
  const unpaidParticipants = totalParticipants - paidParticipants;
  const seatsLeft = Math.max(0, event.max_participants - totalParticipants);
  const revenueTotal = (event as any).revenue_total ?? 0;

  useMeta({
    title: `${event.title} | TwendeHub`,
    description: event.description ?? "Join an unforgettable adventure with TwendeHub.",
    image: event.cover_image || `https://picsum.photos/seed/${event.id}/1200/630`,
  });

  return (
    <div className="pt-20 pb-24">
      {/* Hero Header */}
      <div className="relative h-[60vh] overflow-hidden">
        <img 
          src={event.cover_image || `https://picsum.photos/seed/${event.id}/1920/1080`} 
          className="w-full h-full object-cover"
          alt={event.title}
          referrerPolicy="no-referrer"
          loading="lazy"
          width={1920}
          height={1080}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
        <div className="absolute bottom-0 left-0 right-0 p-8 md:p-16">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-start mb-6">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center space-x-2 text-white/70 hover:text-white transition-colors"
                type="button"
              >
                <ArrowLeft size={20} />
                <span>Back to events</span>
              </button>
              <button 
                onClick={handleShare}
                className="bg-white/10 backdrop-blur-md border border-white/30 text-white p-3 rounded-full hover:bg-white/20 transition-all"
                title="Share Event"
                aria-label="Share this event"
                type="button"
              >
                <Share2 size={20} />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3 mb-6">
              {event.is_featured && (
                <span className="bg-amber-500 text-black text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">
                  Featured
                </span>
              )}
              <span className="bg-olive-drab text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-widest">
                {event.category}
              </span>
              <span className="bg-white/20 backdrop-blur-md text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-widest border border-white/30">
                {event.participants.length} / {event.max_participants} Joined
              </span>
              {event.avg_rating && (
                <span className="bg-white/20 backdrop-blur-md text-white text-xs font-bold px-4 py-1.5 rounded-full border border-white/30 flex items-center">
                  <Star size={12} className="mr-1 fill-amber-500 text-amber-500" />
                  {event.avg_rating.toFixed(1)} ({event.review_count})
                </span>
              )}
            </div>
            <h1 className="text-5xl md:text-7xl font-serif font-bold text-white mb-4">{event.title}</h1>
            <div className="flex flex-wrap gap-8 text-white/80">
              <div className="flex items-center">
                <Calendar className="mr-2 text-olive-drab" size={20} />
                <span>{new Date(event.date_time).toLocaleString('en-KE', { dateStyle: 'full', timeStyle: 'short' })}</span>
              </div>
              <div className="flex items-center">
                <MapPin className="mr-2 text-olive-drab" size={20} />
                <span>{event.location}</span>
              </div>
              {event.duration && (
                <div className="flex items-center">
                  <Clock className="mr-2 text-olive-drab" size={20} />
                  <span>{event.duration}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
        {networkError && (
          <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            {networkError}
          </div>
        )}
        {isOrganizer && (
          <div className="mb-10 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-white border border-stone-200 p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">
                Participants
              </div>
              <div className="text-2xl font-serif font-bold text-stone-900">
                {totalParticipants} / {event.max_participants}
              </div>
            </div>
            <div className="rounded-2xl bg-white border border-stone-200 p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">
                Paid vs Unpaid
              </div>
              <div className="text-sm text-stone-900">
                <span className="font-semibold text-emerald-600">{paidParticipants} paid</span>
                <span className="text-stone-400 mx-1">/</span>
                <span className="font-semibold text-amber-600">{unpaidParticipants} unpaid</span>
              </div>
            </div>
            <div className="rounded-2xl bg-white border border-stone-200 p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">
                Revenue
              </div>
              <div className="text-2xl font-serif font-bold text-olive-drab">
                KES {Number(revenueTotal).toLocaleString()}
              </div>
            </div>
            <div className="rounded-2xl bg-white border border-stone-200 p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">
                Event Status
              </div>
              <div className="text-sm font-semibold capitalize text-stone-900">
                {event.status === "active" && !eventIsPast ? "Registration Open" : event.status}
              </div>
              <div className="text-xs text-stone-500 mt-1">
                {seatsLeft > 0 ? `${seatsLeft} seats left` : "Event Fully Booked"}
              </div>
            </div>
          </div>
        )}
        {/* Tabs */}
        <div
          className="flex space-x-8 border-b border-stone-200 mb-12"
          role="tablist"
          aria-label="Event details sections"
        >
          <button 
            onClick={() => setActiveTab('info')}
            className={`pb-4 text-lg font-serif font-bold transition-all relative ${activeTab === 'info' ? 'text-olive-drab' : 'text-stone-400 hover:text-stone-600'}`}
            role="tab"
            aria-selected={activeTab === 'info'}
            aria-controls="event-tabpanel-info"
          >
            Info
            {activeTab === 'info' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-olive-drab" />}
          </button>
          {(isJoined || event.organizer_id === user?.id) && (
            <button 
              onClick={() => setActiveTab('chat')}
              className={`pb-4 text-lg font-serif font-bold transition-all relative flex items-center space-x-2 ${activeTab === 'chat' ? 'text-olive-drab' : 'text-stone-400 hover:text-stone-600'}`}
              role="tab"
              aria-selected={activeTab === 'chat'}
              aria-controls="event-tabpanel-chat"
            >
              <MessageSquare size={18} />
              <span>Chat</span>
              {activeTab === 'chat' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-olive-drab" />}
            </button>
          )}
          {event.organizer_id === user?.id && (
            <>
              <button 
                onClick={() => setActiveTab('transport')}
                className={`pb-4 text-lg font-serif font-bold transition-all relative flex items-center space-x-2 ${activeTab === 'transport' ? 'text-olive-drab' : 'text-stone-400 hover:text-stone-600'}`}
                role="tab"
                aria-selected={activeTab === 'transport'}
                aria-controls="event-tabpanel-transport"
              >
                <Zap size={18} />
                <span>Transport</span>
                {activeTab === 'transport' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-olive-drab" />}
              </button>
              <button 
                onClick={() => setActiveTab('photography')}
                className={`pb-4 text-lg font-serif font-bold transition-all relative flex items-center space-x-2 ${activeTab === 'photography' ? 'text-olive-drab' : 'text-stone-400 hover:text-stone-600'}`}
                role="tab"
                aria-selected={activeTab === 'photography'}
                aria-controls="event-tabpanel-photography"
              >
                <Camera size={18} />
                <span>Photography</span>
                {activeTab === 'photography' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-olive-drab" />}
              </button>
            </>
          )}
          <button 
            onClick={() => setActiveTab('announcements')}
            className={`pb-4 text-lg font-serif font-bold transition-all relative flex items-center space-x-2 ${activeTab === 'announcements' ? 'text-olive-drab' : 'text-stone-400 hover:text-stone-600'}`}
            role="tab"
            aria-selected={activeTab === 'announcements'}
            aria-controls="event-tabpanel-announcements"
          >
            <Megaphone size={18} />
            <span>Announcements</span>
            {activeTab === 'announcements' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-olive-drab" />}
          </button>
          <button 
            onClick={() => setActiveTab('reviews')}
            className={`pb-4 text-lg font-serif font-bold transition-all relative ${activeTab === 'reviews' ? 'text-olive-drab' : 'text-stone-400 hover:text-stone-600'}`}
            role="tab"
            aria-selected={activeTab === 'reviews'}
            aria-controls="event-tabpanel-reviews"
          >
            Reviews ({event.review_count})
            {activeTab === 'reviews' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-olive-drab" />}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {activeTab === 'info' && (
                <motion.div 
                  key="info"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-12"
                  role="tabpanel"
                  id="event-tabpanel-info"
                  aria-label="Event information"
                >
                  <section>
                    <h2 className="text-3xl font-serif font-bold text-stone-900 mb-6">About this Adventure</h2>
                    <p className="text-stone-600 text-lg leading-relaxed whitespace-pre-wrap">
                      {event.description}
                    </p>
                  </section>

                  <section>
                    <h2 className="text-3xl font-serif font-bold text-stone-900 mb-3">Participants</h2>
                    <div className="mb-6">
                      <div className="flex items-center justify-between text-sm text-stone-600 mb-2">
                        <span>{totalParticipants} / {event.max_participants} spots filled</span>
                        <span>{Math.max(event.max_participants - totalParticipants, 0)} left</span>
                      </div>
                      <div className="h-2 rounded-full bg-stone-200 overflow-hidden">
                        <div className="h-full bg-olive-drab" style={{ width: `${Math.min((totalParticipants / Math.max(event.max_participants, 1)) * 100, 100)}%` }} />
                      </div>
                    </div>
                    {isOrganizer ? (
                      <div className="space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                          <p className="text-sm text-stone-600">
                            You can search, filter, and export your attendee list for this event.
                          </p>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              placeholder="Search by name or phone"
                              className="bg-stone-50 border border-stone-200 rounded-full px-3 py-2 text-sm"
                              value={participantSearch}
                              onChange={(e) => setParticipantSearch(e.target.value)}
                            />
                            <select
                              className="bg-stone-50 border border-stone-200 rounded-full px-3 py-2 text-sm"
                              value={participantPaymentFilter}
                              onChange={(e) =>
                                setParticipantPaymentFilter(e.target.value as "all" | "paid" | "unpaid")
                              }
                            >
                              <option value="all">All participants</option>
                              <option value="paid">Paid only</option>
                              <option value="unpaid">Unpaid only</option>
                            </select>
                            <button
                              type="button"
                              className="olive-button px-4 py-2 text-sm"
                              onClick={() => {
                                const header = "Name,Email,Phone,Payment Status,Seat\n";
                                const rows = event.participants.map((p: any, idx: number) => {
                                  const status = p.payment_status || "unknown";
                                  const safeName = String(p.name ?? "").replace(/"/g, '""');
                                  const safeEmail = String(p.email ?? "").replace(/"/g, '""');
                                  const safePhone = String(p.phone ?? "").replace(/"/g, '""');
                                  return `"${safeName}","${safeEmail}","${safePhone}","${status}","${idx + 1}"`;
                                });
                                const csv = header + rows.join("\n");
                                const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement("a");
                                link.href = url;
                                link.setAttribute(
                                  "download",
                                  `event-${event.id}-participants.csv`,
                                );
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                URL.revokeObjectURL(url);
                              }}
                            >
                              Export CSV
                            </button>
                          </div>
                        </div>
                        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
                          <table className="min-w-full text-sm">
                            <thead className="bg-stone-50">
                              <tr>
                                <th className="px-4 py-2 text-left font-semibold text-stone-600">
                                  Seat
                                </th>
                                <th className="px-4 py-2 text-left font-semibold text-stone-600">
                                  Name
                                </th>
                                <th className="px-4 py-2 text-left font-semibold text-stone-600">
                                  Phone
                                </th>
                                <th className="px-4 py-2 text-left font-semibold text-stone-600">
                                  Payment Status
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {event.participants
                                .map((p: any, idx: number) => ({ ...p, seat: idx + 1 }))
                                .filter((p: any) => {
                                  const term = participantSearch.toLowerCase().trim();
                                  if (term) {
                                    const nameMatch = String(p.name ?? "")
                                      .toLowerCase()
                                      .includes(term);
                                    const phoneMatch = String(p.phone ?? "")
                                      .toLowerCase()
                                      .includes(term);
                                    if (!nameMatch && !phoneMatch) return false;
                                  }
                                  if (participantPaymentFilter === "paid") {
                                    return (
                                      p.payment_status === "confirmed" ||
                                      p.payment_status === "success"
                                    );
                                  }
                                  if (participantPaymentFilter === "unpaid") {
                                    return !(
                                      p.payment_status === "confirmed" ||
                                      p.payment_status === "success"
                                    );
                                  }
                                  return true;
                                })
                                .map((p: any) => (
                                  <tr key={p.id} className="border-t border-stone-100">
                                    <td className="px-4 py-2 text-stone-500 text-xs">{p.seat}</td>
                                    <td className="px-4 py-2 font-medium text-stone-800">
                                      {p.name}
                                    </td>
                                    <td className="px-4 py-2 text-stone-700">
                                      {p.phone || "—"}
                                    </td>
                                    <td className="px-4 py-2">
                                      {p.payment_status === "confirmed" ||
                                      p.payment_status === "success" ? (
                                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold">
                                          Paid
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-[11px] font-semibold">
                                          Pending
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              {event.participants.length === 0 && (
                                <tr>
                                  <td
                                    className="px-4 py-4 text-center text-stone-400"
                                    colSpan={4}
                                  >
                                    No participants yet.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-4">
                        {event.participants.map(p => (
                          <div key={p.id} className="flex items-center space-x-3 bg-white border border-stone-200 rounded-full px-4 py-2">
                            <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 font-bold text-xs">
                              {p.name.charAt(0)}
                            </div>
                            <span className="text-sm font-medium text-stone-700">{p.name}</span>
                          </div>
                        ))}
                        {event.participants.length === 0 && (
                          <p className="text-stone-400 italic">No participants yet. Be the first to join!</p>
                        )}
                      </div>
                    )}
                  </section>
                </motion.div>
              )}

              {activeTab === 'chat' && (
                <motion.div 
                  key="chat"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="card h-[600px] flex flex-col"
                  role="tabpanel"
                  id="event-tabpanel-chat"
                  aria-label="Event chat"
                >
                  <div className="p-6 border-b border-stone-100 bg-stone-50/50">
                    <h3 className="font-serif font-bold text-xl">Event Chat</h3>
                    <p className="text-xs text-stone-400">Real-time updates for participants</p>
                    {chatAuthError && <p className="mt-2 text-xs text-red-600">{chatAuthError}</p>}
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {messages.map((msg) => (
                      <div key={msg.id} className={`flex flex-col ${msg.user_id === user?.id ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{msg.user_name}</span>
                          <span className="text-[10px] text-stone-300">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {msg.user_id !== user?.id && (
                            <button
                              type="button"
                              className="text-stone-400 hover:text-red-600"
                              onClick={() => setReportingMessageId((curr) => (curr === msg.id ? null : msg.id))}
                              disabled={reportedMessageIds.includes(msg.id)}
                              title={reportedMessageIds.includes(msg.id) ? 'Reported' : 'Report message'}
                            >
                              <Flag size={12} />
                            </button>
                          )}
                        </div>
                        <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${msg.user_id === user?.id ? 'bg-olive-drab text-white rounded-tr-none' : 'bg-stone-100 text-stone-700 rounded-tl-none'}`}>
                          {msg.content}
                        </div>
                        {reportingMessageId === msg.id && msg.user_id !== user?.id && !reportedMessageIds.includes(msg.id) && (
                          <div className="mt-2 w-full max-w-md rounded-2xl border border-stone-200 bg-white p-3 space-y-2">
                            <textarea
                              rows={2}
                              maxLength={200}
                              value={reportReason}
                              onChange={(e) => setReportReason(e.target.value)}
                              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                              placeholder="Why are you reporting this message?"
                            />
                            <div className="flex gap-2 justify-end">
                              <button type="button" className="px-3 py-2 text-xs rounded-full bg-stone-100" onClick={() => setReportingMessageId(null)}>
                                Cancel
                              </button>
                              <button type="button" className="olive-button px-3 py-2 text-xs" onClick={() => handleReportMessage(msg.id)}>
                                Submit report
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                  <form onSubmit={handleSendMessage} className="p-4 border-t border-stone-100 flex space-x-2">
                    <input 
                      type="text"
                      placeholder="Type a message..."
                      className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-olive-drab/20"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="bg-olive-drab text-white p-2 rounded-xl hover:bg-opacity-90 transition-all"
                      aria-label="Send message"
                    >
                      <Send size={20} />
                    </button>
                  </form>
                </motion.div>
              )}

              {activeTab === 'announcements' && (
                <motion.div 
                  key="announcements"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-12"
                  role="tabpanel"
                  id="event-tabpanel-announcements"
                  aria-label="Announcements"
                >
                  {event.organizer_id === user?.id && (
                    <section className="bg-white border border-stone-200 rounded-[32px] p-8">
                      <h3 className="text-2xl font-serif font-bold text-stone-900 mb-6">Post an Update</h3>
                      <form onSubmit={handlePostAnnouncement} className="space-y-4">
                        <textarea 
                          rows={3}
                          required
                          placeholder="Share an update with participants..."
                          className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-olive-drab/20"
                          value={newAnnouncement}
                          onChange={(e) => setNewAnnouncement(e.target.value)}
                        />
                        <button type="submit" disabled={submittingAnnouncement} className="olive-button w-full disabled:opacity-50">
                          {submittingAnnouncement ? 'Posting...' : 'Post Announcement'}
                        </button>
                      </form>
                    </section>
                  )}

                  <div className="space-y-6">
                    {announcements.map((announcement) => (
                      <div key={announcement.id} className="card p-6 border-l-4 border-olive-drab bg-white">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Organizer Update</span>
                          <span className="text-[10px] text-stone-400">{new Date(announcement.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-stone-700 leading-relaxed">{announcement.content}</p>
                      </div>
                    ))}
                    {announcements.length === 0 && (
                      <div className="text-center py-12 text-stone-400 italic">
                        No announcements yet.
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === 'reviews' && (
                <motion.div 
                  key="reviews"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-12"
                  role="tabpanel"
                  id="event-tabpanel-reviews"
                  aria-label="Reviews"
                >
                  {/* Review Form */}
                  {isJoined && eventIsPast && !hasReviewed && (
                    <section className="bg-white border border-stone-200 rounded-[32px] p-8">
                      <h3 className="text-2xl font-serif font-bold text-stone-900 mb-6">Leave a Review</h3>
                      <form onSubmit={handleSubmitReview} className="space-y-6">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">Rating</label>
                          <div className="flex space-x-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button 
                                key={star}
                                type="button"
                                onClick={() => setReviewRating(star)}
                                className={`text-2xl transition-all ${star <= reviewRating ? 'text-amber-500 scale-110' : 'text-stone-300'}`}
                                aria-label={`Rate ${star} out of 5 stars`}
                                aria-pressed={star <= reviewRating}
                              >
                                ★
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">Your Experience</label>
                          <textarea 
                            rows={3}
                            required
                            placeholder="How was the adventure? What did you like?"
                            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-olive-drab/20"
                            value={reviewComment}
                            onChange={(e) => setReviewComment(e.target.value)}
                          />
                        </div>
                        <button type="submit" disabled={submittingReview} className="olive-button w-full disabled:opacity-50">
                          {submittingReview ? 'Submitting...' : 'Post Review'}
                        </button>
                      </form>
                    </section>
                  )}

                  <section className="space-y-8">
                    {reviews.map((review) => (
                      <div key={review.id} className="border-b border-stone-100 pb-8 last:border-0">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 font-bold">
                              {review.user_name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-stone-900">{review.user_name}</div>
                              <div className="text-xs text-stone-400">{new Date(review.created_at).toLocaleDateString()}</div>
                            </div>
                          </div>
                          <div className="flex text-amber-500">
                            {[...Array(5)].map((_, i) => (
                              <span key={i}>{i < review.rating ? '★' : '☆'}</span>
                            ))}
                          </div>
                        </div>
                        <p className="text-stone-600 leading-relaxed">{review.comment}</p>
                      </div>
                    ))}
                    {reviews.length === 0 && (
                      <div className="text-center py-12 text-stone-400 italic">
                        No reviews yet.
                      </div>
                    )}
                  </section>
                </motion.div>
              )}

              {activeTab === 'transport' && (
                <motion.div 
                  key="transport"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-12"
                  role="tabpanel"
                  id="event-tabpanel-transport"
                  aria-label="Transport bookings"
                >
                  <div className="flex justify-between items-center">
                    <h2 className="text-3xl font-serif font-bold text-stone-900">Event Transport</h2>
                    <button 
                      onClick={() => navigate(`/book-transport?eventId=${id}`)}
                      className="olive-button flex items-center gap-2"
                    >
                      <PlusCircle size={18} />
                      <span>Book Transport</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {vehicleBookings.map(booking => (
                      <div key={booking.id} className="card p-6 bg-white shadow-sm border border-stone-100">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-lg font-bold text-stone-900">{booking.make} {booking.model}</h3>
                            <p className="text-stone-500 text-sm">Owner: <span className="text-stone-900 font-medium">{booking.owner_name}</span></p>
                          </div>
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${
                            booking.status === 'pending' ? 'bg-amber-100 text-amber-600' :
                            booking.status === 'accepted' ? 'bg-emerald-100 text-emerald-600' :
                            'bg-red-100 text-red-600'
                          }`}>
                            {booking.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm text-stone-600">
                          <div className="flex items-center gap-2">
                            <Users size={16} />
                            <span>{booking.capacity} seats</span>
                          </div>
                          <div className="font-bold text-stone-900">
                            KES {booking.total_price?.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                    {vehicleBookings.length === 0 && (
                      <div className="md:col-span-2 card p-12 text-center text-stone-400 italic bg-stone-50/50">
                        No vehicles booked for this event yet.
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === 'photography' && (
                <motion.div 
                  key="photography"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-12"
                  role="tabpanel"
                  id="event-tabpanel-photography"
                  aria-label="Photography bookings"
                >
                  <div className="flex justify-between items-center">
                    <h2 className="text-3xl font-serif font-bold text-stone-900">Event Photography</h2>
                    <button 
                      onClick={() => navigate(`/book-photographer?eventId=${id}`)}
                      className="olive-button flex items-center gap-2"
                    >
                      <PlusCircle size={18} />
                      <span>Hire Photographer</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {photographerBookings.map(booking => (
                      <div key={booking.id} className="card p-6 bg-white shadow-sm border border-stone-100">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-lg font-bold text-stone-900">{booking.photographer_name}</h3>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {booking.specialties.split(',').map((s: string) => (
                                <span key={s} className="text-[8px] font-bold uppercase tracking-widest text-stone-400 px-1.5 py-0.5 bg-stone-50 rounded border border-stone-100">{s}</span>
                              ))}
                            </div>
                          </div>
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${
                            booking.status === 'pending' ? 'bg-amber-100 text-amber-600' :
                            booking.status === 'accepted' ? 'bg-emerald-100 text-emerald-600' :
                            'bg-red-100 text-red-600'
                          }`}>
                            {booking.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm text-stone-600">
                          <div className="flex items-center gap-2">
                            <Camera size={16} />
                            <span>Contracted</span>
                          </div>
                          <div className="font-bold text-stone-900">
                            KES {booking.total_price?.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                    {photographerBookings.length === 0 && (
                      <div className="md:col-span-2 card p-12 text-center text-stone-400 italic bg-stone-50/50">
                        No photographers hired for this event yet.
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            <div className="card p-8 sticky top-32">
              <div className="flex justify-between items-center mb-8">
                <div className="text-stone-500 font-medium">Price per person</div>
                <div className="text-3xl font-serif font-bold text-olive-drab">
                  {event.participant_fee > 0 ? `KES ${event.participant_fee.toLocaleString()}` : 'FREE'}
                </div>
              </div>

              {isJoined ? (
                <div className="bg-green-50 border border-green-100 rounded-2xl p-6 text-center mb-6">
                  <CheckCircle className="mx-auto text-green-500 mb-2" size={32} />
                  <div className="text-green-800 font-bold">You're going!</div>
                  <div className="text-green-600 text-sm">See you at the event.</div>
                </div>
              ) : (
                <button 
                  onClick={handleJoin}
                  disabled={joining || isFull}
                  className="olive-button w-full py-4 text-lg mb-6 disabled:opacity-50"
                >
                  {joining ? 'Joining...' : isFull ? 'Event Fully Booked' : 'Join Adventure'}
                </button>
              )}

              {user?.id === event.organizer_id && event.is_featured === 0 && (
                <button 
                  onClick={handleFeatureEvent}
                  className="w-full bg-amber-50 border border-amber-200 text-amber-700 rounded-2xl p-4 mb-6 flex items-center justify-center space-x-2 hover:bg-amber-100 transition-all"
                >
                  <Zap size={18} className="fill-amber-500" />
                  <span className="font-bold">Feature this Event (KES 500)</span>
                </button>
              )}

              <div className="space-y-2">
                <button 
                  onClick={handleShare}
                  className="w-full flex items-center justify-center space-x-2 text-stone-500 hover:text-stone-900 transition-colors py-2"
                  type="button"
                  aria-label="Share this event with friends"
                >
                  <Share2 size={18} />
                  <span>Share with friends</span>
                </button>
                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="w-full text-sm text-emerald-600 hover:text-emerald-700 underline underline-offset-4"
                >
                  Share via WhatsApp
                </button>
              </div>

              <div className="mt-8 pt-8 border-t border-stone-100">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center text-olive-drab font-bold text-xl">
                    {event.organizer_name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest text-stone-400">Organized by</div>
                    <div className="text-stone-900 font-bold">{event.organizer_name}</div>
                  </div>
                </div>
                <p className="mt-4 text-[10px] uppercase tracking-[0.25em] text-stone-400">
                  Powered by Twende
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
