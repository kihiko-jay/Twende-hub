import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User, PlusCircle, LayoutDashboard, Car, Truck, Camera, Briefcase, Menu, X } from 'lucide-react';
import React from 'react';
import { AnimatePresence, motion } from 'motion/react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = React.useState(false);
  const connectingRef = React.useRef(false);

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  React.useEffect(() => {
    if (connectingRef.current) return;
    if (isOpen) {
      setIsOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-warm-off-white/80 backdrop-blur-md border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <Link to="/" className="flex items-center space-x-2">
            <span className="text-3xl font-serif font-bold tracking-tight text-olive-drab">TwendeHub</span>
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            <Link to="/" className="text-stone-600 hover:text-olive-drab font-medium transition-colors">Explore</Link>
            <Link to="/find-people" className="text-stone-600 hover:text-olive-drab font-medium transition-colors">Find People</Link>
            {user ? (
              <>
                {user.role === 'organizer' && (
                  <Link to="/create-event" className="flex items-center space-x-2 text-stone-600 hover:text-olive-drab font-medium transition-colors">
                    <PlusCircle size={18} />
                    <span>Create Event</span>
                  </Link>
                )}
                {user.role === 'vehicle_owner' && (
                  <>
                    <Link to="/register-vehicle" className="flex items-center space-x-2 text-stone-600 hover:text-olive-drab font-medium transition-colors">
                      <Car size={18} />
                      <span>List Vehicle</span>
                    </Link>
                    <Link to="/my-vehicles" className="flex items-center space-x-2 text-stone-600 hover:text-olive-drab font-medium transition-colors">
                      <Truck size={18} />
                      <span>My Fleet</span>
                    </Link>
                  </>
                )}
                {user.role === 'photographer' && (
                  <>
                    <Link to="/photographer-registration" className="flex items-center space-x-2 text-stone-600 hover:text-olive-drab font-medium transition-colors">
                      <Camera size={18} />
                      <span>Profile</span>
                    </Link>
                    <Link to="/my-photography" className="flex items-center space-x-2 text-stone-600 hover:text-olive-drab font-medium transition-colors">
                      <Briefcase size={18} />
                      <span>My Studio</span>
                    </Link>
                  </>
                )}
                {user.role === 'vendor' && (
                  <>
                    <Link to="/register-vehicle" className="flex items-center space-x-2 text-stone-600 hover:text-olive-drab font-medium transition-colors">
                      <Car size={18} />
                      <span>List Vehicle</span>
                    </Link>
                    <Link to="/my-vehicles" className="flex items-center space-x-2 text-stone-600 hover:text-olive-drab font-medium transition-colors">
                      <Truck size={18} />
                      <span>My Fleet</span>
                    </Link>
                    <Link to="/photographer-registration" className="flex items-center space-x-2 text-stone-600 hover:text-olive-drab font-medium transition-colors">
                      <Camera size={18} />
                      <span>Studio Profile</span>
                    </Link>
                    <Link to="/my-photography" className="flex items-center space-x-2 text-stone-600 hover:text-olive-drab font-medium transition-colors">
                      <Briefcase size={18} />
                      <span>My Studio</span>
                    </Link>
                  </>
                )}
                {user.role === 'admin' && (
                  <Link to="/admin" className="flex items-center space-x-2 text-stone-600 hover:text-olive-drab font-medium transition-colors">
                    <LayoutDashboard size={18} />
                    <span>Admin</span>
                  </Link>
                )}
                <div className="flex items-center space-x-4 ml-4 pl-4 border-l border-stone-200">
                  <Link to="/profile" className="flex items-center space-x-2 text-stone-700 hover:text-olive-drab transition-colors">
                    <div className="w-8 h-8 rounded-full bg-olive-drab/10 flex items-center justify-center text-olive-drab overflow-hidden">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <User size={16} />
                      )}
                    </div>
                    <span className="text-sm font-medium">{user.name}</span>
                  </Link>
                  <button 
                    onClick={logout}
                    className="text-stone-400 hover:text-red-500 transition-colors"
                    aria-label="Log out of TwendeHub"
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-4">
                <Link to="/login" className="text-stone-600 hover:text-olive-drab font-medium transition-colors">Login</Link>
                <Link to="/register" className="olive-button">Join Now</Link>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <div className="flex md:hidden items-center">
            <button
              type="button"
              aria-label="Toggle navigation"
              aria-expanded={isOpen}
              className="p-2 rounded-full border border-stone-200 text-stone-700 hover:text-olive-drab hover:border-olive-drab transition-colors"
              onClick={() => setIsOpen((prev) => !prev)}
            >
              {isOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="mobile-nav"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden bg-white border-t border-stone-200"
            role="navigation"
          >
            <div className="px-4 pt-4 pb-8 space-y-6">
              {user && (
                <div className="flex items-center space-x-3 pb-4 border-b border-stone-200">
                  <div className="w-10 h-10 rounded-full bg-olive-drab/10 flex items-center justify-center text-olive-drab">
                    <User size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-stone-900">{user.name}</div>
                    <div className="text-xs uppercase tracking-widest text-stone-400">
                      {user.role}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <div className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">
                  Navigation
                </div>
                <MobileLink to="/" label="Explore Trips" onClick={() => setIsOpen(false)} />
                <MobileLink to="/find-people" label="Find People" onClick={() => setIsOpen(false)} />
                <MobileLink to="/create-event" label="For Organizers" onClick={() => setIsOpen(false)} />
                <MobileLink to="/pricing" label="Pricing" onClick={() => setIsOpen(false)} />
              </div>

              {user && user.role === 'organizer' && (
                <div className="space-y-1">
                  <div className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">
                    Organizer Tools
                  </div>
                  <MobileLink to="/create-event" label="Create Event" onClick={() => setIsOpen(false)} />
                  <MobileLink to="/profile" label="Profile & Dashboard" onClick={() => setIsOpen(false)} />
                </div>
              )}

              {(user && (user.role === 'vehicle_owner' || user.role === 'vendor')) && (
                <div className="space-y-1">
                  <div className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">
                    Vehicle Tools
                  </div>
                  <MobileLink to="/register-vehicle" label="List Vehicle" onClick={() => setIsOpen(false)} />
                  <MobileLink to="/my-vehicles" label="My Fleet" onClick={() => setIsOpen(false)} />
                </div>
              )}

              {(user && (user.role === 'photographer' || user.role === 'vendor')) && (
                <div className="space-y-1">
                  <div className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">
                    Vendor Tools
                  </div>
                  <MobileLink to="/photographer-registration" label="Studio Profile" onClick={() => setIsOpen(false)} />
                  <MobileLink to="/my-photography" label="My Studio" onClick={() => setIsOpen(false)} />
                </div>
              )}

              {user && user.role === 'admin' && (
                <div className="space-y-1">
                  <div className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">
                    Admin
                  </div>
                  <MobileLink to="/admin" label="Admin Dashboard" onClick={() => setIsOpen(false)} />
                </div>
              )}

              {!user && (
                <div className="pt-4 border-t border-stone-200">
                  <Link
                    to="/login"
                    className="block w-full mb-3 rounded-full bg-olive-drab text-white py-3 text-sm font-semibold text-center"
                    onClick={() => setIsOpen(false)}
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="block w-full rounded-full border border-stone-300 py-3 text-sm font-semibold text-stone-800 text-center"
                    onClick={() => setIsOpen(false)}
                  >
                    Sign up
                  </Link>
                </div>
              )}

              {user && (
                <div className="pt-4 border-t border-stone-200">
                  <button
                    type="button"
                    className="w-full rounded-full border border-stone-300 py-3 text-sm font-semibold text-stone-800"
                    onClick={() => {
                      setIsOpen(false);
                      logout();
                    }}
                    aria-label="Log out of TwendeHub"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

interface MobileLinkProps {
  to: string;
  label: string;
  onClick: () => void;
}

function MobileLink({ to, label, onClick }: MobileLinkProps) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="block w-full text-left px-3 py-3 text-sm text-stone-700 hover:bg-stone-50 border-b border-stone-200"
    >
      {label}
    </Link>
  );
}

