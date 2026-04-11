import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { motion, AnimatePresence } from 'motion/react';
import { User, Mail, Phone, Calendar, MapPin, Camera, Car, Edit2, Save, X, Share2, PlusCircle, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import ImageUpload from '@/components/ImageUpload.tsx';

export default function Profile() {
  const { user: authUser } = useAuth();
  const { profile, events, bookings, loading, updateProfile, refetch } = useProfile(authUser?.id);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ name: '', bio: '', phone: '' });
  const [activeTab, setActiveTab] = useState<'joined' | 'organized' | 'past'>('joined');

  useEffect(() => {
    if (profile) {
      setEditData({ name: profile.name, bio: profile.bio || '', phone: profile.phone || '' });
    }
  }, [profile]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile(editData);
      setIsEditing(false);
    } catch (err) {
      console.error(err);
    }
  };

  if (!authUser) return <div className="pt-32 text-center">Please log in to view your profile.</div>;
  if (loading && !profile) return <div className="pt-32 text-center">Loading profile...</div>;
  if (!profile) return <div className="pt-32 text-center">Profile not found.</div>;

  return (
    <div className="pt-32 pb-24 px-4 bg-warm-off-white min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Sidebar: Profile Info */}
          <div className="lg:col-span-1 space-y-8">
            <div className="card p-8 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-olive-drab"></div>
              <div className="w-24 h-24 rounded-full bg-olive-drab/10 flex items-center justify-center text-olive-drab mx-auto mb-6 overflow-hidden">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <User size={48} />
                )}
              </div>
              
              {!isEditing ? (
                <>
                  <h2 className="text-3xl font-serif font-bold text-stone-900 mb-2">{profile.name}</h2>
                  <p className="text-stone-500 mb-6 capitalize">{profile.role}</p>
                  
                  <div className="space-y-4 text-left border-t border-stone-100 pt-6">
                    <div className="flex items-center text-stone-600">
                      <Mail size={18} className="mr-3 text-stone-400" />
                      <span>{profile.email}</span>
                    </div>
                    <div className="flex items-center text-stone-600">
                      <Phone size={18} className="mr-3 text-stone-400" />
                      <span>{profile.phone || 'No phone added'}</span>
                    </div>
                    <div className="flex items-start text-stone-600">
                      <Edit2 size={18} className="mr-3 mt-1 text-stone-400" />
                      <p className="text-sm italic">{profile.bio || 'Tell us about yourself...'}</p>
                    </div>
                  </div>

                  <button 
                    onClick={() => setIsEditing(true)}
                    className="mt-8 w-full border border-stone-200 rounded-full py-3 text-stone-600 hover:bg-stone-50 transition-all flex items-center justify-center gap-2"
                  >
                    <Edit2 size={16} />
                    Edit Profile
                  </button>
                </>
              ) : (
                <form onSubmit={handleUpdateProfile} className="space-y-4 text-left">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Full Name</label>
                    <input 
                      type="text" 
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 focus:outline-none"
                      value={editData.name}
                      onChange={(e) => setEditData({...editData, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Phone</label>
                    <input 
                      type="text" 
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 focus:outline-none"
                      value={editData.phone}
                      onChange={(e) => setEditData({...editData, phone: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Bio</label>
                    <textarea 
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 focus:outline-none"
                      rows={4}
                      value={editData.bio}
                      onChange={(e) => setEditData({...editData, bio: e.target.value})}
                    />
                  </div>
                  <ImageUpload
                    bucket="event-covers"
                    path={`${authUser.id}/${Date.now()}-avatar`}
                    currentUrl={profile.avatar_url || undefined}
                    onUpload={(url) => updateProfile({ avatar_url: url })}
                    label="Profile Photo"
                  />
                  <div className="flex gap-2 pt-4">
                    <button 
                      type="submit"
                      className="flex-1 bg-olive-drab text-white rounded-full py-2 flex items-center justify-center gap-2"
                    >
                      <Save size={16} />
                      Save
                    </button>
                    <button 
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="p-2 border border-stone-200 rounded-full text-stone-400"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="card p-8">
              <h3 className="text-xl font-serif font-bold text-stone-900 mb-6">Account Stats</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-stone-50 p-4 rounded-2xl text-center">
                  <div className="text-2xl font-bold text-olive-drab">{events.joined.length}</div>
                  <div className="text-[10px] uppercase font-bold text-stone-400">Joined</div>
                </div>
                <div className="bg-stone-50 p-4 rounded-2xl text-center">
                  <div className="text-2xl font-bold text-olive-drab">{events.organized.length}</div>
                  <div className="text-[10px] uppercase font-bold text-stone-400">Organized</div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content: Events & Bookings */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* My Events Section */}
            <section className="card p-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <h3 className="text-2xl font-serif font-bold text-stone-900 flex items-center gap-3">
                  <Calendar className="text-olive-drab" />
                  My Events
                </h3>
                
                <div className="flex bg-stone-100 p-1 rounded-full overflow-x-auto no-scrollbar">
                  <button 
                    onClick={() => setActiveTab('joined')}
                    className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'joined' ? 'bg-white text-olive-drab shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                  >
                    Joined ({events.joined.filter(e => new Date(e.date_time) > new Date()).length})
                  </button>
                  {profile.role === 'organizer' && (
                    <button 
                      onClick={() => setActiveTab('organized')}
                      className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'organized' ? 'bg-white text-olive-drab shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                    >
                      Organized ({events.organized.filter(e => new Date(e.date_time) > new Date()).length})
                    </button>
                  )}
                  <button 
                    onClick={() => setActiveTab('past')}
                    className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'past' ? 'bg-white text-olive-drab shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                  >
                    Past ({[...events.joined, ...events.organized].filter(e => new Date(e.date_time) <= new Date()).length})
                  </button>
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeTab === 'joined' ? (
                    events.joined.filter(e => new Date(e.date_time) > new Date()).length === 0 ? (
                      <div className="py-12 text-center text-stone-400">
                        <p>You have no upcoming joined events.</p>
                        <Link to="/" className="text-olive-drab font-bold mt-2 inline-block">Explore Events</Link>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {events.joined.filter(e => new Date(e.date_time) > new Date()).map(event => (
                          <Link key={event.id} to={`/events/${event.id}`} className="group">
                            <div className="bg-stone-50 border border-stone-100 rounded-2xl flex overflow-hidden h-32 hover:shadow-md transition-all">
                              <div className="w-32 h-full overflow-hidden">
                                <img 
                                  src={event.cover_image || `https://picsum.photos/seed/${event.id}/400/400`} 
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                  alt={event.title}
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <div className="flex-1 p-4 flex flex-col justify-center">
                                <h4 className="font-bold text-stone-900 group-hover:text-olive-drab transition-colors line-clamp-1">{event.title}</h4>
                                <div className="text-xs text-stone-500 flex items-center mt-1">
                                  <MapPin size={12} className="mr-1" />
                                  {event.location}
                                </div>
                                <div className="text-[10px] text-stone-400 mt-2">
                                  {new Date(event.date_time).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )
                  ) : activeTab === 'organized' ? (
                    <>
                      <div className="flex justify-end mb-4">
                        <Link to="/create-event" className="text-olive-drab text-xs font-bold flex items-center gap-1 hover:underline">
                          <PlusCircle size={14} />
                          Create New Event
                        </Link>
                      </div>
                      {events.organized.filter(e => new Date(e.date_time) > new Date()).length === 0 ? (
                        <div className="py-12 text-center text-stone-400">
                          <p>You have no upcoming organized events.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {events.organized.filter(e => new Date(e.date_time) > new Date()).map(event => (
                            <Link key={event.id} to={`/events/${event.id}`} className="group">
                              <div className="bg-stone-50 border border-stone-100 rounded-2xl flex overflow-hidden h-32 hover:shadow-md transition-all">
                                <div className="w-32 h-full overflow-hidden">
                                  <img 
                                    src={event.cover_image || `https://picsum.photos/seed/${event.id}/400/400`} 
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                    alt={event.title}
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                                <div className="flex-1 p-4 flex flex-col justify-center">
                                  <div className="flex justify-between items-start">
                                    <h4 className="font-bold text-stone-900 group-hover:text-olive-drab transition-colors line-clamp-1">{event.title}</h4>
                                    {event.avg_rating && (
                                      <div className="flex items-center text-amber-500 text-[10px]">
                                        <Star size={10} className="fill-current mr-0.5" />
                                        {Number(event.avg_rating).toFixed(1)}
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-xs text-stone-500 flex items-center mt-1">
                                    <MapPin size={12} className="mr-1" />
                                    {event.location}
                                  </div>
                                  <div className="flex items-center justify-between mt-2">
                                    <span className="text-[10px] text-stone-400">
                                      {new Date(event.date_time).toLocaleDateString()}
                                    </span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${event.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                      {event.status}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {[...events.joined, ...events.organized]
                        .filter(e => new Date(e.date_time) <= new Date())
                        .map(event => (
                          <Link key={event.id} to={`/events/${event.id}`} className="group">
                            <div className="bg-stone-50 border border-stone-100 rounded-2xl flex overflow-hidden h-32 hover:shadow-md transition-all opacity-75">
                              <div className="w-32 h-full overflow-hidden grayscale">
                                <img 
                                  src={event.cover_image || `https://picsum.photos/seed/${event.id}/400/400`} 
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                  alt={event.title}
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <div className="flex-1 p-4 flex flex-col justify-center">
                                <div className="flex justify-between items-start">
                                  <h4 className="font-bold text-stone-900 group-hover:text-olive-drab transition-colors line-clamp-1">{event.title}</h4>
                                  {event.avg_rating && (
                                    <div className="flex items-center text-amber-500 text-[10px]">
                                      <Star size={10} className="fill-current mr-0.5" />
                                      {Number(event.avg_rating).toFixed(1)}
                                    </div>
                                  )}
                                </div>
                                <div className="text-xs text-stone-500 flex items-center mt-1">
                                  <MapPin size={12} className="mr-1" />
                                  {event.location}
                                </div>
                                <div className="flex items-center justify-between mt-2">
                                  <div className="text-[10px] text-stone-400">
                                    {new Date(event.date_time).toLocaleDateString()}
                                  </div>
                                  {event.has_reviewed ? (
                                    <span className="text-[8px] font-bold uppercase text-green-600 bg-green-50 px-2 py-0.5 rounded">Reviewed</span>
                                  ) : (
                                    <span className="text-[8px] font-bold uppercase text-olive-drab bg-olive-drab/5 px-2 py-0.5 rounded">Review Now</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Link>
                        ))}
                      {[...events.joined, ...events.organized].filter(e => new Date(e.date_time) <= new Date()).length === 0 && (
                        <div className="col-span-full py-12 text-center text-stone-400">
                          <p>No past events found.</p>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </section>

            {/* Bookings Management */}
            {(profile.role === 'organizer' || profile.role === 'vendor' || profile.role === 'photographer' || profile.role === 'vehicle_owner') && (
              <section>
                <h3 className="text-2xl font-serif font-bold text-stone-900 mb-6 flex items-center gap-3">
                  <Share2 className="text-olive-drab" />
                  My Bookings
                </h3>
                
                <div className="space-y-6">
                  {/* Bookings as Organizer */}
                  {profile.role === 'organizer' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="card p-6">
                        <h4 className="text-lg font-serif font-bold text-stone-800 mb-4 flex items-center gap-2">
                          <Car size={18} className="text-stone-400" />
                          Vehicles I Booked
                        </h4>
                        {bookings.vehicleBookings.length === 0 ? (
                          <p className="text-sm text-stone-400">No vehicle bookings.</p>
                        ) : (
                          <div className="space-y-3">
                            {bookings.vehicleBookings.map(b => (
                              <div key={b.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl">
                                <div>
                                  <div className="text-sm font-bold text-stone-900">{b.make} {b.model}</div>
                                  <div className="text-[10px] text-stone-500">For: {b.event_title}</div>
                                </div>
                                <div className="text-right">
                                  <div className={`text-[10px] font-bold uppercase ${b.status === 'accepted' ? 'text-green-600' : 'text-amber-600'}`}>{b.status}</div>
                                  <div className="text-xs font-medium text-stone-700">KES {(b.total_price ?? 0).toLocaleString()}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="card p-6">
                        <h4 className="text-lg font-serif font-bold text-stone-800 mb-4 flex items-center gap-2">
                          <Camera size={18} className="text-stone-400" />
                          Photographers I Booked
                        </h4>
                        {bookings.photographerBookings.length === 0 ? (
                          <p className="text-sm text-stone-400">No photographer bookings.</p>
                        ) : (
                          <div className="space-y-3">
                            {bookings.photographerBookings.map(b => (
                              <div key={b.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl">
                                <div>
                                  <div className="text-sm font-bold text-stone-900">{b.photographer_name}</div>
                                  <div className="text-[10px] text-stone-500">For: {b.event_title}</div>
                                </div>
                                <div className="text-right">
                                  <div className={`text-[10px] font-bold uppercase ${b.status === 'accepted' ? 'text-green-600' : 'text-amber-600'}`}>{b.status}</div>
                                  <div className="text-xs font-medium text-stone-700">KES {(b.total_price ?? 0).toLocaleString()}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Bookings as Service Provider */}
                  {(profile.role === 'vendor' || profile.role === 'photographer' || profile.role === 'vehicle_owner') && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {(profile.role === 'vendor' || profile.role === 'vehicle_owner') && (
                        <div className="card p-6">
                          <h4 className="text-lg font-serif font-bold text-stone-800 mb-4 flex items-center gap-2">
                            <Car size={18} className="text-stone-400" />
                            Vehicle Requests
                          </h4>
                          {bookings.myServiceVehicleBookings.length === 0 ? (
                            <p className="text-sm text-stone-400">No requests yet.</p>
                          ) : (
                            <div className="space-y-3">
                              {bookings.myServiceVehicleBookings.map(b => (
                                <div key={b.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl">
                                  <div>
                                    <div className="text-sm font-bold text-stone-900">{b.make} {b.model}</div>
                                    <div className="text-[10px] text-stone-500">By: {b.organizer_name}</div>
                                    <div className="text-[10px] text-stone-400">For: {b.event_title}</div>
                                  </div>
                                  <div className="text-right">
                                    <div className={`text-[10px] font-bold uppercase ${b.status === 'accepted' ? 'text-green-600' : 'text-amber-600'}`}>{b.status}</div>
                                    <div className="text-xs font-medium text-stone-700">KES {(b.total_price ?? 0).toLocaleString()}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {(profile.role === 'vendor' || profile.role === 'photographer') && (
                        <div className="card p-6">
                          <h4 className="text-lg font-serif font-bold text-stone-800 mb-4 flex items-center gap-2">
                            <Camera size={18} className="text-stone-400" />
                            Photography Requests
                          </h4>
                          {bookings.myServicePhotographerBookings.length === 0 ? (
                            <p className="text-sm text-stone-400">No requests yet.</p>
                          ) : (
                            <div className="space-y-3">
                              {bookings.myServicePhotographerBookings.map(b => (
                                <div key={b.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl">
                                  <div>
                                    <div className="text-sm font-bold text-stone-900">Request for Event</div>
                                    <div className="text-[10px] text-stone-500">By: {b.organizer_name}</div>
                                    <div className="text-[10px] text-stone-400">For: {b.event_title}</div>
                                  </div>
                                  <div className="text-right">
                                    <div className={`text-[10px] font-bold uppercase ${b.status === 'accepted' ? 'text-green-600' : 'text-amber-600'}`}>{b.status}</div>
                                    <div className="text-xs font-medium text-stone-700">KES {(b.total_price ?? 0).toLocaleString()}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
