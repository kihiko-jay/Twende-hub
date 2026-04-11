import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import { RequireAuth } from './components/RouteGuards';

const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const CreateEvent = lazy(() => import('./pages/CreateEvent'));
const EventDetail = lazy(() => import('./pages/EventDetail'));
const VehicleRegistration = lazy(() => import('./pages/VehicleRegistration'));
const MyVehicles = lazy(() => import('./pages/MyVehicles'));
const VehicleBooking = lazy(() => import('./pages/VehicleBooking'));
const PhotographerRegistration = lazy(() => import('./pages/PhotographerRegistration'));
const MyPhotography = lazy(() => import('./pages/MyPhotography'));
const PhotographerBooking = lazy(() => import('./pages/PhotographerBooking'));
const Profile = lazy(() => import('./pages/Profile'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const Pricing = lazy(() => import('./pages/Pricing'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const Terms = lazy(() => import('./pages/Terms'));
const NotFound = lazy(() => import('./pages/NotFound'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Help = lazy(() => import('./pages/Help'));
const Safety = lazy(() => import('./pages/Safety'));
const FindPeople = lazy(() => import('./pages/FindPeople'));
const ActivityRequestDetail = lazy(() => import('./pages/ActivityRequestDetail'));
const Payment = lazy(() => import('./pages/Payment'));

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-warm-off-white">
          <Navbar />
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-white focus:text-stone-900 focus:px-4 focus:py-2 focus:rounded-full focus:shadow-lg"
          >
            Skip to main content
          </a>
          <main id="main-content">
            <Suspense fallback={<div className="pt-32 text-center">Loading...</div>}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route
                  path="/create-event"
                  element={
                    <RequireAuth allowedRoles={['organizer']}>
                      <CreateEvent />
                    </RequireAuth>
                  }
                />
                <Route path="/events/:id" element={<EventDetail />} />
                <Route
                  path="/register-vehicle"
                  element={
                    <RequireAuth allowedRoles={['vehicle_owner', 'vendor']}>
                      <VehicleRegistration />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/my-vehicles"
                  element={
                    <RequireAuth allowedRoles={['vehicle_owner', 'vendor']}>
                      <MyVehicles />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/book-transport"
                  element={
                    <RequireAuth>
                      <VehicleBooking />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/photographer-registration"
                  element={
                    <RequireAuth allowedRoles={['photographer', 'vendor']}>
                      <PhotographerRegistration />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/my-photography"
                  element={
                    <RequireAuth allowedRoles={['photographer', 'vendor']}>
                      <MyPhotography />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/book-photographer"
                  element={
                    <RequireAuth>
                      <PhotographerBooking />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <RequireAuth>
                      <Profile />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <RequireAuth allowedRoles={['admin']}>
                      <AdminDashboard />
                    </RequireAuth>
                  }
                />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/help" element={<Help />} />
                <Route path="/safety" element={<Safety />} />
                <Route
                  path="/find-people"
                  element={
                    <RequireAuth>
                      <FindPeople />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/payment"
                  element={
                    <RequireAuth>
                      <Payment />
                    </RequireAuth>
                  }
                />
                <Route path="/activity/:id" element={<ActivityRequestDetail />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </main>
          <footer className="bg-stone-900 text-stone-400 py-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
                <div className="col-span-2">
                  <span className="text-3xl font-serif font-bold text-white mb-6 block">TwendeHub</span>
                  <p className="max-w-md">
                    Building the the world's most trusted platform for outdoor adventures and group experiences. Join us in exploring the beauty of Kenya.
                  </p>
                </div>
                <div>
                  <h4 className="text-white font-bold mb-6 uppercase tracking-widest text-xs">Platform</h4>
                  <ul className="space-y-4">
                    <li><Link to="/" className="hover:text-white transition-colors">Explore Events</Link></li>
                    <li><Link to="/create-event" className="hover:text-white transition-colors">Organize</Link></li>
                    <li><Link to="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-white font-bold mb-6 uppercase tracking-widest text-xs">Support</h4>
                  <ul className="space-y-4">
                    <li><Link to="/help" className="hover:text-white transition-colors">Help Center</Link></li>
                    <li><Link to="/safety" className="hover:text-white transition-colors">Safety Guidelines</Link></li>
                    <li><Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
                    <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                  </ul>
                </div>
              </div>
              <div className="mt-20 pt-8 border-t border-stone-800 text-sm flex justify-between items-center">
                <p>&copy; 2026 TwendeHub. All rights reserved.</p>
                <div className="flex space-x-6">
                  <a href="https://instagram.com/twendehub" className="hover:text-white">Instagram</a>
                  <a href="https://twitter.com/twendehub" className="hover:text-white">Twitter</a>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </Router>
    </AuthProvider>
  );
}
