import React, { useState, useEffect } from 'react';
import { FiUsers, FiFilm, FiMapPin, FiDollarSign, FiTrendingUp } from 'react-icons/fi';
import api from '../../services/api';
import { toast } from 'react-hot-toast';

const DashboardOverview = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTheaters: 0,
    totalMovies: 0,
    totalBookings: 0,
    totalRevenue: 0,
    monthlyRevenue: []
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOverview();
  }, []);

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const [statsRes, activityRes] = await Promise.allSettled([
        api.get('/admin/stats'),
        api.get('/admin/recent-activity')
      ]);
      
      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value.data.data || {});
      }
      if (activityRes.status === 'fulfilled') {
        setRecentActivity(activityRes.value.data.data?.activities || []);
      }
    } catch (err) {
      console.error('Overview load error', err);
      toast.error('Failed to load dashboard overview');
    } finally {
      setLoading(false);
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
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalUsers || 0}</p>
            </div>
            <div className="ml-4">
              <FiUsers className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-sm text-blue-600">Registered users</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Total Theaters</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalTheaters || 0}</p>
            </div>
            <div className="ml-4">
              <FiMapPin className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-sm text-green-600">Active theaters</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Total Movies</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalMovies || 0}</p>
            </div>
            <div className="ml-4">
              <FiFilm className="h-8 w-8 text-purple-600" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-sm text-purple-600">Available movies</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-3xl font-bold text-gray-900">₹{(stats.totalRevenue || 0).toLocaleString()}</p>
            </div>
            <div className="ml-4">
              <FiDollarSign className="h-8 w-8 text-yellow-600" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-sm text-yellow-600">All time revenue</span>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        {recentActivity.length === 0 ? (
          <div className="text-center py-8">
            <FiTrendingUp className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0">
                  <div className="w-2 h-2 bg-primary-600 rounded-full"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{activity.description}</p>
                  <p className="text-xs text-gray-500">{new Date(activity.timestamp).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardOverview;
