import React, { useState, useEffect } from 'react';
import { FiFilm, FiPlus, FiSearch, FiEdit, FiTrash2 } from 'react-icons/fi';
import api from '../../services/api';
import { toast } from 'react-hot-toast';

const MovieManagement = () => {
  const [movies, setMovies] = useState([]);
  const [pagination, setPagination] = useState({ 
    currentPage: 1, 
    totalPages: 1, 
    totalMovies: 0, 
    hasNext: false, 
    hasPrev: false 
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingMovie, setEditingMovie] = useState(null);
  const [movieForm, setMovieForm] = useState({
    title: '',
    genre: '',
    language: '',
    duration: '',
    description: '',
    director: '',
    cast: '',
    releaseDate: '',
    posterUrl: '',
    trailerUrl: '',
    rating: 'U/A',
    imdbRating: ''
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMovies(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMovies = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(searchTerm && { search: searchTerm })
      });
      
      const response = await api.get(`/movies?${params}`);
      setMovies(response.data.data.movies || []);
      setPagination(response.data.data.pagination || {});
    } catch (error) {
      toast.error('Failed to fetch movies');
      console.error('Error fetching movies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchMovies(1);
  };

  const handleMovieAction = async (movieId, action) => {
    setBusyId(movieId);
    try {
      let endpoint = `/movies/${movieId}`;
      
      switch (action) {
        case 'delete':
          await api.delete(endpoint);
          break;
        case 'update':
          // This will be handled by the modal form
          return;
        default:
          throw new Error('Invalid action');
      }

      toast.success(`Movie ${action}d successfully`);
      fetchMovies(pagination.currentPage);
    } catch (error) {
      toast.error(`Failed to ${action} movie`);
      console.error(`Error ${action}ing movie:`, error);
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveMovie = async (e) => {
    e.preventDefault();
    setBusyId('saving');
    try {
      const payload = {
        title: movieForm.title,
        genre: movieForm.genre.split(',').map(s => s.trim()).filter(Boolean),
        language: movieForm.language,
        duration: Number(movieForm.duration),
        description: movieForm.description,
        director: movieForm.director,
        cast: movieForm.cast.split(',').map(s => s.trim()).filter(Boolean),
        releaseDate: movieForm.releaseDate,
        posterUrl: movieForm.posterUrl,
        trailerUrl: movieForm.trailerUrl || undefined,
        rating: movieForm.rating,
        imdbRating: movieForm.imdbRating ? Number(movieForm.imdbRating) : undefined
      };

      if (editingMovie) {
        await api.put(`/movies/${editingMovie._id}`, payload);
        toast.success('Movie updated successfully');
      } else {
        await api.post('/movies', payload);
        toast.success('Movie created successfully');
      }
      
      setShowModal(false);
      resetForm();
      fetchMovies(pagination.currentPage);
    } catch (error) {
      toast.error(editingMovie ? 'Failed to update movie' : 'Failed to create movie');
      console.error('Error saving movie:', error);
    } finally {
      setBusyId(null);
    }
  };

  const openEditModal = (movie) => {
    setEditingMovie(movie);
    setMovieForm({
      title: movie.title || '',
      genre: Array.isArray(movie.genre) ? movie.genre.join(', ') : movie.genre || '',
      language: movie.language || '',
      duration: movie.duration?.toString() || '',
      description: movie.description || '',
      director: movie.director || '',
      cast: Array.isArray(movie.cast) ? movie.cast.join(', ') : movie.cast || '',
      releaseDate: movie.releaseDate || '',
      posterUrl: movie.posterUrl || '',
      trailerUrl: movie.trailerUrl || '',
      rating: movie.rating || 'U/A',
      imdbRating: movie.imdbRating?.toString() || ''
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setMovieForm({
      title: '',
      genre: '',
      language: '',
      duration: '',
      description: '',
      director: '',
      cast: '',
      releaseDate: '',
      posterUrl: '',
      trailerUrl: '',
      rating: 'U/A',
      imdbRating: ''
    });
    setEditingMovie(null);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const Empty = ({ icon, text }) => (
    <div className="text-center py-12">
      {icon}
      <h3 className="text-lg font-medium text-gray-900 mb-2">{text}</h3>
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Movie Management</h2>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
        >
          <FiPlus className="w-4 h-4" />
          Add Movie
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                placeholder="Search movies..."
              />
              <FiSearch className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            </div>
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            Search
          </button>
        </div>
      </div>

      {/* Movies Grid */}
      <div className="bg-white rounded-lg shadow-sm">
        {movies.length === 0 ? (
          <Empty icon={<FiFilm className="mx-auto h-12 w-12 text-gray-400 mb-4" />} text="No movies found" />
        ) : (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {movies.map((movie) => (
                <div key={movie._id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                  <div className="aspect-w-2 aspect-h-3">
                    <img
                      src={movie.posterUrl || '/placeholder-movie.jpg'}
                      alt={movie.title}
                      className="w-full h-48 object-cover"
                      onError={(e) => {
                        e.target.src = '/placeholder-movie.jpg';
                      }}
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">{movie.title}</h3>
                    <div className="space-y-1 text-sm text-gray-600 mb-3">
                      <p><span className="font-medium">Genre:</span> {Array.isArray(movie.genre) ? movie.genre.join(', ') : movie.genre}</p>
                      <p><span className="font-medium">Language:</span> {movie.language}</p>
                      <p><span className="font-medium">Duration:</span> {movie.duration} min</p>
                      <p><span className="font-medium">Rating:</span> {movie.rating}</p>
                      {movie.imdbRating && <p><span className="font-medium">IMDB:</span> {movie.imdbRating}/10</p>}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">
                        {new Date(movie.releaseDate).toLocaleDateString()}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(movie)}
                          className="text-primary-600 hover:text-primary-900"
                          disabled={busyId === movie._id}
                        >
                          <FiEdit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete this movie?')) {
                              handleMovieAction(movie._id, 'delete');
                            }
                          }}
                          className="text-red-600 hover:text-red-900"
                          disabled={busyId === movie._id}
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {((pagination.currentPage - 1) * 10) + 1} to {Math.min(pagination.currentPage * 10, pagination.totalMovies)} of {pagination.totalMovies} movies
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => fetchMovies(pagination.currentPage - 1)}
                disabled={!pagination.hasPrev}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => fetchMovies(pagination.currentPage + 1)}
                disabled={!pagination.hasNext}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Movie Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-4/5 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingMovie ? 'Edit Movie' : 'Add New Movie'}
              </h3>
              <form onSubmit={handleSaveMovie}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Movie Title"
                    value={movieForm.title}
                    onChange={(e) => setMovieForm({ ...movieForm, title: e.target.value })}
                    className="border rounded px-3 py-2"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Genre (comma-separated)"
                    value={movieForm.genre}
                    onChange={(e) => setMovieForm({ ...movieForm, genre: e.target.value })}
                    className="border rounded px-3 py-2"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Language"
                    value={movieForm.language}
                    onChange={(e) => setMovieForm({ ...movieForm, language: e.target.value })}
                    className="border rounded px-3 py-2"
                    required
                  />
                  <input
                    type="number"
                    placeholder="Duration (minutes)"
                    value={movieForm.duration}
                    onChange={(e) => setMovieForm({ ...movieForm, duration: e.target.value })}
                    className="border rounded px-3 py-2"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Director"
                    value={movieForm.director}
                    onChange={(e) => setMovieForm({ ...movieForm, director: e.target.value })}
                    className="border rounded px-3 py-2"
                  />
                  <input
                    type="text"
                    placeholder="Cast (comma-separated)"
                    value={movieForm.cast}
                    onChange={(e) => setMovieForm({ ...movieForm, cast: e.target.value })}
                    className="border rounded px-3 py-2"
                  />
                  <input
                    type="date"
                    placeholder="Release Date"
                    value={movieForm.releaseDate}
                    onChange={(e) => setMovieForm({ ...movieForm, releaseDate: e.target.value })}
                    className="border rounded px-3 py-2"
                    required
                  />
                  <select
                    value={movieForm.rating}
                    onChange={(e) => setMovieForm({ ...movieForm, rating: e.target.value })}
                    className="border rounded px-3 py-2"
                  >
                    <option value="U">U</option>
                    <option value="U/A">U/A</option>
                    <option value="A">A</option>
                    <option value="S">S</option>
                  </select>
                  <input
                    type="url"
                    placeholder="Poster URL"
                    value={movieForm.posterUrl}
                    onChange={(e) => setMovieForm({ ...movieForm, posterUrl: e.target.value })}
                    className="border rounded px-3 py-2"
                    required
                  />
                  <input
                    type="url"
                    placeholder="Trailer URL"
                    value={movieForm.trailerUrl}
                    onChange={(e) => setMovieForm({ ...movieForm, trailerUrl: e.target.value })}
                    className="border rounded px-3 py-2"
                  />
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    placeholder="IMDB Rating"
                    value={movieForm.imdbRating}
                    onChange={(e) => setMovieForm({ ...movieForm, imdbRating: e.target.value })}
                    className="border rounded px-3 py-2"
                  />
                  <textarea
                    placeholder="Description"
                    rows="3"
                    value={movieForm.description}
                    onChange={(e) => setMovieForm({ ...movieForm, description: e.target.value })}
                    className="border rounded px-3 py-2 md:col-span-2"
                  />
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busyId === 'saving'}
                    className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors disabled:opacity-50"
                  >
                    {busyId === 'saving' ? 'Saving...' : (editingMovie ? 'Update Movie' : 'Create Movie')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MovieManagement;
