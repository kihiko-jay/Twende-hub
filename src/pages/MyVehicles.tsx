import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Car, Users, DollarSign, Clock, CheckCircle, XCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface Vehicle {
  id: number;
  make: string;
  model: string;
  year: number;
  capacity: number;
  base_rate: number;
  image_url: string;
  status: string;
}

interface BookingRequest {
  id: number;
  event_title: string;
  organizer_name: string;
  make: string;
  model: string;
  total_price: number;
  status: string;
  notes: string;
  created_at: string;
}

export default function MyVehicles() {
  const { token, user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      Promise.all([
        fetch('/api/vehicles/my', {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.json()),
        fetch('/api/vehicle-bookings/my-requests', {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.json())
      ]).then(([vehiclesData, bookingsData]) => {
        setVehicles(vehiclesData);
        setBookings(bookingsData);
        setLoading(false);
      });
    }
  }, [token]);

  const handleUpdateStatus = async (bookingId: number, status: string) => {
    try {
      const res = await fetch(`/api/vehicle-bookings/${bookingId}`, {
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

  if (!user || user.role !== 'vehicle_owner') {
    return <div className="pt-32 text-center">Access denied.</div>;
  }

  return (
    <div className="pt-32 pb-24 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <h1 className="text-5xl font-serif font-bold text-stone-900 mb-4">My Fleet</h1>
          <p className="text-stone-500 text-lg">Manage your vehicles and booking requests.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Vehicles List */}
          <div className="lg:col-span-1 space-y-6">
            <h2 className="text-2xl font-serif font-bold text-stone-800 mb-6">Registered Vehicles</h2>
            {vehicles.length === 0 ? (
              <div className="card p-8 text-center text-stone-500">
                No vehicles registered yet.
              </div>
            ) : (
              vehicles.map(vehicle => (
                <div key={vehicle.id} className="card overflow-hidden bg-white shadow-sm border border-stone-100">
                  <img 
                    src={vehicle.image_url || 'https://picsum.photos/seed/car/400/200'} 
                    alt={vehicle.make} 
                    className="w-full h-40 object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-stone-900">{vehicle.make} {vehicle.model}</h3>
                        <p className="text-stone-500 text-sm">{vehicle.year}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${
                        vehicle.status === 'available' ? 'bg-emerald-100 text-emerald-600' : 'bg-stone-100 text-stone-500'
                      }`}>
                        {vehicle.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-stone-600">
                      <div className="flex items-center gap-2">
                        <Users size={16} />
                        <span>{vehicle.capacity} seats</span>
                      </div>
                      <div className="flex items-center gap-2 font-bold text-stone-900">
                        <DollarSign size={16} />
                        <span>{vehicle.base_rate.toLocaleString()}/day</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Booking Requests */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-2xl font-serif font-bold text-stone-800 mb-6">Booking Requests</h2>
            {bookings.length === 0 ? (
              <div className="card p-12 text-center text-stone-500 bg-white">
                No booking requests yet.
              </div>
            ) : (
              <div className="space-y-4">
                {bookings.map(booking => (
                  <div key={booking.id} className="card p-6 bg-white shadow-sm border border-stone-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${
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
                      <h3 className="text-lg font-bold text-stone-900 mb-1">{booking.event_title}</h3>
                      <p className="text-stone-500 text-sm mb-4">Requested by <span className="text-stone-900 font-medium">{booking.organizer_name}</span></p>
                      <div className="flex items-center gap-4 text-sm text-stone-600">
                        <div className="flex items-center gap-2">
                          <Car size={16} />
                          <span>{booking.make} {booking.model}</span>
                        </div>
                        <div className="font-bold text-stone-900">
                          KES {booking.total_price?.toLocaleString()}
                        </div>
                      </div>
                      {booking.notes && (
                        <div className="mt-4 p-3 bg-stone-50 rounded-lg text-sm text-stone-600 italic">
                          "{booking.notes}"
                        </div>
                      )}
                    </div>

                    {booking.status === 'pending' && (
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => handleUpdateStatus(booking.id, 'rejected')}
                          className="p-3 rounded-full border border-stone-200 text-stone-400 hover:text-red-500 hover:border-red-500 transition-all"
                          title="Reject Request"
                        >
                          <XCircle size={24} />
                        </button>
                        <button 
                          onClick={() => handleUpdateStatus(booking.id, 'accepted')}
                          className="p-3 rounded-full bg-olive-drab text-white hover:bg-olive-drab/90 transition-all shadow-lg shadow-olive-drab/20"
                          title="Accept Request"
                        >
                          <CheckCircle size={24} />
                        </button>
                      </div>
                    )}
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
