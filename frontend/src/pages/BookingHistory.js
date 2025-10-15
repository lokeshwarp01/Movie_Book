import React, { useState, useEffect } from 'react';
import { FiCalendar, FiMapPin, FiClock, FiTag, FiDownload } from 'react-icons/fi';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const BookingHistory = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, upcoming, past

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const response = await api.get('/bookings/user');
      setBookings(response.data.data.bookings || []);
    } catch (error) {
      toast.error('Failed to fetch booking history');
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timeString) => {
    const time = new Date(`2000-01-01 ${timeString}`);
    return time.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filterBookings = () => {
    const now = new Date();
    return bookings.filter(booking => {
      const showDateTime = new Date(`${booking.show.date} ${booking.show.time}`);
      
      if (filter === 'upcoming') {
        return showDateTime > now;
      } else if (filter === 'past') {
        return showDateTime <= now;
      }
      return true; // all
    });
  };

  const handleDownloadTicket = async (bookingId) => {
    try {
      const response = await api.get(`/bookings/${bookingId}/ticket`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ticket-${bookingId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Failed to download ticket');
      console.error('Error downloading ticket:', error);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) {
      return;
    }

    try {
      await api.put(`/bookings/${bookingId}/cancel`);
      toast.success('Booking cancelled successfully');
      fetchBookings(); // Refresh the list
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to cancel booking');
      console.error('Error cancelling booking:', error);
    }
  };

  const filteredBookings = filterBookings();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Bookings</h1>
          <p className="text-gray-600">View and manage your movie ticket bookings</p>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { key: 'all', label: 'All Bookings' },
                { key: 'upcoming', label: 'Upcoming' },
                { key: 'past', label: 'Past' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    filter === tab.key
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Bookings List */}
        {filteredBookings.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm">
            <FiTag className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {filter === 'all' ? 'No bookings found' : `No ${filter} bookings`}
            </h3>
            <p className="text-gray-500 mb-4">
              {filter === 'all' 
                ? "You haven't made any bookings yet" 
                : `You don't have any ${filter} bookings`
              }
            </p>
            <button
              onClick={() => window.location.href = '/movies'}
              className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 transition-colors"
            >
              Browse Movies
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredBookings.map((booking) => (
              <div key={booking._id} className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-xl font-semibold text-gray-900">
                          {booking.show.movie.title}
                        </h3>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(booking.status)}`}>
                          {booking.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600 mb-4">
                        <div className="flex items-center gap-2">
                          <FiMapPin className="w-4 h-4" />
                          <span>{booking.show.theater.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FiCalendar className="w-4 h-4" />
                          <span>{formatDate(booking.show.date)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FiClock className="w-4 h-4" />
                          <span>{formatTime(booking.show.time)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FiTag className="w-4 h-4" />
                          <span>Screen {booking.show.screen}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-4">
                        <span className="text-sm text-gray-600">
                          <strong>Seats:</strong> {booking.seats.join(', ')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-lg font-semibold text-gray-900">
                            ₹{booking.totalAmount}
                          </span>
                          <span className="text-sm text-gray-600 ml-2">
                            ({booking.seats.length} ticket{booking.seats.length > 1 ? 's' : ''})
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          {booking.status.toLowerCase() === 'confirmed' && (
                            <>
                              <button
                                onClick={() => handleDownloadTicket(booking._id)}
                                className="flex items-center gap-2 px-3 py-1 text-sm bg-primary-100 text-primary-700 rounded-md hover:bg-primary-200 transition-colors"
                              >
                                <FiDownload className="w-4 h-4" />
                                Download Ticket
                              </button>
                              
                              {new Date(`${booking.show.date} ${booking.show.time}`) > new Date() && (
                                <button
                                  onClick={() => handleCancelBooking(booking._id)}
                                  className="px-3 py-1 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50 transition-colors"
                                >
                                  Cancel
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 text-xs text-gray-500">
                        Booking ID: {booking._id} • 
                        Booked on: {new Date(booking.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Movie poster strip */}
                <div className="border-t border-gray-200 bg-gray-50 px-6 py-3">
                  <div className="flex items-center gap-3">
                    {booking.show.movie.poster && (
                      <img
                        src={booking.show.movie.poster}
                        alt={booking.show.movie.title}
                        className="w-12 h-16 object-cover rounded"
                      />
                    )}
                    <div className="text-sm text-gray-600">
                      <p>{booking.show.movie.genre} • {booking.show.movie.language}</p>
                      <p>
                        {typeof booking.show.theater.location === 'string' 
                          ? booking.show.theater.location 
                          : booking.show.theater.address?.city || 'Location not available'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        {filteredBookings.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Booking Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary-600">{filteredBookings.length}</div>
                <div className="text-sm text-gray-600">Total Bookings</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  ₹{filteredBookings.reduce((sum, booking) => sum + booking.totalAmount, 0)}
                </div>
                <div className="text-sm text-gray-600">Total Spent</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {filteredBookings.reduce((sum, booking) => sum + booking.seats.length, 0)}
                </div>
                <div className="text-sm text-gray-600">Total Tickets</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingHistory;