import axios from 'axios';

// Use localhost for development, production URL for deployed app
const API_BASE_URL = import.meta.env.DEV 
  ? 'http://31.97.205.94:5002/api'
  : 'http://31.97.205.94:5002/api';

// Create axios instance
export const adminApi = axios.create({
  baseURL: API_BASE_URL,
});

// ==================== MEMBERS TABLE CRUD ====================
export const getAllMembersAdmin = async () => {
  try {
    const response = await adminApi.get('/admin/members');
    return response.data;
  } catch (error) {
    console.error('Error fetching all members:', error);
    throw error;
  }
};

export const getMemberByIdAdmin = async (id) => {
  try {
    const response = await adminApi.get(`/admin/members/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching member:', error);
    throw error;
  }
};

export const createMember = async (memberData) => {
  try {
    const response = await adminApi.post('/admin/members', memberData);
    return response.data;
  } catch (error) {
    console.error('Error creating member:', error);
    throw error;
  }
};

export const updateMember = async (id, memberData) => {
  try {
    const response = await adminApi.put(`/admin/members/${id}`, memberData);
    return response.data;
  } catch (error) {
    console.error('Error updating member:', error);
    throw error;
  }
};

export const deleteMember = async (id) => {
  try {
    const response = await adminApi.delete(`/admin/members/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting member:', error);
    throw error;
  }
};

// ==================== HOSPITALS TABLE CRUD ====================
export const getAllHospitalsAdmin = async () => {
  try {
    const response = await adminApi.get('/admin/hospitals');
    return response.data;
  } catch (error) {
    console.error('Error fetching hospitals:', error);
    throw error;
  }
};

export const getHospitalByIdAdmin = async (id) => {
  try {
    const response = await adminApi.get(`/admin/hospitals/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching hospital:', error);
    throw error;
  }
};

export const createHospital = async (hospitalData) => {
  try {
    const response = await adminApi.post('/admin/hospitals', hospitalData);
    return response.data;
  } catch (error) {
    console.error('Error creating hospital:', error);
    throw error;
  }
};

export const updateHospital = async (id, hospitalData) => {
  try {
    const response = await adminApi.put(`/admin/hospitals/${id}`, hospitalData);
    return response.data;
  } catch (error) {
    console.error('Error updating hospital:', error);
    throw error;
  }
};

export const deleteHospital = async (id) => {
  try {
    const response = await adminApi.delete(`/admin/hospitals/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting hospital:', error);
    throw error;
  }
};

// ==================== ELECTED MEMBERS TABLE CRUD ====================
export const getAllElectedMembersAdmin = async () => {
  try {
    const response = await adminApi.get('/admin/elected-members');
    return response.data;
  } catch (error) {
    console.error('Error fetching elected members:', error);
    throw error;
  }
};

export const getElectedMemberByIdAdmin = async (id) => {
  try {
    const response = await adminApi.get(`/admin/elected-members/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching elected member:', error);
    throw error;
  }
};

export const createElectedMember = async (electedData) => {
  try {
    const response = await adminApi.post('/admin/elected-members', electedData);
    return response.data;
  } catch (error) {
    console.error('Error creating elected member:', error);
    throw error;
  }
};

export const updateElectedMember = async (id, electedData) => {
  try {
    const response = await adminApi.put(`/admin/elected-members/${id}`, electedData);
    return response.data;
  } catch (error) {
    console.error('Error updating elected member:', error);
    throw error;
  }
};

export const deleteElectedMember = async (id) => {
  try {
    const response = await adminApi.delete(`/admin/elected-members/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting elected member:', error);
    throw error;
  }
};

// ==================== COMMITTEE MEMBERS TABLE CRUD ====================
export const getAllCommitteeMembersAdmin = async () => {
  try {
    const response = await adminApi.get('/admin/committee-members');
    return response.data;
  } catch (error) {
    console.error('Error fetching committee members:', error);
    throw error;
  }
};

export const getCommitteeMemberByIdAdmin = async (id) => {
  try {
    const response = await adminApi.get(`/admin/committee-members/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching committee member:', error);
    throw error;
  }
};

export const createCommitteeMember = async (committeeData) => {
  try {
    const response = await adminApi.post('/admin/committee-members', committeeData);
    return response.data;
  } catch (error) {
    console.error('Error creating committee member:', error);
    throw error;
  }
};

export const updateCommitteeMember = async (id, committeeData) => {
  try {
    const response = await adminApi.put(`/admin/committee-members/${id}`, committeeData);
    return response.data;
  } catch (error) {
    console.error('Error updating committee member:', error);
    throw error;
  }
};

export const deleteCommitteeMember = async (id) => {
  try {
    const response = await adminApi.delete(`/admin/committee-members/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting committee member:', error);
    throw error;
  }
};

// ==================== DOCTORS (OPD_SCHEDULE) TABLE CRUD ====================
export const getAllDoctorsAdmin = async () => {
  try {
    const response = await adminApi.get('/admin/doctors');
    return response.data;
  } catch (error) {
    console.error('Error fetching doctors:', error);
    throw error;
  }
};

export const getDoctorByIdAdmin = async (id) => {
  try {
    const response = await adminApi.get(`/admin/doctors/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching doctor:', error);
    throw error;
  }
};

export const createDoctor = async (doctorData) => {
  try {
    const response = await adminApi.post('/admin/doctors', doctorData);
    return response.data;
  } catch (error) {
    console.error('Error creating doctor:', error);
    throw error;
  }
};

export const updateDoctor = async (id, doctorData) => {
  try {
    const response = await adminApi.put(`/admin/doctors/${id}`, doctorData);
    return response.data;
  } catch (error) {
    console.error('Error updating doctor:', error);
    throw error;
  }
};

export const deleteDoctor = async (id) => {
  try {
    const response = await adminApi.delete(`/admin/doctors/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting doctor:', error);
    throw error;
  }
};

