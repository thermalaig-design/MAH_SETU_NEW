import { supabase } from './supabaseClient';

// Fetch trustees and patrons directly from Supabase using reg_members + Members tables
export const getTrusteesAndPatrons = async (trustId = null, trustName = null) => {
  try {
    let resolvedTrustId = trustId;

    if (!resolvedTrustId && trustName) {
      const { data: trustData } = await supabase
        .from('Trust')
        .select('id')
        .ilike('name', String(trustName).trim())
        .limit(1);
      resolvedTrustId = trustData?.[0]?.id || null;
    }

    // Use members_id (UUID FK) from reg_members to look up Members
    let membersIds = [];
    const roleByMembersId = new Map();
    const membershipNumberByMembersId = new Map();

    if (resolvedTrustId) {
      const batchSize = 1000;
      let from = 0;
      let hasMore = true;
      const rmRows = [];

      while (hasMore) {
        const { data: batch, error } = await supabase
          .from('reg_members')
          .select('members_id, role, "Membership number"')
          .eq('trust_id', resolvedTrustId)
          .or('is_active.is.null,is_active.eq.true')
          .range(from, from + batchSize - 1);
        if (error) throw error;
        if (batch && batch.length > 0) {
          rmRows.push(...batch);
          if (batch.length < batchSize) {
            hasMore = false;
          } else {
            from += batchSize;
          }
        } else {
          hasMore = false;
        }
      }

      const ids = (rmRows || []).map(r => r.members_id).filter(Boolean);
      (rmRows || []).forEach((row) => {
        if (!row.members_id) return;
        const key = String(row.members_id);
        if (!roleByMembersId.has(key)) {
          roleByMembersId.set(key, row.role || null);
        }
        const membershipNumber = row['Membership number'] || null;
        if (membershipNumber && !membershipNumberByMembersId.has(key)) {
          membershipNumberByMembersId.set(key, membershipNumber);
        }
      });
      if (ids.length > 0) membersIds = ids;
    }

    if (resolvedTrustId && membersIds.length === 0) {
      return { data: [] };
    }

    const chunkSize = 500;
    let allData = [];

    if (membersIds.length === 0) {
      // No trust filter — fetch all members
      const { data, error } = await supabase
        .from('Members')
        .select('*')
        .order('Name', { ascending: true });
      if (error) throw error;
      return { data: data || [] };
    }

    // Fetch members by members_id chunks
    for (let i = 0; i < membersIds.length; i += chunkSize) {
      const chunk = membersIds.slice(i, i + chunkSize);
      const { data, error } = await supabase
        .from('Members')
        .select('*')
        .in('members_id', chunk)
        .order('Name', { ascending: true });
      if (error) throw error;
      allData = [...allData, ...(data || [])];
    }

    // Enrich each member with their role from reg_members
    const enriched = allData.map((member) => {
      const mid = member?.members_id ? String(member.members_id) : null;
      const role = mid ? roleByMembersId.get(mid) : null;
      const membershipNumber = mid ? membershipNumberByMembersId.get(mid) : null;

      return {
        ...member,
        type: member?.type || role || member?.role || null,
        role: member?.role || role || null,
        'Membership number': membershipNumber || member?.['Membership number'] || null,
        // Normalize the S.No. field name (table uses "S.No." without space)
        'S. No.': member?.['S.No.'] ?? member?.['S. No.'] ?? null,
      };
    });
    const sorted = enriched.sort((a, b) => String(a?.Name || '').localeCompare(String(b?.Name || '')));
    return { data: sorted };
  } catch (err) {
    console.error('Error fetching trustees and patrons from Supabase:', err);
    throw err;
  }
};


// Fetch doctors from Members + reg_members + employee_details + opd_schedule (new schema)
export const getOpdDoctors = async (trustId = null, trustName = null) => {
  try {
    let resolvedTrustId = trustId;
    
    // Resolve trust_id from trust_name if needed
    if (!resolvedTrustId && trustName) {
      const { data: trustData } = await supabase
        .from('Trust')
        .select('id')
        .ilike('name', String(trustName).trim())
        .limit(1);
      resolvedTrustId = trustData?.[0]?.id || null;
    }
    
    let query = supabase
      .from('reg_members')
      .select(`
        id,
        trust_id,
        role,
        "Membership number",
        members_id,
        Members:members_id (
          "S.No.",
          "Name",
          "Mobile",
          "Email",
          "Address Home",
          "Company Name",
          "Address Office",
          "Resident Landline",
          "Office Landline",
          members_id
        ),
        employee_details!inner (
          designation,
          qualification,
          experience_years,
          doctor_image_url,
          department,
          unit,
          unit_notes,
          is_active
        ),
        opd_schedule (
          opd_type,
          opd_days,
          opd_start_time,
          opd_end_time,
          slot_duration_minutes,
          fees
        )
      `)
      .ilike('role', '%doctor%')
      .or('is_active.is.null,is_active.eq.true')
      .eq('employee_details.is_active', true);

    if (resolvedTrustId) {
      query = query.eq('trust_id', resolvedTrustId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const buildSchedule = (rows, type) => {
      const filtered = (rows || []).filter(r => String(r?.opd_type || '').toLowerCase() === type);
      const schedule = filtered.map(r => ({
        day: r.opd_days || null,
        start_time: r.opd_start_time || null,
        end_time: r.opd_end_time || null,
        slot_duration_minutes: r.slot_duration_minutes ?? null,
        fees: r.fees ?? null
      }));

      const dayText = [...new Set(filtered.map(r => r?.opd_days).filter(Boolean))].join(', ') || null;
      const first = schedule[0] || {};
      const fee = schedule.find(s => s.fees != null)?.fees ?? null;
      const duration = schedule.find(s => s.slot_duration_minutes != null)?.slot_duration_minutes ?? null;

      return {
        schedule,
        dayText,
        start: first.start_time || null,
        end: first.end_time || null,
        fee,
        duration
      };
    };

    const normalized = (data || []).map((row) => {
      const member = row.Members || {};
      const empDetailsRaw = row.employee_details;
      const detailsArr = Array.isArray(empDetailsRaw)
        ? empDetailsRaw
        : empDetailsRaw
        ? [empDetailsRaw]
        : [];
      const activeDetails = detailsArr.filter(d => d?.is_active !== false);
      if (activeDetails.length === 0) return null;
      const details = activeDetails[0];
      const schedules = row.opd_schedule || [];
      const general = buildSchedule(schedules, 'general');
      const privateOpd = buildSchedule(schedules, 'private');
      const fallbackDepartment =
        details.department ||
        details.unit ||
        details.unit_notes ||
        details.designation ||
        member?.['Company Name'] ||
        null;

      let imageUrl = details.doctor_image_url || null;
      if (imageUrl && typeof imageUrl === 'string') {
        if (imageUrl.startsWith('data:') || imageUrl.startsWith('http')) {
          // use as-is
        } else {
          const path = imageUrl.startsWith('/') ? imageUrl.slice(1) : imageUrl;
          try {
            const { data: urlData } = supabase.storage
              .from('doctor-images')
              .getPublicUrl(path);
            imageUrl = urlData?.publicUrl || imageUrl;
          } catch (e) {
            console.warn('Could not get public URL for doctor image:', path, e);
          }
        }
      }

      return {
        id: row.id,
        original_id: member?.['S.No.'] ?? member?.['S. No.'] ?? null,
        members_id: row.members_id || member?.members_id || null,
        trust_id: row.trust_id || null,
        Name: member?.Name || null,
        Mobile: member?.Mobile || null,
        Email: member?.Email || null,
        'Address Home': member?.['Address Home'] || null,
        'Company Name': member?.['Company Name'] || null,
        'Address Office': member?.['Address Office'] || null,
        'Resident Landline': member?.['Resident Landline'] || null,
        'Office Landline': member?.['Office Landline'] || null,
        type: row.role || 'Doctor',
        role: row.role || 'Doctor',
        'Membership number': row['Membership number'] || null,
        designation: details.designation || null,
        qualification: details.qualification || null,
        experience_years: details.experience_years || null,
        doctor_image_url: imageUrl,
        department: fallbackDepartment,
        unit: details.unit || null,
        unit_notes: details.unit_notes || null,
        consultant_name: member?.Name || null,
        general_opd_schedule: general.schedule || [],
        private_opd_schedule: privateOpd.schedule || [],
        general_opd_days: general.dayText,
        private_opd_days: privateOpd.dayText,
        general_opd_start: general.start,
        general_opd_end: general.end,
        private_opd_start: privateOpd.start,
        private_opd_end: privateOpd.end,
        slot_duration_minutes: general.duration || privateOpd.duration || null,
        general_fee: general.fee ?? null,
        private_fee: privateOpd.fee ?? null,
        consultation_fee: general.fee || privateOpd.fee || null
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(a?.Name || '').localeCompare(String(b?.Name || '')));

    return { success: true, data: normalized };
  } catch (err) {
    console.error('Error fetching doctors from reg_members/employee_details:', err);
    return { success: true, data: [] };
  }
};

// Fetch doctors with OPD schedule from reg_members + Members + employee_details + opd_schedule (new schema)
export const getDoctorsWithSchedule = async ({ trustId = null, trustName = null } = {}) => {
  try {
    let resolvedTrustId = trustId;

    if (!resolvedTrustId && trustName) {
      const { data: trustData } = await supabase
        .from('Trust')
        .select('id')
        .ilike('name', String(trustName).trim())
        .limit(1);
      resolvedTrustId = trustData?.[0]?.id || null;
    }

    let query = supabase
      .from('reg_members')
      .select(`
        id,
        trust_id,
        role,
        "Membership number",
        members_id,
        Members:members_id (
          "S.No.",
          "Name",
          "Mobile",
          "Email",
          "Address Home",
          "Company Name",
          "Address Office",
          "Resident Landline",
          "Office Landline",
          members_id
        ),
        employee_details!inner (
          designation,
          qualification,
          experience_years,
          doctor_image_url,
          department,
          unit,
          unit_notes,
          is_active
        ),
        opd_schedule!inner (
          opd_type,
          opd_days,
          opd_start_time,
          opd_end_time,
          slot_duration_minutes,
          fees
        )
      `)
      .ilike('role', '%doctor%')
      .or('is_active.is.null,is_active.eq.true');

    if (resolvedTrustId) {
      query = query.eq('trust_id', resolvedTrustId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const buildSchedule = (rows, type) => {
      const filtered = (rows || []).filter(r => String(r?.opd_type || '').toLowerCase() === type);
      const schedule = filtered.map(r => ({
        day: r.opd_days || null,
        start_time: r.opd_start_time || null,
        end_time: r.opd_end_time || null,
        slot_duration_minutes: r.slot_duration_minutes ?? null,
        fees: r.fees ?? null
      }));

      const dayText = [...new Set(filtered.map(r => r?.opd_days).filter(Boolean))].join(', ') || null;
      const first = schedule[0] || {};
      const fee = schedule.find(s => s.fees != null)?.fees ?? null;
      const duration = schedule.find(s => s.slot_duration_minutes != null)?.slot_duration_minutes ?? null;

      return {
        schedule,
        dayText,
        start: first.start_time || null,
        end: first.end_time || null,
        fee,
        duration
      };
    };

    const normalized = (data || [])
      .map((row) => {
        const member = row.Members || {};

        // employee_details can be an array (multiple rows) or a single object — handle both
        const empDetailsRaw = row.employee_details;
        const detailsArr = Array.isArray(empDetailsRaw)
          ? empDetailsRaw
          : empDetailsRaw
          ? [empDetailsRaw]
          : [];

        // Filter to only active employee_details rows; skip doctor if none remain
        const activeDetails = detailsArr.filter(d => d?.is_active !== false);
        if (activeDetails.length === 0) return null;

        const details = activeDetails[0]; // use first active detail row
        const schedules = row.opd_schedule || [];

        const general = buildSchedule(schedules, 'general');
        const privateOpd = buildSchedule(schedules, 'private');

        // Fallback chain: department → unit → unit_notes → designation → Company Name
        const fallbackDepartment =
          details.department ||
          details.unit ||
          details.unit_notes ||
          details.designation ||
          member?.['Company Name'] ||
          null;

        let imageUrl = details.doctor_image_url || null;
        if (imageUrl && typeof imageUrl === 'string') {
          if (imageUrl.startsWith('data:') || imageUrl.startsWith('http')) {
            // use as-is
          } else {
            const path = imageUrl.startsWith('/') ? imageUrl.slice(1) : imageUrl;
            try {
              const { data: urlData } = supabase.storage
                .from('doctor-images')
                .getPublicUrl(path);
              imageUrl = urlData?.publicUrl || imageUrl;
            } catch (e) {
              console.warn('Could not get public URL for doctor image:', path, e);
            }
          }
        }

        return {
          id: row.id,
          reg_id: row.id,
          original_id: member?.['S.No.'] ?? member?.['S. No.'] ?? null,
          members_id: row.members_id || member?.members_id || null,
          trust_id: row.trust_id || null,
          Name: member?.Name || null,
          Mobile: member?.Mobile || null,
          Email: member?.Email || null,
          'Address Home': member?.['Address Home'] || null,
          'Company Name': member?.['Company Name'] || null,
          'Address Office': member?.['Address Office'] || null,
          'Resident Landline': member?.['Resident Landline'] || null,
          'Office Landline': member?.['Office Landline'] || null,
          type: row.role || 'Doctor',
          role: row.role || 'Doctor',
          'Membership number': row['Membership number'] || null,
          designation: details.designation || null,
          qualification: details.qualification || null,
          experience_years: details.experience_years || null,
          doctor_image_url: imageUrl,
          department: fallbackDepartment,
          unit: details.unit || null,
          unit_notes: details.unit_notes || null,
          consultant_name: member?.Name || null,
          general_opd_schedule: general.schedule || [],
          private_opd_schedule: privateOpd.schedule || [],
          general_opd_days: general.dayText,
          private_opd_days: privateOpd.dayText,
          general_opd_start: general.start,
          general_opd_end: general.end,
          private_opd_start: privateOpd.start,
          private_opd_end: privateOpd.end,
          slot_duration_minutes: general.duration || privateOpd.duration || null,
          general_fee: general.fee ?? null,
          private_fee: privateOpd.fee ?? null,
          consultation_fee: general.fee || privateOpd.fee || null
        };
      })
      .filter(Boolean) // remove null entries (inactive / missing employee_details)
      .filter(d => (d.general_opd_schedule?.length > 0) || (d.private_opd_schedule?.length > 0)) // only doctors with OPD schedule
      .sort((a, b) => String(a?.Name || '').localeCompare(String(b?.Name || '')));

    return { success: true, data: normalized };
  } catch (err) {
    console.error('Error fetching doctors with schedule:', err);
    return { success: true, data: [] };
  }
};
