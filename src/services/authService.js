// authService.js - Frontend auth helpers
import { supabase } from './supabaseClient';
const resolveDevAuthApiUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:5002/api/auth';

  const protocol = window.location.protocol || 'http:';
  const hostname = window.location.hostname || 'localhost';
  return `${protocol}//${hostname}:5002/api/auth`;
};

const API_URL = import.meta.env.VITE_AUTH_API_URL ||
  (import.meta.env.DEV
    ? resolveDevAuthApiUrl()
    : 'https://mah.contractmitra.in/api/auth');

const USE_MOCK_AUTH = import.meta.env.VITE_AUTH_MOCK === 'true';
const MOCK_OTP = '123456';

const buildMockUser = (phoneNumber) => ({
  id: phoneNumber,
  mobile: phoneNumber,
  name: 'Test User',
  type: 'Trustee',
  isRegisteredMember: false,
  vip_status: null,
  reg_member_id: null
});

const normalizePhone = (value) => String(value || '').replace(/\D/g, '');


/**
 * Check phone number and send OTP
 * Also checks reg_members for registered membership and vip_entry for VIP/VVIP status.
 */
export const checkPhoneNumber = async (phoneNumber) => {
  try {
    if (USE_MOCK_AUTH) {
      return {
        success: true,
        message: 'Mocked: phone verified',
        data: { user: buildMockUser(phoneNumber) }
      };
    }

    const cleanedPhone = normalizePhone(phoneNumber);
    if (!cleanedPhone || cleanedPhone.length < 10) {
      return { success: false, message: 'Please enter a valid 10-digit mobile number.' };
    }

    // 1) Find member by mobile in "Members" table
    const { data: members, error: memberError } = await supabase
      .from('Members')
      .select('"S.No.", "Name", "Mobile", "Email", members_id')
      .eq('Mobile', cleanedPhone)
      .order('"S.No."', { ascending: false })
      .limit(10);

    if (memberError) {
      console.error('Supabase member lookup error:', memberError);
      return { success: false, message: 'Unable to verify number. Please try again.' };
    }

    if (!members || members.length === 0) {
      // Auto-register new member with just the mobile number.
      const { data: newMember, error: insertError } = await supabase
        .from('Members')
        .insert({ Mobile: cleanedPhone })
        .select('"S.No.", "Name", "Mobile", "Email", members_id')
        .single();

      if (insertError) {
        console.error('Supabase member insert error:', insertError);
        return { success: false, message: 'Unable to register number. Please try again.' };
      }

      const fallbackUser = {
        id: newMember?.members_id || newMember?.['S.No.'] || cleanedPhone,
        name: newMember?.['Name'] || 'Guest User',
        mobile: newMember?.['Mobile'] || cleanedPhone,
        email: newMember?.['Email'] || '',
        type: 'Guest',
        membershipNumber: '',
        trust: null,
        hospital_memberships: [],
        // ── New fields ──
        isRegisteredMember: false,
        vip_status: null,
        reg_member_id: null
      };

      return {
        success: true,
        message: 'Mobile verified',
        data: { user: fallbackUser }
      };
    }

    const member = members[0];
    const membersIds = members.map((m) => m.members_id).filter(Boolean);

    // 2) Find trust memberships via reg_members
    let hospitalMemberships = [];
    let isRegisteredMember = false;
    let reg_member_id = null;
    let vip_status = null;

    if (membersIds.length > 0) {
      const { data: regMemberships, error: memberShipError } = await supabase
        .from('reg_members')
        .select('id, trust_id, "Membership number", role, is_active, members_id, joined_date')
        .in('members_id', membersIds);

      if (memberShipError) {
        console.error('Supabase membership lookup error:', memberShipError);
        return { success: false, message: 'Unable to verify membership. Please try again.' };
      }

      const activeMemberships = (Array.isArray(regMemberships) ? regMemberships : [])
        .filter(m => membersIds.includes(m.members_id));

      const trustIds = Array.from(
        new Set(activeMemberships.map((m) => m.trust_id).filter(Boolean))
      );

      let trustsById = {};
      if (trustIds.length > 0) {
        const { data: trustRows, error: trustError } = await supabase
          .from('Trust')
          .select('id, name, icon_url, remark')
          .in('id', trustIds);

        if (!trustError && Array.isArray(trustRows)) {
          trustsById = trustRows.reduce((acc, row) => {
            acc[row.id] = row;
            return acc;
          }, {});
        }
      }

      hospitalMemberships = activeMemberships.map((m) => {
        const t = trustsById[m.trust_id] || null;
        return {
          id: m.id || null,
          trust_id: m.trust_id || null,
          trust_name: t?.name || null,
          trust_icon_url: t?.icon_url || null,
          trust_remark: t?.remark || null,
          is_active: m.is_active,
          membership_number: m['Membership number'] || null,
          role: m.role || null,
          members_id: m.members_id || null
        };
      });

      // ── Check registered member status ──
      // A user is a registeredMember if:
      //   - has at least one reg_members row with a trust_id
      //   - role is Trustee or Patron (case-insensitive)
      //   - members_id is set
      const qualifiedMembership = activeMemberships.find(m =>
        m.trust_id &&
        m.members_id &&
        ['trustee', 'patron'].includes((m.role || '').toLowerCase())
      );

      if (qualifiedMembership) {
        isRegisteredMember = true;
        reg_member_id = qualifiedMembership.id;

        // ── Check vip_entry for VIP / VVIP status ──
        const regIds = activeMemberships.map(m => m.id).filter(Boolean);
        if (regIds.length > 0) {
          const { data: vipRows, error: vipError } = await supabase
            .from('vip_entry')
            .select('id, trust_id, reg_id, type, is_active')
            .in('reg_id', regIds)
            .eq('is_active', true)
            .limit(5);

          if (!vipError && Array.isArray(vipRows) && vipRows.length > 0) {
            // Prefer VVIP over VIP
            const vvip = vipRows.find(v => v.type === 'VVIP');
            vip_status = vvip ? 'VVIP' : vipRows[0].type;
            console.log('👑 VIP status found:', vip_status);
          }
        }
      }
    }

    const primaryTrust =
      hospitalMemberships.find((m) => m.is_active && m.trust_id) ||
      hospitalMemberships[0] ||
      null;

    const trust = primaryTrust?.trust_id
      ? { id: primaryTrust.trust_id, name: primaryTrust.trust_name, icon_url: primaryTrust.trust_icon_url, remark: primaryTrust.trust_remark }
      : null;

    const primaryMembership = hospitalMemberships[0] || null;
    const user = {
      id: member.members_id || member['S.No.'],
      name: member['Name'] || '',
      mobile: member['Mobile'] || cleanedPhone,
      email: member['Email'] || '',
      type: primaryMembership?.role || 'Trustee',
      membershipNumber: primaryMembership?.membership_number || '',
      trust,
      // ── New fields ──
      isRegisteredMember,
      vip_status,
      reg_member_id
    };

    if (trust) {
      user.primary_trust = {
        id: trust.id,
        name: trust.name,
        icon_url: trust.icon_url,
        remark: trust.remark || null,
        is_active: true
      };
    }
    user.hospital_memberships = hospitalMemberships;

    console.log(`✅ User check complete — isRegisteredMember: ${isRegisteredMember}, vip_status: ${vip_status}`);

    return {
      success: true,
      message: 'Mobile verified',
      data: { user }
    };
  } catch (error) {
    console.error('Error checking phone:', error);
    throw error;
  }
};

/**
 * Verify OTP
 */
export const verifyOTP = async (phoneNumber, otp) => {
  try {
    // Static OTP for now (no live OTP)
    if (otp === MOCK_OTP) {
      return { success: true, message: 'OTP verified' };
    }
    return { success: false, message: 'Invalid OTP. Use 123456.' };
  } catch (error) {
    console.error('Error verifying OTP:', error);
    throw error;
  }
};

/**
 * Special login for phone number 9911334455
 */
export const specialLogin = async (phoneNumber, passcode) => {
  try {
    // Static passcode for now (no live special login)
    if (passcode === MOCK_OTP) {
      return { success: true, message: 'Passcode verified' };
    }
    return { success: false, message: 'Invalid passcode. Use 123456.' };
  } catch (error) {
    console.error('Error in special login:', error);
    throw error;
  }
};
