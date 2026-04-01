import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { LocalNotifications } from '@capacitor/local-notifications';
import { initPushNotifications } from './services/pushNotificationService';
import Login from './Login';
import VIPLogin from './VIPLogin';
import Home from './Home';
import OTPVerification from './OTPVerification';
import SpecialOTPVerification from './SpecialOTPVerification';
import Directory from './Directory';
import Profile from './Profile';
import Appointments from './Appointments';
import Reports from './Reports';
import Referral from './Referral';
import Notices from './Notices';
import Notifications from './Notifications';
import HealthcareTrusteeDirectory from './HealthcareTrusteeDirectory';
import MemberDetails from './MemberDetails';
import CommitteeMembers from './CommitteeMembers';
import ProtectedRoute from './ProtectedRoute';
import SponsorDetails from './SponsorDetails';
import DeveloperDetails from './DeveloperDetails';
import FeatureGuard from './components/FeatureGuard';

import TermsAndConditions from './TermsAndConditions';
import PrivacyPolicy from './PrivacyPolicy';
import Gallery from './Gallery';
import AdminUserProfiles from './admin/AdminUserProfiles';
import { getCurrentNotificationContext, matchesNotificationForContext } from './services/notificationAudience';

import {
  useAndroidBackHandler,
  useAndroidStatusBar,
  useAndroidSafeArea,
  useAndroidScreenOrientation,
  useAndroidKeyboard,
  useSwipeBackNavigation
} from './hooks';

const HospitalTrusteeApp = () => {
  const LAST_VISITED_ROUTE_KEY = 'lastVisitedRoute';
  const PUBLIC_ROUTES = ['/login', '/otp-verification', '/special-otp-verification', '/terms-and-conditions', '/privacy-policy', '/developers', '/vip-login'];
  const navigate = useNavigate();
  const location = useLocation();
  const [isMember] = useState(true);
  const [selectedMember, setSelectedMember] = useState(null);
  const [previousScreen, setPreviousScreen] = useState(null);
  const [previousScreenName, setPreviousScreenName] = useState(null);

  // Initialize Android features
  useAndroidBackHandler();
  useSwipeBackNavigation();
  useAndroidStatusBar();
  useAndroidSafeArea();
  useAndroidScreenOrientation('PORTRAIT');
  useAndroidKeyboard();

  const isAuthenticated = () => {
    const user = localStorage.getItem('user');
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    return !!user && user !== 'null' && user !== 'undefined' && isLoggedIn;
  };

  const clearAuthAndRedirectToLogin = () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('user');
    localStorage.removeItem(LAST_VISITED_ROUTE_KEY);
    sessionStorage.removeItem('selectedMember');
    sessionStorage.removeItem('previousScreen');
    sessionStorage.removeItem('previousScreenName');
    navigate('/login', { replace: true });
  };

  // Persist current route so app can resume where user left off after app restart.
  // Note: /vip-login is intentionally saved (not filtered out) so registered members
  // always return to their VIP home page.
  useEffect(() => {
    if (!isAuthenticated()) return;
    // Save all authenticated routes, including /vip-login
    const doNotSave = ['/login', '/otp-verification', '/special-otp-verification', '/terms-and-conditions', '/privacy-policy'];
    if (doNotSave.includes(location.pathname)) return;
    localStorage.setItem(LAST_VISITED_ROUTE_KEY, location.pathname);
  }, [location.pathname]);

  // On app boot/reopen: restore last route for logged-in users, otherwise force login route.
  useEffect(() => {
    const authed = isAuthenticated();
    if (!authed) {
      if (!PUBLIC_ROUTES.includes(location.pathname)) {
        console.log('🔐 Not authenticated, redirecting to login');
        navigate('/login', { replace: true });
      }
      return;
    }

    const savedRoute = localStorage.getItem(LAST_VISITED_ROUTE_KEY);
    console.log('📍 App mounted - Current path:', location.pathname, 'Saved route:', savedRoute);

    // Restore saved route when at root — skip if already on the right page
    const noRestoreRoutes = ['/login', '/otp-verification', '/special-otp-verification', '/terms-and-conditions', '/privacy-policy'];
    if (location.pathname === '/' && savedRoute && !noRestoreRoutes.includes(savedRoute) && savedRoute !== '/') {
      console.log('⬅️ Restoring saved route:', savedRoute);
      setTimeout(() => {
        navigate(savedRoute, { replace: true });
      }, 100);
    }
  }, []);

  // ─── Notification Tap → Open Notifications Page ──────────────────────────────
  useEffect(() => {
    // When user taps a phone notification, navigate to /notifications
    const subscription = LocalNotifications.addListener(
      'localNotificationActionPerformed',
      (action) => {
        console.log('🔔 Notification tapped:', action);
        const notificationId =
          action?.notification?.extra?.notificationId ||
          action?.notification?.extra?.notification_id ||
          action?.notification?.data?.notificationId ||
          action?.notification?.id ||
          null;

        if (notificationId) {
          sessionStorage.setItem('openNotificationId', String(notificationId));
        }

        const isLoggedIn = localStorage.getItem('isLoggedIn');
        if (isLoggedIn) {
          navigate('/notifications');
        }
      }
    );
    return () => {
      subscription.then(s => s.remove()).catch(() => { });
    };
  }, [navigate]);

  // ─── FCM Push Registration (Android) ─────────────────────────────────────────
  useEffect(() => {
    let cleanup;
    const setupPush = async () => {
      cleanup = await initPushNotifications();
    };
    setupPush();
    return () => {
      if (typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, []);

  // ─── Push Tap Deep Link Fallback ──────────────────────────────────────────────
  useEffect(() => {
    const shouldOpen = localStorage.getItem('openNotificationsFromPush');
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (shouldOpen === '1' && isLoggedIn) {
      localStorage.removeItem('openNotificationsFromPush');
      navigate('/notifications');
    }
  }, [location.pathname, navigate]);

  // ─── Birthday Notification Check (Direct Supabase) ───────────────────────────
  useEffect(() => {
    if (import.meta.env.VITE_DISABLE_NOTIFICATIONS === 'true') return;
    const checkBirthday = async () => {
      try {
        const userStr = localStorage.getItem('user');
        if (!userStr) {
          console.log('🎂 [Birthday] No user in localStorage, skipping');
          return;
        }

        const parsedUser = JSON.parse(userStr);
        console.log('🎂 [Birthday] parsedUser keys:', Object.keys(parsedUser));
        console.log('🎂 [Birthday] Mobile:', parsedUser.Mobile || parsedUser.mobile);
        console.log('🎂 [Birthday] Membership number:', parsedUser['Membership number']);

        // Extract mobile number for user_profiles search
        const mobileForSearch = parsedUser.Mobile || parsedUser.mobile || parsedUser.phone || '';
        // Extract membership/identifier for notification user_id storage
        const membershipId = parsedUser['Membership number'] || parsedUser['membership_number'] || '';
        // Primary userId = mobile (most reliable for notifications lookup)
        const userId = mobileForSearch || membershipId || String(parsedUser.id || '');

        if (!userId) {
          console.log('🎂 [Birthday] No userId found in user object, skipping');
          return;
        }

        // Avoid showing local notification more than once per day
        const todayIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
        const today = todayIST.toISOString().slice(0, 10); // YYYY-MM-DD
        const localKey = `birthdayNotif_${userId}_${today}`;
        if (localStorage.getItem(localKey)) {
          console.log('🎂 [Birthday] Already shown today, skipping');
          return;
        }

        // Import supabase dynamically to avoid circular deps
        const { supabase } = await import('./services/supabaseClient');

        const orParts = [];
        if (mobileForSearch) {
          orParts.push(`mobile.eq.${mobileForSearch}`);
          const last10 = mobileForSearch.replace(/\D/g, '').slice(-10);
          if (last10 && last10 !== mobileForSearch) {
            orParts.push(`mobile.ilike.%${last10}%`);
          }
        }
        if (membershipId) {
          orParts.push(`user_identifier.eq.${membershipId}`);
        }
        const orCondition = orParts.join(',');

        const { data: profileRows, error: profileError } = await supabase
          .from('user_profiles')
          .select('name, dob, mobile, user_identifier')
          .or(orCondition)
          .limit(5);

        console.log('🎂 [Birthday] profileRows:', JSON.stringify(profileRows), 'error:', profileError?.message);

        let profile = profileRows && profileRows.length > 0 ? profileRows[0] : null;

        if (!profile) {
          const { data: allProfiles } = await supabase
            .from('user_profiles')
            .select('name, dob, mobile, user_identifier')
            .limit(50);
          if (allProfiles) {
            profile = allProfiles.find(p =>
              String(p.mobile) === String(userId) ||
              String(p.user_identifier) === String(userId)
            ) || null;
          }
        }

        if (!profile || !profile.dob) return;

        const dobParts = profile.dob.split('-');
        if (dobParts.length < 3) return;
        const dobMonth = dobParts[1];
        const dobDay = dobParts[2].substring(0, 2);
        const todayMonth = String(todayIST.getUTCMonth() + 1).padStart(2, '0');
        const todayDay = String(todayIST.getUTCDate()).padStart(2, '0');

        if (dobMonth !== todayMonth || dobDay !== todayDay) return;

        const userName = profile.name || 'Member';
        console.log(`🎉 [Birthday] BIRTHDAY DETECTED for: ${userName}`);

        const { data: existing } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', String(userId))
          .eq('type', 'birthday')
          .gte('created_at', `${today}T00:00:00.000Z`)
          .limit(1);

        const birthdayMessage = `🎂 Maharaja Agrasen Samiti ki taraf se aapko janamdin ki hardik shubhkamnayein, ${userName} ji! Aapka yeh din bahut khaas ho! 🎉🎊`;

        if (!existing || existing.length === 0) {
          const { error: insertErr } = await supabase.from('notifications').insert({
            user_id: String(userId),
            title: '🎂 Happy Birthday!',
            message: birthdayMessage,
            type: 'birthday',
            is_read: false,
            created_at: new Date().toISOString(),
          });
          if (insertErr) {
            console.error('🎂 [Birthday] DB insert error:', insertErr.message);
          } else {
            console.log('✅ [Birthday] Notification inserted in DB successfully');
          }
        }

        localStorage.setItem(localKey, '1');
        window.dispatchEvent(new Event('birthdayNotifInserted'));

        try {
          await LocalNotifications.createChannel({
            id: 'birthday_channel',
            name: 'Birthday Wishes',
            description: 'Birthday notifications from Mah-Setu app',
            importance: 5,
            visibility: 1,
            sound: 'default',
            vibration: true,
            lights: true,
            lightColor: '#FF4F46E5',
          });

          const permResult = await LocalNotifications.requestPermissions();
          if (permResult.display === 'granted') {
            const notifId = Date.now() % 2147483647;
            await LocalNotifications.schedule({
              notifications: [
                {
                  id: notifId,
                  title: '🎂 Happy Birthday!',
                  body: `Mah-Setu ki taraf se ${userName} ji ko janamdin ki hardik shubhkamnayein! 🎉🎊`,
                  channelId: 'birthday_channel',
                  schedule: { at: new Date(Date.now() + 2000), allowWhileIdle: true },
                  sound: null,
                  attachments: null,
                  actionTypeId: '',
                  extra: null,
                },
              ],
            });
          }
        } catch (notifErr) {
          console.warn('[Birthday] LocalNotifications error:', notifErr.message || notifErr);
        }
      } catch (err) {
        console.error('[Birthday] Unexpected error:', err);
      }
    };

    const timer = setTimeout(checkBirthday, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Notification listener for Supabase -> LocalNotifications (no Firebase required)
  useEffect(() => {
    if (import.meta.env.VITE_DISABLE_NOTIFICATIONS === 'true') return;
    let pollInterval = null;
    let timer = null;
    let supabaseRef = null;
    let realtimeChannel = null;
    let isDisposed = false;

    const setupNotificationListener = async () => {
      try {
        const userStr = localStorage.getItem('user');
        if (!userStr) {
          console.log('[NotifListener] No user in localStorage, skipping setup');
          return;
        }

        const notificationContext = getCurrentNotificationContext();
        const { userId, userIdVariants, audienceVariants } = notificationContext;

        if (!userId) {
          console.log('[NotifListener] No userId found, skipping setup');
          return;
        }

        console.log('[NotifListener] Setting up for user:', userId, 'variants:', userIdVariants);

        const { supabase } = await import('./services/supabaseClient');
        supabaseRef = supabase;

        const notificationTracker = new Set();
        const trackerKey = `shownNotifications_${userId}`;
        const normalizeId = (value) => String(value || '').trim().toLowerCase();
        const fallbackUserIdSet = new Set();
        const fallbackUserIdRawSet = new Set();

        const refreshFallbackUserIds = async () => {
          try {
            const { data: linkedAppointments } = await supabase
              .from('appointments')
              .select('patient_name, membership_number, user_id')
              .in('patient_phone', userIdVariants)
              .limit(500);

            fallbackUserIdSet.clear();
            fallbackUserIdRawSet.clear();
            (linkedAppointments || []).forEach((row) => {
              const patientName = String(row?.patient_name || '').trim();
              const membershipNumber = String(row?.membership_number || '').trim();
              const appointmentUserId = String(row?.user_id || '').trim();

              if (patientName) {
                fallbackUserIdRawSet.add(patientName);
                fallbackUserIdSet.add(normalizeId(patientName));
              }
              if (membershipNumber) {
                fallbackUserIdRawSet.add(membershipNumber);
                fallbackUserIdSet.add(normalizeId(membershipNumber));
              }
              if (appointmentUserId) {
                fallbackUserIdRawSet.add(appointmentUserId);
                fallbackUserIdSet.add(normalizeId(appointmentUserId));
              }
            });
          } catch (fallbackErr) {
            console.warn('[NotifListener] Fallback user-id refresh failed:', fallbackErr?.message || fallbackErr);
          }
        };

        await refreshFallbackUserIds();
        const existing = localStorage.getItem(trackerKey);
        if (existing) {
          try {
            const existingIds = JSON.parse(existing);
            existingIds.forEach((id) => notificationTracker.add(id));
          } catch {
            console.warn('[NotifListener] Could not parse notification tracker');
          }
        }

        const showPushNotification = async (notification) => {
          if (isDisposed || notificationTracker.has(notification.id)) return;

          try {
            window.dispatchEvent(new CustomEvent('pushNotificationArrived', { detail: notification }));

            await LocalNotifications.createChannel({
              id: `notif_channel_${notification.type || 'general'}`,
              name: notification.type === 'appointment_insert' ? 'Appointment Updates'
                : notification.type === 'referral' ? 'Referral Updates'
                  : notification.type === 'birthday' ? 'Birthday Wishes'
                    : notification.type === 'test' ? 'Test Notifications'
                      : 'Hospital Notifications',
              description: 'Updates from Mah-Setu app',
              importance: 5,
              visibility: 1,
              sound: 'default',
              vibration: true,
              lights: true,
              lightColor: '#FF4F46E5',
            });

            const permResult = await LocalNotifications.requestPermissions();
            if (permResult.display !== 'granted') {
              console.warn('[NotifListener] Permission not granted:', permResult.display);
              return;
            }

            const notifId = Date.now() % 2147483647;
            await LocalNotifications.schedule({
              notifications: [
                {
                  id: notifId,
                  title: notification.title || 'New Notification',
                  body: (notification.message || notification.body || 'You have a new notification').substring(0, 200),
                  channelId: `notif_channel_${notification.type || 'general'}`,
                  schedule: { at: new Date(Date.now() + 500), allowWhileIdle: true },
                  sound: null,
                  attachments: null,
                  actionTypeId: '',
                  extra: { notificationId: notification.id },
                },
              ],
            });

            notificationTracker.add(notification.id);
            const recentIds = Array.from(notificationTracker).slice(-100);
            localStorage.setItem(trackerKey, JSON.stringify(recentIds));
          } catch (err) {
            console.error('[NotifListener] Error showing notification:', err.message || err);
          }
        };

        pollInterval = setInterval(async () => {
          try {
            if (isDisposed) return;

            const fiveSecondsAgo = new Date(Date.now() - 5000).toISOString();

            const notificationUserIds = [
              ...new Set([
                ...userIdVariants,
                ...Array.from(fallbackUserIdRawSet),
              ]),
            ];

            const { data: userNotifications, error: userNotifError } = await supabase
              .from('notifications')
              .select('*')
              .in('user_id', notificationUserIds)
              .gte('created_at', fiveSecondsAgo)
              .order('created_at', { ascending: false });

            if (userNotifError) {
              console.error('[NotifListener] User polling error:', userNotifError.message);
              return;
            }

            const { data: audienceNotifications, error: audienceError } = await supabase
              .from('notifications')
              .select('*')
              .in('target_audience', audienceVariants)
              .gte('created_at', fiveSecondsAgo)
              .order('created_at', { ascending: false });

            if (audienceError) {
              console.error('[NotifListener] Audience polling error:', audienceError.message);
              return;
            }

            const merged = [...(userNotifications || []), ...(audienceNotifications || [])];
            const uniqueRecent = [...new Map(merged.map((item) => [item.id, item])).values()];

            for (const notif of uniqueRecent) {
              if (notif.type !== 'birthday' && !notificationTracker.has(notif.id)) {
                await showPushNotification(notif);
              }
            }
          } catch (err) {
            console.error('[NotifListener] Polling error:', err.message || err);
          }
        }, 5000);

        try {
          realtimeChannel = supabase
            .channel(`notifications_channel_${userId}`)
            .on(
              'postgres_changes',
              { event: 'INSERT', schema: 'public', table: 'notifications' },
              (payload) => {
                const newNotification = payload.new;
                const directMatch = matchesNotificationForContext(newNotification, notificationContext);
                const fallbackMatch = fallbackUserIdSet.has(normalizeId(newNotification?.user_id));
                const isForThisUser = directMatch || fallbackMatch;

                if (isForThisUser && newNotification.type !== 'birthday') {
                  showPushNotification(newNotification);
                }
              }
            )
            .subscribe();
        } catch (rtErr) {
          console.warn('[NotifListener] Real-time setup warning:', rtErr.message || rtErr);
        }
      } catch (err) {
        console.error('[NotifListener] Setup error:', err);
      }
    };

    timer = setTimeout(setupNotificationListener, 2000);

    return () => {
      isDisposed = true;
      if (timer) clearTimeout(timer);
      if (pollInterval) clearInterval(pollInterval);
      if (supabaseRef && realtimeChannel) {
        supabaseRef.removeChannel(realtimeChannel).catch(() => { });
      }
    };
  }, [location.pathname]);

  // Appointment state
  const [appointmentForm, setAppointmentForm] = useState({
    patientName: '',
    phone: '',
    doctor: '',
    date: '',
    time: '',
    reason: '',
    bookingFor: 'self',
    patientRelationship: '',
    age: '',
    gender: '',
    patientEmail: '',
    relationship: '',
    relationshipText: '',
    isFirstVisit: ''
  });

  // Reference state
  const [referenceView, setReferenceView] = useState('menu');
  const [newReference, setNewReference] = useState({
    patientName: '',
    age: '',
    gender: '',
    phone: '',
    referredTo: '',
    condition: '',
    category: '',
    notes: ''
  });

  // Navigation handler - supports both route-based and state-based navigation
  const handleNavigate = (screen, data = null) => {
    if (screen === 'appointment' && !isMember) {
      alert('Only members can book appointments.');
      return;
    }
    if (screen === 'member-details' && data) {
      setPreviousScreen(location.pathname);
      setPreviousScreenName(data.previousScreenName || location.pathname);
      setSelectedMember(data);
      sessionStorage.setItem('selectedMember', JSON.stringify(data));
      sessionStorage.setItem('previousScreen', location.pathname);
      sessionStorage.setItem('previousScreenName', data.previousScreenName || location.pathname);
      navigate('/member-details');
    } else if (screen === 'committee-members' && data) {
      setPreviousScreen(location.pathname);
      setPreviousScreenName(data.previousScreenName || location.pathname);
      setSelectedMember(data);
      sessionStorage.setItem('selectedMember', JSON.stringify(data));
      sessionStorage.setItem('previousScreen', location.pathname);
      sessionStorage.setItem('previousScreenName', data.previousScreenName || location.pathname);
      navigate('/committee-members');
    } else {
      const routeMap = {
        'home': '/',
        'login': '/login',
        'vip-login': '/vip-login',
        'profile': '/profile',
        'directory': '/directory',
        'healthcare-trustee-directory': '/healthcare-trustee-directory',
        'appointment': '/appointment',
        'reports': '/reports',
        'reference': '/reference',
        'notices': '/notices',
        'notifications': '/notifications',
        'committee-members': '/committee-members',
        'sponsor-details': '/sponsor-details',
        'developers': '/developers',
        'gallery': '/gallery',
        'admin-profiles': '/admin-profiles',
      };
      const route = routeMap[screen] || '/';
      console.log('Navigating to route:', screen, '->', route);
      navigate(route);
    }
  };

  // Load member data from sessionStorage on mount if on member-details route
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (location.pathname === '/member-details') {
      const storedMember = sessionStorage.getItem('selectedMember');
      const storedPreviousScreen = sessionStorage.getItem('previousScreen');
      const storedPreviousScreenName = sessionStorage.getItem('previousScreenName');

      if (storedMember) {
        try {
          const parsedMember = JSON.parse(storedMember);
          if (JSON.stringify(selectedMember) !== JSON.stringify(parsedMember)) {
            setSelectedMember(parsedMember);
          }
        } catch (e) {
          console.error('Error parsing stored member:', e);
        }
      }
      if (storedPreviousScreen) {
        if (previousScreen !== storedPreviousScreen) {
          setPreviousScreen(storedPreviousScreen);
        }
      }
      if (storedPreviousScreenName) {
        if (previousScreenName !== storedPreviousScreenName) {
          setPreviousScreenName(storedPreviousScreenName);
        }
      }
    }
  }, [location.pathname]);

  return (
    <div className={`bg-white min-h-screen relative shadow-2xl overflow-x-hidden ${(location.pathname === '/login' || location.pathname === '/otp-verification' || location.pathname === '/profile' || location.pathname === '/vip-login') ? 'overflow-hidden' : 'overflow-y-auto'
      } max-w-full md:max-w-[430px] md:mx-auto pt-2`}>
      <Routes>
        <Route
          path="/login"
          element={<Login />}
        />
        <Route
          path="/vip-login"
          element={
            <VIPLogin
              onNavigate={handleNavigate}
              onLogout={clearAuthAndRedirectToLogin}
            />
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home
                onNavigate={handleNavigate}
                onLogout={clearAuthAndRedirectToLogin}
                isMember={isMember}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <FeatureGuard featureKey="feature_profile">
                <Profile
                  onNavigate={handleNavigate}
                  onNavigateBack={() => navigate('/')}
                  onProfileUpdate={() => { }}
                />
              </FeatureGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/directory"
          element={
            <ProtectedRoute>
              <FeatureGuard featureKey="feature_directory">
                <HealthcareTrusteeDirectory
                  onNavigate={handleNavigate}
                  onNavigateBack={() => navigate('/')}
                  onLogout={clearAuthAndRedirectToLogin}
                />
              </FeatureGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/healthcare-trustee-directory"
          element={
            <ProtectedRoute>
              <FeatureGuard featureKey="feature_directory">
                <HealthcareTrusteeDirectory
                  onNavigate={handleNavigate}
                  onNavigateBack={() => navigate('/')}
                  onLogout={clearAuthAndRedirectToLogin}
                />
              </FeatureGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/appointment"
          element={
            <ProtectedRoute>
              <FeatureGuard featureKey="feature_opd">
                <Appointments
                  onNavigate={handleNavigate}
                  appointmentForm={appointmentForm}
                  setAppointmentForm={setAppointmentForm}
                  onNavigateBack={() => navigate('/')}
                />
              </FeatureGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <FeatureGuard featureKey="feature_reports">
                <Reports onNavigate={handleNavigate} />
              </FeatureGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reference"
          element={
            <ProtectedRoute>
              <FeatureGuard featureKey="feature_referral">
                <Referral
                  onNavigate={handleNavigate}
                  referenceView={referenceView}
                  setReferenceView={setReferenceView}
                  newReference={newReference}
                  setNewReference={setNewReference}
                />
              </FeatureGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/notices"
          element={
            <ProtectedRoute>
              <Notices onNavigate={handleNavigate} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <FeatureGuard featureKey="feature_notifications">
                <Notifications onNavigate={handleNavigate} />
              </FeatureGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/member-details"
          element={
            <ProtectedRoute>
              {selectedMember ? (
                <MemberDetails
                  member={selectedMember}
                  onNavigate={handleNavigate}
                  onNavigateBack={() => {
                    if (previousScreenName && (previousScreenName === 'healthcare' || previousScreenName === 'committee' || previousScreenName === 'trustee')) {
                      navigate('/healthcare-trustee-directory');
                      sessionStorage.setItem('restoreDirectory', previousScreenName);
                    } else if (previousScreenName && (previousScreenName === 'healthcare' || previousScreenName === 'trustees' || previousScreenName === 'patrons' || previousScreenName === 'committee' || previousScreenName === 'doctors' || previousScreenName === 'hospitals' || previousScreenName === 'elected')) {
                      navigate('/directory');
                      sessionStorage.setItem('restoreDirectoryTab', previousScreenName);
                    } else {
                      const prevScreen = previousScreen || '/directory';
                      navigate(prevScreen);
                    }
                  }}
                  previousScreenName={previousScreenName}
                />
              ) : (
                <Navigate to="/directory" replace />
              )}
            </ProtectedRoute>
          }
        />
        <Route
          path="/committee-members"
          element={
            <ProtectedRoute>
              {selectedMember ? (
                <CommitteeMembers
                  committeeData={selectedMember}
                  onNavigateBack={() => {
                    if (previousScreenName && (previousScreenName === 'healthcare' || previousScreenName === 'committee' || previousScreenName === 'trustee')) {
                      navigate('/healthcare-trustee-directory');
                      sessionStorage.setItem('restoreDirectory', previousScreenName);
                    } else {
                      const prevScreen = previousScreen || '/directory';
                      navigate(prevScreen);
                    }
                  }}
                  previousScreenName={previousScreenName}
                  onNavigate={handleNavigate}
                />
              ) : (
                <Navigate to="/directory" replace />
              )}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sponsor-details"
          element={
            <ProtectedRoute>
              <SponsorDetails onBack={() => navigate(-1)} onNavigate={handleNavigate} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/developers"
          element={
            <FeatureGuard featureKey="feature_developer_info">
              <DeveloperDetails
                onNavigateBack={() => navigate(-1)}
                onNavigate={handleNavigate}
              />
            </FeatureGuard>
          }
        />
        <Route
          path="/gallery"
          element={
            <ProtectedRoute>
              <FeatureGuard featureKey="feature_gallery">
                <Gallery
                  onNavigate={handleNavigate}
                  onNavigateBack={() => navigate('/')}
                />
              </FeatureGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-profiles"
          element={
            <ProtectedRoute>
              <AdminUserProfiles onNavigate={handleNavigate} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/otp-verification"
          element={<OTPVerification />}
        />
        <Route
          path="/special-otp-verification"
          element={<SpecialOTPVerification />}
        />
        <Route
          path="/terms-and-conditions"
          element={<TermsAndConditions />}
        />
        <Route
          path="/privacy-policy"
          element={<PrivacyPolicy />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
};

export default HospitalTrusteeApp;
