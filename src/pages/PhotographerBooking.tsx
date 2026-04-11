import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Camera, Users, DollarSign, Search, Filter, CheckCircle, ArrowLeft, Globe, Briefcase, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Photographer {
  id: number;
  photographer_name: string;
  portfolio_url: string;
  bio: string;
  equipment: string;
  base_rate: number;
  specialties: string;
}

interface Event {
  id: number;
  title: string;
}

export default function PhotographerBooking() {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('eventId');
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [photographers, setPhotographers] = useState<Photographer[]>([]);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState<number | null>(null);
  const [success, setSuccess] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (eventId) {
      fetch(`/api/events/${eventId}`)
        .then(res => res.json())
        .then(data => setEvent(data));

      fetch(`/api/photographers/available`)
        .then(res => res.json())
        .then(data => {
          setPhotographers(data);
          setLoading(false);
        });
    }
  }, [eventId]);

  const handleBook = async (photographer: Photographer) => {
    if (!eventId || !token) return;
    setBookingLoading(photographer.id);
    try {
      const res = await fetch('/api/photographer-bookings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          event_id: parseInt(eventId),
          photographer_id: photographer.id,
          total_price: photographer.base_rate,
          notes
        }),
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => navigate(`/events/${eventId}`), 2000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBookingLoading(null);
    }
  };

  if (!user || user.role !== 'organizer') {
    return <div className="pt-32 text-center">Only organizers can book photographers.</div>;
  }

  if (success) {
    return (
      <div className="pt-32 flex flex-col items-center justify-center text-center px-4">
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6"
        >
          <CheckCircle size={40} />
        </motion.div>
        <h2 className="text-3xl font-serif font-bold text-stone-900 mb-2">Booking Requested!</h2>
        <p className="text-stone-500">The photographer has been notified. You'll hear back soon.</p>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-24 px-4 bg-warm-off-white min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-12">
          <button onClick={() => navigate(-1)} className="p-3 rounded-full hover:bg-white hover:shadow-md transition-all">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-5xl font-serif font-bold text-stone-900 mb-2">Hire a Photographer</h1>
            <p className="text-stone-500 text-lg">Capture the best moments of <span className="text-stone-900 font-medium">{event?.title}</span></p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-8">
            <div className="card p-8 bg-white shadow-xl border border-stone-100 sticky top-32">
              <h2 className="text-2xl font-serif font-bold text-stone-800 mb-6">Booking Details</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">Notes for Photographer</label>
                  <textarea 
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-olive-drab/20 transition-all"
                    rows={4}
                    placeholder="e.g. Specific shots needed, event schedule, equipment requirements..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
                <div className="p-4 bg-olive-drab/5 rounded-2xl border border-olive-drab/10">
                  <div className="flex items-center gap-2 text-olive-drab font-bold text-sm mb-2">
                    <Zap size={16} />
                    <span>Pro Tip</span>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Be specific about your event's lighting and location to help photographers prepare.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Photographers Grid */}
          <div className="lg:col-span-2">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="card h-96 bg-stone-100 animate-pulse" />
                ))}
              </div>
            ) : photographers.length === 0 ? (
              <div className="card p-16 text-center text-stone-500 bg-white shadow-xl border border-stone-100">
                <Briefcase className="mx-auto mb-4 text-stone-200" size={64} />
                No photographers available for booking at the moment.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {photographers.map(photographer => (
                  <motion.div 
                    key={photographer.id} 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="card overflow-hidden bg-white shadow-xl border border-stone-100 hover:shadow-2xl transition-all group"
                  >
                    <div className="p-8">
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 bg-stone-100 text-stone-400 rounded-full flex items-center justify-center font-bold text-xl group-hover:bg-olive-drab group-hover:text-white transition-all">
                            {photographer.photographer_name.charAt(0)}
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-stone-900">{photographer.photographer_name}</h3>
                            <a 
                              href={photographer.portfolio_url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-xs text-olive-drab font-bold hover:underline flex items-center gap-1"
                            >
                              <Globe size={12} />
                              View Portfolio
                            </a>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-serif font-bold text-olive-drab">KES {photographer.base_rate.toLocaleString()}</div>
                          <div className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">per event</div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="flex flex-wrap gap-2">
                          {photographer.specialties.split(',').map(s => (
                            <span key={s} className="px-3 py-1 bg-stone-50 text-stone-600 text-[10px] font-bold uppercase tracking-widest rounded-full border border-stone-100">
                              {s}
                            </span>
                          ))}
                        </div>

                        <p className="text-stone-600 text-sm line-clamp-3 leading-relaxed">
                          {photographer.bio}
                        </p>

                        <div className="pt-6 border-t border-stone-100">
                          <button 
                            onClick={() => handleBook(photographer)}
                            disabled={bookingLoading !== null}
                            className="w-full py-4 rounded-2xl bg-stone-900 text-white font-bold hover:bg-stone-800 transition-all disabled:opacity-50 shadow-xl shadow-stone-900/10"
                          >
                            {bookingLoading === photographer.id ? 'Requesting...' : 'Book Photographer'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
