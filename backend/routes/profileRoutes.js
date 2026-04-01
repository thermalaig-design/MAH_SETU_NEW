import express from 'express';
import multer from 'multer';
import { supabase } from '../config/supabase.js';

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit for profile pictures
  fileFilter: (req, file, cb) => {
    
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);

    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, WEBP allowed.'));
    }
  }
});

// Get user profile
router.get('/', async (req, res) => {
  try {
    const userIdHeader = req.headers['user-id'];
    if (!userIdHeader) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    // Resolve member by membership number or mobile
    let { data: member, error: memberErr } = await supabase
      .from('Members')
      .select('*')
      .eq('Membership number', userIdHeader)
      .maybeSingle();

    if (memberErr) {
      console.error('Fetch Members error:', memberErr);
    }

    if (!member) {
      const { data: memberByMobile, error: mobileErr } = await supabase
        .from('Members')
        .select('*')
        .eq('Mobile', userIdHeader)
        .maybeSingle();
      if (mobileErr) {
        console.error('Fetch Members by mobile error:', mobileErr);
      }
      member = memberByMobile;
    }

    if (!member?.members_id) {
      return res.json({ success: true, profile: null });
    }

    const membersId = member.members_id;

    const { data: profile, error: profileErr } = await supabase
      .from('member_profiles')
      .select('*')
      .eq('members_id', membersId)
      .maybeSingle();

    if (profileErr) {
      console.error('Fetch member_profiles error:', profileErr);
      return res.status(500).json({ success: false, message: 'Failed to fetch profile' });
    }

    const { data: familyRows, error: famErr } = await supabase
      .from('family_members')
      .select('*')
      .eq('members_id', membersId)
      .order('created_at', { ascending: true });

    if (famErr) {
      console.error('Fetch family_members error:', famErr);
    }

    const mergedProfile = {
      name: member?.Name || '',
      role: member?.role || member?.Role || 'Trustee',
      memberId: member?.['Membership number'] || '',
      mobile: member?.Mobile || '',
      email: member?.Email || '',
      address_home: member?.['Address Home'] || '',
      address_office: member?.['Address Office'] || '',
      company_name: member?.['Company Name'] || '',
      resident_landline: member?.['Resident Landline'] || '',
      office_landline: member?.['Office Landline'] || '',
      gender: profile?.gender || '',
      marital_status: profile?.marital_status || '',
      nationality: profile?.nationality || '',
      aadhaar_id: profile?.aadhaar_id || '',
      blood_group: profile?.blood_group || '',
      dob: profile?.date_of_birth || '',
      emergency_contact_name: profile?.emergency_contact_name || '',
      emergency_contact_number: profile?.emergency_contact_number || '',
      profile_photo_url: profile?.profile_photo_url || '',
      spouse_name: profile?.spouse_name || '',
      spouse_contact_number: profile?.spouse_contact || '',
      children_count: profile?.no_of_children ?? '',
      facebook: profile?.facebook || '',
      twitter: profile?.twitter || '',
      instagram: profile?.instagram || '',
      linkedin: profile?.linkedin || '',
      whatsapp: profile?.whatsapp || '',
      family_members: familyRows || [],
      members_id: membersId
    };

    res.json({
      success: true,
      profile: mergedProfile
    });

  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Save/Update user profile
router.post('/save', upload.single('profilePhoto'), async (req, res) => {
  try {
    const userIdHeader = req.headers['user-id'];
    if (!userIdHeader) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const profileData = JSON.parse(req.body.profileData || '{}');
    const profilePhotoFile = req.file;

    let profilePhotoUrl = profileData.profilePhotoUrl || profileData.profile_photo_url || '';

    // Resolve member by membership number or mobile
    const lookupId = profileData.memberId || userIdHeader;
    let { data: member, error: memberErr } = await supabase
      .from('Members')
      .select('*')
      .eq('Membership number', lookupId)
      .maybeSingle();

    if (memberErr) {
      console.error('Fetch Members error:', memberErr);
    }

    if (!member) {
      const { data: memberByMobile, error: mobileErr } = await supabase
        .from('Members')
        .select('*')
        .eq('Mobile', lookupId)
        .maybeSingle();
      if (mobileErr) {
        console.error('Fetch Members by mobile error:', mobileErr);
      }
      member = memberByMobile;
    }

    if (!member?.members_id) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const membersId = member.members_id;

    // Upload profile picture if provided
    if (profilePhotoFile) {
      const fileName = `profiles/${membersId}/${Date.now()}_${profilePhotoFile.originalname}`;
      console.log('Attempting to upload profile photo to:', fileName);
      
      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(fileName, profilePhotoFile.buffer, {
          contentType: profilePhotoFile.mimetype,
          upsert: true
        });

      if (uploadError) {
        console.error('Profile photo upload error:', uploadError);
        console.error('Upload error details:', {
          message: uploadError.message,
          code: uploadError.code,
          statusCode: uploadError.statusCode
        });
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to upload profile photo',
          error: uploadError.message,
          details: uploadError
        });
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('profiles')
        .getPublicUrl(fileName);

      console.log('Successfully uploaded profile photo, public URL:', urlData.publicUrl);
      profilePhotoUrl = urlData.publicUrl;
    }

    const dbProfileData = {
      members_id: membersId,
      profile_photo_url: profilePhotoUrl || null,
      gender: profileData.gender || null,
      date_of_birth: profileData.dob || null,
      blood_group: profileData.blood_group || null,
      marital_status: profileData.marital_status || null,
      nationality: profileData.nationality || null,
      aadhaar_id: profileData.aadhaar_id || null,
      emergency_contact_name: profileData.emergency_contact_name || null,
      emergency_contact_number: profileData.emergency_contact_number || null,
      spouse_name: profileData.spouse_name || null,
      spouse_contact: profileData.spouse_contact_number || null,
      no_of_children: profileData.children_count ? parseInt(profileData.children_count, 10) : 0,
      facebook: profileData.facebook || null,
      twitter: profileData.twitter || null,
      instagram: profileData.instagram || null,
      linkedin: profileData.linkedin || null,
      whatsapp: profileData.whatsapp || null,
      updated_at: new Date().toISOString()
    };

    const { data: upsertedProfile, error: upsertErr } = await supabase
      .from('member_profiles')
      .upsert(dbProfileData, { onConflict: 'members_id' })
      .select()
      .maybeSingle();

    if (upsertErr) {
      console.error('DB error:', upsertErr);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to save profile',
        error: upsertErr.message
      });
    }

    // Sync family members
    const familyMembers = Array.isArray(profileData.family_members)
      ? profileData.family_members
      : [];

    const { error: deleteErr } = await supabase
      .from('family_members')
      .delete()
      .eq('members_id', membersId);

    if (deleteErr) {
      console.error('Family delete error:', deleteErr);
    }

    const cleanedFamily = familyMembers
      .filter(m => m && m.name && m.relation)
      .map(m => ({
        members_id: membersId,
        name: m.name,
        relation: m.relation,
        gender: m.gender || null,
        age: m.age ? parseInt(m.age, 10) : null,
        blood_group: m.blood_group || null,
        contact_no: m.contact_no || null
      }));

    if (cleanedFamily.length > 0) {
      const { error: famInsertErr } = await supabase
        .from('family_members')
        .insert(cleanedFamily);
      if (famInsertErr) {
        console.error('Family insert error:', famInsertErr);
      }
    }

    const responseProfile = {
      name: member?.Name || '',
      role: member?.role || member?.Role || 'Trustee',
      memberId: member?.['Membership number'] || '',
      mobile: member?.Mobile || '',
      email: member?.Email || '',
      address_home: member?.['Address Home'] || '',
      address_office: member?.['Address Office'] || '',
      company_name: member?.['Company Name'] || '',
      resident_landline: member?.['Resident Landline'] || '',
      office_landline: member?.['Office Landline'] || '',
      gender: upsertedProfile?.gender || '',
      marital_status: upsertedProfile?.marital_status || '',
      nationality: upsertedProfile?.nationality || '',
      aadhaar_id: upsertedProfile?.aadhaar_id || '',
      blood_group: upsertedProfile?.blood_group || '',
      dob: upsertedProfile?.date_of_birth || '',
      emergency_contact_name: upsertedProfile?.emergency_contact_name || '',
      emergency_contact_number: upsertedProfile?.emergency_contact_number || '',
      profile_photo_url: upsertedProfile?.profile_photo_url || profilePhotoUrl || '',
      spouse_name: upsertedProfile?.spouse_name || '',
      spouse_contact_number: upsertedProfile?.spouse_contact || '',
      children_count: upsertedProfile?.no_of_children ?? '',
      facebook: upsertedProfile?.facebook || '',
      twitter: upsertedProfile?.twitter || '',
      instagram: upsertedProfile?.instagram || '',
      linkedin: upsertedProfile?.linkedin || '',
      whatsapp: upsertedProfile?.whatsapp || '',
      family_members: cleanedFamily,
      members_id: membersId
    };

    res.json({
      success: true,
      message: 'Profile saved successfully',
      profile: responseProfile
    });

  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get profile photos for multiple members
router.post('/photos', async (req, res) => {
  try {
    const { memberIds } = req.body;
    
    if (!memberIds || !Array.isArray(memberIds)) {
      return res.status(400).json({ success: false, message: 'memberIds array is required' });
    }

    const uniqIds = Array.from(new Set(memberIds.filter(Boolean)));
    if (uniqIds.length === 0) {
      return res.json({ success: true, photos: {} });
    }

    const { data: membersByNumber } = await supabase
      .from('Members')
      .select('members_id, "Membership number", Mobile')
      .in('Membership number', uniqIds);

    const { data: membersByMobile } = await supabase
      .from('Members')
      .select('members_id, "Membership number", Mobile')
      .in('Mobile', uniqIds);

    const memberMap = new Map();
    [...(membersByNumber || []), ...(membersByMobile || [])].forEach(m => {
      if (m?.members_id) memberMap.set(String(m.members_id), m);
    });

    const membersIdList = Array.from(memberMap.keys());
    if (membersIdList.length === 0) {
      return res.json({ success: true, photos: {} });
    }

    const { data: profiles, error } = await supabase
      .from('member_profiles')
      .select('members_id, profile_photo_url')
      .in('members_id', membersIdList)
      .not('profile_photo_url', 'is', null);

    if (error) {
      console.error('Fetch profile photos error:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch profile photos' });
    }

    const photoMap = {};
    (profiles || []).forEach(p => {
      const member = memberMap.get(String(p.members_id));
      if (!member) return;
      if (member['Membership number']) photoMap[member['Membership number']] = p.profile_photo_url;
      if (member.Mobile) photoMap[member.Mobile] = p.profile_photo_url;
      photoMap[p.members_id] = p.profile_photo_url;
    });
    
    res.json({
      success: true,
      photos: photoMap
    });
    
  } catch (error) {
    console.error('Fetch profile photos error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;

