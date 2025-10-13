import React, { useState } from 'react';
import { FiUsers, FiFilm, FiMapPin, FiShield, FiHome, FiBarChart } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import DashboardOverview from '../../components/admin/DashboardOverview';
import UserManagement from '../../components/admin/UserManagement';
import TheaterManagement from '../../components/admin/TheaterManagement';
import MovieManagement from '../../components/admin/MovieManagement';
import AnalyticsDashboard from '../../components/admin/AnalyticsDashboard';
import TheaterAssignmentDebug from '../../components/admin/TheaterAssignmentDebug';

const SuperAdminDashboardNew = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FiHome },
    { id: 'users', label: 'Users', icon: FiUsers },
    { id: 'theaters', label: 'Theaters', icon: FiMapPin },
    { id: 'movies', label: 'Movies', icon: FiFilm },
    { id: 'analytics', label: 'Analytics', icon: FiBarChart },
    { id: 'debug', label: 'Debug', icon: FiShield }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <DashboardOverview />;
      case 'users':
        return <UserManagement />;
      case 'theaters':
        return <TheaterManagement />;
      case 'movies':
        return <MovieManagement />;
      case 'analytics':
        return <AnalyticsDashboard isTheaterAdmin={false} />;
      case 'debug':
        return <TheaterAssignmentDebug />;
      default:
        return <DashboardOverview />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Super Admin Dashboard</h1>
              <p className="text-sm text-gray-600">Welcome back, {user?.name}!</p>
            </div>
            <div className="flex items-center gap-2">
              <FiShield className="w-5 h-5 text-primary-600" />
              <span className="text-sm font-medium text-primary-600">Super Admin</span>
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
    </div>
  );
};

export default SuperAdminDashboardNew;
