import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useBackNavigation } from './hooks';
import { fetchDefaultTrust } from './services/trustService';

const PrivacyPolicy = () => {
  const navigate = useNavigate();
  useBackNavigation(); // Default: uses window.history.back()
  const [content, setContent] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isActive = true;
    const loadContent = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        const parsedUser = storedUser ? JSON.parse(storedUser) : null;
        const preferredTrustId =
          parsedUser?.primary_trust?.id || localStorage.getItem('selected_trust_id');
        const trust = await fetchDefaultTrust(preferredTrustId);
        if (isActive) {
          const policy = trust?.privacy_content || '';
          setContent(policy);
          setUpdatedAt(trust?.created_at || '');
        }
      } catch (err) {
        console.warn('Failed to load privacy policy:', err);
        if (isActive) {
          setError('Privacy Policy failed to load. Please try again later.');
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };
    loadContent();
    return () => {
      isActive = false;
    };
  }, []);

  const renderContent = () => {
    if (loading) {
      return <p className="text-gray-500">Loading privacy policy...</p>;
    }
    if (error) {
      return <p className="text-red-600 font-medium">{error}</p>;
    }
    if (!content) {
      return <p className="text-gray-500">Privacy policy content is not available.</p>;
    }
    return (
      <div
        className="legal-content text-gray-700"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <div className="bg-blue-600 text-white p-4 flex items-center gap-4 mt-6">
        <button onClick={() => navigate(-1)} className="p-1">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">Privacy Policy</h1>
      </div>

      <div className="flex-1 p-6 overflow-y-auto space-y-4 text-gray-700">
        {renderContent()}
        {updatedAt && !loading && !error && (
          <section className="pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500 italic">
              Last updated: {new Date(updatedAt).toLocaleDateString()}
            </p>
          </section>
        )}
      </div>
    </div>
  );
};

export default PrivacyPolicy;
