import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home as HomeIcon, Users, Clock, FileText, UserPlus, ChevronRight, LogOut, Image, User, Share2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { getProfile } from '../services/api';
import { fetchFeatureFlags, isFeatureEnabled } from '../services/featureFlags';

// Calculate profile completion % based on filled fields
const calcCompletion = (profile, user) => {
  const fields = [
    profile?.name || user?.Name || user?.name,
    profile?.profilePhotoUrl,
    user?.Mobile || user?.mobile,
    user?.Email || user?.email,
    user?.['Company Name'] || user?.company,
    user?.['Address Home'] || user?.address,
    user?.['Membership number'] || user?.membership_number,
  ];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
};

const Sidebar = ({ isOpen, onClose, onNavigate, currentPage }) => {
  const sidebarRef = useRef(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [userData, setUserData] = useState(null);
  const [shareToast, setShareToast] = useState(false);
  const [featureFlags, setFeatureFlags] = useState({});

  // Load feature flags when sidebar opens
  useEffect(() => {
    if (!isOpen) return;
    const trustId = localStorage.getItem('selected_trust_id') || null;
    fetchFeatureFlags(trustId, { force: false }).then((result) => {
      if (result.success) setFeatureFlags(result.flags || {});
    });
  }, [isOpen]);

  const ff = (key) => isFeatureEnabled(featureFlags, key);

  // Load profile data when sidebar opens
  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      try {
        const user = localStorage.getItem('user');
        const parsedUser = user ? JSON.parse(user) : null;
        setUserData(parsedUser);

        const response = await getProfile();
        if (response.success && response.profile) {
          setProfile({
            name: response.profile.name || parsedUser?.Name || parsedUser?.name || '',
            profilePhotoUrl: response.profile.profile_photo_url || '',
          });
        } else if (parsedUser) {
          const key = `userProfile_${parsedUser.Mobile || parsedUser.mobile || parsedUser.id || 'default'}`;
          const saved = localStorage.getItem(key);
          if (saved) setProfile(JSON.parse(saved));
          else setProfile({ name: parsedUser.Name || parsedUser.name || '', profilePhotoUrl: '' });
        }
      } catch {
        const user = localStorage.getItem('user');
        if (user) {
          const parsedUser = JSON.parse(user);
          setUserData(parsedUser);
          setProfile({ name: parsedUser?.Name || parsedUser?.name || '', profilePhotoUrl: '' });
        }
      }
    };
    load();
  }, [isOpen]);

  // Lock body scroll when sidebar is open
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      document.body.dataset.scrollY = scrollY;
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.touchAction = 'none';
    } else {
      const scrollY = parseInt(document.body.dataset.scrollY || '0');
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      document.body.style.touchAction = '';
      window.scrollTo(0, scrollY);
    }
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      document.body.style.touchAction = '';
    };
  }, [isOpen]);

  // Swipe left to close
  useEffect(() => {
    if (!isOpen) return;
    const handleTouchStart = (e) => {
      touchStartX.current = e.touches[0].clientX;
      touchEndX.current = e.touches[0].clientX;
    };
    const handleTouchMove = (e) => { touchEndX.current = e.touches[0].clientX; };
    const handleTouchEnd = () => {
      if (touchStartX.current - touchEndX.current > 80) onClose();
    };
    const sidebar = sidebarRef.current;
    if (sidebar) {
      sidebar.addEventListener('touchstart', handleTouchStart, { passive: true });
      sidebar.addEventListener('touchmove', handleTouchMove, { passive: true });
      sidebar.addEventListener('touchend', handleTouchEnd);
    }
    return () => {
      if (sidebar) {
        sidebar.removeEventListener('touchstart', handleTouchStart);
        sidebar.removeEventListener('touchmove', handleTouchMove);
        sidebar.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const displayName = profile?.name || userData?.Name || userData?.name || 'User';
  const initials = displayName.charAt(0).toUpperCase();
  const completion = calcCompletion(profile, userData);

  const menuItems = [
    { id: 'home',      label: 'Home',           icon: HomeIcon },
    { id: 'directory', label: 'Directory',      icon: Users,    featureKey: 'feature_directory' },
    { id: 'appointment', label: 'OPD Schedule', icon: Clock,    featureKey: 'feature_opd' },
    { id: 'reports',   label: 'Reports',        icon: FileText, featureKey: 'feature_reports' },
    { id: 'gallery',   label: 'Gallery',        icon: Image,    featureKey: 'feature_gallery' },
    { id: 'reference', label: 'Patient Referral', icon: UserPlus, featureKey: 'feature_referral' },
  ].filter((item) => !item.featureKey || ff(item.featureKey));

  return (
    <>
      {/* Overlay — absolute within parent container */}
      <div
        className="absolute inset-0 bg-white/60 backdrop-blur-sm z-40"
        data-sidebar-overlay="true"
        onTouchStart={onClose}
        onClick={onClose}
        style={{ touchAction: 'none' }}
      />

      {/* Sidebar panel — absolute, left-anchored, full height */}
      <div
        ref={sidebarRef}
        className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl z-50 flex flex-col"
        data-sidebar="true"
        style={{ maxWidth: '85vw', touchAction: 'pan-y' }}
      >
        {/* ── Profile Card Header ── */}
        <div
          className="px-5 pt-16 pb-6 border-b border-gray-100 flex-shrink-0 cursor-pointer"
          onClick={() => { onNavigate('profile'); onClose(); }}
        >
          {/* Avatar + name row */}
          <div className="flex items-center gap-3 mb-3">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              {profile?.profilePhotoUrl ? (
                <img
                  src={profile.profilePhotoUrl}
                  alt={displayName}
                  className="h-14 w-14 rounded-2xl object-cover border-2 border-indigo-200"
                  onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }}
                />
              ) : (
                <div className="h-14 w-14 rounded-2xl bg-indigo-100 border-2 border-indigo-200 flex items-center justify-center text-xl font-bold text-indigo-700 select-none">
                  {initials}
                </div>
              )}
              {/* Online dot */}
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white" />
            </div>

            {/* Name + subtitle */}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-sm truncate">{displayName}</p>
              <p className="text-xs text-indigo-600 font-medium mt-0.5">View &amp; Edit Profile</p>
            </div>

            <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
          </div>

          {/* Completion bar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-gray-500 font-medium">Profile Completion</span>
              <span className={`text-[11px] font-bold ${completion >= 80 ? 'text-green-600' : completion >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                {completion}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${completion >= 80 ? 'bg-green-500' : completion >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                style={{ width: `${completion}%` }}
              />
            </div>
          </div>
        </div>

        {/* ── Scrollable area: nav + extras + logout ── */}
        <div className="flex-1 overflow-y-auto">
          {/* Nav items */}
          <div className="py-3 px-3">
            <div className="space-y-1">
              {menuItems.map((item) => {
                const cp = (currentPage || '').toLowerCase();
                const aliasMap = {
                  'healthcare-directory': 'directory',
                  'healthcare-trustee-directory': 'directory',
                  'directory': 'directory',
                  'appointments': 'appointment',
                  'appointment': 'appointment',
                  'home': 'home',
                  'reports': 'reports',
                  'gallery': 'gallery',
                  'reference': 'reference',
                  'profile': 'profile'
                };
                let normalized = aliasMap[cp] || cp;
                if (!normalized) normalized = '';
                if (!aliasMap[cp] && normalized.endsWith('s')) normalized = normalized.slice(0, -1);
                const isActive = normalized === String(item.id).toLowerCase();
                return (
                  <button
                    key={item.id}
                    onClick={() => { onNavigate(item.id); onClose(); }}
                    className={`w-full flex items-center gap-3 px-4 rounded-xl transition-all text-left active:scale-95 select-none ${isActive ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700 active:bg-gray-100'
                      }`}
                    style={{ minHeight: '52px', WebkitTapHighlightColor: 'rgba(0,0,0,0.06)' }}
                  >
                    <item.icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-indigo-600' : 'text-gray-500'}`} />
                    <span className={`font-medium flex-1 ${isActive ? 'text-indigo-600' : 'text-gray-700'}`}>
                      {item.label}
                    </span>
                    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── More Options ── */}
          <div className="px-3 pt-2 pb-3 border-t border-gray-100 space-y-2">
            {/* Share Button - controlled by feature_share_app */}
            {ff('feature_share_app') && <button
              onClick={async () => {
                const APP_URL = 'https://play.google.com/store/apps/details?id=com.maharajaagarsen.app';
                const shareText = 'MAH SETU App - Maharaja Agrasen Hospital ka official app. Download karo Google Play Store se:';
                const shareData = {
                  title: 'MAH SETU - Maharaja Agrasen Hospital',
                  text: shareText,
                  url: APP_URL,
                };
                try {
                  if (Capacitor.isNativePlatform()) {
                    await Share.share({
                      title: shareData.title,
                      text: `${shareText} ${APP_URL}`,
                      url: APP_URL,
                      dialogTitle: 'Share MAH SETU App',
                    });
                    return;
                  }

                  if (navigator.share) {
                    await navigator.share(shareData);
                    return;
                  }

                  if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(`${shareText} ${APP_URL}`);
                    setShareToast(true);
                    setTimeout(() => setShareToast(false), 2500);
                  } else {
                    setShareToast(true);
                    setTimeout(() => setShareToast(false), 2500);
                  }
                } catch (err) {
                  if (err?.name === 'AbortError') return;
                  try {
                    if (navigator.clipboard?.writeText) {
                      await navigator.clipboard.writeText(`${shareText} ${APP_URL}`);
                      setShareToast(true);
                      setTimeout(() => setShareToast(false), 2500);
                    }
                  } catch { /* nothing */ }
                }
              }}
              className="w-full flex items-center gap-3 px-4 rounded-xl bg-blue-50 text-blue-600 font-semibold active:bg-blue-200 transition-colors active:scale-95 select-none relative"
              style={{ minHeight: '48px', WebkitTapHighlightColor: 'rgba(59,130,246,0.08)' }}
            >
              <Share2 className="h-5 w-5 flex-shrink-0" />
              <span>Share App</span>
              {shareToast && (
                <span className="absolute right-4 text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
                  Copied!
                </span>
              )}
            </button>}

          </div>

          {/* ── Logout ── */}
          <div className="px-3 pb-8 border-t border-gray-100">
            <button
              onClick={() => {
                localStorage.removeItem('user');
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('lastVisitedRoute');
                sessionStorage.removeItem('selectedMember');
                sessionStorage.removeItem('previousScreen');
                sessionStorage.removeItem('previousScreenName');
                navigate('/login', { replace: true });
                if (onClose) onClose();
              }}
              className="w-full flex items-center justify-between px-4 rounded-xl bg-red-50 text-red-600 font-semibold active:bg-red-100 transition-colors active:scale-95 select-none"
              style={{ minHeight: '52px', WebkitTapHighlightColor: 'rgba(220,38,38,0.08)' }}
            >
              <div className="flex items-center gap-3">
                <LogOut className="h-5 w-5 flex-shrink-0" />
                <span>Logout</span>
              </div>
              <ChevronRight className="h-4 w-4 flex-shrink-0" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;

