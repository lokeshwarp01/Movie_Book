import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';

// Components
import Navbar from './components/common/Navbar';
import Footer from './components/common/Footer';
import ProtectedRoute from './components/auth/ProtectedRoute';

// Pages
import Home from './pages/Home';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import Movies from './pages/Movies';
import MovieDetails from './pages/MovieDetails';
import Theaters from './pages/Theaters';
import TheaterDetails from './pages/TheaterDetails';
import Booking from './pages/Booking';
import BookingHistory from './pages/BookingHistory';
import Profile from './pages/Profile';

// Admin Pages
// import SuperAdminDashboard from './pages/admin/SuperAdminDashboard';
// import TheaterAdminDashboard from './pages/admin/TheaterAdminDashboard';
import SuperAdminDashboardNew from './pages/admin/SuperAdminDashboardNew';
import TheaterAdminDashboardNew from './pages/admin/TheaterAdminDashboardNew';

// Context
import { AuthProvider } from './context/AuthContext';

// Socket.IO
import { SocketProvider } from './context/SocketContext';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <SocketProvider>
            <div className="min-h-screen bg-gray-50">
              <Navbar />
              <main className="flex-1">
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={<Home />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/movies" element={<Movies />} />
                  <Route path="/movies/:id" element={<MovieDetails />} />
                  <Route path="/theaters" element={<Theaters />} />
                  <Route path="/theaters/:id" element={<TheaterDetails />} />

                  {/* Protected User Routes */}
                  <Route path="/booking/:showId" element={
                    <ProtectedRoute allowedRoles={['user']}>
                      <Booking />
                    </ProtectedRoute>
                  } />
                  <Route path="/bookings" element={
                    <ProtectedRoute allowedRoles={['user']}>
                      <BookingHistory />
                    </ProtectedRoute>
                  } />
                  <Route path="/profile" element={
                    <ProtectedRoute allowedRoles={['user', 'theater_admin', 'super_admin']}>
                      <Profile />
                    </ProtectedRoute>
                  } />

                  {/* Super Admin Routes */}
                  <Route path="/admin/super" element={
                    <ProtectedRoute allowedRoles={['super_admin']}>
                      <SuperAdminDashboardNew />
                    </ProtectedRoute>
                  } />
                  
                  {/* Theater Admin Routes */}
                  <Route path="/admin/theater/:theaterId?" element={
                    <ProtectedRoute allowedRoles={['theater_admin', 'super_admin']}>
                      <TheaterAdminDashboardNew />
                    </ProtectedRoute>
                  } />

                  {/* Catch all route */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
              <Footer />
            </div>
          </SocketProvider>
        </AuthProvider>
      </Router>
      {/* <ReactQueryDevtools initialIsOpen={false} /> */}
    </QueryClientProvider>
  );
}

export default App;
