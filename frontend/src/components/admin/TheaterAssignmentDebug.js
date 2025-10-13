import React, { useState, useEffect } from 'react';
import { FiUsers, FiMapPin, FiRefreshCw } from 'react-icons/fi';
import api from '../../services/api';
import { toast } from 'react-hot-toast';

const TheaterAssignmentDebug = () => {
  const [theaterAdmins, setTheaterAdmins] = useState([]);
  const [theaters, setTheaters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDebugData();
  }, []);

  const fetchDebugData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/debug/users');
      const { theaterAdmins, availableTheaters } = response.data.data;
      setTheaterAdmins(theaterAdmins);
      setTheaters(availableTheaters);
    } catch (error) {
      console.error('Error fetching debug data:', error);
      toast.error('Failed to fetch debug data');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignTheater = async (userId, theaterId) => {
    try {
      await api.put(`/admin/users/${userId}/assign-theater`, { theaterId });
      toast.success('Theater assigned successfully');
      fetchDebugData(); // Refresh data
    } catch (error) {
      console.error('Error assigning theater:', error);
      toast.error('Failed to assign theater');
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <FiUsers className="h-6 w-6 text-primary-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Theater Admin Assignment Debug</h3>
        </div>
        <button
          onClick={fetchDebugData}
          className="flex items-center px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
        >
          <FiRefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </button>
      </div>

      <div className="space-y-6">
        {/* Theater Admins */}
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-3">Theater Admins</h4>
          <div className="space-y-3">
            {theaterAdmins.length === 0 ? (
              <p className="text-gray-500 text-sm">No theater admins found</p>
            ) : (
              theaterAdmins.map((admin) => (
                <div key={admin._id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <span className="font-medium text-gray-900">{admin.name}</span>
                        <span className="ml-2 text-sm text-gray-500">({admin.email})</span>
                        <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                          admin.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {admin.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center text-sm text-gray-600">
                        <FiMapPin className="h-4 w-4 mr-1" />
                        {admin.theaterId ? (
                          <span>Assigned to: <strong>{admin.theaterId.name}</strong> ({admin.theaterId.address?.city})</span>
                        ) : (
                          <span className="text-red-600">No theater assigned</span>
                        )}
                      </div>
                    </div>
                    {!admin.theaterId && (
                      <div className="ml-4">
                        <select
                          onChange={(e) => e.target.value && handleAssignTheater(admin._id, e.target.value)}
                          className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          defaultValue=""
                        >
                          <option value="">Assign Theater</option>
                          {theaters.map(theater => (
                            <option key={theater._id} value={theater._id}>
                              {theater.name} ({theater.address?.city})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Available Theaters */}
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-3">Available Theaters</h4>
          <div className="space-y-2">
            {theaters.length === 0 ? (
              <p className="text-gray-500 text-sm">No theaters found</p>
            ) : (
              theaters.map((theater) => (
                <div key={theater._id} className="flex items-center text-sm text-gray-600">
                  <FiMapPin className="h-4 w-4 mr-2" />
                  <span><strong>{theater.name}</strong> - {theater.address?.city}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TheaterAssignmentDebug;
