import React, { useState, useEffect, useMemo } from 'react';
import {
    ArrowLeft, Search, Users, Phone, Mail, MapPin, User,
    Calendar, Heart, Shield, Home as HomeIcon, Briefcase,
    ChevronDown, ChevronUp, Loader, RefreshCw
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';

const AdminUserProfiles = ({ onNavigate }) => {
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedId, setExpandedId] = useState(null);

    const fetchProfiles = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: sbError } = await supabase
                .from('user_profiles')
                .select('*')
                .order('created_at', { ascending: false });
            if (sbError) throw sbError;
            setProfiles(data || []);
        } catch (err) {
            setError(err.message || 'Failed to load user profiles');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchProfiles(); }, []);

    const filtered = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return profiles;
        return profiles.filter(p =>
            [p.name, p.mobile, p.email, p.member_id, p.role, p.user_identifier]
                .some(v => v && v.toString().toLowerCase().includes(q))
        );
    }, [profiles, searchQuery]);

    const Field = ({ icon: Icon, label, value }) => {
        if (!value) return null;
        return (
            <div className="flex items-start gap-2 py-1.5">
                <Icon className="h-4 w-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">{label}</p>
                    <p className="text-sm text-gray-800 font-medium">{value}</p>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-gray-50 min-h-screen">
            {/* Navbar */}
            <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
                <button
                    onClick={() => onNavigate('home')}
                    className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-indigo-600"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-indigo-600" />
                    <h1 className="text-base font-bold text-gray-800">User Profiles</h1>
                </div>
                <button
                    onClick={fetchProfiles}
                    className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-indigo-600"
                    title="Refresh"
                >
                    <RefreshCw className="h-5 w-5" />
                </button>
            </div>

            {/* Header banner */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-5 text-white">
                <h2 className="text-lg font-extrabold">All Members</h2>
                <p className="text-indigo-100 text-sm mt-0.5">
                    {loading ? 'Loading...' : `${profiles.length} total profiles`}
                </p>
            </div>

            {/* Search bar */}
            <div className="px-4 pt-4 pb-2">
                <div className="bg-white rounded-2xl p-2 flex items-center gap-3 border border-gray-200 shadow-sm">
                    <Search className="h-5 w-5 text-indigo-400 ml-2" />
                    <input
                        type="text"
                        placeholder="Search by name, mobile, email, member ID..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="flex-1 bg-transparent border-none focus:ring-0 text-gray-800 placeholder-gray-400 text-sm"
                    />
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="mx-4 mt-3 bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-red-600 text-sm font-medium">{error}</p>
                    <button onClick={fetchProfiles} className="mt-2 text-xs text-red-700 underline">Retry</button>
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-20">
                    <Loader className="h-8 w-8 animate-spin text-indigo-600" />
                </div>
            )}

            {/* Profile list */}
            {!loading && (
                <div className="px-4 pt-3 pb-10 space-y-3">
                    {filtered.length === 0 ? (
                        <div className="text-center py-20">
                            <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500 font-medium">No profiles found</p>
                        </div>
                    ) : (
                        filtered.map(p => {
                            const isOpen = expandedId === p.id;
                            const initials = (p.name || p.user_identifier || '?')
                                .split(' ')
                                .slice(0, 2)
                                .map(n => n[0])
                                .join('')
                                .toUpperCase();

                            return (
                                <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                    {/* Header row */}
                                    <button
                                        onClick={() => setExpandedId(isOpen ? null : p.id)}
                                        className="w-full flex items-center gap-3 p-4 text-left"
                                    >
                                        {/* Avatar */}
                                        {p.profile_photo_url ? (
                                            <img
                                                src={p.profile_photo_url}
                                                alt={p.name}
                                                className="h-12 w-12 rounded-full object-cover flex-shrink-0 border-2 border-indigo-100"
                                                onError={e => { e.target.style.display = 'none'; }}
                                            />
                                        ) : (
                                            <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                                <span className="text-indigo-700 font-bold text-sm">{initials}</span>
                                            </div>
                                        )}
                                        {/* Name + role */}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-gray-900 text-sm">{p.name || 'N/A'}</p>
                                            <p className="text-xs text-gray-500 truncate">
                                                {[p.role, p.member_id].filter(Boolean).join(' · ')}
                                            </p>
                                            {p.mobile && (
                                                <p className="text-xs text-indigo-600 font-medium">{p.mobile}</p>
                                            )}
                                        </div>
                                        {isOpen
                                            ? <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                            : <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                        }
                                    </button>

                                    {/* Expanded details */}
                                    {isOpen && (
                                        <div className="border-t border-gray-100 px-4 py-3 grid grid-cols-1 gap-0.5">
                                            <Field icon={User} label="Full Name" value={p.name} />
                                            <Field icon={Shield} label="Role" value={p.role} />
                                            <Field icon={Users} label="Member ID" value={p.member_id} />
                                            <Field icon={Phone} label="Mobile" value={p.mobile} />
                                            <Field icon={Mail} label="Email" value={p.email} />
                                            <Field icon={Calendar} label="Date of Birth" value={p.dob} />
                                            <Field icon={Heart} label="Blood Group" value={p.blood_group} />
                                            <Field icon={User} label="Gender" value={p.gender} />
                                            <Field icon={Heart} label="Marital Status" value={p.marital_status} />
                                            <Field icon={Shield} label="Aadhaar" value={p.aadhaar_id} />
                                            <Field icon={Shield} label="Nationality" value={p.nationality} />
                                            <Field icon={HomeIcon} label="Home Address" value={p.address_home} />
                                            <Field icon={Briefcase} label="Office Address" value={p.address_office} />
                                            <Field icon={Briefcase} label="Company" value={p.company_name} />
                                            <Field icon={Phone} label="Resident Landline" value={p.resident_landline} />
                                            <Field icon={Phone} label="Office Landline" value={p.office_landline} />
                                            <Field icon={User} label="Spouse Name" value={p.spouse_name} />
                                            <Field icon={Phone} label="Spouse Contact" value={p.spouse_contact_number} />
                                            <Field icon={Users} label="Children Count" value={p.children_count !== null && p.children_count !== undefined ? String(p.children_count) : null} />
                                            <Field icon={User} label="Emergency Contact" value={p.emergency_contact_name} />
                                            <Field icon={Phone} label="Emergency Number" value={p.emergency_contact_number} />
                                            <Field icon={MapPin} label="Location" value={p.location} />
                                            <Field icon={Briefcase} label="Position" value={p.position} />
                                            {p.is_elected_member && (
                                                <div className="mt-2">
                                                    <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-1 rounded-full">Elected Member</span>
                                                </div>
                                            )}
                                            {/* Social links */}
                                            {(p.facebook || p.twitter || p.instagram || p.linkedin || p.whatsapp) && (
                                                <div className="mt-3 pt-3 border-t border-gray-100">
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide mb-2">Social</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {p.facebook && <a href={p.facebook} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">Facebook</a>}
                                                        {p.twitter && <a href={p.twitter} target="_blank" rel="noreferrer" className="text-xs text-sky-500 underline">Twitter</a>}
                                                        {p.instagram && <a href={p.instagram} target="_blank" rel="noreferrer" className="text-xs text-pink-500 underline">Instagram</a>}
                                                        {p.linkedin && <a href={p.linkedin} target="_blank" rel="noreferrer" className="text-xs text-blue-700 underline">LinkedIn</a>}
                                                        {p.whatsapp && <a href={`https://wa.me/${p.whatsapp}`} target="_blank" rel="noreferrer" className="text-xs text-green-600 underline">WhatsApp</a>}
                                                    </div>
                                                </div>
                                            )}
                                            <p className="text-[10px] text-gray-400 mt-3">
                                                Registered: {p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN') : '—'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminUserProfiles;
