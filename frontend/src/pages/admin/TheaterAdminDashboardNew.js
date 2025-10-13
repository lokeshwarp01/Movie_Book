import React, { useState, useEffect } from 'react';
import { FiFilm, FiCalendar, FiDollarSign, FiUsers, FiPlus, FiEdit, FiTrash2, FiHome, FiBarChart, FiSettings, FiAlertTriangle } from 'react-icons/fi';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import BookingManagement from '../../components/admin/BookingManagement';
import ShowManagementModal from '../../components/admin/ShowManagementModal';
import AnalyticsDashboard from '../../components/admin/AnalyticsDashboard';
import TheaterSettings from '../../components/admin/TheaterSettings';

const TheaterAdminDashboardNew = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    totalShows: 0,
    totalBookings: 0,
    totalRevenue: 0,
    todayBookings: 0
  });
  const [shows, setShows] = useState([]);
  const [movies, setMovies] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedShow, setSelectedShow] = useState(null);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FiHome },
    { id: 'shows', label: 'Shows', icon: FiFilm },
    { id: 'bookings', label: 'Bookings', icon: FiCalendar },
    { id: 'analytics', label: 'Analytics', icon: FiBarChart },
    { id: 'settings', label: 'Settings', icon: FiSettings },
  ];

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, showsRes, moviesRes, bookingsRes] = await Promise.all([
        api.get('/admin/theater/stats'),
        api.get('/admin/theater/shows'),
        api.get('/movies'),
        api.get('/admin/theater/bookings')
      ]);

      setStats(statsRes.data.data || {});
      setShows(showsRes.data.data?.shows || []);
      setMovies(moviesRes.data.data?.movies || []);
      setBookings(bookingsRes.data.data?.bookings || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      
      // Check if it's a theater assignment issue
      if (error.response?.status === 400 && error.response?.data?.message?.includes('not associated with any theater')) {
        toast.error('You are not assigned to any theater. Please contact the super admin for assistance.');
        setStats({ 
          totalShows: 0, 
          totalBookings: 0, 
          totalRevenue: 0, 
          todayBookings: 0,
          error: 'No theater assigned'
        });
        setShows([]);
        setMovies([]);
        setBookings([]);
      } else {
        toast.error('Failed to fetch dashboard data');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Warning Banner for No Theater Assignment */}
      {stats.error === 'No theater assigned' && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <FiAlertTriangle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>No Theater Assigned:</strong> You are not currently assigned to any theater. 
                Please contact the super admin to assign you to a theater before you can manage shows and bookings.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Total Shows</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalShows || 0}</p>
            </div>
            <div className="ml-4">
              <FiFilm className="h-8 w-8 text-primary-600" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-sm text-primary-600">Active shows</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Total Bookings</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalBookings || 0}</p>
            </div>
            <div className="ml-4">
              <FiUsers className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-sm text-blue-600">All time bookings</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Today's Bookings</p>
              <p className="text-3xl font-bold text-gray-900">{stats.todayBookings || 0}</p>
            </div>
            <div className="ml-4">
              <FiCalendar className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-sm text-green-600">Today only</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-3xl font-bold text-gray-900">₹{(stats.totalRevenue || 0).toLocaleString()}</p>
            </div>
            <div className="ml-4">
              <FiDollarSign className="h-8 w-8 text-purple-600" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-sm text-purple-600">All time revenue</span>
          </div>
        </div>
      </div>

      {/* Recent Bookings */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Bookings</h3>
        {bookings.length === 0 ? (
          <div className="text-center py-8">
            <FiCalendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500">No recent bookings</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Movie</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Show Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {bookings.slice(0, 5).map((booking) => (
                  <tr key={booking._id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {booking.userId?.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {booking.showId?.movieId?.title || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {booking.showId ? new Date(booking.showId.startTime).toLocaleString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ₹{booking.totalAmount || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        booking.status === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {booking.status || 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const renderShows = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Manage Shows</h2>
        <button
          onClick={() => {
            setSelectedShow(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
        >
          <FiPlus className="w-4 h-4" />
          Add New Show
        </button>
      </div>

      {/* Shows Table */}
      <div className="bg-white rounded-lg shadow-sm">
        {shows.length === 0 ? (
          <div className="text-center py-12">
            <FiFilm className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No shows scheduled</h3>
            <p className="text-gray-500 mb-4">Start by adding your first show</p>
                        <button
                          onClick={() => {
                            setSelectedShow(null);
                            setShowModal(true);
                          }}
                          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
                        >
                          Add First Show
                        </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Movie</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Screen</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bookings</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {shows.map((show) => (
                  <tr key={show._id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {show.movieId?.title || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {show.movieId?.language} • {show.movieId?.genre}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{new Date(show.startTime).toLocaleDateString()}</div>
                      <div className="text-sm text-gray-500">{new Date(show.startTime).toLocaleTimeString()}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {show.screenId?.name || `Screen ${show.screenId}`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ₹{show.price}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {show.bookings || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditShow(show)}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          <FiEdit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteShow(show._id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const handleShowSave = async (showData) => {
    try {
      if (selectedShow) {
        await api.put(`/admin/theater/shows/${selectedShow._id}`, showData);
        toast.success('Show updated successfully');
      } else {
        await api.post('/admin/theater/shows', showData);
        toast.success('Show created successfully');
      }
      
      setShowModal(false);
      setSelectedShow(null);
      fetchDashboardData();
    } catch (error) {
      console.error('Error saving show:', error);
      toast.error(selectedShow ? 'Failed to update show' : 'Failed to create show');
      throw error;
    }
  };

  const handleEditShow = (show) => {
    setSelectedShow(show);
    setShowModal(true);
  };

  const handleDeleteShow = async (showId) => {
    if (!window.confirm('Are you sure you want to delete this show?')) {
      return;
    }

    try {
      await api.delete(`/admin/theater/shows/${showId}`);
      toast.success('Show deleted successfully');
      fetchDashboardData();
    } catch (error) {
      console.error('Error deleting show:', error);
      toast.error('Failed to delete show');
    }
  };

  const renderBookings = () => <BookingManagement />;

  const renderAnalytics = () => <AnalyticsDashboard isTheaterAdmin={true} />;

  const renderSettings = () => <TheaterSettings />;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'shows':
        return renderShows();
      case 'bookings':
        return renderBookings();
      case 'analytics':
        return renderAnalytics();
      case 'settings':
        return renderSettings();
      default:
        return renderOverview();
    }
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Theater Admin Dashboard</h1>
              <p className="text-sm text-gray-600">Welcome back, {user?.name}!</p>
            </div>
            <div className="flex items-center gap-2">
              <FiFilm className="w-5 h-5 text-primary-600" />
              <span className="text-sm font-medium text-primary-600">Theater Admin</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderTabContent()}
      </div>

      {/* Show Management Modal */}
      <ShowManagementModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedShow(null);
        }}
        show={selectedShow}
        onSave={handleShowSave}
        theaterId={user?.theaterId}
      />
    </div>
  );
};

export default TheaterAdminDashboardNew;
