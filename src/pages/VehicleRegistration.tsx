import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Car, Users, DollarSign, CheckCircle } from 'lucide-react';
import { motion } from 'motion/react';
import ImageUpload from '@/components/ImageUpload.tsx';

export default function VehicleRegistration() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    make: '',
    model: '',
    year: new Date().getFullYear(),
    capacity: 7,
    base_rate: 5000,
    image_url: ''
  });

  if (!user) {
    return <div className="pt-32 text-center">Please login to register a vehicle.</div>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/vehicles', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => navigate('/my-vehicles'), 2000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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
        <h2 className="text-3xl font-serif font-bold text-stone-900 mb-2">Vehicle Registered!</h2>
        <p className="text-stone-500">Your vehicle is now available for event organizers to book.</p>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-24 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-12">
          <h1 className="text-5xl font-serif font-bold text-stone-900 mb-4">Register Your Vehicle</h1>
          <p className="text-stone-500 text-lg">Join our fleet and earn by providing transport for group adventures.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="card p-8 space-y-6 bg-white shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">Make</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Toyota"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-olive-drab/20 transition-all"
                  value={formData.make}
                  onChange={(e) => setFormData({...formData, make: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">Model</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Noah / Hiace"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-olive-drab/20 transition-all"
                  value={formData.model}
                  onChange={(e) => setFormData({...formData, model: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">Year</label>
                <input 
                  type="number" 
                  required
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-olive-drab/20 transition-all"
                  value={formData.year}
                  onChange={(e) => setFormData({...formData, year: parseInt(e.target.value)})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">Capacity</label>
                <div className="relative">
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                  <input 
                    type="number" 
                    required
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-olive-drab/20 transition-all"
                    value={formData.capacity}
                    onChange={(e) => setFormData({...formData, capacity: parseInt(e.target.value)})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">Base Rate (KES/Day)</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                  <input 
                    type="number" 
                    required
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-olive-drab/20 transition-all"
                    value={formData.base_rate}
                    onChange={(e) => setFormData({...formData, base_rate: parseInt(e.target.value)})}
                  />
                </div>
              </div>
            </div>

            <ImageUpload
              bucket="vehicle-images"
              path={`${user.id}/${Date.now()}`}
              currentUrl={formData.image_url || undefined}
              onUpload={(url) => setFormData({ ...formData, image_url: url })}
              label="Vehicle Image"
            />
          </div>

          <div className="flex justify-end">
            <button 
              type="submit" 
              disabled={loading}
              className="olive-button px-12 py-4 text-lg disabled:opacity-50"
            >
              {loading ? 'Registering...' : 'Register Vehicle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
