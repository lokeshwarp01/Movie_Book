import React, { useState } from 'react';
import { FiTrash2, FiCheck, FiX, FiUser, FiMapPin, FiFilm } from 'react-icons/fi';

const BulkOperations = ({ type, selectedItems, onBulkAction, onClearSelection }) => {
  const [showMenu, setShowMenu] = useState(false);

  const getTypeIcon = () => {
    switch (type) {
      case 'users':
        return <FiUser className="w-4 h-4" />;
      case 'theaters':
        return <FiMapPin className="w-4 h-4" />;
      case 'movies':
        return <FiFilm className="w-4 h-4" />;
      default:
        return <FiUser className="w-4 h-4" />;
    }
  };

  const getTypeLabel = () => {
    switch (type) {
      case 'users':
        return 'users';
      case 'theaters':
        return 'theaters';
      case 'movies':
        return 'movies';
      default:
        return 'items';
    }
  };

  const handleBulkAction = (action) => {
    onBulkAction(action, selectedItems);
    setShowMenu(false);
  };

  if (selectedItems.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {getTypeIcon()}
            <span className="text-sm font-medium text-gray-700">
              {selectedItems.length} {getTypeLabel()} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="px-3 py-1 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
            >
              Actions
            </button>
            <button
              onClick={onClearSelection}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        {showMenu && (
          <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-md shadow-lg">
            <div className="py-1">
              {type === 'users' && (
                <>
                  <button
                    onClick={() => handleBulkAction('activate')}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <FiCheck className="w-4 h-4 text-green-600" />
                    Activate Selected
                  </button>
                  <button
                    onClick={() => handleBulkAction('deactivate')}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <FiX className="w-4 h-4 text-red-600" />
                    Deactivate Selected
                  </button>
                  <button
                    onClick={() => handleBulkAction('delete')}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <FiTrash2 className="w-4 h-4 text-red-600" />
                    Delete Selected
                  </button>
                </>
              )}

              {type === 'theaters' && (
                <>
                  <button
                    onClick={() => handleBulkAction('approve')}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <FiCheck className="w-4 h-4 text-green-600" />
                    Approve Selected
                  </button>
                  <button
                    onClick={() => handleBulkAction('reject')}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <FiX className="w-4 h-4 text-red-600" />
                    Reject Selected
                  </button>
                  <button
                    onClick={() => handleBulkAction('delete')}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <FiTrash2 className="w-4 h-4 text-red-600" />
                    Delete Selected
                  </button>
                </>
              )}

              {type === 'movies' && (
                <button
                  onClick={() => handleBulkAction('delete')}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <FiTrash2 className="w-4 h-4 text-red-600" />
                  Delete Selected
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkOperations;
