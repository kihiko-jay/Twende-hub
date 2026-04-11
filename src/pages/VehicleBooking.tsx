import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Car, Users, DollarSign, Search, Filter, CheckCircle, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Vehicle {
  id: number;
  make: string;
  model: string;
  year: number;
  capacity: number;
  base_rate: number;
  image_url: string;
  owner_name: string;
}

interface Event {
  id: number;
  title: string;
  max_participants: number;
}

export default function VehicleBooking() {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('eventId');
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
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

      fetch(`/api/vehicles/available`)
        .then(res => res.json())
        .then(data => {
          setVehicles(data);
          setLoading(false);
        });
    }
  }, [eventId]);

  const handleBook = async (vehicle: Vehicle) => {
    if (!eventId || !token) return;
    setBookingLoading(vehicle.id);
    try {
      const res = await fetch('/api/vehicle-bookings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          event_id: parseInt(eventId),
          vehicle_id: vehicle.id,
          total_price: vehicle.base_rate, // Simple calculation for now
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
    return <div className="pt-32 text-center">Only organizers can book vehicles.</div>;
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
        <p className="text-stone-500">The vehicle owner has been notified. You'll hear back soon.</p>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-24 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-stone-100 transition-all">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-4xl font-serif font-bold text-stone-900">Find Transport</h1>
            <p className="text-stone-500">Book a vehicle for <span className="text-stone-900 font-medium">{event?.title}</span></p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Filters & Info */}
          <div className="lg:col-span-1 space-y-8">
            <div className="card p-8 bg-white shadow-sm border border-stone-100">
              <h2 className="text-xl font-serif font-bold text-stone-800 mb-6">Booking Details</h2>
              <div className="space-y-4 mb-8">
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Group Size:</span>
                  <span className="text-stone-900 font-bold">{event?.max_participants} people</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Recommended Capacity:</span>
                  <span className="text-stone-900 font-bold">{event?.max_participants} + 1</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">Notes for Owner</label>
                <textarea 
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-olive-drab/20 transition-all"
                  rows={4}
                  placeholder="e.g. Pick up at 6:00 AM, specific route details..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Vehicles Grid */}
          <div className="lg:col-span-2">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="card h-80 bg-stone-100 animate-pulse" />
                ))}
              </div>
            ) : vehicles.length === 0 ? (
              <div className="card p-12 text-center text-stone-500 bg-white">
                No available vehicles match your criteria.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {vehicles.map(vehicle => (
                  <div key={vehicle.id} className="card overflow-hidden bg-white shadow-sm border border-stone-100 hover:shadow-md transition-all">
                    <img 
                      src={vehicle.image_url || 'https://picsum.photos/seed/car/400/200'} 
                      alt={vehicle.make} 
                      className="w-full h-48 object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-stone-900">{vehicle.make} {vehicle.model}</h3>
                          <p className="text-stone-500 text-sm">Owner: <span className="text-stone-900 font-medium">{vehicle.owner_name}</span></p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-olive-drab">KES {vehicle.base_rate.toLocaleString()}</div>
                          <div className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">per day</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mb-6 text-sm text-stone-600">
                        <div className="flex items-center gap-2">
                          <Users size={16} />
                          <span>{vehicle.capacity} seats</span>
                        </div>
                        <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${
                          vehicle.capacity >= (event?.max_participants || 0) ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                        }`}>
                          {vehicle.capacity >= (event?.max_participants || 0) ? 'Fits Group' : 'Too Small'}
                        </div>
                      </div>
                      <button 
                        onClick={() => handleBook(vehicle)}
                        disabled={bookingLoading !== null}
                        className="w-full py-3 rounded-xl bg-stone-900 text-white font-bold hover:bg-stone-800 transition-all disabled:opacity-50"
                      >
                        {bookingLoading === vehicle.id ? 'Requesting...' : 'Request Booking'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
