import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiSearch, FiMapPin, FiStar, FiPhone, FiMail } from 'react-icons/fi';
import api from '../services/api';
import { toast } from 'react-hot-toast';

const Theaters = () => {
  const [theaters, setTheaters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [filteredTheaters, setFilteredTheaters] = useState([]);

  const locations = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata', 'Ahmedabad'];

  useEffect(() => {
    fetchTheaters();
  }, []);

  useEffect(() => {
    filterTheaters();
  }, [theaters, searchTerm, selectedLocation]);

  const fetchTheaters = async () => {
    try {
      const response = await api.get('/theaters');
      setTheaters(response.data.data.theaters || []);
    } catch (error) {
      toast.error('Failed to fetch theaters');
      console.error('Error fetching theaters:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterTheaters = () => {
    let filtered = theaters;

    if (searchTerm) {
      filtered = filtered.filter(theater => {
        const locationStr = typeof theater.location === 'string' 
          ? theater.location 
          : theater.address?.city || '';
        return theater.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
               locationStr.toLowerCase().includes(searchTerm.toLowerCase());
      });
    }

    if (selectedLocation) {
      filtered = filtered.filter(theater => {
        const locationStr = typeof theater.location === 'string' 
          ? theater.location 
          : theater.address?.city || '';
        return locationStr.toLowerCase().includes(selectedLocation.toLowerCase());
      });
    }

    setFilteredTheaters(filtered);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedLocation('');
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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Theaters</h1>
          <p className="text-gray-600">Find theaters near you and explore their offerings</p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search theaters..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Location Filter */}
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">All Locations</option>
              {locations.map(location => (
                <option key={location} value={location}>{location}</option>
              ))}
            </select>

            {/* Clear Filters */}
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Theaters Grid */}
        {filteredTheaters.length === 0 ? (
          <div className="text-center py-12">
            <FiMapPin className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No theaters found</h3>
            <p className="text-gray-500">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTheaters.map((theater) => (
              <div key={theater._id} className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                {/* Theater Image */}
                <div className="h-48 bg-gradient-to-r from-primary-500 to-primary-600 relative">
                  {theater.image ? (
                    <img
                      src={theater.image}
                      alt={theater.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <FiMapPin className="h-16 w-16 text-white opacity-50" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black bg-opacity-20"></div>
                  <div className="absolute bottom-4 left-4 text-white">
                    <h3 className="text-xl font-bold">{theater.name}</h3>
                  </div>
                </div>

                {/* Theater Details */}
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-gray-600 mb-2">
                        <FiMapPin className="w-4 h-4" />
                        <span className="text-sm">
                          {typeof theater.location === 'string' 
                            ? theater.location 
                            : theater.address?.city || 'Location not available'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">
                        {theater.address ? 
                          `${theater.address.street || ''}, ${theater.address.city || ''}, ${theater.address.state || ''} ${theater.address.zipCode || ''}, ${theater.address.country || ''}`.replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, '') || 'Address not available'
                          : 'Address not available'}
                      </p>
                    </div>
                  </div>

                  {/* Theater Features */}
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-2">
                      {theater.screens && (
                        <span className="px-2 py-1 bg-primary-100 text-primary-800 text-xs rounded">
                          {theater.screens} Screens
                        </span>
                      )}
                      {theater.facilities?.map((facility, index) => (
                        <span key={index} className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">
                          {facility}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                    {theater.phone && (
                      <div className="flex items-center gap-1">
                        <FiPhone className="w-4 h-4" />
                        <span>{theater.phone}</span>
                      </div>
                    )}
                    {theater.rating && (
                      <div className="flex items-center gap-1">
                        <FiStar className="w-4 h-4 text-yellow-500" />
                        <span>{theater.rating}</span>
                      </div>
                    )}
                  </div>

                  <Link
                    to={`/theaters/${theater._id}`}
                    className="w-full bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 transition-colors text-center block"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load More Button (if pagination is needed) */}
        {filteredTheaters.length > 0 && (
          <div className="text-center mt-8">
            <button className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors">
              Load More Theaters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Theaters;