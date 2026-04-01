import React, { useState, useEffect } from 'react';
import { ArrowLeft, Building2, MapPin, Briefcase, Info } from 'lucide-react';
import { getSponsors } from './services/api';

const SponsorDetails = ({ onBack }) => {
  const [sponsor, setSponsor] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const loadSponsorDetails = async () => {
      try {
        setLoading(true);
        const stored = sessionStorage.getItem('selectedSponsor');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed) {
              setSponsor(parsed);
              setLoading(false);
              return;
            }
          } catch {
            // ignore parse error
          }
        }

        const trustId = localStorage.getItem('selected_trust_id') || null;
        const trustName = localStorage.getItem('selected_trust_name') || null;
        const response = await getSponsors(trustId, trustName);
        if (response.success && response.data && response.data.length > 0) {
          // Get the first active sponsor (highest priority)
          setSponsor(response.data[0]);
          console.log('✅ Sponsor details loaded:', response.data[0].name);
        } else {
          setSponsor(null);
        }
      } catch (error) {
        console.error('Error loading sponsor details:', error);
        setSponsor(null);
      } finally {
        setLoading(false);
      }
    };
    
    loadSponsorDetails();
  }, []);
  
  if (loading) {
    return (
      <div className="bg-gradient-to-br from-sky-50 via-white to-indigo-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading sponsor details...</p>
        </div>
      </div>
    );
  }
  
  if (!sponsor) {
    return (
      <div className="bg-gradient-to-br from-sky-50 via-white to-indigo-50 min-h-screen flex items-center justify-center">
        <div className="text-center max-w-sm px-6">
          <div className="bg-white h-16 w-16 rounded-2xl shadow-md border border-slate-200 flex items-center justify-center mx-auto mb-4">
            <div className="bg-slate-200 h-8 w-8 rounded-xl" />
          </div>
          <h2 className="text-lg font-bold text-gray-800">No sponsor available</h2>
          <p className="text-sm text-gray-500 mt-2">This trust does not have any sponsor details yet.</p>
          <button
            onClick={onBack}
            className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-sky-50 via-white to-indigo-50 min-h-screen">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur border-b border-gray-200 px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <button
          onClick={onBack}
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-6 w-6 text-gray-700" />
        </button>
        <h1 className="text-lg font-bold text-gray-800">Sponsor Details</h1>
      </div>

      <div className="flex justify-center items-start pt-8 pb-10 px-4">
        <div className="w-full max-w-md">
          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.12)]">
            <div className="absolute -top-16 -right-10 h-32 w-32 rounded-full bg-sky-200/60 blur-2xl" />
            <div className="absolute -bottom-16 -left-10 h-32 w-32 rounded-full bg-indigo-200/60 blur-2xl" />
            <div className="relative px-6 pt-8 pb-6">
              <div className="flex items-start gap-4">
                <div className="relative">
                  <div className="w-24 h-24 bg-white p-1 rounded-2xl shadow-xl border-4 border-indigo-100">
                    <img
                      src={sponsor ? sponsor.photo_url : '/assets/president.png'}
                      alt={sponsor ? sponsor.name : 'Sponsor'}
                      className="w-full h-full object-cover rounded-xl"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                    <div className="hidden items-center justify-center w-full h-full text-gray-400">
                      <div className="text-center">
                        <div className="bg-gray-200 border-2 border-dashed rounded-xl w-20 h-20 mx-auto" />
                        <p className="text-xs mt-1">Photo</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 text-indigo-700 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em]">
                    Sponsored
                  </div>
                  <h2 className="mt-2 text-xl font-extrabold text-slate-900 leading-snug">{sponsor ? sponsor.name : 'Sponsor'}</h2>
                  <p className="mt-1 text-xs text-slate-500 font-semibold">
                    {sponsor ? sponsor.position || 'President' : 'President'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 font-medium">Community healthcare partner</p>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6">
              <div className="grid grid-cols-1 gap-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-indigo-700 text-xs font-bold uppercase tracking-wide">
                    <Briefcase className="h-4 w-4" />
                    Positions
                  </div>
                  <div className="mt-3 space-y-2">
                    {(sponsor && sponsor.positions && sponsor.positions.length > 0) ?
                      sponsor.positions.map((position, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <div className="w-2 h-2 bg-indigo-500 rounded-full mt-2 flex-shrink-0"></div>
                          <p className="text-slate-800 font-medium text-sm">{position}</p>
                        </div>
                      ))
                    :
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full mt-2 flex-shrink-0"></div>
                        <p className="text-slate-800 font-medium text-sm">President</p>
                      </div>
                    }
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-indigo-700 text-xs font-bold uppercase tracking-wide">
                    <Building2 className="h-4 w-4" />
                    Affiliation
                  </div>
                  <p className="mt-2 text-slate-800 font-medium text-sm">
                    {sponsor ? sponsor.affiliation || 'Maharaja Agrasen Hospital' : 'Maharaja Agrasen Hospital'}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-indigo-700 text-xs font-bold uppercase tracking-wide">
                    <MapPin className="h-4 w-4" />
                    Location
                  </div>
                  <p className="mt-2 text-slate-800 font-medium text-sm">
                    {sponsor ? sponsor.location || sponsor.address || 'New Delhi' : 'New Delhi'}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-indigo-700 text-xs font-bold uppercase tracking-wide">
                    <Info className="h-4 w-4" />
                    About
                  </div>
                  <p className="mt-2 text-slate-700 text-sm leading-relaxed">
                    {sponsor ? sponsor.about : 'Leader with extensive experience in healthcare and social welfare, focused on community services.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SponsorDetails;
