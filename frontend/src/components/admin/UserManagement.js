import React, { useState, useEffect } from 'react';
import { FiUsers, FiPlus, FiSearch, FiEdit, FiTrash2, FiUserMinus, FiCheck } from 'react-icons/fi';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import BulkOperations from './BulkOperations';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ 
    currentPage: 1, 
    totalPages: 1, 
    totalUsers: 0, 
    hasNext: false, 
    hasPrev: false 
  });
  const [filters, setFilters] = useState({ search: '', role: '', isActive: '' });
  const [busyId, setBusyId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [userForm, setUserForm] = useState({ 
    name: '', 
    email: '', 
    phone: '', 
    password: '', 
    role: 'user' 
  });
  const [editingUser, setEditingUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [theaters, setTheaters] = useState([]);

  useEffect(() => {
    fetchUsers(1);
    fetchTheaters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUsers = async (page = 1) => {
    setLoading(true);
    try {
      const params = {
        page: page.toString(),
        limit: '10',
        search: filters.search || ''
      };

      if (filters.role) {
        params.role = filters.role;
      }
      if (filters.isActive) {
        params.isActive = filters.isActive;
      }

      const queryString = new URLSearchParams(params).toString();
      const response = await api.get(`/users/admin/users?${queryString}`);
      setUsers(response.data.data.users || []);
      setPagination(response.data.data.pagination || {});
    } catch (error) {
      toast.error('Failed to fetch users');
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTheaters = async () => {
    try {
      const response = await api.get('/theaters/admin/all');
      setTheaters(response.data.data.theaters || []);
    } catch (error) {
      toast.error('Failed to fetch theaters for assignment');
      console.error('Error fetching theaters for assignment:', error);
    }
  };

  const handleSearch = () => {
    fetchUsers(1);
  };

  const handleUserAction = async (userId, action) => {
    setBusyId(userId);
    try {
      let endpoint = '';
      switch (action) {
        case 'activate':
          endpoint = `/users/admin/users/${userId}/activate`;
          break;
        case 'deactivate':
          endpoint = `/users/admin/users/${userId}/deactivate`;
          break;
        case 'delete':
          endpoint = `/users/admin/users/${userId}`;
          break;
        default:
          throw new Error('Invalid action');
      }

      if (action === 'delete') {
        await api.delete(endpoint);
      } else {
        await api.put(endpoint);
      }

      toast.success(`User ${action}d successfully`);
      fetchUsers(pagination.currentPage);
    } catch (error) {
      toast.error(`Failed to ${action} user`);
      console.error(`Error ${action}ing user:`, error);
    } finally {
      setBusyId(null);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    setBusyId(userId);
    try {
      await api.put(`/users/admin/users/${userId}/role`, { role: newRole });
      toast.success('User role updated successfully');
      fetchUsers(pagination.currentPage);
    } catch (error) {
      toast.error('Failed to update user role');
      console.error('Error updating user role:', error);
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setBusyId('saving');
    try {
      if (editingUser) {
        await api.put(`/users/admin/users/${editingUser._id}`, userForm);
        toast.success('User updated successfully');
      } else {
        await api.post('/users/admin/users', userForm);
        toast.success('User created successfully');
      }
      
      setShowModal(false);
      setUserForm({ name: '', email: '', phone: '', password: '', role: 'user' });
      setEditingUser(null);
      fetchUsers(pagination.currentPage);
    } catch (error) {
      toast.error(editingUser ? 'Failed to update user' : 'Failed to create user');
      console.error('Error saving user:', error);
    } finally {
      setBusyId(null);
    }
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setUserForm({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      password: '',
      role: user.role || 'user'
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setUserForm({ name: '', email: '', phone: '', password: '', role: 'user' });
  };

  const handleSelectUser = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map(user => user._id));
    }
  };

  const handleBulkAction = async (action, userIds) => {
    setBusyId('bulk');
    try {
      await api.post('/users/admin/users/bulk-action', {
        action,
        userIds
      });
      
      toast.success(`Bulk ${action} completed successfully`);
      setSelectedUsers([]);
      fetchUsers(pagination.currentPage);
    } catch (error) {
      console.error(`Error performing bulk ${action}:`, error);
      toast.error(`Failed to perform bulk ${action}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleAssignTheater = async (userId, theaterId) => {
    setBusyId(userId);
    try {
      await api.put(`/admin/users/${userId}/assign-theater`, {
        theaterId
      });
      
      toast.success('User assigned to theater successfully');
      fetchUsers(pagination.currentPage);
    } catch (error) {
      console.error('Error assigning theater:', error);
      toast.error('Failed to assign user to theater');
    } finally {
      setBusyId(null);
    }
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
        <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
        >
          <FiPlus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                placeholder="Search users..."
              />
              <FiSearch className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={filters.role}
              onChange={(e) => setFilters({ ...filters, role: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">All Roles</option>
              <option value="user">User</option>
              <option value="theater_admin">Theater Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.isActive}
              onChange={(e) => setFilters({ ...filters, isActive: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
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

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-sm">
        {users.length === 0 ? (
          <Empty icon={<FiUsers className="mx-auto h-12 w-12 text-gray-400 mb-4" />} text="No users found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedUsers.length === users.length && users.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Theater</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user._id)}
                        onChange={() => handleSelectUser(user._id)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user._id, e.target.value)}
                        disabled={busyId === user._id}
                        className="text-sm border-none bg-transparent focus:ring-2 focus:ring-primary-500 rounded"
                      >
                        <option value="user">User</option>
                        <option value="theater_admin">Theater Admin</option>
                        <option value="super_admin">Super Admin</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.role === 'theater_admin' ? (
                        <select
                          value={user.theaterId || ''}
                          onChange={(e) => handleAssignTheater(user._id, e.target.value)}
                          disabled={busyId === user._id}
                          className="text-sm border-none bg-transparent focus:ring-2 focus:ring-primary-500 rounded"
                        >
                          <option value="">Select Theater</option>
                          {theaters.map(theater => (
                            <option key={theater._id} value={theater._id}>
                              {theater.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-sm text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(user)}
                          className="text-primary-600 hover:text-primary-900"
                          disabled={busyId === user._id}
                        >
                          <FiEdit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleUserAction(user._id, user.isActive ? 'deactivate' : 'activate')}
                          className={user.isActive ? "text-red-600 hover:text-red-900" : "text-green-600 hover:text-green-900"}
                          disabled={busyId === user._id}
                        >
                          {user.isActive ? <FiUserMinus className="w-4 h-4" /> : <FiCheck className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete this user?')) {
                              handleUserAction(user._id, 'delete');
                            }
                          }}
                          className="text-red-600 hover:text-red-900"
                          disabled={busyId === user._id}
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
              Showing {((pagination.currentPage - 1) * 10) + 1} to {Math.min(pagination.currentPage * 10, pagination.totalUsers)} of {pagination.totalUsers} users
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => fetchUsers(pagination.currentPage - 1)}
                disabled={!pagination.hasPrev}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => fetchUsers(pagination.currentPage + 1)}
                disabled={!pagination.hasNext}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingUser ? 'Edit User' : 'Add New User'}
              </h3>
              <form onSubmit={handleSaveUser}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={userForm.name}
                      onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={userForm.email}
                      onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={userForm.phone}
                      onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  {!editingUser && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                      <input
                        type="password"
                        value={userForm.password}
                        onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                        required={!editingUser}
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <select
                      value={userForm.role}
                      onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="user">User</option>
                      <option value="theater_admin">Theater Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>
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
                    {busyId === 'saving' ? 'Saving...' : (editingUser ? 'Update User' : 'Create User')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Operations */}
      <BulkOperations
        type="users"
        selectedItems={selectedUsers}
        onBulkAction={handleBulkAction}
        onClearSelection={() => setSelectedUsers([])}
      />
    </div>
  );
};

export default UserManagement;
