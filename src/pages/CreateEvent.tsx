import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import * as eventsService from '@/services/events';
import { apiFetch, ApiError } from '@/lib/apiClient.ts';
import { logCriticalAction } from '@/lib/logger.ts';
import { motion } from 'motion/react';
import { MapPin, Calendar, Users, DollarSign, Lock, Globe, Mail, Plus, X } from 'lucide-react';
import ImageUpload from '@/components/ImageUpload.tsx';

export default function CreateEvent() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [mpesaPhone, setMpesaPhone] = useState(user?.phone ?? '');
  const [mpesaCode, setMpesaCode] = useState('');
  const [paymentMode, setPaymentMode] = useState<'stk' | 'manual'>('stk');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Hiking',
    type: 'Group',
    location: '',
    date_time: '',
    max_participants: 20,
    participant_fee: 0,
    visibility: 'public',
    cover_image: '',
    duration: 'Full Day',
    invitations: [] as string[]
  });
  const [inviteEmail, setInviteEmail] = useState('');

  if (!user || user.role !== 'organizer') {
    return <div className="pt-32 text-center">Only organizers can create events.</div>;
  }

  const handleOpenPaymentModal = (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentMessage(null);
    setShowPaymentModal(true);
  };

  const pollPaymentStatus = async (eventId: number, attempts = 0) => {
    if (attempts > 20) {
      setPaymentMessage('Payment is taking longer than expected. If you have paid, please contact support.');
      return;
    }
    const statusData = await apiFetch<{ event_status: string; payment_status: string | null; amount: number | null }>(
      `/api/payments/status?event_id=${eventId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        retryCount: 2,
      },
    );
    if (statusData.event_status === 'active' && ['success', 'confirmed'].includes(statusData.payment_status ?? '')) {
      navigate(`/events/${eventId}`);
    } else if (statusData.payment_status === 'failed') {
      setPaymentError('Payment failed. Please try again.');
    } else {
      setTimeout(() => pollPaymentStatus(eventId, attempts + 1), 3000);
    }
  };

  const handlePayAndPublish = async (mode: 'stk' | 'manual') => {
    if (!user || !token) return;
    setLoading(true);
    setPaymentMessage(null);
    setPaymentError(null);
    try {
      const { id } = await eventsService.createEvent(user.id, {
        title: formData.title,
        description: formData.description || null,
        category: formData.category,
        type: formData.type,
        location: formData.location,
        latitude: null,
        longitude: null,
        date_time: formData.date_time,
        max_participants: formData.max_participants,
        participant_fee: formData.participant_fee,
        visibility: formData.visibility as 'public' | 'private',
        cover_image: formData.cover_image || null,
        duration: formData.duration || null,
      });
      const data = { id };

      if (formData.invitations.length > 0) {
        await Promise.all(formData.invitations.map((email) =>
          eventsService.inviteByEmail(id, email, user.id)
        ));
      }

      if (mode === 'stk') {
        // Initiate M-Pesa STK Push
        try {
          const payData = await apiFetch<{ phone: string; checkoutRequestId: string | null; paymentStatus: string }>(
            '/api/payments/initiate',
            {
              method: 'POST',
              body: JSON.stringify({ event_id: data.id, type: 'creation', phone: mpesaPhone }),
              headers: { Authorization: `Bearer ${token}` },
              retryCount: 1,
            },
          );

        setPaymentMessage(`We’ve sent an M-Pesa STK Push to ${payData.phone}. Please check your phone to authorize the payment.`);
        setShowPaymentModal(false);
        await pollPaymentStatus(data.id);
        } catch (e) {
          const msg =
            e instanceof ApiError
              ? e.message
              : 'Failed to initiate M-Pesa payment. Please try again.';
          setPaymentError(msg);
        }
      } else {
        // Manual Paybill confirmation using verify endpoint as manual override
        try {
          await apiFetch<{ status: string }>('/api/payments/verify', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: JSON.stringify({ event_id: data.id, transaction_code: mpesaCode, amount: 1000, phone_number: mpesaPhone }),
            retryCount: 1,
          });
        } catch (e) {
          const msg =
            e instanceof ApiError
              ? e.message
              : 'Could not confirm manual payment. Please try again or contact support.';
          setPaymentError(msg);
          return;
        }
        setShowPaymentModal(false);
        navigate(`/events/${data.id}`);
      }
    } catch (err) {
      setPaymentError('Something went wrong while creating the event. Please try again.');
      logCriticalAction('event_create_failed', { error: err });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-32 pb-24 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-12">
          <h1 className="text-5xl font-serif font-bold text-stone-900 mb-4">Create an Adventure</h1>
          <p className="text-stone-500 text-lg">Fill in the details below to start your event. A platform fee of KES 1,000 applies.</p>
          {paymentError && (
            <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2 rounded-xl">
              {paymentError}
            </p>
          )}
          {paymentMessage && (
            <p className="mt-4 text-olive-drab-700 bg-olive-drab/10 border border-olive-drab/20 px-4 py-3 rounded-xl">
              {paymentMessage}
            </p>
          )}
        </div>

        <form onSubmit={handleOpenPaymentModal} className="space-y-8">
          <div className="card p-8 space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">Event Title</label>
              <input 
                type="text" 
                required
                placeholder="e.g. Mt. Longonot Day Hike"
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-olive-drab/20 transition-all"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">Category</label>
                <select 
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-olive-drab/20 transition-all"
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                >
                  <option>Hiking</option>
                  <option>Road Trip</option>
                  <option>Photography</option>
                  <option>Team Building</option>
                  <option>Camping</option>
                  <option>Cycling</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">Event Type</label>
                <select 
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-olive-drab/20 transition-all"
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                >
                  <option>Group</option>
                  <option>Solo</option>
                  <option>Family</option>
                  <option>Workshop</option>
                  <option>Competition</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">Duration</label>
                <select 
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-olive-drab/20 transition-all"
                  value={formData.duration}
                  onChange={(e) => setFormData({...formData, duration: e.target.value})}
                >
                  <option>Half Day</option>
                  <option>Full Day</option>
                  <option>Multiple Days</option>
                  <option>Ongoing</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">Date & Time</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                  <input 
                    type="datetime-local" 
                    required
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-olive-drab/20 transition-all"
                    value={formData.date_time}
                    onChange={(e) => setFormData({...formData, date_time: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">Location</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Naivasha, Kenya"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-olive-drab/20 transition-all"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">Description</label>
              <textarea 
                rows={4}
                required
                placeholder="Tell participants what to expect, what to carry, and the itinerary..."
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-olive-drab/20 transition-all"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
              />
            </div>
          </div>

          <div className="card p-8 space-y-6">
            <h3 className="text-xl font-serif font-bold text-stone-900">Logistics & Pricing</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">Max Participants</label>
                <div className="relative">
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                  <input 
                    type="number" 
                    required
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-olive-drab/20 transition-all"
                    value={formData.max_participants}
                    onChange={(e) => setFormData({...formData, max_participants: parseInt(e.target.value)})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">Participant Fee (KES)</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                  <input 
                    type="number" 
                    placeholder="0 for free events"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-olive-drab/20 transition-all"
                    value={formData.participant_fee}
                    onChange={(e) => setFormData({...formData, participant_fee: parseInt(e.target.value)})}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">Visibility</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setFormData({...formData, visibility: 'public'})}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl border transition-all ${formData.visibility === 'public' ? 'bg-olive-drab border-olive-drab text-white' : 'bg-white border-stone-200 text-stone-600'}`}
                >
                  <Globe size={18} />
                  Public
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, visibility: 'private'})}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl border transition-all ${formData.visibility === 'private' ? 'bg-olive-drab border-olive-drab text-white' : 'bg-white border-stone-200 text-stone-600'}`}
                >
                  <Lock size={18} />
                  Private
                </button>
              </div>
            </div>

            {formData.visibility === 'private' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4"
              >
                <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">Invite Participants (Email)</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                    <input 
                      type="email" 
                      placeholder="user@example.com"
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-olive-drab/20 transition-all"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (inviteEmail && !formData.invitations.includes(inviteEmail)) {
                            setFormData({...formData, invitations: [...formData.invitations, inviteEmail]});
                            setInviteEmail('');
                          }
                        }
                      }}
                    />
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      if (inviteEmail && !formData.invitations.includes(inviteEmail)) {
                        setFormData({...formData, invitations: [...formData.invitations, inviteEmail]});
                        setInviteEmail('');
                      }
                    }}
                    className="bg-stone-900 text-white px-6 rounded-xl hover:bg-stone-800 transition-all"
                  >
                    <Plus size={20} />
                  </button>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {formData.invitations.map(email => (
                    <span key={email} className="bg-stone-100 text-stone-600 px-3 py-1 rounded-full text-xs flex items-center gap-2">
                      {email}
                      <button 
                        type="button"
                        onClick={() => setFormData({...formData, invitations: formData.invitations.filter(e => e !== email)})}
                        className="hover:text-red-500"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              </motion.div>
            )}

            <ImageUpload
              bucket="event-covers"
              path={`${user.id}/${Date.now()}`}
              currentUrl={formData.cover_image || undefined}
              onUpload={(url) => setFormData({ ...formData, cover_image: url })}
              label="Event Cover Photo"
            />
          </div>

          <div className="flex items-center justify-between p-6 bg-olive-drab/5 rounded-[32px] border border-olive-drab/10">
            <div className="text-stone-600">
              <span className="font-bold text-stone-900">Platform Fee:</span> KES 1,000
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="olive-button px-12 py-4 text-lg disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Pay & Publish'}
            </button>
          </div>
        </form>

        {showPaymentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-6">
              <h2 className="text-xl font-serif font-bold text-stone-900">Pay with M-Pesa</h2>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMode('stk')}
                  className={`flex-1 py-2 rounded-lg border text-sm ${
                    paymentMode === 'stk'
                      ? 'bg-olive-drab text-white border-olive-drab'
                      : 'bg-white text-stone-700 border-stone-200'
                  }`}
                >
                  Auto STK Push
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode('manual')}
                  className={`flex-1 py-2 rounded-lg border text-sm ${
                    paymentMode === 'manual'
                      ? 'bg-olive-drab text-white border-olive-drab'
                      : 'bg-white text-stone-700 border-stone-200'
                  }`}
                >
                  Manual Paybill
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">
                  Kenyan M-Pesa Number
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 2547XXXXXXXX"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-olive-drab/20"
                  value={mpesaPhone}
                  onChange={(e) => setMpesaPhone(e.target.value)}
                />
              </div>

              {paymentMode === 'manual' && (
                <>
                  <div className="text-sm text-stone-600 space-y-1">
                    <p><span className="font-semibold">Paybill:</span> 174379</p>
                    <p><span className="font-semibold">Account:</span> Use your event title or ID</p>
                    <p><span className="font-semibold">Amount:</span> KES 1,000 (platform fee)</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">
                      M-Pesa Transaction Code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. QJD3XYZ123"
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-olive-drab/20"
                      value={mpesaCode}
                      onChange={(e) => setMpesaCode(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="px-4 py-2 text-sm rounded-lg border border-stone-200 text-stone-600"
                  onClick={() => {
                    setShowPaymentModal(false);
                    setPaymentMessage(null);
                  }}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="olive-button px-6 py-2 text-sm disabled:opacity-50"
                  onClick={() => handlePayAndPublish(paymentMode)}
                  disabled={loading || !mpesaPhone || (paymentMode === 'manual' && !mpesaCode)}
                >
                  {loading ? 'Processing...' : 'Confirm & Pay'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
