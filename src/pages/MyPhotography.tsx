import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Camera, Users, DollarSign, Clock, CheckCircle, XCircle, Briefcase, Globe, Settings } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';

interface Photographer {
  id: number;
  portfolio_url: string;
  bio: string;
  equipment: string;
  base_rate: number;
  specialties: string;
  status: string;
}

interface BookingRequest {
  id: number;
  event_title: string;
  organizer_name: string;
  total_price: number;
  status: string;
  notes: string;
  created_at: string;
}

export default function MyPhotography() {
  const { token, user } = useAuth();
  const [photographer, setPhotographer] = useState<Photographer | null>(null);
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      Promise.all([
        fetch('/api/photographers/my', {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.json()),
        fetch('/api/photographer-bookings/my-requests', {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.json())
      ]).then(([photographerData, bookingsData]) => {
        setPhotographer(photographerData);
        setBookings(bookingsData);
        setLoading(false);
      });
    }
  }, [token]);

  const handleUpdateStatus = async (bookingId: number, status: string) => {
    try {
      const res = await fetch(`/api/photographer-bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setBookings(bookings.map(b => b.id === bookingId ? { ...b, status } : b));
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!user || user.role !== 'photographer') {
    return <div className="pt-32 text-center">Access denied.</div>;
  }

  if (loading) return <div className="pt-32 text-center">Loading...</div>;

  return (
    <div className="pt-32 pb-24 px-4 bg-warm-off-white min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
          <div>
            <h1 className="text-5xl font-serif font-bold text-stone-900 mb-4">Photography Studio</h1>
            <p className="text-stone-500 text-lg">Manage your bookings and showcase your talent.</p>
          </div>
          <Link 
            to="/photographer-registration" 
            className="flex items-center gap-2 px-6 py-3 bg-white border border-stone-200 rounded-xl text-stone-600 font-bold hover:bg-stone-50 transition-all shadow-sm"
          >
            <Settings size={18} />
            <span>Edit Profile</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Profile Summary */}
          <div className="lg:col-span-1 space-y-8">
            <h2 className="text-2xl font-serif font-bold text-stone-800 mb-6">Profile Summary</h2>
            {photographer ? (
              <div className="card p-8 bg-white shadow-xl border border-stone-100">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-16 h-16 bg-olive-drab/10 text-olive-drab rounded-full flex items-center justify-center">
                    <Camera size={32} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-stone-900">{user.name}</h3>
                    <div className="flex items-center gap-2 text-stone-400 text-sm">
                      <Globe size={14} />
                      <a href={photographer.portfolio_url} target="_blank" rel="noopener noreferrer" className="hover:text-olive-drab underline">Portfolio</a>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">Specialties</label>
                    <div className="flex flex-wrap gap-2">
                      {photographer.specialties.split(',').map(s => (
                        <span key={s} className="px-3 py-1 bg-stone-50 text-stone-600 text-xs font-medium rounded-full border border-stone-100">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">Base Rate</label>
                    <div className="text-2xl font-serif font-bold text-olive-drab">
                      KES {photographer.base_rate.toLocaleString()} <span className="text-xs font-sans text-stone-400 font-normal uppercase tracking-widest">/ Event</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">Equipment</label>
                    <p className="text-stone-600 text-sm leading-relaxed">{photographer.equipment}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card p-8 text-center text-stone-500 bg-white shadow-xl border border-stone-100">
                <Briefcase className="mx-auto mb-4 text-stone-200" size={48} />
                <p className="mb-6">You haven't set up your profile yet.</p>
                <Link to="/photographer-registration" className="olive-button inline-block">Set Up Profile</Link>
              </div>
            )}
          </div>

          {/* Booking Requests */}
          <div className="lg:col-span-2 space-y-8">
            <h2 className="text-2xl font-serif font-bold text-stone-800 mb-6">Booking Requests</h2>
            {bookings.length === 0 ? (
              <div className="card p-12 text-center text-stone-500 bg-white shadow-xl border border-stone-100">
                <Clock className="mx-auto mb-4 text-stone-200" size={48} />
                No booking requests yet. Keep your portfolio updated!
              </div>
            ) : (
              <div className="space-y-4">
                {bookings.map(booking => (
                  <motion.div 
                    key={booking.id} 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="card p-8 bg-white shadow-xl border border-stone-100 flex flex-col md:flex-row md:items-center justify-between gap-8"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                          booking.status === 'pending' ? 'bg-amber-100 text-amber-600' :
                          booking.status === 'accepted' ? 'bg-emerald-100 text-emerald-600' :
                          'bg-red-100 text-red-600'
                        }`}>
                          {booking.status}
                        </span>
                        <span className="text-stone-400 text-xs flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(booking.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="text-2xl font-serif font-bold text-stone-900 mb-2">{booking.event_title}</h3>
                      <p className="text-stone-500 text-sm mb-6">Requested by <span className="text-stone-900 font-medium">{booking.organizer_name}</span></p>
                      
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 text-stone-600">
                          <DollarSign size={18} className="text-olive-drab" />
                          <span className="font-bold text-stone-900">KES {booking.total_price?.toLocaleString()}</span>
                        </div>
                      </div>

                      {booking.notes && (
                        <div className="mt-6 p-4 bg-stone-50 rounded-2xl text-sm text-stone-600 italic border border-stone-100">
                          "{booking.notes}"
                        </div>
                      )}
                    </div>

                    {booking.status === 'pending' && (
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => handleUpdateStatus(booking.id, 'rejected')}
                          className="p-4 rounded-full border border-stone-200 text-stone-400 hover:text-red-500 hover:border-red-500 transition-all shadow-sm"
                          title="Reject Request"
                        >
                          <XCircle size={28} />
                        </button>
                        <button 
                          onClick={() => handleUpdateStatus(booking.id, 'accepted')}
                          className="p-4 rounded-full bg-olive-drab text-white hover:bg-olive-drab/90 transition-all shadow-xl shadow-olive-drab/20"
                          title="Accept Request"
                        >
                          <CheckCircle size={28} />
                        </button>
                      </div>
                    )}
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
