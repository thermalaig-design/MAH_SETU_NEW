import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Stethoscope, Building2, Star, Award, Search, Plus, Edit2, Trash2, 
  Phone, Mail, MapPin, ChevronLeft, X, Save, Loader 
} from 'lucide-react';
import { 
  getAllMembersAdmin, createMember, updateMember, deleteMember,
  getAllHospitalsAdmin, createHospital, updateHospital, deleteHospital,
  getAllElectedMembersAdmin, createElectedMember, updateElectedMember, deleteElectedMember,
  getAllCommitteeMembersAdmin, createCommitteeMember, updateCommitteeMember, deleteCommitteeMember,
  getAllDoctorsAdmin, createDoctor, updateDoctor, deleteDoctor
} from './services/adminApi';

const AdminDirectory = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState('members');
  const [searchQuery, setSearchQuery] = useState('');
  const [members, setMembers] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [electedMembers, setElectedMembers] = useState([]);
  const [committeeMembers, setCommitteeMembers] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});

  const tabs = [
    { id: 'members', label: 'Members', icon: Users },
    { id: 'hospitals', label: 'Hospitals', icon: Building2 },
    { id: 'elected', label: 'Elected Members', icon: Star },
    { id: 'committee', label: 'Committee', icon: Users },
    { id: 'doctors', label: 'Doctors', icon: Stethoscope },
  ];

  // Load data when tab changes
  useEffect(() => {
    loadData(activeTab);
  }, [activeTab]);

  const loadData = async (tab) => {
    setLoading(true);
    setError(null);
    try {
      switch (tab) {
        case 'members':
          const membersRes = await getAllMembersAdmin();
          setMembers(membersRes?.data || []);
          break;
        case 'hospitals':
          const hospitalsRes = await getAllHospitalsAdmin();
          setHospitals(hospitalsRes?.data || []);
          break;
        case 'elected':
          const electedRes = await getAllElectedMembersAdmin();
          setElectedMembers(electedRes?.data || []);
          break;
        case 'committee':
          const committeeRes = await getAllCommitteeMembersAdmin();
          setCommitteeMembers(committeeRes?.data || []);
          break;
        case 'doctors':
          const doctorsRes = await getAllDoctorsAdmin();
          setDoctors(doctorsRes?.data || []);
          break;
      }
    } catch (err) {
      console.error(`Error loading ${tab}:`, err);
      setError(`Failed to load ${tab}: ${err.message || 'Please make sure backend server is running'}`);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentData = () => {
    switch (activeTab) {
      case 'members': return members;
      case 'hospitals': return hospitals;
      case 'elected': return electedMembers;
      case 'committee': return committeeMembers;
      case 'doctors': return doctors;
      default: return [];
    }
  };

  const filteredData = useMemo(() => {
    const data = getCurrentData();
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return data;
    
    return data.filter(item => {
      try {
        return Object.values(item).some(value => 
          value && value.toString().toLowerCase().includes(q)
        );
      } catch {
        return false;
      }
    });
  }, [searchQuery, members, hospitals, electedMembers, committeeMembers, doctors, activeTab]);

  const handleAdd = () => {
    setEditingItem(null);
    setFormData({});
    setShowAddForm(true);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData(item);
    setShowAddForm(true);
  };

  const handleDelete = async (item) => {
    if (!window.confirm('Are you sure you want to delete this item?')) {
      return;
    }

    try {
      const id = item.id || item['S. No.'] || item.member_id || item.hospital_id || item.elected_id || item.doctor_id;
      
      switch (activeTab) {
        case 'members':
          await deleteMember(id);
          setMembers(members.filter(m => (m.id || m['S. No.']) !== id));
          break;
        case 'hospitals':
          await deleteHospital(id);
          setHospitals(hospitals.filter(h => (h.id || h.hospital_id) !== id));
          break;
        case 'elected':
          await deleteElectedMember(id);
          setElectedMembers(electedMembers.filter(e => (e.id || e.elected_id) !== id));
          break;
        case 'committee':
          await deleteCommitteeMember(id);
          setCommitteeMembers(committeeMembers.filter(c => (c.id || c.committee_id) !== id));
          break;
        case 'doctors':
          await deleteDoctor(id);
          setDoctors(doctors.filter(d => (d.id || d.doctor_id) !== id));
          break;
      }
      alert('Item deleted successfully!');
    } catch (err) {
      console.error('Error deleting item:', err);
      alert(`Failed to delete: ${err.message || 'Unknown error'}`);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const id = editingItem?.id || editingItem?.['S. No.'] || editingItem?.member_id || editingItem?.hospital_id || editingItem?.elected_id || editingItem?.doctor_id;

      switch (activeTab) {
        case 'members':
          if (id) {
            await updateMember(id, formData);
            setMembers(members.map(m => (m.id || m['S. No.']) === id ? { ...m, ...formData } : m));
          } else {
            const newMember = await createMember(formData);
            setMembers([...members, newMember.data]);
          }
          break;
        case 'hospitals':
          if (id) {
            await updateHospital(id, formData);
            setHospitals(hospitals.map(h => (h.id || h.hospital_id) === id ? { ...h, ...formData } : h));
          } else {
            const newHospital = await createHospital(formData);
            setHospitals([...hospitals, newHospital.data]);
          }
          break;
        case 'elected':
          if (id) {
            await updateElectedMember(id, formData);
            setElectedMembers(electedMembers.map(e => (e.id || e.elected_id) === id ? { ...e, ...formData } : e));
          } else {
            const newElected = await createElectedMember(formData);
            setElectedMembers([...electedMembers, newElected.data]);
          }
          break;
        case 'committee':
          if (id) {
            await updateCommitteeMember(id, formData);
            setCommitteeMembers(committeeMembers.map(c => (c.id || c.committee_id) === id ? { ...c, ...formData } : c));
          } else {
            const newCommittee = await createCommitteeMember(formData);
            setCommitteeMembers([...committeeMembers, newCommittee.data]);
          }
          break;
        case 'doctors':
          if (id) {
            await updateDoctor(id, formData);
            setDoctors(doctors.map(d => (d.id || d.doctor_id) === id ? { ...d, ...formData } : d));
          } else {
            const newDoctor = await createDoctor(formData);
            setDoctors([...doctors, newDoctor.data]);
          }
          break;
      }
      
      setShowAddForm(false);
      setEditingItem(null);
      setFormData({});
      alert(editingItem ? 'Item updated successfully!' : 'Item added successfully!');
    } catch (err) {
      console.error('Error saving item:', err);
      alert(`Failed to save: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const renderForm = () => {
    const fields = getFormFields(activeTab);
    
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">
              {editingItem ? 'Edit' : 'Add'} {tabs.find(t => t.id === activeTab)?.label}
            </h2>
            <button
              onClick={() => {
                setShowAddForm(false);
                setEditingItem(null);
                setFormData({});
              }}
              className="p-2 rounded-xl hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map((field) => (
              <div key={field.key} className={field.fullWidth ? 'md:col-span-2' : ''}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field.label}
                  {field.required && <span className="text-red-500">*</span>}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    value={formData[field.key] || ''}
                    onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    rows={3}
                    required={field.required}
                  />
                ) : field.type === 'checkbox' ? (
                  <input
                    type="checkbox"
                    checked={formData[field.key] || false}
                    onChange={(e) => setFormData({ ...formData, [field.key]: e.target.checked })}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                ) : (
                  <input
                    type={field.type || 'text'}
                    value={formData[field.key] || ''}
                    onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required={field.required}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {loading ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setEditingItem(null);
                setFormData({});
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  const getFormFields = (tab) => {
    switch (tab) {
      case 'members':
        return [
          { key: 'Name', label: 'Name', required: true },
          { key: 'Membership number', label: 'Membership Number' },
          { key: 'Mobile', label: 'Mobile' },
          { key: 'Email', label: 'Email' },
          { key: 'type', label: 'Type' },
          { key: 'Company Name', label: 'Company Name' },
          { key: 'Address Home', label: 'Address Home', fullWidth: true },
          { key: 'Address Office', label: 'Address Office', fullWidth: true },
          { key: 'Resident Landline', label: 'Resident Landline' },
          { key: 'Office Landline', label: 'Office Landline' },
        ];
      case 'hospitals':
        return [
          { key: 'hospital_name', label: 'Hospital Name', required: true },
          { key: 'trust_name', label: 'Trust Name' },
          { key: 'hospital_type', label: 'Hospital Type' },
          { key: 'address', label: 'Address', fullWidth: true },
          { key: 'city', label: 'City' },
          { key: 'state', label: 'State' },
          { key: 'pincode', label: 'Pincode' },
          { key: 'contact_phone', label: 'Contact Phone' },
          { key: 'contact_email', label: 'Contact Email' },
          { key: 'bed_strength', label: 'Bed Strength' },
          { key: 'established_year', label: 'Established Year' },
          { key: 'accreditation', label: 'Accreditation' },
          { key: 'facilities', label: 'Facilities', type: 'textarea' },
          { key: 'departments', label: 'Departments', type: 'textarea' },
        ];
      case 'elected':
        return [
          { key: 'membership_number', label: 'Membership Number', required: true },
          { key: 'position', label: 'Position' },
          { key: 'location', label: 'Location' },
          { key: 'is_elected_member', label: 'Is Elected Member', type: 'checkbox' },
        ];
      case 'committee':
        return [
          { key: 'member_name_english', label: 'Member Name (English)', required: true },
          { key: 'committee_name_english', label: 'Committee Name (English)' },
          { key: 'committee_name_hindi', label: 'Committee Name (Hindi)' },
          { key: 'member_role', label: 'Member Role' },
        ];
      case 'doctors':
        return [
          { key: 'consultant_name', label: 'Consultant Name', required: true },
          { key: 'department', label: 'Department' },
          { key: 'designation', label: 'Designation' },
          { key: 'specialization', label: 'Specialization' },
          { key: 'qualification', label: 'Qualification' },
          { key: 'senior_junior', label: 'Senior/Junior' },
          { key: 'unit', label: 'Unit' },
          { key: 'general_opd_days', label: 'General OPD Days' },
          { key: 'private_opd_days', label: 'Private OPD Days' },
          { key: 'unit_notes', label: 'Unit Notes', type: 'textarea' },
          { key: 'notes', label: 'Notes', type: 'textarea' },
        ];
      default:
        return [];
    }
  };

  const renderItemCard = (item) => {
    const displayName = item.Name || item.hospital_name || item.consultant_name || item.member_name_english || 'N/A';
    const id = item.id || item['S. No.'] || item.member_id || item.hospital_id || item.elected_id || item.doctor_id || item.committee_id;

    return (
      <div key={id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="font-bold text-gray-800 text-base mb-2">{displayName}</h3>
            <div className="space-y-1 text-sm text-gray-600">
              {item.type && <p><span className="font-medium">Type:</span> {item.type}</p>}
              {item.hospital_type && <p><span className="font-medium">Type:</span> {item.hospital_type}</p>}
              {item.position && <p><span className="font-medium">Position:</span> {item.position}</p>}
              {item.member_role && <p><span className="font-medium">Role:</span> {item.member_role}</p>}
              {item.designation && <p><span className="font-medium">Designation:</span> {item.designation}</p>}
              {item.Mobile && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <span>{item.Mobile}</span>
                </div>
              )}
              {item.Email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span className="text-xs">{item.Email}</span>
                </div>
              )}
              {item.address && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span className="text-xs">{item.address}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 pt-4 border-t border-gray-100">
          <button
            onClick={() => handleEdit(item)}
            className="flex-1 bg-indigo-50 text-indigo-600 px-3 py-2 rounded-lg font-medium hover:bg-indigo-100 flex items-center justify-center gap-2"
          >
            <Edit2 className="h-4 w-4" />
            Edit
          </button>
          <button
            onClick={() => handleDelete(item)}
            className="flex-1 bg-red-50 text-red-600 px-3 py-2 rounded-lg font-medium hover:bg-red-100 flex items-center justify-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 pb-10">
      {/* Search Section */}
      <div className="px-6 mt-4">
        <div className="bg-gray-50 rounded-2xl p-2 flex items-center gap-3 border border-gray-200 focus-within:border-indigo-300 transition-all shadow-sm">
          <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 ml-1">
            <Search className="h-5 w-5 text-indigo-600" />
          </div>
          <input
            type="text"
            placeholder={`Search ${tabs.find(t => t.id === activeTab)?.label}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent border-none focus:ring-0 text-gray-800 placeholder-gray-400 font-medium text-sm py-2"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 mt-6">
        <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSearchQuery('');
              }}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all text-xs tracking-tight ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100 border border-indigo-600'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
              }`}
            >
              <tab.icon className={`h-4 w-4 ${activeTab === tab.id ? 'text-white' : 'text-indigo-600'}`} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Add Button */}
      <div className="px-6 mt-4">
        <button
          onClick={handleAdd}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-indigo-700 flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Add New {tabs.find(t => t.id === activeTab)?.label}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-6 mt-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <p className="text-red-600 font-medium">{error}</p>
            <button 
              onClick={() => loadData(activeTab)}
              className="mt-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && !filteredData.length && (
        <div className="px-6 mt-4 text-center py-20">
          <Loader className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
          <p className="text-gray-600 mt-2">Loading...</p>
        </div>
      )}

      {/* Content List */}
      <div className="px-6 mt-4 space-y-4">
        {!loading && filteredData.length > 0 ? (
          filteredData.map(item => renderItemCard(item))
        ) : !loading ? (
          <div className="text-center py-20">
            <div className="bg-gray-50 h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-gray-300">
              <Search className="h-8 w-8 text-gray-300" />
            </div>
            <h3 className="text-gray-800 font-bold">No results found</h3>
            <p className="text-gray-500 text-sm mt-1">Try adding a new item or searching with different keywords</p>
          </div>
        ) : null}
      </div>

      {/* Form Modal */}
      {showAddForm && renderForm()}
    </div>
  );
};

export default AdminDirectory;

