import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiStar, FiClock, FiCalendar, FiMapPin, FiPlay, FiArrowLeft } from 'react-icons/fi';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const MovieDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [movie, setMovie] = useState(null);
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTheater, setSelectedTheater] = useState('');

  useEffect(() => {
    if (id) {
      fetchMovieDetails();
      fetchShows();
    }
  }, [id]);

  const fetchMovieDetails = async () => {
    try {
      const response = await api.get(`/movies/${id}`);
      setMovie(response.data.data.movie);
    } catch (error) {
      toast.error('Failed to fetch movie details');
      console.error('Error fetching movie details:', error);
    }
  };

  const fetchShows = async () => {
    try {
      const response = await api.get(`/shows/movie/${id}`);
      setShows(response.data.data.shows || []);
    } catch (error) {
      console.error('Error fetching shows:', error);
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
      weekday: 'short',
      month: 'short',
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

  const getUniqueDates = () => {
    const dates = [...new Set(shows.map(show => show.date))];
    return dates.sort((a, b) => new Date(a) - new Date(b));
  };

  const getTheatersForDate = (date) => {
    const theatersMap = new Map();
    shows
      .filter(show => show.date === date)
      .forEach(show => {
        if (!theatersMap.has(show.theater._id)) {
          theatersMap.set(show.theater._id, {
            ...show.theater,
            shows: []
          });
        }
        theatersMap.get(show.theater._id).shows.push(show);
      });
    return Array.from(theatersMap.values());
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

  if (!movie) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Movie not found</h3>
            <button
              onClick={() => navigate('/movies')}
              className="text-primary-600 hover:text-primary-700"
            >
              Back to Movies
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Movie Hero Section */}
      <div className="relative bg-gray-900 text-white">
        <div className="absolute inset-0 bg-black bg-opacity-50"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <button
            onClick={() => navigate('/movies')}
            className="flex items-center gap-2 text-white hover:text-gray-300 mb-8"
          >
            <FiArrowLeft className="w-5 h-5" />
            Back to Movies
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Movie Poster */}
            <div className="lg:col-span-1">
              <div className="aspect-w-3 aspect-h-4 bg-gray-200 rounded-lg overflow-hidden">
                {movie.poster ? (
                  <img
                    src={movie.poster}
                    alt={movie.title}
                    className="w-full h-96 object-cover rounded-lg"
                  />
                ) : (
                  <div className="flex items-center justify-center h-96 bg-gray-700 rounded-lg">
                    <FiPlay className="h-16 w-16 text-gray-400" />
                  </div>
                )}
              </div>
            </div>

            {/* Movie Details */}
            <div className="lg:col-span-2">
              <h1 className="text-4xl font-bold mb-4">{movie.title}</h1>
              
              <div className="flex flex-wrap items-center gap-6 mb-6">
                <div className="flex items-center gap-2">
                  <FiStar className="w-5 h-5 text-yellow-500" />
                  <span className="text-lg">{movie.rating || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FiClock className="w-5 h-5" />
                  <span>{movie.duration || 'N/A'} minutes</span>
                </div>
                <span className="px-3 py-1 bg-primary-600 text-white rounded-full text-sm">
                  {movie.genre}
                </span>
                <span className="px-3 py-1 bg-gray-700 text-white rounded-full text-sm">
                  {movie.language}
                </span>
              </div>

              <p className="text-lg text-gray-300 mb-6 leading-relaxed">
                {movie.description}
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Director:</span>
                  <p className="font-medium">{movie.director || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-gray-400">Cast:</span>
                  <p className="font-medium">{movie.cast?.join(', ') || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-gray-400">Release Date:</span>
                  <p className="font-medium">
                    {movie.releaseDate ? formatDate(movie.releaseDate) : 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400">Certificate:</span>
                  <p className="font-medium">{movie.certificate || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Showtimes Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-8">Book Tickets</h2>

        {shows.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm">
            <FiCalendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No shows available</h3>
            <p className="text-gray-500">Check back later for available showtimes</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Date Selection */}
            <div className="flex flex-wrap gap-2">
              {getUniqueDates().map((date) => (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedDate === date
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {formatDate(date)}
                </button>
              ))}
            </div>

            {/* Theaters and Showtimes */}
            {(selectedDate || getUniqueDates()[0]) && (
              <div className="space-y-6">
                {getTheatersForDate(selectedDate || getUniqueDates()[0]).map((theater) => (
                  <div key={theater._id} className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{theater.name}</h3>
                        <div className="flex items-center gap-1 text-gray-600">
                          <FiMapPin className="w-4 h-4" />
                          <span className="text-sm">
                            {typeof theater.location === 'string' 
                              ? theater.location 
                              : theater.address?.city || 'Location not available'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {theater.shows.map((show) => (
                        <button
                          key={show._id}
                          onClick={() => handleBooking(show._id)}
                          className="px-4 py-2 border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-600 hover:text-white transition-colors"
                        >
                          {formatTime(show.time)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MovieDetails;