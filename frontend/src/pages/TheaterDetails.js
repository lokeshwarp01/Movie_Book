import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiMapPin, FiPhone, FiMail, FiStar, FiArrowLeft, FiCalendar } from 'react-icons/fi';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const TheaterDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [theater, setTheater] = useState(null);
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchTheaterDetails();
      fetchTheaterShows();
    }
  }, [id]);

  const fetchTheaterDetails = async () => {
    try {
      const response = await api.get(`/theaters/${id}`);
      setTheater(response.data.data.theater);
    } catch (error) {
      toast.error('Failed to fetch theater details');
      console.error('Error fetching theater details:', error);
    }
  };

  const fetchTheaterShows = async () => {
    try {
      const response = await api.get(`/shows/theater/${id}`);
      setShows(response.data.data.shows || []);
    } catch (error) {
      console.error('Error fetching theater shows:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBooking = (showId) => {
    if (!isAuthenticated) {
      toast.error('Please login to book tickets');
      navigate('/login');
      return;
    }
    navigate(`/booking/${showId}`);
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

  const groupShowsByDate = () => {
    const grouped = {};
    shows.forEach(show => {
      const date = show.date;
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(show);
    });
    return grouped;
  };

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

  if (!theater) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Theater not found</h3>
            <button
              onClick={() => navigate('/theaters')}
              className="text-primary-600 hover:text-primary-700"
            >
              Back to Theaters
            </button>
          </div>
        </div>
      </div>
    );
  }

  const groupedShows = groupShowsByDate();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Theater Hero Section */}
      <div className="relative bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <button
            onClick={() => navigate('/theaters')}
            className="flex items-center gap-2 text-white hover:text-gray-300 mb-8"
          >
            <FiArrowLeft className="w-5 h-5" />
            Back to Theaters
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Theater Image */}
            <div className="lg:col-span-1">
              <div className="aspect-w-4 aspect-h-3 bg-white bg-opacity-20 rounded-lg overflow-hidden">
                {theater.image ? (
                  <img
                    src={theater.image}
                    alt={theater.name}
                    className="w-full h-64 object-cover rounded-lg"
                  />
                ) : (
                  <div className="flex items-center justify-center h-64 bg-white bg-opacity-10 rounded-lg">
                    <FiMapPin className="h-16 w-16 text-white opacity-50" />
                  </div>
                )}
              </div>
            </div>

            {/* Theater Information */}
            <div className="lg:col-span-2">
              <h1 className="text-4xl font-bold mb-4">{theater.name}</h1>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3">
                  <FiMapPin className="w-5 h-5" />
                  <span className="text-lg">
                    {typeof theater.location === 'string' 
                      ? theater.location 
                      : theater.address?.city || 'Location not available'}
                  </span>
                </div>
                {theater.phone && (
                  <div className="flex items-center gap-3">
                    <FiPhone className="w-5 h-5" />
                    <span>{theater.phone}</span>
                  </div>
                )}
                {theater.email && (
                  <div className="flex items-center gap-3">
                    <FiMail className="w-5 h-5" />
                    <span>{theater.email}</span>
                  </div>
                )}
                {theater.rating && (
                  <div className="flex items-center gap-3">
                    <FiStar className="w-5 h-5 text-yellow-300" />
                    <span>{theater.rating} / 5.0</span>
                  </div>
                )}
              </div>

              <p className="text-lg text-gray-100 mb-6 leading-relaxed">
                {theater.description || `Experience the best of cinema at ${theater.name}. We provide comfortable seating, crystal clear sound, and an unforgettable movie experience.`}
              </p>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {theater.screens && (
                  <div className="bg-white bg-opacity-10 rounded-lg p-3">
                    <span className="text-sm text-gray-200">Screens</span>
                    <p className="text-xl font-bold">{theater.screens}</p>
                  </div>
                )}
                {theater.capacity && (
                  <div className="bg-white bg-opacity-10 rounded-lg p-3">
                    <span className="text-sm text-gray-200">Total Seats</span>
                    <p className="text-xl font-bold">{theater.capacity}</p>
                  </div>
                )}
                <div className="bg-white bg-opacity-10 rounded-lg p-3">
                  <span className="text-sm text-gray-200">Status</span>
                  <p className="text-xl font-bold text-green-300">Open</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Facilities Section */}
      {theater.facilities && theater.facilities.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Facilities & Amenities</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {theater.facilities.map((facility, index) => (
              <div key={index} className="bg-white rounded-lg shadow-sm p-4 text-center">
                <span className="text-gray-700 font-medium">{facility}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current Shows Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-8">Current Shows</h2>

        {Object.keys(groupedShows).length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm">
            <FiCalendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No shows available</h3>
            <p className="text-gray-500">Check back later for upcoming shows at this theater</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedShows)
              .sort(([a], [b]) => new Date(a) - new Date(b))
              .map(([date, dateShows]) => (
                <div key={date} className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">
                    {formatDate(date)}
                  </h3>
                  <div className="space-y-4">
                    {dateShows.map((show) => (
                      <div key={show._id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-lg font-medium text-gray-900">{show.movie.title}</h4>
                            <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                              <span>{show.movie.language}</span>
                              <span>•</span>
                              <span>{show.movie.genre}</span>
                              <span>•</span>
                              <span>Screen {show.screen}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold text-gray-900">
                              {formatTime(show.time)}
                            </div>
                            <div className="text-sm text-gray-600">
                              ₹{show.price} onwards
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex justify-end">
                          <button
                            onClick={() => handleBooking(show._id)}
                            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
                          >
                            Book Tickets
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TheaterDetails;