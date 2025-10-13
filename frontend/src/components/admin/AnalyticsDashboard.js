import React, { useState, useEffect } from 'react';
import { FiTrendingUp, FiUsers, FiDollarSign, FiCalendar, FiFilm, FiDownload } from 'react-icons/fi';
import api from '../../services/api';
import { toast } from 'react-hot-toast';

const AnalyticsDashboard = ({ isTheaterAdmin = false }) => {
  const [analytics, setAnalytics] = useState({
    revenue: {
      total: 0,
      monthly: [],
      daily: []
    },
    bookings: {
      total: 0,
      monthly: [],
      status: {}
    },
    users: {
      total: 0,
      monthly: [],
      byRole: {}
    },
    movies: {
      total: 0,
      topPerforming: []
    },
    theaters: {
      total: 0,
      byCity: []
    }
  });
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    to: new Date().toISOString().split('T')[0] // today
  });
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const endpoint = isTheaterAdmin ? '/admin/theater/analytics' : '/admin/analytics';
      const { from, to } = dateRange;

      const response = await api.get(`${endpoint}?from=${from}&to=${to}`);
      setAnalytics(response.data.data || {});
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExport = async (type) => {
    try {
      const endpoint = isTheaterAdmin ? '/admin/theater/export' : '/admin/export';
      const params = new URLSearchParams({
        type,
        from: dateRange.from,
        to: dateRange.to
      });

      const response = await api.get(`${endpoint}?${params}`, {
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}_report_${dateRange.from}_to_${dateRange.to}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success(`${type} report exported successfully`);
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Failed to export data');
    }
  };

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
        <h2 className="text-2xl font-bold text-gray-900">Analytics & Reports</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <button
            onClick={fetchAnalytics}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-3xl font-bold text-gray-900">₹{analytics.revenue.total?.toLocaleString() || 0}</p>
            </div>
            <div className="ml-4">
              <FiDollarSign className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-sm text-green-600">Revenue</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Total Bookings</p>
              <p className="text-3xl font-bold text-gray-900">{analytics.bookings.total || 0}</p>
            </div>
            <div className="ml-4">
              <FiCalendar className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-sm text-blue-600">Bookings</span>
          </div>
        </div>

        {!isTheaterAdmin && (
          <>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">Total Users</p>
                  <p className="text-3xl font-bold text-gray-900">{analytics.users.total || 0}</p>
                </div>
                <div className="ml-4">
                  <FiUsers className="h-8 w-8 text-purple-600" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-sm text-purple-600">Users</span>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">Total Movies</p>
                  <p className="text-3xl font-bold text-gray-900">{analytics.movies.total || 0}</p>
                </div>
                <div className="ml-4">
                  <FiFilm className="h-8 w-8 text-orange-600" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-sm text-orange-600">Movies</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Charts and Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Revenue Trend</h3>
            <button
              onClick={() => handleExport('revenue')}
              className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
            >
              <FiDownload className="w-4 h-4" />
              Export
            </button>
          </div>
          <div className="h-64 flex items-center justify-center">
            {analytics.revenue.monthly?.length > 0 ? (
              <div className="text-center">
                <FiTrendingUp className="mx-auto h-12 w-12 text-green-500 mb-2" />
                <p className="text-gray-600">Revenue trend chart would be displayed here</p>
                <p className="text-sm text-gray-500 mt-2">
                  Data points: {analytics.revenue.monthly.length}
                </p>
              </div>
            ) : (
              <div className="text-center text-gray-500">
                <FiTrendingUp className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                <p>No revenue data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Booking Status Distribution */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Booking Status</h3>
            <button
              onClick={() => handleExport('bookings')}
              className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
            >
              <FiDownload className="w-4 h-4" />
              Export
            </button>
          </div>
          <div className="space-y-3">
            {Object.entries(analytics.bookings.status || {}).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 capitalize">{status}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full"
                      style={{
                        width: `${analytics.bookings.total > 0 ? (count / analytics.bookings.total) * 100 : 0}%`
                      }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600 w-8">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Performing Movies */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Top Performing Movies</h3>
          <button
            onClick={() => handleExport('movies')}
            className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <FiDownload className="w-4 h-4" />
            Export
          </button>
        </div>
        {analytics.movies.topPerforming?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Movie</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bookings</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Rating</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analytics.movies.topPerforming.slice(0, 5).map((movie, index) => (
                  <tr key={movie._id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <span className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-semibold">
                            {index + 1}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{movie.title}</div>
                          <div className="text-sm text-gray-500">{movie.language}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {movie.bookings || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ₹{movie.revenue?.toLocaleString() || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {movie.avgRating || 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <FiFilm className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500">No movie performance data available</p>
          </div>
        )}
      </div>

      {/* Theater Distribution (Super Admin only) */}
      {!isTheaterAdmin && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Theater Distribution by City</h3>
            <button
              onClick={() => handleExport('theaters')}
              className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
            >
              <FiDownload className="w-4 h-4" />
              Export
            </button>
          </div>
          {analytics.theaters.byCity?.length > 0 ? (
            <div className="space-y-3">
              {analytics.theaters.byCity.slice(0, 10).map((city, index) => (
                <div key={city.city} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{city.city}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${analytics.theaters.total > 0 ? (city.count / analytics.theaters.total) * 100 : 0}%`
                        }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-600 w-8">{city.count}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FiTrendingUp className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500">No theater distribution data available</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AnalyticsDashboard;
