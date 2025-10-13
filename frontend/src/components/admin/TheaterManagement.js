import React, { useState, useEffect } from 'react';
import { FiMapPin, FiPlus, FiSearch, FiEdit, FiTrash2, FiCheck, FiX } from 'react-icons/fi';
import api from '../../services/api';
import { toast } from 'react-hot-toast';

const TheaterManagement = () => {
  const [theaters, setTheaters] = useState([]);
  const [pagination, setPagination] = useState({ 
    currentPage: 1, 
    totalPages: 1, 
    totalTheaters: 0, 
    hasNext: false, 
    hasPrev: false 
  });
  const [filters, setFilters] = useState({ search: '', city: '' });
  const [busyId, setBusyId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingTheater, setEditingTheater] = useState(null);
  const [theaterForm, setTheaterForm] = useState({
    name: '',
    address: { street: '', city: '', state: '', pincode: '' },
    location: { type: 'Point', coordinates: ['', ''] },
    facilities: [],
    description: '',
    contact: { email: '', phone: '' },
    ownerUserId: ''
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTheaters(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTheaters = async (page = 1) => {
    setLoading(true);
    try {
      const params = {
        page: page.toString(),
        limit: '10'
      };

      if (filters.search) {
        params.search = filters.search;
      }
      if (filters.city) {
        params.city = filters.city;
      }

      const queryString = new URLSearchParams(params).toString();
      const response = await api.get(`/theaters/admin/all?${queryString}`);
      setTheaters(response.data.data.theaters || []);
      setPagination(response.data.data.pagination || {});
    } catch (error) {
      toast.error('Failed to fetch theaters');
      console.error('Error fetching theaters:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchTheaters(1);
  };

  const handleTheaterAction = async (theaterId, action) => {
    setBusyId(theaterId);
    try {
      let endpoint = '';
      switch (action) {
        case 'approve':
          endpoint = `/theaters/admin/${theaterId}/approve`;
          break;
        case 'reject':
          endpoint = `/theaters/admin/${theaterId}/reject`;
          break;
        case 'delete':
          endpoint = `/theaters/admin/${theaterId}`;
          break;
        default:
          throw new Error('Invalid action');
      }

      if (action === 'delete') {
        await api.delete(endpoint);
      } else {
        await api.put(endpoint);
      }

      toast.success(`Theater ${action}d successfully`);
      fetchTheaters(pagination.currentPage);
    } catch (error) {
      toast.error(`Failed to ${action} theater`);
      console.error(`Error ${action}ing theater:`, error);
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveTheater = async (e) => {
    e.preventDefault();
    setBusyId('saving');
    try {
      if (editingTheater) {
        await api.put(`/theaters/admin/${editingTheater._id}`, theaterForm);
        toast.success('Theater updated successfully');
      } else {
        await api.post('/theaters/admin', theaterForm);
        toast.success('Theater created successfully');
      }
      
      setShowModal(false);
      resetForm();
      fetchTheaters(pagination.currentPage);
    } catch (error) {
      toast.error(editingTheater ? 'Failed to update theater' : 'Failed to create theater');
      console.error('Error saving theater:', error);
    } finally {
      setBusyId(null);
    }
  };

  const openEditModal = (theater) => {
    setEditingTheater(theater);
    setTheaterForm({
      name: theater.name || '',
      address: theater.address || { street: '', city: '', state: '', pincode: '' },
      location: theater.location || { type: 'Point', coordinates: ['', ''] },
      facilities: theater.facilities || [],
      description: theater.description || '',
      contact: theater.contact || { email: '', phone: '' },
      ownerUserId: theater.ownerUserId || ''
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setTheaterForm({
      name: '',
      address: { street: '', city: '', state: '', pincode: '' },
      location: { type: 'Point', coordinates: ['', ''] },
      facilities: [],
      description: '',
      contact: { email: '', phone: '' },
      ownerUserId: ''
    });
    setEditingTheater(null);
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

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', text: 'Pending' },
      approved: { color: 'bg-green-100 text-green-800', text: 'Approved' },
      rejected: { color: 'bg-red-100 text-red-800', text: 'Rejected' },
      suspended: { color: 'bg-gray-100 text-gray-800', text: 'Suspended' }
    };
    
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${config.color}`}>
        {config.text}
      </span>
    );
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
        <h2 className="text-2xl font-bold text-gray-900">Theater Management</h2>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
        >
          <FiPlus className="w-4 h-4" />
          Add Theater
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                placeholder="Search theaters..."
              />
              <FiSearch className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input
              type="text"
              value={filters.city}
              onChange={(e) => setFilters({ ...filters, city: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              placeholder="Filter by city..."
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleSearch}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              Search
            </button>
          </div>
        </div>
      </div>

      {/* Theaters Table */}
      <div className="bg-white rounded-lg shadow-sm">
        {theaters.length === 0 ? (
          <Empty icon={<FiMapPin className="mx-auto h-12 w-12 text-gray-400 mb-4" />} text="No theaters found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Theater</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Screens</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {theaters.map((theater) => (
                  <tr key={theater._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{theater.name}</div>
                        <div className="text-sm text-gray-600">
                          {theater.address?.street}, {theater.address?.city}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {theater.address?.city}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {theater.screensCount ?? theater.screens?.length ?? 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(theater.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(theater)}
                          className="text-primary-600 hover:text-primary-900"
                          disabled={busyId === theater._id}
                        >
                          <FiEdit className="w-4 h-4" />
                        </button>
                        {theater.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleTheaterAction(theater._id, 'approve')}
                              className="text-green-600 hover:text-green-900"
                              disabled={busyId === theater._id}
                            >
                              <FiCheck className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleTheaterAction(theater._id, 'reject')}
                              className="text-red-600 hover:text-red-900"
                              disabled={busyId === theater._id}
                            >
                              <FiX className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete this theater?')) {
                              handleTheaterAction(theater._id, 'delete');
                            }
                          }}
                          className="text-red-600 hover:text-red-900"
                          disabled={busyId === theater._id}
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

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {((pagination.currentPage - 1) * 10) + 1} to {Math.min(pagination.currentPage * 10, pagination.totalTheaters)} of {pagination.totalTheaters} theaters
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => fetchTheaters(pagination.currentPage - 1)}
                disabled={!pagination.hasPrev}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => fetchTheaters(pagination.currentPage + 1)}
                disabled={!pagination.hasNext}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Theater Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-4/5 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingTheater ? 'Edit Theater' : 'Add New Theater'}
              </h3>
              <form onSubmit={handleSaveTheater}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input 
                    className="border rounded px-3 py-2" 
                    placeholder="Name" 
                    value={theaterForm.name} 
                    onChange={(e) => setTheaterForm({ ...theaterForm, name: e.target.value })} 
                    required
                  />
                  <input 
                    className="border rounded px-3 py-2" 
                    placeholder="Street" 
                    value={theaterForm.address.street} 
                    onChange={(e) => setTheaterForm({ ...theaterForm, address: { ...theaterForm.address, street: e.target.value } })} 
                    required
                  />
                  <input 
                    className="border rounded px-3 py-2" 
                    placeholder="City" 
                    value={theaterForm.address.city} 
                    onChange={(e) => setTheaterForm({ ...theaterForm, address: { ...theaterForm.address, city: e.target.value } })} 
                    required
                  />
                  <input 
                    className="border rounded px-3 py-2" 
                    placeholder="State" 
                    value={theaterForm.address.state} 
                    onChange={(e) => setTheaterForm({ ...theaterForm, address: { ...theaterForm.address, state: e.target.value } })} 
                    required
                  />
                  <input 
                    className="border rounded px-3 py-2" 
                    placeholder="Pincode" 
                    value={theaterForm.address.pincode} 
                    onChange={(e) => setTheaterForm({ ...theaterForm, address: { ...theaterForm.address, pincode: e.target.value } })} 
                  />
                  <input 
                    className="border rounded px-3 py-2" 
                    placeholder="Longitude" 
                    value={theaterForm.location.coordinates[0]} 
                    onChange={(e) => setTheaterForm({ ...theaterForm, location: { ...theaterForm.location, coordinates: [e.target.value, theaterForm.location.coordinates[1]] } })} 
                  />
                  <input 
                    className="border rounded px-3 py-2" 
                    placeholder="Latitude" 
                    value={theaterForm.location.coordinates[1]} 
                    onChange={(e) => setTheaterForm({ ...theaterForm, location: { ...theaterForm.location, coordinates: [theaterForm.location.coordinates[0], e.target.value] } })} 
                  />
                  <input 
                    className="border rounded px-3 py-2 md:col-span-2" 
                    placeholder="Facilities (comma-separated)" 
                    value={(theaterForm.facilities || []).join(', ')} 
                    onChange={(e) => setTheaterForm({ ...theaterForm, facilities: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} 
                  />
                  <input 
                    className="border rounded px-3 py-2" 
                    placeholder="Contact Email" 
                    type="email" 
                    value={theaterForm.contact.email} 
                    onChange={(e) => setTheaterForm({ ...theaterForm, contact: { ...theaterForm.contact, email: e.target.value } })} 
                    required
                  />
                  <input 
                    className="border rounded px-3 py-2" 
                    placeholder="Contact Phone" 
                    value={theaterForm.contact.phone} 
                    onChange={(e) => setTheaterForm({ ...theaterForm, contact: { ...theaterForm.contact, phone: e.target.value } })} 
                    required
                  />
                  <textarea 
                    className="border rounded px-3 py-2 md:col-span-2" 
                    placeholder="Description" 
                    rows="3"
                    value={theaterForm.description} 
                    onChange={(e) => setTheaterForm({ ...theaterForm, description: e.target.value })} 
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
                    {busyId === 'saving' ? 'Saving...' : (editingTheater ? 'Update Theater' : 'Create Theater')}
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

export default TheaterManagement;
