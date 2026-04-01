import { supabase } from './supabaseClient';

export const fetchMemberTrusts = async (membersId) => {
  if (!membersId) return [];

  const { data: memberships, error: membershipError } = await supabase
    .from('reg_members')
    .select('id, trust_id, "Membership number", role, joined_date, is_active, members_id')
    .eq('members_id', membersId);

  if (membershipError) {
    throw membershipError;
  }

  const trustIds = Array.from(
    new Set((memberships || []).map((m) => m.trust_id).filter(Boolean))
  );

  if (trustIds.length === 0) return [];

  const { data: trusts, error: trustError } = await supabase
    .from('Trust')
    .select('id,name,icon_url,remark')
    .in('id', trustIds);

  if (trustError) {
    throw trustError;
  }

  const trustById = (trusts || []).reduce((acc, t) => {
    acc[t.id] = t;
    return acc;
  }, {});

  return (memberships || []).map((m) => {
    const t = trustById[m.trust_id] || {};
    return {
      id: m.trust_id || null,
      name: t.name || null,
      icon_url: t.icon_url || null,
      remark: t.remark || null,
      is_active: m.is_active,
      membership_number: m['Membership number'] || null,
      role: m.role || null,
      members_id: m.members_id || null
    };
  });
};

export const fetchAllTrusts = async () => {
  const { data, error } = await supabase
    .from('Trust')
    .select('id,name,icon_url,remark,created_at')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
};

export const fetchDefaultTrust = async (preferredTrustId) => {
  let query = supabase
    .from('Trust')
    .select('id,name,icon_url,remark,terms_content,privacy_content,created_at')
    .limit(1);

  if (preferredTrustId) {
    query = query.eq('id', preferredTrustId);
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  if (Array.isArray(data)) {
    return data[0] || null;
  }

  return data || null;
};

export const fetchTrustByName = async (name) => {
  if (!name) return null;
  const { data, error } = await supabase
    .from('Trust')
    .select('id,name,icon_url,remark,terms_content,privacy_content,created_at')
    .eq('name', name)
    .limit(1);

  if (error) {
    throw error;
  }

  if (Array.isArray(data)) {
    return data[0] || null;
  }

  return data || null;
};

export const fetchTrustById = async (id) => {
  if (!id) return null;
  const { data, error } = await supabase
    .from('Trust')
    .select('id,name,icon_url,remark,terms_content,privacy_content,created_at')
    .eq('id', id)
    .limit(1);

  if (error) {
    throw error;
  }

  if (Array.isArray(data)) {
    return data[0] || null;
  }

  return data || null;
};
