import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useBackNavigation } from './hooks';
import { specialLogin } from './services/authService';
import { fetchDirectoryData } from './services/directoryService';

function SpecialOTPVerification() {
  const navigate = useNavigate();
  const location = useLocation();
  useBackNavigation(() => navigate('/login')); // Go to login on back
  const [passcode, setPasscode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Get user data from location state passed from login
  const user = location.state?.user || null;
  const phoneNumber = location.state?.phoneNumber || '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('🔍 Verifying special passcode for:', phoneNumber);
      
      // Call special login endpoint
      const result = await specialLogin(phoneNumber, passcode);
      
      console.log('📞 API Response:', result);
      
      if (!result.success) {
        setError(result.message || 'Invalid passcode. Please try again.');
        setLoading(false);
        return;
      }

      // Passcode verified successfully
      console.log('✅ Special login verified successfully');
      
      // Store user in localStorage and redirect to home
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
        navigate('/');
      } else {
        setError('User data not found. Please try again.');
      }
      
    } catch (error) {
      console.error('❌ Error verifying special login:', error);
      setError('Failed to verify passcode. Please try again.');
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Special Login</h2>
          <div className="w-24 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent mx-auto mt-3 mb-4 rounded-full"></div>
          <p className="text-gray-600 text-base mt-4">
            Enter the special passcode for
            <span className="block mt-2 font-semibold text-gray-800">{phoneNumber}</span>
          </p>
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
            <p className="text-yellow-800 text-sm font-medium">
              🔧 Special Access Enabled
            </p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-3">Special Passcode</label>
            <input
              type="text"
              placeholder="Enter 6-digit passcode"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value.replace(/\D/g, '').slice(0, 6))}
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
              className="flex-1 bg-gray-200 text-gray-800 py-4 rounded-2xl font-bold text-sm hover:bg-gray-300 transition-colors active:scale-[0.98]"
            >
              Back
            </button>
            <button 
              type="submit" 
              disabled={loading || passcode.length !== 6}
              className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-bold text-sm shadow-lg hover:bg-indigo-700 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {loading ? 'Verifying...' : 'Verify Passcode'}
            </button>
          </div>
        </form>
        
        <div className="mt-6 text-center">
          <p className="text-gray-500 text-sm">
            This is a special access login for authorized users only
          </p>
        </div>
      </div>
    </div>
  );
}

export default SpecialOTPVerification;
