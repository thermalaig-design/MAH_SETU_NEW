import React from 'react';
import { Users, ChevronLeft, Phone } from 'lucide-react';

const CommitteeMembers = ({ committeeData, onNavigateBack, previousScreenName, onNavigate }) => {
  // Get screen name for back button
  const getScreenName = () => {
    if (!previousScreenName) return 'Directory';
    
    // Handle both route paths and screen names
    const screenName = previousScreenName.replace(/^\//, ''); // Remove leading slash if present
    
    const screenNames = {
      'directory': 'Directory',
      '/directory': 'Directory',
      'healthcare-trustee-directory': 'Directory',
      '/healthcare-trustee-directory': 'Directory',
      'healthcare': 'Healthcare Directory',
      'trustees': 'Trustees',
      'patrons': 'Patrons',
      'committee': 'Committee',
      'doctors': 'Doctors',
      'hospitals': 'Hospitals',
      '/': 'Home'
    };
    
    return screenNames[previousScreenName] || screenNames[screenName] || 'Directory';
  };

  const committeeMembers = committeeData.committee_members || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="bg-white px-6 pt-6 pb-4 shadow-sm">
        <div className="flex items-center gap-4 mb-4">
          <button 
            onClick={onNavigateBack}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors flex items-center gap-2 text-indigo-600"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="text-sm font-medium">{getScreenName()}</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Committee Members</h1>
            <p className="text-gray-600 text-sm">{committeeData.Name}</p>
          </div>
        </div>
      </div>

      {/* Committee Members List */}
      <div className="p-6">
        {committeeMembers.length > 0 ? (
          <div className="space-y-4">
            {committeeMembers.map((member, index) => (
                  <div 
                    key={member['S. No.'] || member.id || `member-${index}`} 
                    className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-start gap-4"
                  >
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-800 text-lg">
                        {member.member_name_english || member.Name || 'N/A'}
                      </h3>
                      <p className="text-gray-600 text-sm mt-1">
                        {member.committee_name_english || committeeData.committee_name_english || 'N/A'}
                      </p>
                      <div className="flex items-center gap-2 mt-3 text-sm text-gray-700">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span>{member.Mobile || member.phone1 || member.phone2 || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="bg-gray-50 h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-gray-300">
              <Users className="h-8 w-8 text-gray-300" />
            </div>
            <h3 className="text-gray-800 font-bold">No members found</h3>
            <p className="text-gray-500 text-sm mt-1">This committee has no members</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommitteeMembers;
