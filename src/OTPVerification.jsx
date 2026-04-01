import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useBackNavigation } from './hooks';
import { verifyOTP } from './services/authService';
import { fetchDirectoryData } from './services/directoryService';
import { fetchDefaultTrust, fetchTrustByName } from './services/trustService';
import logo from '../new_logo.png';

function OTPVerification() {
  const navigate = useNavigate();
  const location = useLocation();
  useBackNavigation(() => navigate('/login')); // Go to login on back
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [trustInfo, setTrustInfo] = useState(null);

  // Get user data from location state passed from login
  const user = location.state?.user || null;
  const phoneNumber = location.state?.phoneNumber || '';

  useEffect(() => {
    let isActive = true;
    const loadTrust = async () => {
      try {
        const defaultTrustName =
          import.meta.env.VITE_DEFAULT_TRUST_NAME || 'Maharaja Agarsen Hospital';
        const namedTrust = await fetchTrustByName(defaultTrustName);
        if (namedTrust) {
          setTrustInfo(namedTrust);
          if (namedTrust.id) {
            localStorage.setItem('selected_trust_id', namedTrust.id);
          }
          if (namedTrust.name) {
            localStorage.setItem('selected_trust_name', namedTrust.name);
          }
          return;
        }

        const preferredTrustId = localStorage.getItem('selected_trust_id');
        const trust = await fetchDefaultTrust(preferredTrustId);
        if (isActive) {
          setTrustInfo(trust);
        }
        if (trust?.name) {
          localStorage.setItem('selected_trust_name', trust.name);
        }
      } catch (err) {
        console.warn('Failed to load trust info for OTP:', err);
      }
    };
    loadTrust();
    return () => {
      isActive = false;
    };
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('🔍 Verifying OTP:', otp);

      const result = await verifyOTP(phoneNumber, otp);

      console.log('📞 API Response:', result);

      if (!result.success) {
        setError(result.message || 'Invalid OTP. Please try again.');
        setLoading(false);
        return;
      }

      // OTP verified successfully
      console.log('✅ OTP verified successfully');

      if (user) {
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('isLoggedIn', 'true');

        // Pre-load directory data in background
        const selectedTrustId =
          user?.primary_trust?.id || localStorage.getItem('selected_trust_id');
        const selectedTrustName =
          user?.primary_trust?.name || localStorage.getItem('selected_trust_name');
        fetchDirectoryData(selectedTrustId || null, selectedTrustName || null).catch(err =>
          console.warn('Failed to pre-load directory data:', err)
        );

        try {
          sessionStorage.removeItem('trust_selected_in_session');
        } catch {
          // ignore storage errors
        }

        // ── Navigate to home after successful login ──
        // VIP login is a separate, dedicated flow (via the VIP button on login page)
        // Normal login always goes to Home
        if (user.isRegisteredMember) {
          console.log('👑 Registered member logged in via normal flow — navigating to home');
        }
        navigate('/', { replace: true });
      } else {
        setError('User data not found. Please try again.');
      }

    } catch (err) {
      console.error('❌ Error verifying OTP:', err);
      setError('Failed to verify OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-6 sm:p-8 border border-gray-100">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img
              src={trustInfo?.icon_url || logo}
              alt={trustInfo?.name || 'Hospital Logo'}
              className="h-20 w-auto object-contain"
              loading="eager"
            />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Verify OTP</h2>
          <div className="w-24 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent mx-auto mt-3 mb-4 rounded-full"></div>
          <p className="text-gray-600 text-base mt-4">
            Enter the 6-digit OTP sent to
            {phoneNumber && <span className="block mt-2 font-semibold text-gray-800">{phoneNumber}</span>}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-3">OTP Code</label>
            <input
              type="text"
              placeholder="Enter 6-digit OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              required
              className="w-full px-5 py-4 text-xl border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center tracking-widest bg-gray-50 focus:bg-white transition-all"
            />
          </div>

          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 text-red-700 text-base font-medium">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="flex-1 bg-gray-200 text-gray-800 py-4 rounded-2xl font-bold text-base hover:bg-gray-300 transition-colors active:scale-[0.98]"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-bold text-base shadow-lg hover:bg-indigo-700 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-500 text-sm">
            Didn't receive the OTP?
            <button
              onClick={handleBack}
              className="ml-1 text-indigo-600 font-semibold hover:text-indigo-700"
            >
              Try again
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default OTPVerification;
