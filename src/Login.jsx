import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useBackNavigation } from './hooks';
import { checkPhoneNumber } from './services/authService';
import { fetchDefaultTrust, fetchTrustByName } from './services/trustService';
import logo from '../new_logo.png';

function Login() {
  const navigate = useNavigate();
  useBackNavigation(); // Default: uses window.history.back()
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [trustInfo, setTrustInfo] = useState(null);

  useEffect(() => {
    let isActive = true;
    const loadTrust = async () => {
      try {
        const defaultTrustName =
          import.meta.env.VITE_DEFAULT_TRUST_NAME || 'Maharaja Agarsen Hospital';
        const namedTrust = await fetchTrustByName(defaultTrustName);
        const trust = namedTrust || (await fetchDefaultTrust(localStorage.getItem('selected_trust_id')));
        if (isActive) {
          setTrustInfo(trust);
          if (trust?.id) {
            localStorage.setItem('selected_trust_id', trust.id);
          }
          if (trust?.name) {
            localStorage.setItem('selected_trust_name', trust.name);
          }
        }
      } catch (err) {
        console.warn('Failed to load trust info for login:', err);
      }
    };
    loadTrust();
    return () => {
      isActive = false;
    };
  }, []);

  const handleCheckPhone = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('🔍 Checking phone number:', phoneNumber);

      // 🔧 SPECIAL CASE: Bypass OTP for phone number 9911334455
      if (phoneNumber === '9911334455') {
        console.log('🔧 Special login detected for 9911334455 - redirecting to special verification');

        const checkResult = await checkPhoneNumber(phoneNumber);

        if (!checkResult.success) {
          setError(checkResult.message);
          setLoading(false);
          return;
        }

        navigate('/special-otp-verification', {
          state: {
            user: checkResult.data.user,
            phoneNumber: phoneNumber
          }
        });
        setLoading(false);
        return;
      }

      // Check if phone exists in backend (normal flow)
      const checkResult = await checkPhoneNumber(phoneNumber);

      console.log('📞 API Response:', checkResult);

      if (!checkResult.success) {
        setError(checkResult.message);
        setLoading(false);
        return;
      }

      console.log('✅ User found:', checkResult.data.user?.name);

      // Navigate to OTP verification screen with user data
      navigate('/otp-verification', {
        state: {
          user: checkResult.data.user,
          phoneNumber: phoneNumber
        }
      });

    } catch (err) {
      console.error('❌ Error checking phone:', err);
      setError('Failed to verify phone number. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-emerald-50 px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-sky-200/40 blur-3xl"></div>
      <div className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl"></div>

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center">
        <div className="w-full rounded-3xl border border-white/70 bg-white/95 p-6 shadow-2xl shadow-slate-200/70 backdrop-blur sm:p-8">

          {/* Header */}
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex items-center rounded-full border border-sky-100 bg-sky-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">
              Secure Login Portal
            </div>
            <div className="mb-4 flex justify-center">
              <img
                src={trustInfo?.icon_url || logo}
                alt={trustInfo?.name || 'Hospital Logo'}
                className="h-24 w-auto object-contain"
                loading="eager"
              />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {trustInfo?.name || 'Maharaja Agarsen Hospital'}
            </h1>
            <p className="mt-2 text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
              Welcome back
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Sign in with your mobile number to continue to your hospital dashboard.
            </p>
            <div className="mx-auto mt-4 h-1 w-36 rounded-full bg-gradient-to-r from-transparent via-sky-500 to-transparent"></div>
          </div>

          {/* Phone Form */}
          <form onSubmit={handleCheckPhone} className="space-y-6">
            <div>
              <label className="mb-3 block text-sm font-semibold uppercase tracking-wide text-slate-700">Mobile Number</label>
              <div className="flex items-center rounded-2xl border-2 border-slate-200 bg-slate-50 transition-all focus-within:border-sky-500 focus-within:bg-white focus-within:shadow-lg focus-within:shadow-sky-100">
                <span className="pl-4 text-base font-semibold text-slate-500">+91</span>
                <input
                  type="tel"
                  placeholder="Enter 10-digit mobile number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                  maxLength={10}
                  required
                  className="w-full rounded-2xl border-0 bg-transparent px-3 py-4 text-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-4 text-base font-medium text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-sky-600 to-cyan-500 py-4 text-lg font-bold text-white shadow-lg shadow-sky-200 transition-all hover:from-sky-700 hover:to-cyan-600 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? 'Verifying...' : 'Continue'}
            </button>
          </form>

          {/* Footer Links */}
          <div className="mt-6 flex flex-col items-center space-y-3 border-t border-slate-100 pt-6">
            <div className="flex items-center space-x-4 text-sm font-medium text-slate-500">
              <Link to="/terms-and-conditions" className="transition-colors hover:text-sky-700">Terms</Link>
              <span className="h-1 w-1 rounded-full bg-slate-300"></span>
              <Link to="/privacy-policy" className="transition-colors hover:text-sky-700">Privacy</Link>
            </div>
            <p className="text-center text-xs text-slate-400">© 2026 Maharaja Agarsen Hospital. All rights reserved.</p>
          </div>

        </div>
      </div>
    </div>
  );
}

export default Login;

