import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Camera, Video, Globe, Briefcase, DollarSign, CheckCircle } from 'lucide-react';
import { motion } from 'motion/react';
import ImageUpload from '@/components/ImageUpload.tsx';

export default function PhotographerRegistration() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [bio, setBio] = useState('');
  const [equipment, setEquipment] = useState('');
  const [baseRate, setBaseRate] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [existingProfile, setExistingProfile] = useState(false);

  useEffect(() => {
    if (token) {
      fetch('/api/photographers/my', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data) {
          setExistingProfile(true);
          setPortfolioUrl(data.portfolio_url || '');
          setBio(data.bio || '');
          setEquipment(data.equipment || '');
          setBaseRate(data.base_rate?.toString() || '');
          setSpecialties(data.specialties?.split(',') || []);
        }
      });
    }
  }, [token]);

  const toggleSpecialty = (s: string) => {
    setSpecialties(prev => prev.includes(s) ? prev.filter(item => item !== s) : [...prev, s]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/photographers', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          portfolio_url: portfolioUrl,
          bio,
          equipment,
          base_rate: parseInt(baseRate),
          specialties: specialties.join(',')
        }),
      });

      if (res.ok) {
        navigate('/my-photography');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save profile');
      }
    } catch (err) {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.role !== 'photographer') {
    return <div className="pt-32 text-center">Access denied. Only photographers can access this page.</div>;
  }

  return (
    <div className="pt-32 pb-24 px-4 bg-warm-off-white min-h-screen">
      <div className="max-w-3xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-10 bg-white shadow-xl border border-stone-100"
        >
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-olive-drab/10 text-olive-drab rounded-full flex items-center justify-center mx-auto mb-6">
              <Camera size={40} />
            </div>
            <h1 className="text-4xl font-serif font-bold text-stone-900 mb-2">
              {existingProfile ? 'Update Your Profile' : 'Showcase Your Work'}
            </h1>
            <p className="text-stone-500">Let organizers know what you can do for their events.</p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-8 text-sm border border-red-100">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <ImageUpload
                  bucket="photographer-portfolios"
                  path={`${user.id}/${Date.now()}`}
                  currentUrl={portfolioUrl || undefined}
                  onUpload={(url) => setPortfolioUrl(url)}
                  label="Portfolio Cover Image"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">Base Rate (KES / Event)</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                  <input 
                    type="number" 
                    required
                    placeholder="5000"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-olive-drab/20 transition-all"
                    value={baseRate}
                    onChange={(e) => setBaseRate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">Specialties</label>
              <div className="flex flex-wrap gap-3">
                {['Photography', 'Videography', 'Drone Shots', 'Editing', 'Live Streaming'].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSpecialty(s)}
                    className={`px-6 py-2.5 rounded-full border text-sm font-medium transition-all ${
                      specialties.includes(s) 
                        ? 'bg-olive-drab border-olive-drab text-white shadow-lg shadow-olive-drab/20' 
                        : 'bg-white border-stone-200 text-stone-600 hover:border-olive-drab'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">About You & Your Style</label>
              <textarea 
                required
                rows={4}
                placeholder="Tell organizers about your experience and what makes your work unique..."
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-olive-drab/20 transition-all"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">Equipment List</label>
              <textarea 
                required
                rows={3}
                placeholder="Cameras, lenses, lighting, etc."
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-olive-drab/20 transition-all"
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="olive-button w-full py-4 text-lg flex items-center justify-center space-x-2 shadow-xl shadow-olive-drab/20"
            >
              {loading ? (
                <span>Saving...</span>
              ) : (
                <>
                  <CheckCircle size={20} />
                  <span>{existingProfile ? 'Update Profile' : 'Complete Profile'}</span>
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
