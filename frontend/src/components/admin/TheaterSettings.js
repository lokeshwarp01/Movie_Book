import React, { useState, useEffect } from 'react';
import { FiSave, FiMapPin, FiPhone, FiSettings, FiImage, FiPlus, FiTrash2 } from 'react-icons/fi';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

const TheaterSettings = () => {
  const { user } = useAuth();
  // user is available via context if needed in future
  const [theaterData, setTheaterData] = useState({
    name: '',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'India'
    },
    location: {
      type: 'Point',
      coordinates: [0, 0]
    },
    contact: {
      phone: '',
      email: ''
    },
    description: '',
    facilities: [],
    images: []
  });
  const [newFacility, setNewFacility] = useState('');
  const [newImage, setNewImage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const availableFacilities = [
    'AC', 'Parking', 'Food Court', '3D', 'IMAX', 'Dolby Atmos', 
    'Wheelchair Access', 'Online Booking', 'Snack Bar', 'Valet Parking'
  ];

  useEffect(() => {
    fetchTheaterData();
  }, []);

  const fetchTheaterData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/theater/current');
      const fetchedTheater = response.data.theater || {};
      setTheaterData(prev => ({
        ...prev,
        ...fetchedTheater,
        address: { ...prev.address, ...(fetchedTheater.address || {}) },
        contact: { ...prev.contact, ...(fetchedTheater.contact || {}) },
        location: { ...prev.location, ...(fetchedTheater.location || {}) },
      }));
    } catch (error) {
      console.error('Error fetching theater data:', error);
      toast.error('Failed to fetch theater information');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name.startsWith('address.')) {
      const field = name.split('.')[1];
      setTheaterData(prev => ({
        ...prev,
        address: {
          ...prev.address,
          [field]: value
        }
      }));
    } else if (name.startsWith('contact.')) {
      const field = name.split('.')[1];
      setTheaterData(prev => ({
        ...prev,
        contact: {
          ...prev.contact,
          [field]: value
        }
      }));
    } else if (name.startsWith('location.')) {
      const field = name.split('.')[1];
      if (field === 'coordinates') {
        const coords = value.split(',').map(c => parseFloat(c.trim()));
        setTheaterData(prev => ({
          ...prev,
          location: {
            ...prev.location,
            coordinates: coords
          }
        }));
      }
    } else {
      setTheaterData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleAddFacility = () => {
    if (newFacility.trim() && !theaterData.facilities.includes(newFacility.trim())) {
      setTheaterData(prev => ({
        ...prev,
        facilities: [...prev.facilities, newFacility.trim()]
      }));
      setNewFacility('');
    }
  };

  const handleRemoveFacility = (facility) => {
    setTheaterData(prev => ({
      ...prev,
      facilities: prev.facilities.filter(f => f !== facility)
    }));
  };

  const handleAddImage = () => {
    if (newImage.trim() && !theaterData.images.includes(newImage.trim())) {
      setTheaterData(prev => ({
        ...prev,
        images: [...prev.images, newImage.trim()]
      }));
      setNewImage('');
    }
  };

  const handleRemoveImage = (imageUrl) => {
    setTheaterData(prev => ({
      ...prev,
      images: prev.images.filter(img => img !== imageUrl)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await api.put('/admin/theater/current', theaterData);
      toast.success('Theater settings updated successfully');
    } catch (error) {
      console.error('Error updating theater:', error);
      toast.error('Failed to update theater settings');
    } finally {
      setSaving(false);
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
        <h2 className="text-2xl font-bold text-gray-900">Theater Settings</h2>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          <FiSave className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FiSettings className="w-5 h-5" />
            Basic Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Theater Name</label>
              <input
                type="text"
                name="name"
                value={theaterData.name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                name="description"
                value={theaterData.description}
                onChange={handleInputChange}
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Address Information */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FiMapPin className="w-5 h-5" />
            Address Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
              <input
                type="text"
                name="address.street"
                value={theaterData.address.street}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                name="address.city"
                value={theaterData.address.city}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input
                type="text"
                name="address.state"
                value={theaterData.address.state}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zip Code</label>
              <input
                type="text"
                name="address.zipCode"
                value={theaterData.address.zipCode}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <input
                type="text"
                name="address.country"
                value={theaterData.address.country}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FiPhone className="w-5 h-5" />
            Contact Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                type="tel"
                name="contact.phone"
                value={theaterData.contact.phone}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                name="contact.email"
                value={theaterData.contact.email}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>
          </div>
        </div>

        {/* Location Coordinates */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FiMapPin className="w-5 h-5" />
            Location Coordinates
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Longitude, Latitude</label>
              <input
                type="text"
                name="location.coordinates"
                value={theaterData.location.coordinates.join(', ')}
                onChange={handleInputChange}
                placeholder="e.g., 77.2090, 28.6139"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              />
              <p className="text-xs text-gray-500 mt-1">Enter coordinates separated by comma</p>
            </div>
          </div>
        </div>

        {/* Facilities */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Facilities</h3>
          <div className="space-y-4">
            <div className="flex gap-2">
              <select
                value={newFacility}
                onChange={(e) => setNewFacility(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select a facility</option>
                {availableFacilities.map(facility => (
                  <option key={facility} value={facility}>{facility}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddFacility}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
              >
                <FiPlus className="w-4 h-4" />
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {theaterData.facilities.map((facility, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-2 px-3 py-1 bg-primary-100 text-primary-800 text-sm rounded-full"
                >
                  {facility}
                  <button
                    type="button"
                    onClick={() => handleRemoveFacility(facility)}
                    className="text-primary-600 hover:text-primary-800"
                  >
                    <FiTrash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FiImage className="w-5 h-5" />
            Theater Images
          </h3>
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="url"
                value={newImage}
                onChange={(e) => setNewImage(e.target.value)}
                placeholder="Enter image URL"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              />
              <button
                type="button"
                onClick={handleAddImage}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
              >
                <FiPlus className="w-4 h-4" />
                Add
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {theaterData.images.map((imageUrl, index) => (
                <div key={index} className="relative group">
                  <img
                    src={imageUrl}
                    alt={`Theater ${index + 1}`}
                    className="w-full h-24 object-cover rounded-md"
                    onError={(e) => {
                      e.target.src = '/placeholder-theater.jpg';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(imageUrl)}
                    className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <FiTrash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default TheaterSettings;
