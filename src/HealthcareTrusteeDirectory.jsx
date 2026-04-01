import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { User, Users, Stethoscope, Building2, Star, Award, ChevronRight, ChevronLeft, Menu, X, Home as HomeIcon, Clock, FileText, UserPlus, Phone, Mail, MapPin, Search, Filter, ArrowLeft, ArrowRight } from 'lucide-react';
import Sidebar from './components/Sidebar';
import { getAllMembers, getAllCommitteeMembers, getAllHospitals, getAllElectedMembers, getProfilePhotos } from './services/api';
import { getOpdDoctors, getTrusteesAndPatrons } from './services/supabaseService';
import { registerSidebarState, useAndroidBack } from './hooks';
import { fetchFeatureFlags, subscribeFeatureFlags } from './services/featureFlags';

const CACHE_KEY_HTD = 'healthcare_trustee_directory_cache';
const CACHE_TIMESTAMP_KEY_HTD = 'healthcare_trustee_directory_cache_timestamp';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const buildCacheKey = (trustKey) =>
  trustKey ? `${CACHE_KEY_HTD}_${trustKey}` : CACHE_KEY_HTD;
const buildTimestampKey = (trustKey) =>
  trustKey ? `${CACHE_TIMESTAMP_KEY_HTD}_${trustKey}` : CACHE_TIMESTAMP_KEY_HTD;

const HealthcareTrusteeDirectory = ({ onNavigate }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedDirectory, setSelectedDirectory] = useState(null); // null, 'healthcare', 'trustee', or 'committee'
  const [activeTab, setActiveTab] = useState(null);
  const trustId = localStorage.getItem('selected_trust_id') || null;
  const trustName = localStorage.getItem('selected_trust_name') || null;
  const trustCacheKey = trustId || trustName;

  const [allMembers, setAllMembers] = useState([]);
  const [opdDoctors, setOpdDoctors] = useState([]); // doctors fetched directly from Supabase with image URLs
  const [opdDoctorsLoading, setOpdDoctorsLoading] = useState(false); // Track loading state for doctors
  const [committeeMembers, setCommitteeMembers] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [electedMembers, setElectedMembers] = useState([]);
  const [profilePhotos, setProfilePhotos] = useState({});
  const [loading, setLoading] = useState(false); // Changed to false - show page immediately
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [dataLoaded, setDataLoaded] = useState(false);
  const itemsPerPage = 20;
  const { registerBackHandler } = useAndroidBack();
  const [featureFlags, setFeatureFlags] = useState({});

  // Ref to track previous filtered members to avoid infinite loop
  const previousFilteredRef = useRef([]);

  // Ref for the content area to scroll to
  const contentRef = useRef(null);

  const isFeatureEnabled = (key) => featureFlags[key] !== false;
  const isDirectoryEnabled = isFeatureEnabled('feature_directory');
  const isDoctorsEnabled = isFeatureEnabled('feature_doctors');
  const isHospitalsEnabled = isFeatureEnabled('feature_hospitals');
  const isHealthcareEnabled = isDoctorsEnabled || isHospitalsEnabled;
  const isCommitteeEnabled = isFeatureEnabled('feature_committee');
  const isElectedEnabled = isFeatureEnabled('feature_elected_members');
  const canShowCommittee = isDirectoryEnabled && (isCommitteeEnabled || isElectedEnabled);
  const canShowTrustee = isDirectoryEnabled;
  const canShowHealthcare = isDirectoryEnabled && isHealthcareEnabled;

  useEffect(() => {
    const loadFlags = async (force = false) => {
      const trustId = localStorage.getItem('selected_trust_id') || null;
      const result = await fetchFeatureFlags(trustId, { force });
      if (result.success) {
        setFeatureFlags(result.flags || {});
      }
    };
    loadFlags();

    const handleFocus = () => loadFlags(true);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadFlags(true);
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    const trustId = localStorage.getItem('selected_trust_id') || null;
    const unsubscribe = subscribeFeatureFlags(trustId, () => loadFlags(true));

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      unsubscribe?.();
    };
  }, []);

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

  // Register sidebar state so Android hardware back closes sidebar first.
  useEffect(() => {
    registerSidebarState(isMenuOpen, () => setIsMenuOpen(false));
  }, [isMenuOpen]);

  // Handle Android hardware back inside directory flow before leaving route.
  useEffect(() => {
    if (!isMenuOpen && !selectedDirectory) return undefined;

    const unregister = registerBackHandler(() => {
      if (isMenuOpen) {
        setIsMenuOpen(false);
        return;
      }

      if (selectedDirectory) {
        setSelectedDirectory(null);
        setActiveTab(null);
        setSearchQuery('');
      }
    });

    return () => {
      unregister?.();
    };
  }, [isMenuOpen, selectedDirectory]);

  // Fetch all members, hospitals and member types when component mounts
  const fetchMembers = async (isBackground = false) => {
    let mounted = true;
    let hospitalsData = [];
    let committeeData = [];
    let electedData = [];

    try {
      if (!isBackground) {
        setLoading(true);
      }
      setError(null);
      console.log('Fetching trustees and patrons from Supabase...');
      const response = await getTrusteesAndPatrons(trustId, trustName);
      console.log('Trustees/patrons response:', response);

      if (!mounted) return;

      setAllMembers(response.data || []);

      // Fetch OPD doctors from Supabase
      try {
        setOpdDoctorsLoading(true); // Set loading flag before fetching
        console.log('Fetching OPD doctors with:', { trustId, trustName });
        const opdResponse = await getOpdDoctors(trustId, trustName);
        console.log('OPD doctors response:', opdResponse);
        if (opdResponse.success && Array.isArray(opdResponse.data)) {
          console.log('Setting OPD doctors, count:', opdResponse.data.length);
          setOpdDoctors(opdResponse.data || []);
          console.log('OPD doctors fetched successfully:', opdResponse.data);
        } else {
          console.warn('OPD response invalid:', { success: opdResponse.success, isArray: Array.isArray(opdResponse.data) });
          setOpdDoctors([]);
        }
      } catch (opdErr) {
        console.error('Error fetching OPD doctors:', opdErr);
        setOpdDoctors([]);
      } finally {
        setOpdDoctorsLoading(false); // Clear loading flag after fetching
      }

      // Fetch hospitals separately from the hospitals table
      try {
        const hospitalsResponse = await getAllHospitals(trustId, trustName);
        console.log('Hospitals response:', hospitalsResponse);
        hospitalsData = hospitalsResponse.data || [];
        setHospitals(hospitalsData);
      } catch (hospitalsErr) {
        console.error('Error fetching hospitals:', hospitalsErr);
        setHospitals([]);
      }

      // Fetch committee members from committee_members table
      try {
        const committeeResponse = await getAllCommitteeMembers(trustId, trustName);
        console.log('Committee members response:', committeeResponse);
        committeeData = committeeResponse.data || [];
        setCommitteeMembers(committeeData);
      } catch (committeeErr) {
        console.error('Error fetching committee members:', committeeErr);
        setCommitteeMembers([]);
      }

      // Fetch elected members separately from elected_members table
      try {
        const electedResponse = await getAllElectedMembers(trustId, trustName);
        console.log('Elected members response:', electedResponse);
        electedData = electedResponse.data || [];
        setElectedMembers(electedData);
      } catch (electedErr) {
        console.error('Error fetching elected members:', electedErr);
        // Don't set error, just log it - elected members are optional
      }

      setDataLoaded(true);

      // Cache the data (now including committeeMembers)
      try {
        const cacheData = {
          allMembers: response.data || [],
          hospitals: hospitalsData,
          electedMembers: electedData,
          committeeMembers: committeeData,
        };
        sessionStorage.setItem(buildCacheKey(trustCacheKey), JSON.stringify(cacheData));
        sessionStorage.setItem(buildTimestampKey(trustCacheKey), Date.now().toString());
      } catch (cacheErr) {
        console.error('Error caching data:', cacheErr);
      }
    } catch (err) {
      console.error('Error fetching members:', err);
      setError(`Failed to load members data: ${err.message || 'Please make sure backend server is running on port 5000'}`);
    } finally {
      if (mounted && !isBackground) {
        setLoading(false);
      }
    }
  };

  // Restore directory and tab when coming back from member details
  useEffect(() => {
    const restoreDirectory = sessionStorage.getItem('restoreDirectory');
    const restoreTab = sessionStorage.getItem('restoreDirectoryTab');
    if (restoreDirectory) {
      setSelectedDirectory(restoreDirectory);
      if (restoreTab) {
        setActiveTab(restoreTab);
      } else if (restoreDirectory === 'healthcare') {
        setActiveTab('doctors');
      } else if (restoreDirectory === 'committee') {
        setActiveTab('committee');
      } else if (restoreDirectory === 'trustee') {
        setActiveTab('trustees');
      }
      sessionStorage.removeItem('restoreDirectory');
      sessionStorage.removeItem('restoreDirectoryTab');
    }
  }, []);

  // Load cached data if available
  useEffect(() => {
    try {
      const cachedData = sessionStorage.getItem(buildCacheKey(trustCacheKey));
      const cacheTimestamp = sessionStorage.getItem(buildTimestampKey(trustCacheKey));

      if (cachedData && cacheTimestamp) {
        const cacheAge = Date.now() - parseInt(cacheTimestamp, 10);
        if (cacheAge < CACHE_DURATION) {
          const parsed = JSON.parse(cachedData);

          // If committeeMembers missing from old cache but allMembers exists,
          // the cache was written before committee fetch — invalidate it.
          const isStaleCache =
            (!parsed.committeeMembers || parsed.committeeMembers.length === 0) &&
            parsed.allMembers && parsed.allMembers.length > 0;

          if (!isStaleCache) {
            setAllMembers(parsed.allMembers || []);
            setHospitals(parsed.hospitals || []);
            setElectedMembers(parsed.electedMembers || []);
            setCommitteeMembers(parsed.committeeMembers || []);
            setDataLoaded(true);
            // Still fetch fresh data in background but don't block UI
            fetchMembers(true);
            return;
          }

          // Stale cache — remove it and fall through to a full fetch
          sessionStorage.removeItem(buildCacheKey(trustCacheKey));
          sessionStorage.removeItem(buildTimestampKey(trustCacheKey));
        }
      }
    } catch (err) {
      console.error('Error loading cache:', err);
    }
    // No cache, expired cache, or stale cache — fetch data fresh
    fetchMembers(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Calculate counts for each category
  const hasRole = (member, target) => {
    const candidates = [
      member?.type,
      member?.role,
      member?.position,
      member?.member_role
    ].filter(Boolean);
    if (candidates.length === 0) return false;
    return candidates.some((value) =>
      String(value).toLowerCase().includes(target)
    );
  };

  const getTrusteesCount = () => allMembers.filter(m => {
    return hasRole(m, 'trustee');
  }).length;

  const getPatronsCount = () => allMembers.filter(m => {
    return hasRole(m, 'patron');
  }).length;

  const getCommitteeCount = () => {
    // Count unique committees (not individual members)
    const uniqueCommittees = new Set();
    committeeMembers.forEach((cm) => {
      const rawName = cm?.committee_name_english || cm?.committee_name_hindi || '';
      const normalized = String(rawName).trim().toLowerCase();
      if (normalized) uniqueCommittees.add(normalized);
    });
    return uniqueCommittees.size;
  };

  const getDoctorsCount = () => opdDoctors.length > 0 ? opdDoctors.length : allMembers.filter(m =>
    (m.type && (m.type.toLowerCase().includes('doctor') ||
      m.type.toLowerCase().includes('medical'))) ||
    m.specialization ||
    m.designation ||
    (m.consultant_name && m.department) // This indicates it's from opd_schedule
  ).length;

  const getHospitalsCount = () => hospitals.length;

  const getElectedMembersCount = () => electedMembers.length;

  // Function to get members based on selected directory and tab
  const getMembersByDirectoryAndTab = useCallback((directory, tabId) => {
    console.log('getMembersByDirectoryAndTab called:', { directory, tabId, opdDoctorsLength: opdDoctors.length, opdDoctorsLoading, hospitalsLength: hospitals.length });
    if (directory === 'healthcare') {
      if (tabId === 'doctors') {
        // If doctors are still loading, don't show fallback - wait for real data
        if (opdDoctorsLoading) {
          console.log('OPD doctors still loading, returning empty array to show loading state');
          return [];
        }
        
        // Prefer opdDoctors (direct Supabase fetch with proper image URLs)
        if (opdDoctors.length > 0) {
          console.log('Returning opdDoctors:', opdDoctors);
          return opdDoctors;
        }
        // Fallback to allMembers only if not loading and opdDoctors came back empty
        const fallbackDoctors = allMembers.filter(member =>
          (member.type && (
            member.type.toLowerCase().includes('doctor') ||
            member.type.toLowerCase().includes('medical')
          )) || member.specialization || member.designation || (member.consultant_name && member.department)
        );
        console.log('Fallback doctors from allMembers:', fallbackDoctors);
        return fallbackDoctors;
      } else if (tabId === 'hospitals') {
        // Return hospitals from the separate hospitals array
        console.log('Returning hospitals:', hospitals);
        return hospitals;
      }
    } else if (directory === 'trustee') {
      if (tabId === 'trustees') {
        // Get trustees from allMembers
        const trustees = allMembers.filter(member => {
          return hasRole(member, 'trustee');
        });

        // Also add elected members who are trustees (merged data already includes member table data)
        const electedTrustees = electedMembers.filter(elected => {
          // Check if this elected member's type indicates they're a trustee (from merged member table data)
          return hasRole(elected, 'trustee');
        });

        // Also add elected members that are not already included (in case merging failed)
        const additionalElectedTrustees = electedMembers.filter(elected => {
          // If not already in electedTrustees and not in trustees, include if it's an elected member
          const alreadyIncluded = electedTrustees.some(et =>
            (et['Membership number'] && elected['Membership number'] &&
              et['Membership number'] === elected['Membership number']) ||
            (et['S. No.'] && elected['S. No.'] && et['S. No.'] === elected['S. No.']) ||
            (et.elected_id && elected.elected_id && et.elected_id === elected.elected_id)
          );
          const inTrustees = trustees.some(t =>
            (t['Membership number'] && elected['Membership number'] &&
              t['Membership number'] === elected['Membership number']) ||
            (t['S. No.'] && elected['S. No.'] && t['S. No.'] === elected['S. No.'])
          );
          return !alreadyIncluded && !inTrustees && elected.is_elected_member;
        });

        // Combine and remove duplicates based on available ID fields.
        // NOTE: findIndex returns -1 when no condition matches (item has no ID fields),
        // causing `index === -1` to be false for every valid index → all ID-less items
        // get incorrectly removed. We guard against this by keeping items that have no ID.
        const combined = [...trustees, ...electedTrustees, ...additionalElectedTrustees];
        const unique = combined.filter((item, index, self) => {
          const hasId = item['Membership number'] || item['S. No.'] || item.elected_id;
          // If item has no identifying field, we cannot dedup it — keep it.
          if (!hasId) return true;
          // Otherwise keep only the first occurrence
          return index === self.findIndex(i =>
            (i['Membership number'] && item['Membership number'] && i['Membership number'] === item['Membership number']) ||
            (i['S. No.'] && item['S. No.'] && i['S. No.'] === item['S. No.']) ||
            (i.elected_id && item.elected_id && i.elected_id === item.elected_id)
          );
        });

        return unique;
      } else if (tabId === 'patrons') {
        // Get patrons from allMembers
        const patrons = allMembers.filter(member => {
          return hasRole(member, 'patron');
        });

        // Also add elected members who are patrons (merged data already includes member table data)
        const electedPatrons = electedMembers.filter(elected => {
          // Check if this elected member's type indicates they're a patron (from merged member table data)
          return hasRole(elected, 'patron');
        });

        // Combine and remove duplicates based on membership number
        const combined = [...patrons];
        electedPatrons.forEach(elected => {
          const exists = combined.some(p =>
            (p['Membership number'] && elected['Membership number'] &&
              p['Membership number'] === elected['Membership number']) ||
            (p['S. No.'] && elected['S. No.'] && p['S. No.'] === elected['S. No.'])
          );
          if (!exists) {
            combined.push(elected);
          }
        });

        return combined;
      }
    } else if (directory === 'committee') {
      if (tabId === 'elected') {
        // Return elected members from elected_members table
        return electedMembers;
      } else {
        // Return unique committee names instead of individual members
        const uniqueCommittees = [...new Set(committeeMembers.map(cm => cm.committee_name_english || cm.committee_name_hindi))]
          .filter(name => name && name !== 'N/A')
          .map((committeeName, index) => ({
            'S. No.': `COM${index}`,
            'Name': committeeName,
            'type': 'Committee',
            'committee_name_english': committeeMembers.find(cm => (cm.committee_name_english || cm.committee_name_hindi) === committeeName)?.committee_name_english || committeeName,
            'committee_name_hindi': committeeMembers.find(cm => (cm.committee_name_english || cm.committee_name_hindi) === committeeName)?.committee_name_hindi || committeeName,
            'is_committee_group': true
          }));
        return uniqueCommittees;
      }
    }
    return [];
  }, [allMembers, opdDoctors, opdDoctorsLoading, hospitals, electedMembers, committeeMembers]);

  // Healthcare Directory Tabs — memoized to keep referential stability
  const healthcareTabs = useMemo(() => {
    const tabs = [
      { id: 'doctors', label: `Doctors (${getDoctorsCount()})`, icon: Stethoscope, enabled: isDirectoryEnabled && isDoctorsEnabled },
      { id: 'hospitals', label: `Hospitals (${getHospitalsCount()})`, icon: Building2, enabled: isDirectoryEnabled && isHospitalsEnabled },
    ];
    const filtered = tabs.filter((t) => t.enabled);
    console.log('healthcareTabs after filtering:', filtered);
    return filtered;
  },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [allMembers, opdDoctors, hospitals, isDirectoryEnabled, isDoctorsEnabled, isHospitalsEnabled]);

  // Trustee Directory Tabs — memoized
  const trusteeTabs = useMemo(() => [
    { id: 'trustees', label: `Trustees (${getTrusteesCount()})`, icon: Star, enabled: isDirectoryEnabled },
    { id: 'patrons', label: `Patrons (${getPatronsCount()})`, icon: Award, enabled: isDirectoryEnabled },
  ].filter((t) => t.enabled),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [allMembers, isDirectoryEnabled]);

  // Committee Directory Tabs — memoized
  const committeeTabs = useMemo(() => [
    { id: 'elected', label: `Elected (${getElectedMembersCount()})`, icon: Star, enabled: isDirectoryEnabled && isElectedEnabled },
    { id: 'committee', label: `Committee (${getCommitteeCount()})`, icon: Users, enabled: isDirectoryEnabled && isCommitteeEnabled },
  ].filter((t) => t.enabled),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [electedMembers, committeeMembers, isDirectoryEnabled, isElectedEnabled, isCommitteeEnabled]);

  // Get current tabs based on selected directory — memoized
  const currentTabs = useMemo(() =>
    selectedDirectory === 'healthcare' ? healthcareTabs :
    selectedDirectory === 'committee' ? committeeTabs : trusteeTabs,
  [selectedDirectory, healthcareTabs, trusteeTabs, committeeTabs]);

  useEffect(() => {
    const dirEnabled =
      (selectedDirectory === 'healthcare' && canShowHealthcare) ||
      (selectedDirectory === 'trustee' && canShowTrustee) ||
      (selectedDirectory === 'committee' && canShowCommittee);

    if (selectedDirectory && !dirEnabled) {
      setSelectedDirectory(null);
      setActiveTab(null);
      return;
    }

    if (selectedDirectory && currentTabs.length > 0) {
      // Only update activeTab if it is missing or no longer valid for current tabs.
      // Guard prevents the effect from triggering again after setActiveTab.
      const tabIsValid = activeTab && currentTabs.some((t) => t.id === activeTab);
      if (!tabIsValid) {
        setActiveTab(currentTabs[0].id);
      }
    }
  // featureFlags intentionally omitted — currentTabs already reacts to it via useMemo
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDirectory, currentTabs]);

  // Filter members based on current selection and search
  useEffect(() => {
    let membersToFilter = [];

    if (selectedDirectory && currentTabs.length > 0) {
      // Get members for the currently selected tab
      const currentTabId = activeTab || currentTabs[0]?.id; // Use active tab if set, otherwise default to first tab
      console.log('Filtering members for:', { selectedDirectory, currentTabId, opdDoctorsCount: opdDoctors.length, hospitalsCount: hospitals.length });
      membersToFilter = getMembersByDirectoryAndTab(selectedDirectory, currentTabId);
      console.log('Filtered members count:', membersToFilter.length, 'Data:', membersToFilter);
    } else {
      membersToFilter = [];
    }

    const query = String(searchQuery || '').trim().toLowerCase();
    if (!query) {
      setFilteredMembers(membersToFilter);
      previousFilteredRef.current = membersToFilter;
      setCurrentPage(1);
      return;
    }

    // Apply search filter
    const filtered = membersToFilter.filter(item =>
      (item.Name && item.Name.toLowerCase().includes(query)) ||
      (item.hospital_name && item.hospital_name.toLowerCase().includes(query)) ||
      (item.member_name_english && item.member_name_english.toLowerCase().includes(query)) ||
      (item['Company Name'] && item['Company Name'].toLowerCase().includes(query)) ||
      (item.trust_name && item.trust_name.toLowerCase().includes(query)) ||
      (item.committee_name_hindi && item.committee_name_hindi.toLowerCase().includes(query)) ||
      (item.type && item.type.toLowerCase().includes(query)) ||
      (item.hospital_type && item.hospital_type.toLowerCase().includes(query)) ||
      (item.member_role && item.member_role.toLowerCase().includes(query)) ||
      (item['Membership number'] && String(item['Membership number']).toLowerCase().includes(query)) ||
      (item.department && item.department.toLowerCase().includes(query)) ||
      (item.designation && item.designation.toLowerCase().includes(query)) ||
      (item.city && item.city.toLowerCase().includes(query)) ||
      (item.consultant_name && item.consultant_name.toLowerCase().includes(query)) ||
      (item.position && item.position.toLowerCase().includes(query)) ||
      (item.location && item.location.toLowerCase().includes(query)) ||
      (item.member_id && item.member_id.toLowerCase().includes(query)) ||
      (item.Mobile && String(item.Mobile).toLowerCase().includes(query)) ||
      (item.Mobile2 && String(item.Mobile2).toLowerCase().includes(query))
    );

    setFilteredMembers(filtered);
    previousFilteredRef.current = filtered;
    // Reset to first page when search, tab, or directory changes
    setCurrentPage(1);
  // currentTabs removed from deps — getMembersByDirectoryAndTab (useCallback) already
  // depends on the underlying data; adding currentTabs caused a new-array-reference loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDirectory, activeTab, searchQuery, allMembers, opdDoctors, opdDoctorsLoading, hospitals, electedMembers, committeeMembers]);

  // Scroll to top of the scrollable area whenever directory or tab changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedDirectory, activeTab]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageMembers = filteredMembers.slice(startIndex, endIndex);

  // Debug logging
  useEffect(() => {
    console.log('Pagination state:', {
      selectedDirectory,
      activeTab,
      filteredMembersCount: filteredMembers.length,
      currentPageMembersCount: currentPageMembers.length,
      totalPages,
      currentPage,
      currentPageMembers
    });
  }, [selectedDirectory, activeTab, filteredMembers, currentPageMembers, totalPages, currentPage]);

  // Fetch profile photos for the current page members
  useEffect(() => {
    const fetchPhotos = async () => {
      if (!currentPageMembers.length) return;

      const memberIds = new Set();
      currentPageMembers.forEach(item => {
        // Collect all possible identifiers
        if (item['Membership number']) memberIds.add(item['Membership number']);
        if (item.membership_number) memberIds.add(item.membership_number);
        if (item.Mobile) memberIds.add(item.Mobile);
        if (item.mobile) memberIds.add(item.mobile);
        if (item.phone1) memberIds.add(item.phone1);
        if (item.member_id) memberIds.add(item.member_id);
      });

      const idsToFetch = Array.from(memberIds).filter(id => id && id !== 'N/A');
      if (idsToFetch.length === 0) return;

      try {
        const response = await getProfilePhotos(idsToFetch);
        if (response.success && response.photos) {
          setProfilePhotos(prev => ({ ...prev, ...response.photos }));
        }
      } catch (err) {
        console.error('Error fetching profile photos:', err);
      }
    };

    fetchPhotos();
  }, [currentPageMembers]);

  // Helper to get photo for a member
  const getMemberPhoto = (item) => {
    // For doctors from opd_schedule, use doctor_image_url directly
    if (item.doctor_image_url) return item.doctor_image_url;
    return profilePhotos[item['Membership number']] ||
      profilePhotos[item.membership_number] ||
      profilePhotos[item.Mobile] ||
      profilePhotos[item.mobile] ||
      profilePhotos[item.phone1] ||
      profilePhotos[item.member_id];
  };

  const containerRef = useRef(null);
  const scrollRef = useRef(null);

  return (
    <div className={`bg-white h-screen flex flex-col relative${isMenuOpen ? ' overflow-hidden' : ' overflow-hidden'}`} ref={containerRef}>
      {/* Navbar - Matching Home.jsx */}
      <div className="bg-white border-b border-gray-200 px-6 py-5 flex items-center justify-between sticky top-0 z-50 shadow-sm mt-6 pointer-events-auto">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors pointer-events-auto"
        >
          {isMenuOpen ? <X className="h-6 w-6 text-gray-700" /> : <Menu className="h-6 w-6 text-gray-700" />}
        </button>
        <h1 className="text-lg font-bold text-gray-800">
          {selectedDirectory ? (selectedDirectory === 'healthcare' ? 'Hospitals & Doctors Directory' :
            selectedDirectory === 'committee' ? 'Committee Directory' : 'Trustee & Patron Directory') : 'Directory Selection'}
        </h1>
        <button
          onClick={() => onNavigate('home')}
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-center text-indigo-600"
        >
          <HomeIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Sidebar */}
      {error && (
        <div className="px-6 py-4 flex-shrink-0">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <p className="text-red-600 font-medium">{error}</p>
            <button
              onClick={() => {
                setError(null);
                fetchMembers(false);
              }}
              className="mt-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {loading && !dataLoaded && (
        <div className="px-6 py-4 flex-shrink-0">
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        </div>
      )}

      <Sidebar
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onNavigate={onNavigate}
        currentPage="healthcare-directory"
      />

      {/* ── Scrollable content area ── */}
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>

        {/* Directory Selection Screen */}
        {!selectedDirectory && (
          <div className="px-6 pt-8">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Directory Selection</h1>
              <p className="text-gray-600">Choose the directory you want to explore</p>
            </div>

            <div className="space-y-4">
              {!canShowCommittee && !canShowTrustee && !canShowHealthcare && (
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center text-sm text-gray-600">
                    All directory sections are disabled right now.
                  </div>
                )}

              {/* Committee Directory Card */}
              {canShowCommittee && (
                <div
                  className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-4 group hover:shadow-md hover:border-indigo-100 transition-all cursor-pointer"
                  onClick={() => {
                    setSelectedDirectory('committee');
                    setActiveTab(committeeTabs[0]?.id || 'committee'); // Default to first available tab
                    setSearchQuery('');
                  }}
                >
                  <div className="bg-indigo-50 h-16 w-16 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                    <Users className="h-7 w-7" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800 text-lg group-hover:text-indigo-600 transition-colors">
                      Committee Directory
                    </h3>
                    <p className="text-gray-600 text-sm mt-1">Find Committee Members</p>
                    <div className="flex items-center gap-4 mt-3">
                      <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold">
                        {getCommitteeCount()} Committee
                      </span>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-2 rounded-full group-hover:bg-indigo-50 transition-colors">
                    <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              )}

              {/* Trustee Directory Card */}
              {canShowTrustee && (
                <div
                  className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-4 group hover:shadow-md hover:border-indigo-100 transition-all cursor-pointer"
                  onClick={() => {
                    setSelectedDirectory('trustee');
                    setActiveTab('trustees'); // Set first tab immediately to show data
                  }}
                >
                  <div className="bg-indigo-50 h-16 w-16 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                    <Star className="h-7 w-7" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800 text-lg group-hover:text-indigo-600 transition-colors">
                      Trustee And Patron Directory
                    </h3>
                    <p className="text-gray-600 text-sm mt-1">Find Trustees & Patrons</p>
                    <div className="flex items-center gap-4 mt-3">
                      <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-bold">
                        {getTrusteesCount()} Trustees
                      </span>
                      <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold">
                        {getPatronsCount()} Patrons
                      </span>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-2 rounded-full group-hover:bg-indigo-50 transition-colors">
                    <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              )}

              {/* Healthcare Directory Card */}
              {canShowHealthcare && (
                <div
                  className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-4 group hover:shadow-md hover:border-indigo-100 transition-all cursor-pointer"
                  onClick={() => {
                    console.log('Healthcare card clicked - setting directory to healthcare, activeTab to doctors');
                    setSelectedDirectory('healthcare');
                    setActiveTab('doctors'); // Set first tab immediately to show data
                  }}
                >
                  <div className="bg-indigo-50 h-16 w-16 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                    <Building2 className="h-7 w-7" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800 text-lg group-hover:text-indigo-600 transition-colors">
                      Hospitals & Doctors Directory
                    </h3>
                    <p className="text-gray-600 text-sm mt-1">Find Doctors & Hospitals</p>
                    <div className="flex items-center gap-4 mt-3">
                      <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-xs font-bold">
                        {getDoctorsCount()} Doctors
                      </span>
                      <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold">
                        {getHospitalsCount()} Hospitals
                      </span>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-2 rounded-full group-hover:bg-indigo-50 transition-colors">
                    <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Healthcare or Trustee Directory View */}
        {selectedDirectory && (
          <div>
            {/* Header Section */}
            <div className="bg-white px-6 pt-6 pb-4">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setSelectedDirectory(null)}
                  className="p-2 rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-center text-indigo-600"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="flex items-center flex-1 mx-4">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-800">
                      {selectedDirectory === 'healthcare' ? 'Hospitals & Doctors Directory' :
                        selectedDirectory === 'committee' ? 'Committee Directory' : 'Trustee & Patron Directory'}
                    </h1>
                    <p className="text-gray-500 text-sm font-medium">
                      {selectedDirectory === 'healthcare' ? 'Find Doctors & Hospitals' :
                        selectedDirectory === 'committee' ? 'Find Committee Members' : 'Find Trustees & Patrons'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Search Section */}
            <div className="px-6 mt-4">
              <div className="bg-gray-50 rounded-2xl p-2 flex items-center gap-3 border border-gray-200 focus-within:border-indigo-300 transition-all shadow-sm">
                <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 ml-1">
                  <User className="h-5 w-5 text-indigo-600" />
                </div>
                <input
                  type="text"
                  placeholder={`Search in ${selectedDirectory === 'healthcare' ? 'Hospitals & Doctors' :
                    selectedDirectory === 'committee' ? 'Committee' : 'Trustee'} directory...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent border-none focus:ring-0 text-gray-800 placeholder-gray-400 font-medium text-sm py-2"
                />
              </div>
            </div>

            {/* Tabs - Modern Pill Style */}
            <div className="px-6 mt-6">
              <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
                {currentTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setSearchQuery('');
                    }}
                    className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all text-xs tracking-tight ${activeTab === tab.id || (!activeTab && currentTabs[0]?.id === tab.id)
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100 border border-indigo-600'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                      }`}
                  >
                    <tab.icon className={`h-4 w-4 ${(activeTab === tab.id || (!activeTab && currentTabs[0]?.id === tab.id)) ? 'text-white' : 'text-indigo-600'}`} />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content List - Modern Cards */}
            <div className="px-6 mt-2 space-y-4" ref={contentRef}>
              {loading && !dataLoaded ? (
                <div className="flex justify-center items-center py-20">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 text-sm">Loading directory...</p>
                  </div>
                </div>
              ) : currentPageMembers.length > 0 ? (
                currentPageMembers.map((item) => (
                  <div
                    key={item['S. No.'] || item.id || Math.random()}
                    className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4 group hover:shadow-md hover:border-indigo-100 transition-all cursor-pointer"
                    onClick={() => {
                      const currentTabId = activeTab || currentTabs[0]?.id;
                      const isElectedContext = selectedDirectory === 'committee' && currentTabId === 'elected';

                      // Check if this is a committee group (committee name)
                      // Skip this path when we're in the elected tab.
                      if (!isElectedContext && item.is_committee_group) {
                        // Navigate to a new view showing all members of this committee
                        const filteredCommitteeMembers = committeeMembers.filter(cm =>
                          (cm.committee_name_english === item.Name) || (cm.committee_name_hindi === item.Name)
                        );

                        const committeeData = {
                          'Name': item.Name,
                          'type': 'Committee',
                          'committee_members': filteredCommitteeMembers,
                          'committee_name_english': item.committee_name_english,
                          'committee_name_hindi': item.committee_name_hindi,
                          'is_committee_group': true
                        };

                        // Add the current directory type as the previous screen name
                        committeeData.previousScreenName = selectedDirectory;

                        // Store the current directory and tab in sessionStorage to restore when coming back
                        sessionStorage.setItem('restoreDirectory', selectedDirectory);
                        sessionStorage.setItem('restoreDirectoryTab', activeTab);

                        onNavigate('committee-members', committeeData);
                      } else {
                        // Navigate to member details page
                        // Determine if this is a healthcare member (from opd_schedule)
                        const isHealthcareMember = !!item.consultant_name || (item.original_id && item.original_id.toString().startsWith('DOC'));
                        // Determine if this is a committee member (from committee_members table)
                        const isCommitteeMember = !!item.is_committee_member || (item.original_id && item.original_id.toString().startsWith('CM'));
                        // Determine if this is a hospital member (from hospitals table)
                        const isHospitalMember = !!item.is_hospital ||
                          (item.original_id && item.original_id.toString().startsWith('HOSP')) ||
                          (item['S. No.'] && item['S. No.'].toString().startsWith('HOSP'));
                        // Determine if this is an elected member (from elected_members table)
                        const isElectedMember = isElectedContext || !!item.is_elected_member ||
                          (item.elected_id !== undefined && item.elected_id !== null) ||
                          (item.original_id && item.original_id.toString().startsWith('ELECT')) ||
                          (item['S. No.'] && item['S. No.'].toString().startsWith('ELECT'));

                        // Create member data based on the source
                        const memberData = {
                          'S. No.': item['S. No.'] || item.original_id || `MEM${Math.floor(Math.random() * 10000)}`,
                          'Name': item.member_name_english || item.Name || item.hospital_name || item.consultant_name || 'N/A',
                          'Mobile': item.Mobile || item.contact_phone || item.mobile || 'N/A',
                          'Email': item.Email || item.contact_email || item.email || 'N/A',
                          'type': item.member_role || item.type || item.Type || 'N/A',
                          'Membership number': item['Membership number'] || item.membership_number || item.membership_number_elected || 'N/A',
                          'isHealthcareMember': isHealthcareMember,
                          'isCommitteeMember': isCommitteeMember,
                          'isHospitalMember': isHospitalMember,
                          'isElectedMember': isElectedMember
                        };

                        // Add hospital-specific fields (from hospitals table) only if it's a hospital member
                        if (isHospitalMember) {
                          memberData.hospital_name = item.hospital_name || 'N/A';
                          memberData.trust_name = item.trust_name || 'N/A';
                          memberData.hospital_type = item.hospital_type || 'N/A';
                          memberData.address = item.address || 'N/A';
                          memberData.city = item.city || 'N/A';
                          memberData.state = item.state || 'N/A';
                          memberData.pincode = item.pincode || 'N/A';
                          memberData.established_year = item.established_year || 'N/A';
                          memberData.bed_strength = item.bed_strength || 'N/A';
                          memberData.accreditation = item.accreditation || 'N/A';
                          memberData.facilities = item.facilities || 'N/A';
                          memberData.departments = item.departments || 'N/A';
                          memberData.contact_phone = item.contact_phone || 'N/A';
                          memberData.contact_email = item.contact_email || 'N/A';
                          memberData.is_active = item.is_active || 'N/A';
                          memberData.id = item.original_id || null;
                        } else if (isCommitteeMember) {
                          // Add committee-specific fields (from committee_members table)
                          memberData.committee_name_hindi = item.committee_name_hindi || 'N/A';
                          memberData.member_name_english = item.member_name_english || 'N/A';
                          memberData.member_role = item.member_role || 'N/A';
                          memberData['Company Name'] = item.committee_name_hindi || item['Company Name'] || 'N/A';
                        } else if (!isHealthcareMember && !isElectedMember) {
                          // Add general member fields (from Members Table) only if not healthcare, committee, or elected
                          if (item['Company Name']) memberData['Company Name'] = item['Company Name'];
                          if (item['Address Home']) memberData['Address Home'] = item['Address Home'];
                          if (item['Address Office']) memberData['Address Office'] = item['Address Office'];
                          if (item['Resident Landline']) memberData['Resident Landline'] = item['Resident Landline'];
                          if (item['Office Landline']) memberData['Office Landline'] = item['Office Landline'];
                        }

                        // Add Members Table fields for elected members (since they're merged with Members Table)
                        if (isElectedMember) {
                          if (item['Company Name']) memberData['Company Name'] = item['Company Name'];
                          if (item['Address Home']) memberData['Address Home'] = item['Address Home'];
                          if (item['Address Office']) memberData['Address Office'] = item['Address Office'];
                          if (item['Resident Landline']) memberData['Resident Landline'] = item['Resident Landline'];
                          if (item['Office Landline']) memberData['Office Landline'] = item['Office Landline'];

                          // Add elected-specific fields from elected_members table
                          memberData.position = item.position || 'N/A';
                          memberData.location = item.location || 'N/A';
                          memberData.elected_id = item.elected_id || item.original_id || item.id || item.reg_id || null;
                          memberData.membership_number_elected = item.membership_number || item.membership_number_elected || item['Membership number'] || 'N/A';
                          memberData.created_at = item.created_at || 'N/A';
                          memberData.is_merged_with_member = item.is_merged_with_member || false;
                        }

                        // Add healthcare-specific fields (from opd_schedule) only if it's a healthcare member
                        if (isHealthcareMember) {
                          memberData.department = item.department || 'N/A';
                          memberData.designation = item.designation || item.specialization || 'N/A';
                          memberData.qualification = item.qualification || 'N/A';
                          memberData.senior_junior = item.senior_junior || 'N/A';
                          memberData.unit = item.unit || 'N/A';
                          memberData.general_opd_days = item.general_opd_days || 'N/A';
                          memberData.private_opd_days = item.private_opd_days || 'N/A';
                          memberData.unit_notes = item.unit_notes || 'N/A';
                          memberData.consultant_name = item.consultant_name || item.Name || 'N/A';
                          memberData.notes = item.notes || item.unit_notes || 'N/A';
                          memberData.id = item.id || item.original_id || null;
                        } else if (!isCommitteeMember && !isHospitalMember && !isElectedMember) {
                          // For non-healthcare, non-committee, non-hospital, non-elected members, use original field values if they exist
                          if (item.designation) memberData.designation = item.designation;
                          if (item.qualification) memberData.qualification = item.qualification;
                          if (item.notes) memberData.notes = item.notes;
                        }

                        // Add the current directory type as the previous screen name
                        memberData.previousScreenName = selectedDirectory;

                        // Store the current directory and tab in sessionStorage to restore when coming back
                        sessionStorage.setItem('restoreDirectory', selectedDirectory);
                        sessionStorage.setItem('restoreDirectoryTab', activeTab);

                        onNavigate('member-details', memberData);
                      }
                    }}
                  >
                    {/* Avatar / Doctor Image */}
                    {selectedDirectory === 'healthcare' && activeTab === 'doctors' ? (
                      // ── Doctor card: large image + rich details ──
                      <div className="flex gap-4 w-full">
                        {/* Doctor Photo */}
                        <div className="flex-shrink-0 h-20 w-20 rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center border border-indigo-200/50 shadow-sm">
                          {getMemberPhoto(item) ? (
                            <img
                              src={getMemberPhoto(item)}
                              alt={item.consultant_name || item.Name || 'Doctor'}
                              className="w-full h-full object-cover"
                              onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }}
                            />
                          ) : (
                            <Stethoscope className="h-8 w-8 text-indigo-500" />
                          )}
                        </div>

                        {/* Doctor Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-bold text-gray-900 text-sm leading-tight group-hover:text-indigo-600 transition-colors">
                              {item.consultant_name || item.Name || 'N/A'}
                            </h3>
                            <div className="bg-gray-50 p-1.5 rounded-full group-hover:bg-indigo-50 flex-shrink-0">
                              <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-indigo-400" />
                            </div>
                          </div>

                          {/* Department */}
                          {item.department && (
                            <span className="inline-block mt-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                              {item.department}
                            </span>
                          )}

                          {/* Designation + Qualification */}
                          {(item.designation || item.qualification) && (
                            <p className="text-purple-700 text-[10px] font-semibold bg-purple-50 px-2 py-0.5 rounded-full inline-block mt-1">
                              {[item.designation, item.qualification].filter(Boolean).join(' | ')}
                            </p>
                          )}

                          {/* Experience + Fee row */}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {item.experience_years && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                                {item.experience_years}+ yrs exp
                              </span>
                            )}
                            {item.consultation_fee && (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                                ₹{item.consultation_fee} fee
                              </span>
                            )}
                          </div>

                          {/* OPD Days */}
                          {(item.general_opd_days || item.private_opd_days) && (
                            <p className="text-gray-500 text-[10px] mt-1.5 leading-relaxed">
                              {item.general_opd_days && <span><span className="font-semibold text-gray-600">OPD:</span> {item.general_opd_days}</span>}
                              {item.general_opd_days && item.private_opd_days && ' · '}
                              {item.private_opd_days && <span><span className="font-semibold text-gray-600">Pvt:</span> {item.private_opd_days}</span>}
                            </p>
                          )}

                          {/* Call button */}
                          {(item.mobile || item.Mobile) && (
                            <a
                              href={`tel:${(item.mobile || item.Mobile).replace(/\s+/g, '').split(',')[0]}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 mt-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all"
                            >
                              <Phone className="h-3 w-3" />
                              Call
                            </a>
                          )}
                        </div>
                      </div>
                    ) : (
                      // ── Generic card for hospitals, trustees, patrons, committee ──
                      <>
                        <div className="bg-gradient-to-br from-indigo-100 to-purple-100 h-16 w-16 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:from-indigo-600 group-hover:to-purple-600 group-hover:text-white transition-all duration-300 overflow-hidden shadow-sm border border-indigo-200/50 group-hover:border-transparent group-hover:shadow-md flex-shrink-0">
                          {getMemberPhoto(item) ? (
                            <img
                              src={getMemberPhoto(item)}
                              alt={item.member_name_english || item.Name || 'Member'}
                              className="w-full h-full object-cover"
                              onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }}
                            />
                          ) : (
                            selectedDirectory === 'healthcare' ? <Stethoscope className="h-7 w-7" /> :
                              selectedDirectory === 'committee' ? <Users className="h-7 w-7" /> : <Star className="h-7 w-7" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-bold text-gray-800 text-base leading-tight group-hover:text-indigo-600 transition-colors">
                                {item.member_name_english || item.Name || 'N/A'}
                              </h3>
                              <div className="flex flex-col gap-1 mt-1">
                                {item['Membership number'] && (
                                  <p className="text-gray-500 text-xs font-medium">{item['Membership number']}</p>
                                )}
                                {!(selectedDirectory === 'healthcare' && (activeTab === 'doctors' || activeTab === 'hospitals')) && (
                                  <p className="text-indigo-600 text-[10px] font-bold uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-full inline-block group-hover:bg-indigo-100 transition-colors">
                                    {item.position || item.member_role || item.type || item['Company Name'] || 'N/A'}
                                  </p>
                                )}
                                {item.location && (
                                  <p className="text-emerald-700 text-xs font-bold bg-emerald-50 px-2 py-0.5 rounded-md inline-flex items-center gap-1 mt-1">
                                    <MapPin className="h-3 w-3" />{item.location}
                                  </p>
                                )}
                                {(item.committee_name_hindi || item['Company Name'] || (item.department && activeTab !== 'doctors')) && (
                                  <p className="text-indigo-700 text-xs mt-1 font-bold bg-indigo-50 px-2 py-0.5 rounded-md inline-block">
                                    {item.committee_name_hindi || item.department || item['Company Name']}
                                  </p>
                                )}
                                {(item.hospital_type || item.trust_name) && (
                                  <p className="text-gray-600 text-xs mt-1">{item.hospital_type || item.trust_name}</p>
                                )}
                                {(item.designation || item.qualification) && (
                                  <p className="text-purple-700 text-xs font-bold bg-purple-50 px-2 py-0.5 rounded-md inline-block">
                                    {item.designation}{item.qualification ? ` | ${item.qualification}` : ''}
                                  </p>
                                )}
                                {item.city && (
                                  <p className="text-emerald-700 text-xs font-bold bg-emerald-50 px-2 py-0.5 rounded-md inline-flex items-center gap-1 mt-1">
                                    <MapPin className="h-3 w-3" />{item.city}{item.state ? `, ${item.state}` : ''}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 mt-4 flex-wrap">
                            {item.Mobile && (
                              <a href={`tel:${item.Mobile.replace(/\s+/g, '').split(',')[0]}`}
                                className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all text-xs font-semibold border border-gray-100">
                                <Phone className="h-3.5 w-3.5" />Call
                              </a>
                            )}
                            {item.Email && item.Email.trim() && (
                              <a href={`mailto:${item.Email.trim()}`}
                                className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all text-xs font-semibold border border-gray-100">
                                <User className="h-3.5 w-3.5" />Email
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="bg-gray-50 p-2 rounded-full group-hover:bg-indigo-50 transition-colors flex-shrink-0">
                          <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-20">
                  <div className="bg-gray-50 h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-gray-300">
                    <User className="h-8 w-8 text-gray-300" />
                  </div>
                  <h3 className="text-gray-800 font-bold">No results found</h3>
                  <p className="text-gray-500 text-sm mt-1">Try searching with a different keyword</p>
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {filteredMembers.length > itemsPerPage && (
              <div className="px-4 mt-5 mb-4">
                <div className="bg-indigo-50 rounded-2xl px-3 py-3 border border-indigo-100">
                  <div className="flex items-center justify-between gap-2">
                    {/* Prev */}
                    <button
                      onClick={() => {
                        setCurrentPage(prev => Math.max(1, prev - 1));
                        scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      disabled={currentPage === 1}
                      className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-all ${currentPage === 1
                        ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                        : 'bg-white text-indigo-600 border border-indigo-200 active:scale-95'
                        }`}
                    >
                      ← Prev
                    </button>

                    {/* Page Numbers — max 3 shown */}
                    <div className="flex items-center gap-1">
                      {(() => {
                        const pages = [];
                        let start = Math.max(1, currentPage - 1);
                        let end = Math.min(totalPages, start + 2);
                        if (end - start < 2) start = Math.max(1, end - 2);
                        for (let p = start; p <= end; p++) {
                          pages.push(
                            <button
                              key={p}
                              onClick={() => {
                                setCurrentPage(p);
                                scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className={`w-9 h-9 rounded-xl font-bold text-sm transition-all ${currentPage === p
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-white text-gray-600 border border-gray-200 active:scale-95'
                                }`}
                            >
                              {p}
                            </button>
                          );
                        }
                        return pages;
                      })()}
                    </div>

                    {/* Info */}
                    <span className="text-[11px] text-gray-500 font-semibold whitespace-nowrap">
                      {startIndex + 1}–{Math.min(endIndex, filteredMembers.length)} / {filteredMembers.length}
                    </span>

                    {/* Next */}
                    <button
                      onClick={() => {
                        setCurrentPage(prev => Math.min(totalPages, prev + 1));
                        scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      disabled={currentPage === totalPages}
                      className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-all ${currentPage === totalPages
                        ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                        : 'bg-white text-indigo-600 border border-indigo-200 active:scale-95'
                        }`}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Extra Space for Bottom Nav */}
        <div className="h-10"></div>
      </div>
    </div>
  );
};

export default HealthcareTrusteeDirectory;
