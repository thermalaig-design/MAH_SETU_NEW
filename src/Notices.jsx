import React, { useState, useEffect } from 'react';
import { User, Users, Clock, FileText, UserPlus, Bell, ChevronRight, LogOut, Heart, Shield, Plus, ArrowRight, Pill, ShoppingCart, Calendar, Stethoscope, Building2, Phone, QrCode, Monitor, Brain, Package, FileCheck, Search, Filter, MapPin, Star, HelpCircle, BookOpen, Video, Headphones, Menu, X, Home as HomeIcon, Settings } from 'lucide-react';
import Sidebar from './components/Sidebar';

const Notices = ({ onNavigate }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const allNotices = [
    {
      id: 2,
      title: 'New Equipment Installation',
      message: 'New MRI machines are being installed in the radiology department. Please expect some noise.',
      date: '2024-12-28',
      priority: 'normal',
      icon: Building2,
      tag: 'Infrastructure'
    },
    {
      id: 3,
      title: 'Annual Health Camp',
      message: 'Our annual free health camp will be organized on 5th Jan. Volunteers are requested to register.',
      date: '2024-12-25',
      priority: 'normal',
      icon: Stethoscope,
      tag: 'Health Camp'
    },
    {
      id: 4,
      title: 'Holiday Notice',
      message: 'The hospital administrative office will remain closed on 1st Jan for New Year.',
      date: '2024-12-24',
      priority: 'low',
      icon: Bell,
      tag: 'Admin'
    },
  ];

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

  return (
    <div className={`bg-white min-h-screen pb-10 relative${isMenuOpen ? ' overflow-hidden max-h-screen' : ''}`}>
      {/* Navbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-5 flex items-center justify-between sticky top-0 z-50 shadow-sm mt-6 pointer-events-auto">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors pointer-events-auto"
        >
          {isMenuOpen ? <X className="h-6 w-6 text-gray-700" /> : <Menu className="h-6 w-6 text-gray-700" />}
        </button>
        <h1 className="text-lg font-bold text-gray-800">Notice Board</h1>
        <button
          onClick={() => onNavigate('home')}
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-center text-indigo-600"
        >
          <HomeIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Backdrop for sidebar */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-0 z-25 lg:hidden"
          onClick={() => setIsMenuOpen(false)}
          style={{ pointerEvents: 'auto' }}
        ></div>
      )}

      <Sidebar
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onNavigate={onNavigate}
        currentPage="notices"
      />

      {/* Header Section */}
      <div className="bg-white px-6 pt-8 pb-4">
        <div className="flex items-center gap-4">
          <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
            <Bell className="h-12 w-12 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Important Updates</h1>
            <p className="text-gray-500 text-sm font-medium">Stay informed with latest news</p>
          </div>
        </div>
      </div>

      {/* Notices List */}
      <div className="px-6 py-4 space-y-4">
        {allNotices.map((notice) => (
          <div key={notice.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-100 transition-all border-l-4 border-l-indigo-600">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded-full">
                {notice.tag}
              </span>
              <div className="flex items-center gap-1.5 text-gray-400 text-[10px] font-bold">
                <Calendar className="h-3 w-3" />
                {notice.date}
              </div>
            </div>

            <h3 className="font-bold text-gray-800 text-lg mb-2 leading-tight">
              {notice.title}
            </h3>

            <p className="text-gray-600 text-sm leading-relaxed">
              {notice.message}
            </p>

            <div className="mt-4 pt-4 border-t border-gray-50 flex justify-end">
              <button className="text-indigo-600 text-xs font-bold flex items-center gap-1 hover:underline transition-all">
                Read Full Detail <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}

        {allNotices.length === 0 && (
          <div className="text-center py-20">
            <div className="bg-gray-50 h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-gray-300">
              <Bell className="h-8 w-8 text-gray-300" />
            </div>
            <h3 className="text-gray-800 font-bold">No new notices</h3>
            <p className="text-gray-500 text-sm mt-1">Check back later for updates</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notices;