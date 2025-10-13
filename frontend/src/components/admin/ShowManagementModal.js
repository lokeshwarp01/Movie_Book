import React, { useState, useEffect } from 'react';
import { FiX, FiCalendar, FiClock, FiDollarSign, FiFilm, FiMonitor } from 'react-icons/fi';
import api from '../../services/api';
import { toast } from 'react-hot-toast';

const ShowManagementModal = ({ isOpen, onClose, show, onSave, theaterId }) => {
  const [formData, setFormData] = useState({
    movieId: '',
    screenId: '',
    startTime: '',
    endTime: '',
    price: '',
    isActive: true
  });
  const [movies, setMovies] = useState([]);
  const [screens, setScreens] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchMovies();
      fetchScreens();
      if (show) {
        setFormData({
          movieId: show.movieId?._id || '',
          screenId: show.screenId?._id || '',
          startTime: show.startTime ? new Date(show.startTime).toISOString().slice(0, 16) : '',
          endTime: show.endTime ? new Date(show.endTime).toISOString().slice(0, 16) : '',
          price: show.price || '',
          isActive: show.isActive !== undefined ? show.isActive : true
        });
      } else {
        setFormData({
          movieId: '',
          screenId: '',
          startTime: '',
          endTime: '',
          price: '',
          isActive: true
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, show]);

  const fetchMovies = async () => {
    try {
      const response = await api.get('/movies');
      setMovies(response.data.data.movies || []);
    } catch (error) {
      console.error('Error fetching movies:', error);
      toast.error('Failed to fetch movies');
    }
  };

  const fetchScreens = async () => {
    try {
      const response = await api.get(`/theaters/${theaterId}/screens`);
      setScreens(response.data.data.screens || []);
    } catch (error) {
      console.error('Error fetching screens:', error);
      toast.error('Failed to fetch screens');
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleStartTimeChange = (e) => {
    const startTime = new Date(e.target.value);
    const endTime = new Date(startTime.getTime() + (2 * 60 * 60 * 1000)); // Add 2 hours
    
    setFormData(prev => ({
      ...prev,
      startTime: e.target.value,
      endTime: endTime.toISOString().slice(0, 16)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const showData = {
        ...formData,
        theaterId,
        price: Number(formData.price),
        startTime: new Date(formData.startTime),
        endTime: new Date(formData.endTime)
      };

      await onSave(showData);
      onClose();
    } catch (error) {
      console.error('Error saving show:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-4/5 max-w-2xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">
              {show ? 'Edit Show' : 'Add New Show'}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Movie Selection */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FiFilm className="inline w-4 h-4 mr-2" />
                  Movie
                </label>
                <select
                  name="movieId"
                  value={formData.movieId}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                  required
                >
                  <option value="">Select a movie</option>
                  {movies.map((movie) => (
                    <option key={movie._id} value={movie._id}>
                      {movie.title} ({movie.language})
                    </option>
                  ))}
                </select>
              </div>

              {/* Screen Selection */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FiMonitor className="inline w-4 h-4 mr-2" />
                  Screen
                </label>
                <select
                  name="screenId"
                  value={formData.screenId}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                  required
                >
                  <option value="">Select a screen</option>
                  {screens.map((screen) => (
                    <option key={screen._id} value={screen._id}>
                      {screen.name} ({screen.screenType})
                    </option>
                  ))}
                </select>
              </div>

              {/* Start Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FiCalendar className="inline w-4 h-4 mr-2" />
                  Show Date & Time
                </label>
                <input
                  type="datetime-local"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleStartTimeChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                  required
                />
              </div>

              {/* End Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FiClock className="inline w-4 h-4 mr-2" />
                  End Time
                </label>
                <input
                  type="datetime-local"
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                  required
                />
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FiDollarSign className="inline w-4 h-4 mr-2" />
                  Price (₹)
                </label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                  min="0"
                  step="10"
                  required
                />
              </div>

              {/* Active Status */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-900">
                  Active Show
                </label>
              </div>
            </div>

            {/* Selected Movie Info */}
            {formData.movieId && movies.find(m => m._id === formData.movieId) && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Movie Details</h4>
                {(() => {
                  const movie = movies.find(m => m._id === formData.movieId);
                  return (
                    <div className="text-sm text-gray-600">
                      <p><strong>Duration:</strong> {movie.duration} minutes</p>
                      <p><strong>Genre:</strong> {Array.isArray(movie.genre) ? movie.genre.join(', ') : movie.genre}</p>
                      <p><strong>Rating:</strong> {movie.rating}</p>
                      {movie.imdbRating && <p><strong>IMDB Rating:</strong> {movie.imdbRating}/10</p>}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Selected Screen Info */}
            {formData.screenId && screens.find(s => s._id === formData.screenId) && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Screen Details</h4>
                {(() => {
                  const screen = screens.find(s => s._id === formData.screenId);
                  return (
                    <div className="text-sm text-gray-600">
                      <p><strong>Capacity:</strong> {screen.rows * screen.columns} seats</p>
                      <p><strong>Screen Type:</strong> {screen.screenType}</p>
                      <p><strong>Sound System:</strong> {screen.soundSystem}</p>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? 'Saving...' : (show ? 'Update Show' : 'Create Show')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ShowManagementModal;
