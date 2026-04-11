import type React from 'react';
import { useState, useMemo, useEffect, type Dispatch, type SetStateAction } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  MapPin,
  Users,
  Search,
  Filter,
  X,
  Navigation,
  Clock,
  AlertTriangle,
  MessageCircle,
  CreditCard,
  ClipboardList,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useEvents, useFeaturedEvents } from '@/hooks/useEvents';
import EmptyState from '@/components/EmptyState.tsx';
import { useMeta } from "@/hooks/useMeta.ts";
import type { EventWithMeta } from '@/services/events.ts';

type UpcomingEventsProps = {
  events: EventWithMeta[];
  loading: boolean;
  hasMore: boolean;
  fetchMore: () => void;
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  category: string;
  setCategory: Dispatch<SetStateAction<string>>;
  type: string;
  setType: Dispatch<SetStateAction<string>>;
  startDate: string;
  setStartDate: Dispatch<SetStateAction<string>>;
  endDate: string;
  setEndDate: Dispatch<SetStateAction<string>>;
  minCapacity: string;
  setMinCapacity: Dispatch<SetStateAction<string>>;
  maxCapacity: string;
  setMaxCapacity: Dispatch<SetStateAction<string>>;
  radius: string;
  setRadius: Dispatch<SetStateAction<string>>;
  userLocation: { lat: number; lng: number } | null;
  handleGetLocation: () => void;
  showFilters: boolean;
  setShowFilters: Dispatch<SetStateAction<boolean>>;
  clearFilters: () => void;
  renderStars: (rating: number | null) => React.ReactNode;
};

function scrollToUpcoming() {
  const el = document.getElementById('upcoming-events');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function LandingHero() {
  return (
    <section className="relative overflow-hidden bg-stone-900 text-white">
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=2070"
          className="w-full h-full object-cover brightness-75"
          alt="Hiking group on a mountain trail"
          referrerPolicy="no-referrer"
          fetchPriority="high"
          width={2070}
          height={1200}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/20" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-24">
        <div className="max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <p className="text-olive-drab text-xs font-bold uppercase tracking-[0.25em] mb-4">
              Built for outdoor organizers
            </p>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-serif font-bold leading-tight mb-6">
              Run Professional Outdoor Events
              <br />
              <span className="italic font-light text-stone-100">
                Without Spreadsheet Chaos
              </span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl max-w-2xl mb-8 text-stone-200">
              Create hiking trips, manage participants, collect payments, and organize unforgettable
              outdoor adventures — all in one platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <Link
                to="/create-event"
                className="olive-button text-base sm:text-lg px-8 sm:px-10 py-3 sm:py-4 w-full sm:w-auto text-center"
              >
                Create Your Event
              </Link>
              <Link
                to="/find-people"
                className="w-full sm:w-auto bg-white text-stone-900 rounded-full px-8 sm:px-10 py-3 sm:py-4 text-base sm:text-lg hover:bg-stone-100 transition-all text-center font-medium border border-white/40"
              >
                Find People
              </Link>
              <button
                type="button"
                onClick={scrollToUpcoming}
                className="w-full sm:w-auto bg-white/10 backdrop-blur-md border border-white/30 text-white rounded-full px-8 sm:px-10 py-3 sm:py-4 text-base sm:text-lg hover:bg-white/20 transition-all text-center"
              >
                Explore Upcoming Trips
              </button>
            </div>
            <p className="text-sm sm:text-base text-stone-300">
              Perfect for hiking organizers, outdoor communities, and adventure groups.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function ProblemSection() {
  const problems = [
    {
      icon: CreditCard,
      title: 'Tracking payments manually on M-Pesa',
      description: 'Endless screenshots, mismatched amounts, and no single source of truth.',
    },
    {
      icon: MessageCircle,
      title: 'Managing participants in WhatsApp groups',
      description: 'Threads disappear, details are lost, and new joiners miss key information.',
    },
    {
      icon: ClipboardList,
      title: 'Confirming who has paid and who hasn’t',
      description: 'Spreadsheets get messy fast when trips sell out or plans change.',
    },
    {
      icon: AlertTriangle,
      title: 'Overbooking and last‑minute cancellations',
      description: 'Manual tracking makes it easy to double‑book or miss important updates.',
    },
  ];

  return (
    <section className="py-20 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-10 md:mb-12">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-stone-900 mb-4">
            Organizing Outdoor Events Shouldn&apos;t Be This Hard
          </h2>
          <p className="text-stone-600 text-base md:text-lg">
            Most hiking organizers are stuck juggling spreadsheets, WhatsApp groups, and M-Pesa
            confirmations just to fill a single trip.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {problems.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="card flex items-start gap-4 p-5 md:p-6 bg-stone-50 border border-stone-200"
            >
              <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-olive-drab/10 text-olive-drab">
                <Icon size={20} />
              </div>
              <div>
                <h3 className="text-base md:text-lg font-semibold text-stone-900 mb-1">
                  {title}
                </h3>
                <p className="text-sm md:text-base text-stone-600">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SolutionSection() {
  const features = [
    {
      title: 'Create Events Easily',
      description:
        'Set up hiking trips, set capacity, and publish your event in minutes — not hours.',
    },
    {
      title: 'Manage Participants',
      description:
        'See registrations and payment status in a single dashboard so you always know who is confirmed.',
    },
    {
      title: 'Collect Payments Automatically',
      description:
        'Stop chasing M-Pesa screenshots. Payments are tracked and matched to participants automatically.',
    },
    {
      title: 'Fill Your Trips Faster',
      description:
        'Participants can discover and join your adventures directly from Twende, without friction.',
    },
  ];

  return (
    <section className="py-20 md:py-24 bg-warm-off-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-10 md:mb-12">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-stone-900 mb-4">
            Twende Handles the Hard Part
          </h2>
          <p className="text-stone-600 text-base md:text-lg">
            From the first idea to the last participant check‑in, Twende gives you a calm,
            organized way to run outdoor events.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {features.map((feature) => (
            <div key={feature.title} className="card p-5 md:p-6 bg-white border border-stone-200">
              <h3 className="text-lg md:text-xl font-serif font-semibold text-stone-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-sm md:text-base text-stone-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      step: 'Step 1',
      title: 'Organizer creates an event',
      description:
        'Set the route, capacity, pricing, and trip details from a simple event creation form.',
    },
    {
      step: 'Step 2',
      title: 'Participants register and book seats',
      description:
        'Your community and new explorers discover your trip and secure their spots online.',
    },
    {
      step: 'Step 3',
      title: 'Payments are confirmed automatically',
      description:
        'Twende tracks M-Pesa payments so you always know who has paid — no spreadsheets.',
    },
    {
      step: 'Step 4',
      title: 'Organizer manages participants from the dashboard',
      description:
        'See confirmed, pending, and cancelled participants at a glance before you hit the trail.',
    },
  ];

  return (
    <section className="py-20 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-10 md:mb-12">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-stone-900 mb-4">
            How Twende Works
          </h2>
          <p className="text-stone-600 text-base md:text-lg">
            A simple flow that keeps both organizers and participants in sync at every step.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-8">
          {steps.map((item, index) => (
            <div
              key={item.step}
              className="card h-full p-5 md:p-6 bg-warm-off-white border border-stone-200 flex flex-col"
            >
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-olive-drab mb-2">
                {item.step}
              </div>
              <h3 className="text-lg font-serif font-semibold text-stone-900 mb-2">
                {item.title}
              </h3>
              <p className="text-sm md:text-base text-stone-600 flex-1">{item.description}</p>
              <div className="mt-4 text-sm text-stone-400">0{index + 1}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function UpcomingEvents({
  events,
  loading,
  hasMore,
  fetchMore,
  search,
  setSearch,
  category,
  setCategory,
  type,
  setType,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  minCapacity,
  setMinCapacity,
  maxCapacity,
  setMaxCapacity,
  radius,
  setRadius,
  userLocation,
  handleGetLocation,
  showFilters,
  setShowFilters,
  clearFilters,
  renderStars,
}: UpcomingEventsProps) {
  return (
    <section id="upcoming-events" className="py-20 md:py-24 bg-warm-off-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-12 gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-olive-drab mb-2">
              For participants
            </p>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-stone-900 mb-3">
              Upcoming Adventures
            </h2>
            <p className="text-stone-600 text-sm md:text-base max-w-xl">
              Hiking events, outdoor trips, and team adventures hosted by organizers using Twende.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
                size={18}
              />
              <input
                type="text"
                placeholder="Search adventures..."
                className="w-full bg-white border border-stone-200 rounded-full pl-12 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-olive-drab/20"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center justify-center gap-2 px-6 py-2 rounded-full border text-sm font-medium transition-all ${
                showFilters
                  ? 'bg-olive-drab border-olive-drab text-white'
                  : 'bg-white border-stone-200 text-stone-600 hover:border-olive-drab'
              }`}
              type="button"
            >
              <Filter size={18} />
              <span>Filters</span>
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-10"
            >
              <div className="card p-6 md:p-8 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 bg-white shadow-sm">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">
                    Category
                  </label>
                  <select
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 focus:outline-none text-sm"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">All Categories</option>
                    <option>Hiking</option>
                    <option>Road Trip</option>
                    <option>Photography</option>
                    <option>Team Building</option>
                    <option>Camping</option>
                    <option>Cycling</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">
                    Event Type
                  </label>
                  <select
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 focus:outline-none text-sm"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    <option value="">All Types</option>
                    <option>Group</option>
                    <option>Solo</option>
                    <option>Family</option>
                    <option>Workshop</option>
                    <option>Competition</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">
                    Date Range
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 text-sm"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                    <span className="text-stone-400">-</span>
                    <input
                      type="date"
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 text-sm"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">
                    Capacity
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 text-sm"
                      value={minCapacity}
                      onChange={(e) => setMinCapacity(e.target.value)}
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 text-sm"
                      value={maxCapacity}
                      onChange={(e) => setMaxCapacity(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">
                    Radius (km)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Distance"
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 text-sm"
                      value={radius}
                      onChange={(e) => setRadius(e.target.value)}
                    />
                    <button
                      onClick={handleGetLocation}
                      className={`p-2 rounded-xl border transition-all ${
                        userLocation
                          ? 'bg-olive-drab border-olive-drab text-white'
                          : 'bg-white border-stone-200 text-stone-400 hover:text-olive-drab'
                      }`}
                      title="Use current location"
                      aria-label="Use current location for nearby events"
                      type="button"
                    >
                      <Navigation size={18} />
                    </button>
                  </div>
                </div>
                <div className="md:col-span-3 lg:col-span-5 flex justify-end gap-4 pt-4 border-t border-stone-100">
                  <button
                    onClick={clearFilters}
                    className="text-stone-400 hover:text-stone-600 text-xs md:text-sm font-medium flex items-center gap-2"
                    type="button"
                  >
                    <X size={16} />
                    <span>Clear All</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {loading && events.length === 0 ? (
          <EmptyState
            title="Loading adventures..."
            description="Fetching the latest hikes and outdoor trips from organisers."
          />
        ) : (
          <>
            {events.length === 0 ? (
              <EmptyState
                title="No adventures found"
                description="Try adjusting your filters or check back soon for new trips."
                action={{ label: "Clear filters", onClick: clearFilters }}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                {events.map((event) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                  >
                    <Link to={`/events/${event.id}`} className="group block h-full">
                      <div className="card h-full group-hover:shadow-xl transition-all duration-300 flex flex-col">
                        <div className="h-56 overflow-hidden relative">
                          <img
                            src={event.cover_image || `https://picsum.photos/seed/${event.id}/800/600`}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            alt={event.title}
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            width={800}
                            height={600}
                          />
                          <div className="absolute top-4 left-4 flex gap-2">
                            <span className="bg-white/90 backdrop-blur-sm text-olive-drab text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">
                              {event.category}
                            </span>
                            <span className="bg-stone-900/80 backdrop-blur-sm text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">
                              {event.type}
                            </span>
                          </div>
                        </div>
                        <div className="p-5 md:p-6 flex-1 flex flex-col">
                          <div className="flex justify-between items-start mb-3 gap-3">
                            <h3 className="text-xl md:text-2xl font-serif font-bold text-stone-900 group-hover:text-olive-drab transition-colors">
                              {event.title}
                            </h3>
                            {renderStars(event.avg_rating ?? null)}
                          </div>
                          <div className="space-y-1.5 mb-4 text-sm text-stone-500">
                            <div className="flex items-center">
                              <Calendar size={16} className="mr-2" />
                              <span>
                                {new Date(event.date_time).toLocaleDateString('en-KE', {
                                  dateStyle: 'long',
                                })}
                              </span>
                            </div>
                            <div className="flex items-center">
                              <MapPin size={16} className="mr-2" />
                              <span>{event.location}</span>
                            </div>
                            <div className="flex items-center">
                              <Users size={16} className="mr-2" />
                              <span>Max {event.max_participants} people</span>
                            </div>
                            {event.duration && (
                              <div className="flex items-center">
                                <Clock size={16} className="mr-2" />
                                <span>{event.duration}</span>
                              </div>
                            )}
                          </div>
                          <div className="mt-auto flex justify-between items-center pt-4 border-t border-stone-100">
                            <div className="text-stone-400 text-xs">
                              By{' '}
                              <span className="text-stone-700 font-medium">
                                {event.organizer_name ?? 'Organizer'}
                              </span>
                            </div>
                            <div className="text-olive-drab font-bold text-sm">
                              {event.participant_fee > 0
                                ? `KES ${event.participant_fee.toLocaleString()}`
                                : 'FREE'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}

            <div className="mt-10 flex flex-col items-center gap-4">
              {hasMore && (
                <button
                  onClick={fetchMore}
                  className="px-8 py-3 rounded-full border border-stone-300 bg-white text-stone-700 text-sm font-medium hover:border-olive-drab hover:text-olive-drab transition-all disabled:opacity-50"
                  disabled={loading}
                  type="button"
                >
                  {loading ? 'Loading more...' : 'Load more adventures'}
                </button>
              )}
              <button
                type="button"
                onClick={scrollToUpcoming}
                className="text-xs md:text-sm text-stone-500 hover:text-stone-700 underline-offset-4 hover:underline"
              >
                Explore all events
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function OrganizerCTA() {
  return (
    <section className="py-20 md:py-24 bg-stone-900 text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">
          Run Your Next Adventure With Twende
        </h2>
        <p className="text-sm md:text-base text-stone-200 mb-8 max-w-2xl mx-auto">
          Twende helps outdoor organizers run professional events without the administrative chaos.
          Focus on the trail — we&apos;ll handle the logistics, payments, and participant tracking.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/create-event"
            className="olive-button px-8 sm:px-10 py-3 sm:py-4 text-base sm:text-lg w-full sm:w-auto text-center"
          >
            Start Organizing Today
          </Link>
          <button
            type="button"
            onClick={scrollToUpcoming}
            className="w-full sm:w-auto rounded-full border border-white/30 px-8 sm:px-10 py-3 sm:py-4 text-sm sm:text-base font-medium text-white bg-white/5 hover:bg-white/10 transition-all"
          >
            Learn How It Works
          </button>
        </div>
      </div>
    </section>
  );
}

function SocialProof() {
  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between gap-8 md:gap-12 items-start">
          <div className="max-w-md">
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-stone-900 mb-3">
              Trusted by Outdoor Communities
            </h2>
            <p className="text-stone-600 text-sm md:text-base">
              Twende is built together with hiking clubs, outdoor communities, and organizers who
              need a reliable way to run trips every weekend.
            </p>
          </div>
          <div className="flex-1">
            <div className="card p-5 md:p-6 bg-warm-off-white border border-stone-200 mb-4">
              <p className="text-stone-700 text-sm md:text-base italic">
                &quot;Twende made managing our hikes much easier. No more payment confusion or
                guessing who actually confirmed their slot.&quot;
              </p>
              <p className="mt-3 text-xs md:text-sm text-stone-500">
                — Future organizer testimonial (placeholder)
              </p>
            </div>
            <p className="text-[11px] md:text-xs text-stone-400">
              Space for organiser testimonials, participant feedback, and community logos will live
              here as Twende grows.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="border-t border-stone-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-12">
        <div className="flex flex-col md:flex-row justify-between gap-8 md:gap-12">
          <div>
            <h3 className="text-lg font-serif font-bold text-stone-900 mb-2">Twende</h3>
            <p className="text-sm text-stone-600 max-w-xs">
              The easiest way to run professional outdoor events and help more people get outside.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 text-sm">
            <div className="space-y-2">
              <p className="font-semibold text-stone-900">Product</p>
              <Link to="/create-event" className="block text-stone-600 hover:text-olive-drab">
                For Organizers
              </Link>
              <button
                type="button"
                onClick={scrollToUpcoming}
                className="block text-left text-stone-600 hover:text-olive-drab"
              >
                Explore Events
              </button>
              <Link to="/help" className="block text-stone-600 hover:text-olive-drab">
                How It Works
              </Link>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-stone-900">Company</p>
              <Link to="/pricing" className="block text-stone-600 hover:text-olive-drab">
                Pricing
              </Link>
              <Link to="/safety" className="block text-stone-600 hover:text-olive-drab">
                Safety
              </Link>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-stone-900">Support</p>
              <a
                href="mailto:support@twendehub.com"
                className="block text-stone-600 hover:text-olive-drab"
              >
                Contact
              </a>
              <Link to="/privacy" className="block text-stone-600 hover:text-olive-drab">
                Privacy
              </Link>
              <Link to="/terms" className="block text-stone-600 hover:text-olive-drab">
                Terms
              </Link>
            </div>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-stone-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <p className="text-xs text-stone-400">
            © {new Date().getFullYear()} Twende. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function Home() {
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minCapacity, setMinCapacity] = useState('');
  const [maxCapacity, setMaxCapacity] = useState('');
  const [radius, setRadius] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debouncedCategory, setDebouncedCategory] = useState('');
  const [debouncedType, setDebouncedType] = useState('');

  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedSearch(search);
      setDebouncedCategory(category);
      setDebouncedType(type);
    }, 350);
    return () => clearTimeout(id);
  }, [search, category, type]);

  const filters = useMemo(() => ({
    search: debouncedSearch || undefined,
    category: debouncedCategory || undefined,
    type: debouncedType || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    minCapacity: minCapacity ? parseInt(minCapacity, 10) : undefined,
    maxCapacity: maxCapacity ? parseInt(maxCapacity, 10) : undefined,
    lat: userLocation?.lat,
    lng: userLocation?.lng,
    radius: radius ? parseFloat(radius) : undefined,
  }), [debouncedSearch, debouncedCategory, debouncedType, startDate, endDate, minCapacity, maxCapacity, radius, userLocation]);

  const { events, loading, hasMore, fetchMore } = useEvents(filters);
  const { featuredEvents, loading: featuredLoading } = useFeaturedEvents();

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      });
    }
  };

  const clearFilters = () => {
    setSearch('');
    setCategory('');
    setType('');
    setStartDate('');
    setEndDate('');
    setMinCapacity('');
    setMaxCapacity('');
    setRadius('');
    setUserLocation(null);
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return <span className="text-stone-400 text-xs italic">No reviews yet</span>;
    return (
      <div className="flex items-center text-amber-500">
        {[...Array(5)].map((_, i) => (
          <span key={i} className={i < Math.round(rating) ? 'fill-current' : 'text-stone-300'}>★</span>
        ))}
        <span className="text-stone-500 text-xs ml-1">({rating.toFixed(1)})</span>
      </div>
    );
  };

  useMeta({
    title: "Twende | Run professional outdoor events",
    description:
      "Twende is the easiest way for hiking and outdoor organizers to run professional events, manage participants, and track payments — while participants discover unforgettable trips.",
    image:
      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=1200",
  });

  return (
    <div className="pt-20">
      <LandingHero />
      <ProblemSection />
      <SolutionSection />
      <HowItWorks />

      {!featuredLoading && featuredEvents.length > 0 && (
        <section className="py-24 bg-stone-900 text-white overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-end mb-12">
              <div>
                <h2 className="text-4xl font-serif font-bold mb-4">Featured Adventures</h2>
                <p className="text-stone-400">Hand-picked premium experiences</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              {featuredEvents.map((event) => (
                <Link key={event.id} to={`/events/${event.id}`} className="group relative h-[400px] card overflow-hidden border-none">
                  <img
                    src={event.cover_image || `https://picsum.photos/seed/${event.id}/1200/800`}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    alt={event.title}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    width={1200}
                    height={800}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-10 flex flex-col justify-end">
                    <div className="mb-4">
                      <span className="bg-amber-500 text-black text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest mr-2">
                        Featured
                      </span>
                      <span className="text-stone-300 text-sm">{event.category}</span>
                    </div>
                    <h3 className="text-4xl font-serif font-bold mb-4">{event.title}</h3>
                    <div className="flex items-center space-x-6 text-stone-300">
                      <div className="flex items-center text-sm">
                        <MapPin size={16} className="mr-2 text-amber-500" />
                        <span>{event.location}</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Calendar size={16} className="mr-2 text-amber-500" />
                        <span>{new Date(event.date_time).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <UpcomingEvents
        events={events}
        loading={loading}
        hasMore={hasMore}
        fetchMore={fetchMore}
        search={search}
        setSearch={setSearch}
        category={category}
        setCategory={setCategory}
        type={type}
        setType={setType}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        minCapacity={minCapacity}
        setMinCapacity={setMinCapacity}
        maxCapacity={maxCapacity}
        setMaxCapacity={setMaxCapacity}
        radius={radius}
        setRadius={setRadius}
        userLocation={userLocation}
        handleGetLocation={handleGetLocation}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        clearFilters={clearFilters}
        renderStars={renderStars}
      />

      <OrganizerCTA />
      <SocialProof />
      <LandingFooter />
    </div>
  );
}
