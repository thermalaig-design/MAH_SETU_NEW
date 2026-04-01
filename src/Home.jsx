import React, { useState, useEffect, useRef } from 'react';
import { User, Users, Clock, FileText, UserPlus, Bell, ChevronRight, Heart, Shield, Plus, ArrowRight, Pill, ShoppingCart, Calendar, Stethoscope, Building2, Phone, QrCode, Monitor, Brain, Package, FileCheck, Search, Filter, MapPin, Star, HelpCircle, BookOpen, Video, Headphones, Menu, X, Home as HomeIcon, Settings, UserCircle, Image, Trash2, Code } from 'lucide-react';
import Sidebar from './components/Sidebar';
import TermsModal from './components/TermsModal';
import ImageSlider from './components/ImageSlider';
import { getProfile, getMarqueeUpdates, getSponsors, getUserNotifications, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification } from './services/api';
import { fetchLatestGalleryImages } from './services/galleryService';
import { registerSidebarState } from './hooks';
import { supabase } from './services/supabaseClient';
import { getCurrentNotificationContext, matchesNotificationForContext } from './services/notificationAudience';
import { fetchFeatureFlags, subscribeFeatureFlags, isFeatureEnabled } from './services/featureFlags';
import { fetchAllTrusts, fetchMemberTrusts, fetchTrustByName, fetchTrustById, fetchDefaultTrust } from './services/trustService';

const buildNotificationContentKey = (notification) => {
  const title = String(notification?.title || '').trim().toLowerCase();
  const message = String(notification?.message || notification?.body || '').trim().toLowerCase();
  const type = String(notification?.type || '').trim().toLowerCase();
  const createdAt = String(notification?.created_at || '').trim();
  const createdAtSecond = createdAt ? createdAt.slice(0, 19) : '';
  return `${type}|${title}|${message}|${createdAtSecond}`;
};

/* eslint-disable react-refresh/only-export-components */
const Home = ({ onNavigate, onLogout, isMember }) => {
  const normalizeTrustId = (id) => (id === null || id === undefined ? '' : String(id));
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const mainContainerRef = useRef(null);
  const channelRef = useRef(null);
  const [userProfile, setUserProfile] = useState(null);
  const [trustInfo, setTrustInfo] = useState(null);
  const [trustList, setTrustList] = useState([]);
  const [selectedTrustId, setSelectedTrustId] = useState(() =>
    normalizeTrustId(localStorage.getItem('selected_trust_id') || '')
  );
  const [defaultTrust, setDefaultTrust] = useState(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [marqueeUpdates, setMarqueeUpdates] = useState([]);
  const [sponsor, setSponsor] = useState(null);
  const [galleryImages, setGalleryImages] = useState([]);
  const [isGalleryLoading, setIsGalleryLoading] = useState(true);
  const [galleryError, setGalleryError] = useState(null);
  const [featureFlags, setFeatureFlags] = useState({});
  const hasLoadedMemberTrusts = useRef(false);

  // Register sidebar state with Android back handler
  useEffect(() => {
    registerSidebarState(isMenuOpen, () => setIsMenuOpen(false));
  }, [isMenuOpen]);

  const getSessionSelectionFlag = () => {
    if (typeof window === 'undefined') return false;
    try {
      if (defaultTrust?.id) return;
      return sessionStorage.getItem('trust_selected_in_session') === 'true';
    } catch {
      return false;
    }
  };

  const setSessionSelectionFlag = () => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem('trust_selected_in_session', 'true');
    } catch {
      // no-op
    }
  };

  useEffect(() => {
    let isActive = true;
    const loadDefaultTrust = async () => {
      try {
        const hasSessionSelection = getSessionSelectionFlag();
        const existingTrustId = localStorage.getItem('selected_trust_id');
        if (hasSessionSelection && (existingTrustId || trustInfo?.id || defaultTrust?.id)) return;

        let trust = null;
        if (existingTrustId) trust = await fetchTrustById(existingTrustId);

        if (!trust) {
          const envTrustId = import.meta.env.VITE_DEFAULT_TRUST_ID;
          const envTrustName = import.meta.env.VITE_DEFAULT_TRUST_NAME;
          if (envTrustId) trust = await fetchTrustById(envTrustId);
          else if (envTrustName) trust = await fetchTrustByName(envTrustName);
        }

        if (!trust) trust = await fetchDefaultTrust();

        if (isActive && trust) {
          setDefaultTrust(trust);
          setTrustList([trust]);
          setTrustInfo(trust);
          setSelectedTrustId(trust.id);
          localStorage.setItem('selected_trust_id', trust.id);
          if (trust.name) localStorage.setItem('selected_trust_name', trust.name);
        }
      } catch (err) {
        console.warn('Failed to load default trust:', err);
      }
    };
    loadDefaultTrust();
    return () => { isActive = false; };
  }, []);

  // Close sidebar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isMenuOpen) {
        const isSidebarClick = event.target.closest('[data-sidebar="true"]');
        const isOverlayClick = event.target.closest('[data-sidebar-overlay="true"]');
        if (isOverlayClick) setIsMenuOpen(false);
        if (!isSidebarClick && !isOverlayClick) setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('click', handleClickOutside, true);
      return () => document.removeEventListener('click', handleClickOutside, true);
    }
  }, [isMenuOpen]);

  // Close notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isNotificationsOpen) {
        const notificationsPanel = event.target.closest('.notification-dropdown');
        const notificationsButton = event.target.closest('.notification-button');
        if (!notificationsPanel && !notificationsButton) setIsNotificationsOpen(false);
      }
    };
    if (isNotificationsOpen) {
      document.addEventListener('click', handleClickOutside, true);
      return () => document.removeEventListener('click', handleClickOutside, true);
    }
  }, [isNotificationsOpen]);

  // Lock scroll when notifications open
  useEffect(() => {
    if (isNotificationsOpen) {
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
  }, [isNotificationsOpen]);

  // Load user profile
  useEffect(() => {
    const loadProfile = async () => {
      const user = localStorage.getItem('user');
      if (user) {
        try {
          const parsedUser = JSON.parse(user);
          const userId = parsedUser['Membership number'] || parsedUser.mobile || parsedUser.id;
          if (userId) {
            try {
              const response = await getProfile();
              if (response.success && response.profile) {
                setUserProfile({ name: response.profile.name || '', profilePhotoUrl: response.profile.profile_photo_url || '' });
                return;
              }
            } catch (error) {
              console.error('Error loading from Supabase:', error);
            }
          }
          const userKey = `userProfile_${parsedUser.Mobile || parsedUser.mobile || parsedUser.id || 'default'}`;
          const savedProfile = localStorage.getItem(userKey);
          if (savedProfile) { setUserProfile(JSON.parse(savedProfile)); return; }
          const fallbackName = parsedUser.name || parsedUser.Name || parsedUser['Name'] || '';
          if (fallbackName) setUserProfile({ name: fallbackName, profilePhotoUrl: '' });
        } catch (error) {
          console.error('Error loading user profile:', error);
        }
      }
    };
    loadProfile();
  }, []);

  // Load trusts from user localStorage
  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) return;
    try {
      const parsedUser = JSON.parse(user);
      const memberships = Array.isArray(parsedUser.hospital_memberships) ? parsedUser.hospital_memberships : [];
      const derivedTrusts = memberships.map((m) => ({
        id: m.trust_id || m.id || null,
        name: m.trust_name || (m.trust_id ? 'Hospital' : null),
        icon_url: m.trust_icon_url || null,
        remark: m.trust_remark || null,
        is_active: m.is_active
      }));
      const uniqueTrusts = [];
      const seenTrustIds = new Set();
      for (const trust of derivedTrusts) {
        if (!trust.id || seenTrustIds.has(trust.id)) continue;
        seenTrustIds.add(trust.id);
        uniqueTrusts.push(trust);
      }
      const primaryTrust = parsedUser.primary_trust || parsedUser.trust || derivedTrusts.find((t) => t.is_active) || derivedTrusts[0] || (parsedUser.trust_name ? { name: parsedUser.trust_name } : null);
      const normalizedTrusts = uniqueTrusts.length > 0 ? uniqueTrusts : primaryTrust ? [primaryTrust] : [];
      setTrustList(normalizedTrusts);
      const effectiveTrustId = normalizeTrustId(selectedTrustId) || normalizeTrustId(primaryTrust?.id) || normalizeTrustId(normalizedTrusts[0]?.id) || '';
      if (effectiveTrustId && effectiveTrustId !== selectedTrustId) {
        setSelectedTrustId(effectiveTrustId);
        localStorage.setItem('selected_trust_id', effectiveTrustId);
      }
      const effectiveTrust = normalizedTrusts.find((t) => normalizeTrustId(t.id) === effectiveTrustId) || primaryTrust || normalizedTrusts[0] || null;
      setTrustInfo(effectiveTrust);
      if (effectiveTrust?.name) localStorage.setItem('selected_trust_name', effectiveTrust.name);
    } catch (error) {
      console.warn('Could not parse user trust info:', error);
    }
  }, [selectedTrustId, defaultTrust?.id]);

  // Load member trusts from API
  useEffect(() => {
    if (hasLoadedMemberTrusts.current) return;
    const user = localStorage.getItem('user');
    if (!user) return;
    let parsedUser = null;
    try { parsedUser = JSON.parse(user); } catch { return; }
    const membersId = parsedUser?.members_id || parsedUser?.member_id || parsedUser?.id;
    if (!membersId) return;
    hasLoadedMemberTrusts.current = true;
    const loadMemberTrusts = async () => {
      try {
        const memberships = await fetchMemberTrusts(membersId);
        if (!Array.isArray(memberships) || memberships.length === 0) return;
        const uniqueTrusts = [];
        const seenTrustIds = new Set();
        for (const trust of memberships) {
          if (!trust.id || seenTrustIds.has(trust.id)) continue;
          seenTrustIds.add(trust.id);
          uniqueTrusts.push(trust);
        }
        if (uniqueTrusts.length === 0) return;
        setTrustList((prev) => { if (Array.isArray(prev) && prev.length >= uniqueTrusts.length) return prev; return uniqueTrusts; });
        const primaryTrust = uniqueTrusts.find((t) => t.is_active) || uniqueTrusts[0];
        const effectiveTrustId = normalizeTrustId(selectedTrustId) || normalizeTrustId(primaryTrust?.id) || '';
        if (effectiveTrustId && effectiveTrustId !== selectedTrustId) {
          setSelectedTrustId(effectiveTrustId);
          localStorage.setItem('selected_trust_id', effectiveTrustId);
        }
        const effectiveTrust = uniqueTrusts.find((t) => normalizeTrustId(t.id) === effectiveTrustId) || primaryTrust || uniqueTrusts[0] || null;
        if (effectiveTrust) {
          setTrustInfo(effectiveTrust);
          if (effectiveTrust.name) localStorage.setItem('selected_trust_name', effectiveTrust.name);
        }
      } catch (error) {
        console.warn('Failed to load member trusts:', error);
      }
    };
    loadMemberTrusts();
  }, [selectedTrustId]);

  // Feature flags
  useEffect(() => {
    const loadFlags = async (force = false) => {
      const trustId = selectedTrustId || trustInfo?.id || '';
      const result = await fetchFeatureFlags(trustId || null, { force });
      if (result.success) setFeatureFlags(result.flags || {});
    };
    loadFlags();
    const handleFocus = () => loadFlags(true);
    const handleVisibility = () => { if (document.visibilityState === 'visible') loadFlags(true); };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    const trustId = selectedTrustId || trustInfo?.id || '';
    const unsubscribe = subscribeFeatureFlags(trustId || null, () => loadFlags(true));
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      unsubscribe?.();
    };
  }, [selectedTrustId, trustInfo?.id]);

  const handleTrustSelect = async (trustId) => {
    const normalizedId = normalizeTrustId(trustId);
    setSelectedTrustId(normalizedId);
    localStorage.setItem('selected_trust_id', normalizedId);
    setSessionSelectionFlag();
    const selected = trustList.find((t) => normalizeTrustId(t.id) === normalizedId) || null;
    setTrustInfo(selected);
    if (selected?.name) localStorage.setItem('selected_trust_name', selected.name);
    try {
      const freshTrust = await fetchTrustById(normalizedId);
      if (freshTrust) {
        setTrustInfo(freshTrust);
        setTrustList((prev) => (prev || []).map((t) => normalizeTrustId(t.id) === normalizedId ? { ...t, ...freshTrust } : t));
        if (freshTrust.name) localStorage.setItem('selected_trust_name', freshTrust.name);
      }
    } catch (err) {
      console.warn('Failed to refresh trust details:', err);
    }
  };

  // Marquee updates
  useEffect(() => {
    const loadMarqueeUpdates = async () => {
      try {
        const trustId = localStorage.getItem('selected_trust_id') || selectedTrustId || null;
        const trustName = localStorage.getItem('selected_trust_name') || trustInfo?.name || null;
        const response = await getMarqueeUpdates(trustId, trustName);
        if (response.success && response.data && response.data.length > 0) {
          const updates = response.data.map(item => item.message).filter(msg => msg && msg.trim() !== '');
          if (updates.length > 0) setMarqueeUpdates(updates);
        } else {
          setMarqueeUpdates([]);
        }
      } catch (error) {
        console.error('Error loading marquee updates:', error);
        setMarqueeUpdates([]);
      }
    };
    loadMarqueeUpdates();
  }, [selectedTrustId, trustInfo]);

  // Sponsor
  useEffect(() => {
    const loadSponsor = async () => {
      try {
        const trustId = selectedTrustId || trustInfo?.id || localStorage.getItem('selected_trust_id') || null;
        const trustName = localStorage.getItem('selected_trust_name') || trustInfo?.name || null;
        if (!trustId) { setSponsor(null); return; }
        const response = await getSponsors(trustId, trustName);
        if (response.success && response.data && response.data.length > 0) setSponsor(response.data[0]);
        else setSponsor(null);
      } catch (error) {
        console.error('Error loading sponsor:', error);
        setSponsor(null);
      }
    };
    loadSponsor();
  }, [selectedTrustId, trustInfo?.id]);

  // Gallery
  useEffect(() => {
    if (import.meta.env.VITE_DISABLE_GALLERY === 'true') return;
    const loadGallery = async () => {
      try {
        setIsGalleryLoading(true);
        setGalleryError(null);
        const trustId = selectedTrustId || trustInfo?.id || localStorage.getItem('selected_trust_id') || null;
        if (!trustId) { setGalleryImages([]); setIsGalleryLoading(false); return; }
        const images = await fetchLatestGalleryImages(6, trustId);
        setGalleryImages(images);
      } catch (err) {
        console.error('Error loading gallery images:', err);
        setGalleryError('Could not load gallery photos');
        setGalleryImages([]);
      } finally {
        setIsGalleryLoading(false);
      }
    };
    loadGallery();
  }, [selectedTrustId, trustInfo?.id]);

  // Notifications
  useEffect(() => {
    if (import.meta.env.VITE_DISABLE_NOTIFICATIONS === 'true') return;
    const fetchNotifications = async () => {
      try {
        const response = await getUserNotifications();
        if (response.success) {
          setNotifications(response.data || []);
          setUnreadCount((response.data || []).filter(n => !n.is_read).length);
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };
    fetchNotifications();
    const handleBirthdayInserted = () => fetchNotifications();
    window.addEventListener('birthdayNotifInserted', handleBirthdayInserted);
    const handlePushNotificationArrived = () => fetchNotifications();
    window.addEventListener('pushNotificationArrived', handlePushNotificationArrived);
    const handlePushNotificationClicked = () => fetchNotifications();
    window.addEventListener('pushNotificationClicked', handlePushNotificationClicked);
    const handleAppResumed = () => fetchNotifications();
    window.addEventListener('appResumed', handleAppResumed);
    const delayed = setTimeout(fetchNotifications, 5000);
    const interval = setInterval(fetchNotifications, 15000);
    return () => {
      clearInterval(interval);
      clearTimeout(delayed);
      window.removeEventListener('birthdayNotifInserted', handleBirthdayInserted);
      window.removeEventListener('pushNotificationArrived', handlePushNotificationArrived);
      window.removeEventListener('pushNotificationClicked', handlePushNotificationClicked);
      window.removeEventListener('appResumed', handleAppResumed);
    };
  }, []);

  // Real-time notifications
  useEffect(() => {
    if (import.meta.env.VITE_DISABLE_NOTIFICATIONS === 'true') return;
    const subscribeToNotifications = () => {
      const notificationContext = getCurrentNotificationContext();
      if (!notificationContext.userId) return;
      const channel = supabase
        .channel('notifications-realtime-home')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
          const newNotif = payload.new;
          const isForMe = matchesNotificationForContext(newNotif, notificationContext);
          if (isForMe) {
            setNotifications((prev) => {
              const existingKeys = new Set(prev.map(buildNotificationContentKey));
              const newKey = buildNotificationContentKey(newNotif);
              if (existingKeys.has(newKey)) return prev;
              if (!newNotif.is_read) setUnreadCount((count) => count + 1);
              return [newNotif, ...prev];
            });
          }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, (payload) => {
          const updatedNotif = payload.new;
          const isForMe = matchesNotificationForContext(updatedNotif, notificationContext);
          if (isForMe) {
            setNotifications((prev) => prev.map((n) => (n.id === updatedNotif.id ? updatedNotif : n)));
            if (payload.old?.is_read === false && updatedNotif.is_read === true) setUnreadCount((prev) => Math.max(0, prev - 1));
          }
        })
        .subscribe();
      channelRef.current = channel;
    };
    subscribeToNotifications();
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  const handleMarkAsRead = async (id) => {
    try {
      await markNotificationAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) { console.error('Error marking notification as read:', error); }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) { console.error('Error marking all notifications as read:', error); }
  };

  const handleDismissNotification = async (id) => {
    try {
      setNotifications(prev => prev.filter(n => n.id !== id));
      setUnreadCount(prev => {
        const dismissed = notifications.find(n => n.id === id);
        return dismissed && !dismissed.is_read ? Math.max(0, prev - 1) : prev;
      });
      try { await deleteNotification(id); } catch (apiError) { console.error('Error deleting notification from backend:', apiError); }
    } catch (error) { console.error('Error dismissing notification:', error); }
  };

  const handleClearAll = async () => {
    const toDelete = [...notifications];
    setNotifications([]);
    setUnreadCount(0);
    setIsNotificationsOpen(false);
    try { await Promise.all(toDelete.map(n => deleteNotification(n.id))); } catch (error) { console.error('Error clearing notifications:', error); }
  };

  useEffect(() => {
    const termsAccepted = localStorage.getItem('terms_accepted');
    if (!termsAccepted) setShowTermsModal(true);
  }, []);

  const handleAcceptTerms = () => {
    localStorage.setItem('terms_accepted', 'true');
    setShowTermsModal(false);
  };

  const formatNotificationTitle = (title, message) => {
    if (title.includes('Appointment') && message.includes('appointment')) {
      if (message.includes('date has been changed')) return '📅 Appointment Rescheduled';
      else if (message.includes('remark')) return '💬 New Message';
      else return '📋 Appointment Updated';
    }
    return title;
  };

  const formatNotificationMessage = (message) => {
    if (message.includes('appointment') && message.includes('date has been changed')) {
      const dateMatch = message.match(/date has been changed from ([\d-]+) to ([\d-]+)/i);
      if (dateMatch) return `Hi there! Your appointment has been rescheduled from ${formatDate(dateMatch[1])} to ${formatDate(dateMatch[2])}.`;
    } else if (message.includes('appointment') && message.includes('remark')) {
      const remarkMatch = message.match(/has a new remark: (.+)/i);
      if (remarkMatch) return `Hi there! New message regarding your appointment: "${remarkMatch[1]}".`;
      else return `Hi there! New message regarding your appointment.`;
    }
    return message;
  };

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return dateStr; }
  };

  const quickActions = [
    { id: 'directory', title: 'Directory', desc: 'Find Doctors & Hospitals', icon: Users, color: 'bg-blue-100', iconColor: 'text-blue-700', screen: 'directory', featureKey: 'feature_directory' },
    { id: 'appointment', title: 'OPD Schedule', desc: 'Book OPD Appointment', icon: Clock, color: 'bg-indigo-100', iconColor: 'text-indigo-700', screen: 'appointment', memberOnly: true, featureKey: 'feature_opd' },
    { id: 'reports', title: 'Reports', desc: 'Medical Test Results', icon: FileText, color: 'bg-amber-100', iconColor: 'text-amber-700', screen: 'reports', featureKey: 'feature_reports' },
    { id: 'reference', title: 'Patient Referral', desc: 'Refer Patient to Doctor', icon: UserPlus, color: 'bg-teal-100', iconColor: 'text-teal-700', screen: 'reference', featureKey: 'feature_referral' },
    { id: 'vip-login', title: 'VIP Login', desc: 'Special Access', icon: Shield, color: 'bg-rose-100', iconColor: 'text-rose-700', screen: 'vip-login' },
  ];

  const ff = (key) => isFeatureEnabled(featureFlags, key);

  const activeTrust =
    trustList.find((trust) => normalizeTrustId(trust.id) === normalizeTrustId(selectedTrustId)) ||
    trustInfo ||
    defaultTrust ||
    null;

  const shouldShowTrustSelector = (() => {
    if (trustList.length <= 1) return false;
    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) return false;
      const parsed = JSON.parse(userStr);
      return parsed?.isRegisteredMember === true;
    } catch { return false; }
  })();

  return (
    <div
      ref={mainContainerRef}
      className={`bg-gradient-to-br from-sky-50 via-white to-emerald-50 min-h-screen flex flex-col relative ${isMenuOpen ? 'overflow-hidden max-h-screen' : ''}`}
    >
      {/* Navbar */}
      <div className="bg-white border-slate-200 shadow-sm border-b px-5 py-4 sm:px-6 sm:py-5 flex items-center justify-between sticky top-0 z-50 transition-all duration-300">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="p-2 rounded-xl hover:bg-slate-100 transition-colors mt-3"
        >
          {isMenuOpen ? <X className="h-6 w-6 text-slate-700" /> : <Menu className="h-6 w-6 text-slate-700" />}
        </button>
        <div className="flex items-center gap-2 mt-3">
          <img
            src={activeTrust?.icon_url || import.meta.env.VITE_LOGO_URL || '/src/assets/logo.png'}
            alt="MAH SETU Logo"
            className="h-7 w-7 object-contain"
          />
          <h1 className="text-lg font-bold text-slate-800 tracking-[0.2em]">MAH SETU</h1>
        </div>
        <div className="flex items-center gap-2">
          {ff('feature_notifications') && (
            <div className="relative mt-3">
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="notification-button p-2 rounded-xl transition-colors relative hover:bg-slate-100"
              >
                <Bell className="h-6 w-6 text-slate-700" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[10px] font-bold h-4 w-4 flex items-center justify-center rounded-full border-2 border-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {isNotificationsOpen && (
                <>
                  <div className="fixed inset-0 z-[90] bg-black/0" onClick={() => setIsNotificationsOpen(false)} />
                  <div className="notification-dropdown fixed left-1/2 -translate-x-1/2 top-20 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 z-[100] overflow-hidden">
                    <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                      <h3 className="font-bold text-slate-900">Notifications ({notifications.length})</h3>
                      <div className="flex items-center gap-3">
                        {unreadCount > 0 && (
                          <button onClick={handleMarkAllAsRead} className="text-xs text-slate-600 font-semibold hover:text-slate-800">
                            Mark all read
                          </button>
                        )}
                        {notifications.length > 0 && (
                          <button onClick={handleClearAll} className="flex items-center gap-1 text-xs text-rose-600 font-semibold hover:text-rose-700" title="Clear all notifications">
                            <Trash2 className="w-3.5 h-3.5" />
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto">
                      {notifications.length > 0 ? (
                        notifications.slice(0, 4).map((notification) => (
                          <div key={notification.id} className={`p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer relative ${!notification.is_read ? 'bg-slate-50' : ''}`}>
                            <div
                              onClick={() => {
                                handleMarkAsRead(notification.id);
                                sessionStorage.setItem('initialNotification', JSON.stringify(notification));
                                setIsNotificationsOpen(false);
                                onNavigate('notifications');
                              }}
                              className="cursor-pointer"
                            >
                              {!notification.is_read && <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-slate-600 rounded-full" />}
                              <h4 className={`text-sm font-semibold text-slate-900 mb-0.5 ${!notification.is_read ? 'pr-4' : ''}`}>
                                {formatNotificationTitle(notification.title, notification.message)}
                              </h4>
                              <p className="text-xs text-slate-600 leading-relaxed mb-2">{formatNotificationMessage(notification.message)}</p>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {new Date(notification.created_at).toLocaleDateString()} at {new Date(notification.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDismissNotification(notification.id); }}
                              className="absolute top-2 right-2 p-1 rounded-full hover:bg-slate-200 text-slate-500 hover:text-rose-600 transition-colors"
                              title="Dismiss notification"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center">
                          <div className="bg-slate-100 h-12 w-12 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Bell className="h-6 w-6 text-slate-400" />
                          </div>
                          <p className="text-sm text-slate-500 font-medium">No notifications yet</p>
                        </div>
                      )}
                    </div>
                    {notifications.length > 0 && (
                      <div className="p-3 bg-slate-50 text-center border-t border-slate-200">
                        <button
                          onClick={() => { setIsNotificationsOpen(false); onNavigate('notifications'); }}
                          className="text-xs text-slate-500 font-semibold hover:text-slate-700"
                        >
                          View all {notifications.length} notifications
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <Sidebar isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} onNavigate={onNavigate} currentPage="home" />

      {/* Header Card (simple like reference) */}
      <div className="bg-gradient-to-br from-sky-50 via-white to-emerald-50 px-0 pt-0">
        <div className="relative w-full rounded-none border border-slate-200/80 bg-gradient-to-br from-white via-white to-slate-50 px-5 sm:px-6 py-4 sm:py-5 shadow-[0_12px_26px_rgba(15,23,42,0.08)] overflow-hidden">
          <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-sky-100/70 blur-2xl" />

          <div className="pointer-events-none absolute -left-8 -bottom-10 h-24 w-24 rounded-full bg-indigo-100/60 blur-2xl" />
          {activeTrust?.name && (
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-tight tracking-tight">
              {activeTrust.name}
            </h1>
          )}
          <p className="text-slate-600 text-sm font-medium mt-0.5">
            {activeTrust?.remark || 'Welcome to our portal'}
          </p>
          {userProfile?.name && (
            <p className="text-sky-700 text-sm font-semibold mt-1">Welcome, {userProfile.name}</p>
          )}

          {/* Trust Logos � logos only, inside header */}
          {shouldShowTrustSelector && trustList.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pt-3 mt-3 border-t border-slate-100 pb-0.5" style={{ scrollbarWidth: 'none' }}>
              {trustList.map((trust, idx) => {
                const isActive = normalizeTrustId(trust.id) === selectedTrustId;
                return (
                  <button
                    key={trust.id || trust.name}
                    onClick={() => handleTrustSelect(trust.id)}
                    className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden transition-all duration-300"
                    style={{
                      border: isActive ? '2.5px solid #6366f1' : '2px solid #e2e8f0',
                      backgroundColor: isActive ? '#ffffff' : '#f8fafc',
                      transform: isActive ? 'scale(1.1)' : 'scale(1)',
                      boxShadow: isActive ? '0 4px 14px rgba(99,102,241,0.35)' : 'none',
                    }}
                    title={trust.name || 'Hospital'}
                  >
                    {trust.icon_url ? (
                      <img src={trust.icon_url} alt={trust.name || 'Hospital'} className="w-7 h-7 object-contain" />
                    ) : (
                      <Building2 className="h-4 w-4 text-indigo-400" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Marquee Banner */}
      {ff('feature_marquee') && marqueeUpdates.length > 0 && (
        <div className="mt-0 mb-2 w-full overflow-hidden bg-gradient-to-r from-purple-900/90 via-purple-800/90 to-indigo-900/90" style={{ boxShadow: '0 2px 12px rgba(88,28,135,0.35)' }}>
          <div className="flex items-stretch">
            <div className="flex-shrink-0 bg-black/40 px-3 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
              </span>
              <span className="text-white text-[11px] font-bold uppercase tracking-widest whitespace-nowrap">Updates</span>
            </div>
            <div className="w-px bg-white/30 my-1.5" />
            <div className="overflow-hidden flex-1 py-2">
              <div className="marquee-track flex">
                {[...marqueeUpdates, ...marqueeUpdates].map((msg, i) => (
                  <span key={i} className="whitespace-nowrap text-white text-xs font-semibold px-6">⭐ {msg}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Services Section */}
      <div className="px-4 sm:px-6 mt-3">
        <div className="mb-3">
          <h2 className="text-base font-extrabold text-slate-900 tracking-tight">All Features</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.filter((action) => !action.featureKey || ff(action.featureKey)).map((action) => (
            <button
              key={action.id}
              onClick={() => onNavigate(action.screen)}
              disabled={action.memberOnly && !isMember}
              className={`bg-white rounded-3xl border border-slate-200/80 shadow-[0_10px_22px_rgba(15,23,42,0.06)] flex flex-col items-center text-center transition-all active:scale-95 overflow-hidden ${action.memberOnly && !isMember ? 'opacity-60' : ''}`}
            >
              <div className={`${action.color} w-full h-1 rounded-t-3xl opacity-70`} />
              <div className="flex flex-col items-center w-full px-3 pt-4 pb-4 gap-2">
                <div className={`${action.color} w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm`}>
                  <action.icon className={`h-7 w-7 ${action.iconColor}`} />
                </div>
                <div className="flex flex-col items-center">
                  <h3 className="font-bold text-slate-900 text-base leading-tight">{action.title}</h3>
                  <p className="text-slate-400 text-[11px] font-medium mt-1 leading-snug">{action.desc}</p>
                </div>
</div>
            </button>
          ))}
        </div>
      </div>

      {/* Gallery Section */}
      {ff('feature_gallery') && (
        <div className="px-4 sm:px-6 mt-10 sm:mt-12 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-1 bg-indigo-600 rounded-full" />
                <span className="text-indigo-600 text-[10px] font-bold uppercase tracking-wider">Visual Tour</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Hospital Gallery</h2>
            </div>
            <button
              onClick={() => onNavigate('gallery')}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-2xl bg-slate-100 text-slate-700 text-sm font-bold hover:bg-indigo-600 hover:text-white transition-all group"
            >
              Explore All <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
          <div className="w-full relative">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-200 rounded-full blur-3xl opacity-40 -z-10" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-200 rounded-full blur-3xl opacity-30 -z-10" />
            {isGalleryLoading ? (
              <div className="w-full h-[190px] sm:h-[230px] rounded-2xl border-2 border-white bg-gray-100 animate-pulse" />
            ) : galleryImages.length > 0 ? (
              <ImageSlider images={galleryImages} onNavigate={onNavigate} />
            ) : (
              <button
                onClick={() => onNavigate('gallery')}
                className="w-full h-[190px] sm:h-[230px] rounded-2xl border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center text-slate-600 hover:border-slate-400 hover:text-slate-800 transition-colors"
              >
                <Image className="h-8 w-8 mb-2" />
                <div className="text-sm font-bold">No gallery photos yet</div>
                <div className="text-xs mt-0.5">{galleryError || 'Tap to open gallery'}</div>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sponsor Section */}
      {ff('feature_sponsors') && (
        <div className="px-4 sm:px-6 mt-6 mb-8">
          {sponsor ? (
            <button
              onClick={() => {
                try { sessionStorage.setItem('selectedSponsor', JSON.stringify(sponsor)); } catch { }
                onNavigate('sponsor-details');
              }}
              className="group w-full overflow-hidden rounded-3xl border border-slate-200/80 bg-white text-left shadow-[0_12px_28px_rgba(15,23,42,0.12)] transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(15,23,42,0.18)]"
            >
              <div className="relative px-5 sm:px-6 py-4 sm:py-4 bg-gradient-to-br from-white via-white to-sky-50">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_55%)]" />
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400/70 via-indigo-400/70 to-blue-400/70" />
                <div className="relative flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 text-indigo-700 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em]">
                      Sponsored
                    </div>
                    <div className="mt-2 text-slate-900 text-base sm:text-lg font-extrabold leading-snug line-clamp-2">
                      {sponsor.name}
                    </div>
                    <p className="mt-1 text-xs text-slate-500 font-medium">
                      Supporting healthcare services for your trust
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="relative h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-white shadow-lg border border-slate-200 flex items-center justify-center overflow-hidden">
                      <div className="absolute inset-0 rounded-2xl ring-1 ring-indigo-200/60" />
                      {sponsor.photo_url ? (
                        <img src={sponsor.photo_url} alt={sponsor.name || 'Sponsor'} className="h-full w-full object-contain" />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-gray-200" />
                      )}
                    </div>
                  </div>
                </div>
                <div className="relative mt-3 flex items-center justify-between">
                  <div className="text-[11px] text-slate-500 font-semibold">Tap to view details</div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-white text-[11px] font-semibold px-3 py-1.5 group-hover:bg-indigo-600 transition-colors">
                    Explore
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            </button>
          ) : (
            <div className="w-full rounded-3xl border-2 border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
              No sponsor details available for this trust.
            </div>
          )}
        </div>
      )}

      <style>{`
        .marquee-track {
          display: flex;
          animation: marquee-scroll 30s linear infinite;
          width: max-content;
        }
        .marquee-track:hover { animation-play-state: paused; }
        @keyframes marquee-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>

      {/* Footer */}
      <footer className="mt-auto py-4 px-6 bg-white border-t border-slate-200">
        <div className="text-center">
          <button
            onClick={() => onNavigate('developers')}
            className="text-xs text-slate-500 hover:text-slate-700 font-medium transition-colors"
          >
            Powered by Developers
          </button>
        </div>
      </footer>

      <TermsModal isOpen={showTermsModal} onAccept={handleAcceptTerms} />
    </div>
  );
};

export default Home;


























