import React, { useState, useEffect } from 'react';
import { Shield, Users, LogOut, Menu, X, Home as HomeIcon, UserCircle, MessageSquare } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import AdminDirectory from './AdminDirectory';
import SendMessagePage from './SendMessagePage';
import { getProfile } from '../services/api';

const AdminPanel = ({ onNavigate, onLogout }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [currentView, setCurrentView] = useState('directory'); // 'directory' | 'send-message'

  // Scroll locking when sidebar is open
  useEffect(() => {
    if (isMenuOpen) {
      const scrollY = window.scrollY;
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.touchAction = 'none';
    } else {
      const scrollY = parseInt(document.body.style.top || '0') * -1;
      document.documentElement.style.overflow = 'unset';
      document.body.style.overflow = 'unset';
      document.body.style.position = 'unset';
      document.body.style.width = 'unset';
      document.body.style.top = 'unset';
      document.body.style.touchAction = 'auto';
      window.scrollTo(0, scrollY);
    }
    return () => {
      document.documentElement.style.overflow = 'unset';
      document.body.style.overflow = 'unset';
      document.body.style.position = 'unset';
      document.body.style.width = 'unset';
      document.body.style.top = 'unset';
      document.body.style.touchAction = 'auto';
    };
  }, [isMenuOpen]);

  useEffect(() => {
    // Load profile from Supabase first, then fallback to localStorage
    const loadProfile = async () => {
      const user = localStorage.getItem('user');
      if (user) {
        try {
          const parsedUser = JSON.parse(user);
          const userId = parsedUser['Membership number'] || parsedUser.mobile || parsedUser.id;

          if (userId) {
            // Try to load from Supabase
            try {
              const response = await getProfile();
              if (response.success && response.profile) {
                const mappedProfile = {
                  name: response.profile.name || '',
                  profilePhotoUrl: response.profile.profile_photo_url || ''
                };
                setUserProfile(mappedProfile);
                return;
              }
            } catch (error) {
              console.error('Error loading from Supabase:', error);
            }
          }

          // Fallback to localStorage
          const userKey = `userProfile_${parsedUser.Mobile || parsedUser.mobile || parsedUser.id || 'default'}`;
          const savedProfile = localStorage.getItem(userKey);
          if (savedProfile) {
            setUserProfile(JSON.parse(savedProfile));
          }
        } catch (error) {
          console.error('Error loading user profile:', error);
        }
      }
    };

    loadProfile();
  }, []);

  return (
    <div className="bg-white min-h-screen pb-10 relative">
      {/* Backdrop for notifications */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
          {isMenuOpen ? <X className="h-6 w-6 text-gray-700" /> : <Menu className="h-6 w-6 text-gray-700" />}
        </button>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-indigo-600" />
          <h1 className="text-lg font-bold text-gray-800">Admin Panel</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('profile')}
            className="p-1 rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-center"
          >
            {userProfile?.profilePhotoUrl ? (
              <img
                src={userProfile.profilePhotoUrl}
                alt="Profile"
                className="h-8 w-8 rounded-lg object-cover border-2 border-indigo-200"
                onError={(e) => {
                  e.target.onerror = null;
                  if (userProfile?.name) {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }
                }}
              />
            ) : null}
            {userProfile?.name && !userProfile?.profilePhotoUrl ? (
              <div className="h-8 w-8 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center text-xs font-bold border-2 border-indigo-200">
                {userProfile.name.charAt(0).toUpperCase()}
              </div>
            ) : !userProfile?.profilePhotoUrl ? (
              <UserCircle className="h-7 w-7 text-gray-700" />
            ) : null}
          </button>
          <button
            onClick={() => setCurrentView(currentView === 'send-message' ? 'directory' : 'send-message')}
            className={`p-2 rounded-xl transition-colors flex items-center gap-1 text-xs font-semibold ${currentView === 'send-message'
                ? 'bg-indigo-600 text-white'
                : 'hover:bg-gray-100 text-indigo-600'
              }`}
            title="Send Notification"
          >
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Send</span>
          </button>
          <button
            onClick={() => onNavigate('home')}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-indigo-600"
            title="Go to Home"
          >
            <HomeIcon className="h-5 w-5" />
          </button>
          <button
            onClick={onLogout}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <LogOut className="h-5 w-5 text-gray-700" />
          </button>
        </div>
      </div>

      <Sidebar
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onNavigate={onNavigate}
        currentPage="admin"
      />

      {/* Header Section */}
      <div className="bg-gradient-to-br from-white to-gray-50 px-4 sm:px-6 pt-8 sm:pt-10 pb-6 border-b border-gray-100">
        <div className="flex items-center gap-3 sm:gap-5">
          <div className="bg-white p-3 sm:p-4 rounded-2xl sm:rounded-3xl shadow-lg border-2 border-gray-100 flex-shrink-0">
            <img src={import.meta.env.VITE_LOGO_URL || '/src/assets/logo.png'} alt="Hospital Logo" className="h-12 w-12 sm:h-16 sm:w-16 object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1 truncate">Admin Panel</h1>
            <p className="text-gray-600 text-sm sm:text-base font-medium">Manage Members, Hospitals, Doctors & More</p>
            {userProfile?.name && (
              <p className="text-indigo-600 text-xs sm:text-sm font-semibold mt-1 truncate">Welcome, {userProfile.name}</p>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      {currentView === 'send-message' ? (
        <SendMessagePage onBack={() => setCurrentView('directory')} />
      ) : (
        <AdminDirectory onNavigate={onNavigate} />
      )}
    </div>
  );
};

export default AdminPanel;

