import { supabase } from '../config/supabase.js';

// ─── Helper: today's date in IST ───────────────────────────────────────────
const getTodayIST = () => {
  const now = new Date();
  // UTC+5:30
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  const mm = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(istDate.getUTCDate()).padStart(2, '0');
  return { month: mm, day: dd, year: String(istDate.getUTCFullYear()) };
};

export const registerDeviceToken = async (req, res) => {
  try {
    const { userId, token, platform } = req.body;

    if (!userId || !token) {
      return res.status(400).json({ success: false, message: 'userId and token are required' });
    }

    const payload = {
      user_id: String(userId).trim(),
      token: String(token).trim(),
      platform: String(platform || 'android').toLowerCase(),
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('notification_devices')
      .upsert(payload, { onConflict: 'user_id,token' });

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.json({ success: true, message: 'Device token registered' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const unregisterDeviceToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'token is required' });
    }

    const { error } = await supabase
      .from('notification_devices')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('token', String(token).trim());

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.json({ success: true, message: 'Device token unregistered' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get user notifications
export const getNotifications = async (req, res) => {
  try {
    const userId = req.headers['user-id'];

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    console.log(`🔍 Fetching notifications for user: ${userId}`);

    let allNotifications = [];

    // Approach 1: Direct match by phone number (primary method)
    const { data: phoneNotifications, error: phoneError } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!phoneError && phoneNotifications && phoneNotifications.length > 0) {
      console.log(`📱 Found ${phoneNotifications.length} notifications by phone number`);
      allNotifications = [...phoneNotifications];
    }

    // Approach 2: Find patient names associated with this phone number from appointments
    // This handles cases where notifications were created with patient_name as user_id
    const { data: appointments, error: appointmentError } = await supabase
      .from('appointments')
      .select('patient_name, patient_phone')
      .eq('patient_phone', userId)
      .limit(100);

    if (!appointmentError && appointments && appointments.length > 0) {
      // Get unique patient names for this phone number
      const patientNames = [...new Set(appointments.map(apt => apt.patient_name.trim()))];
      console.log(`👤 Found ${patientNames.length} patient name(s) for phone ${userId}: ${patientNames.join(', ')}`);

      // Fetch notifications where user_id matches any of these patient names
      if (patientNames.length > 0) {
        const { data: nameNotifications, error: nameError } = await supabase
          .from('notifications')
          .select('*')
          .in('user_id', patientNames)
          .order('created_at', { ascending: false });

        if (!nameError && nameNotifications && nameNotifications.length > 0) {
          console.log(`📋 Found ${nameNotifications.length} additional notifications by patient name(s)`);
          // Merge with existing notifications
          allNotifications = [...allNotifications, ...nameNotifications];
        }
      }
    }

    // Approach 3: Also check referrals table for user_phone/user_id matches
    // This ensures referral notifications are also fetched
    const { data: referrals, error: referralError } = await supabase
      .from('referrals')
      .select('user_id, user_phone, user_name')
      .or(`user_phone.eq.${userId},user_id.eq.${userId}`)
      .limit(100);

    if (!referralError && referrals && referrals.length > 0) {
      // Get unique user identifiers from referrals
      const referralUserIds = [...new Set(
        referrals
          .map(ref => ref.user_phone || ref.user_id)
          .filter(id => id && id !== userId) // Exclude already matched userId
      )];

      if (referralUserIds.length > 0) {
        console.log(`🔗 Found ${referralUserIds.length} referral user ID(s) for phone ${userId}`);

        // Fetch notifications where user_id matches any of these referral user IDs
        const { data: referralNotifications, error: refNotifError } = await supabase
          .from('notifications')
          .select('*')
          .in('user_id', referralUserIds)
          .order('created_at', { ascending: false });

        if (!refNotifError && referralNotifications && referralNotifications.length > 0) {
          console.log(`📋 Found ${referralNotifications.length} additional notifications from referrals`);
          // Merge with existing notifications
          allNotifications = [...allNotifications, ...referralNotifications];
        }
      }
    }

    // Approach 4: Fetch admin broadcast notifications based on user's member type (Trustee/Patron)
    // Look up the user's type in the Members Table using their mobile number
    // Try multiple matching strategies since mobile format can vary
    let memberType = null;

    try {
      // Strategy 1: Exact match on Mobile column
      const { data: exactMatch, error: exactError } = await supabase
        .from('Members Table')
        .select('type, Mobile')
        .eq('Mobile', userId)
        .limit(1)
        .maybeSingle();

      console.log(`🔍 [Approach4] Exact Mobile match for "${userId}":`, exactMatch ? `type=${exactMatch.type}` : 'not found', exactError ? `err=${exactError.message}` : '');

      if (!exactError && exactMatch && exactMatch.type) {
        memberType = exactMatch.type;
      }

      // Strategy 2: Try last 10 digits (removes +91 prefix etc.)
      if (!memberType) {
        const last10 = String(userId).replace(/\D/g, '').slice(-10);
        if (last10 && last10 !== userId) {
          const { data: last10Match, error: last10Error } = await supabase
            .from('Members Table')
            .select('type, Mobile')
            .ilike('Mobile', `%${last10}`)
            .limit(1)
            .maybeSingle();

          console.log(`🔍 [Approach4] Last-10 match for "${last10}":`, last10Match ? `type=${last10Match.type}, Mobile=${last10Match.Mobile}` : 'not found');

          if (!last10Error && last10Match && last10Match.type) {
            memberType = last10Match.type;
          }
        }
      }

      // Strategy 3: ilike contains search
      if (!memberType) {
        const digits = String(userId).replace(/\D/g, '').slice(-10);
        if (digits) {
          const { data: containsMatch, error: containsError } = await supabase
            .from('Members Table')
            .select('type, Mobile')
            .ilike('Mobile', `%${digits}%`)
            .limit(1)
            .maybeSingle();

          console.log(`🔍 [Approach4] Contains match for "%${digits}%":`, containsMatch ? `type=${containsMatch.type}, Mobile=${containsMatch.Mobile}` : 'not found', containsError ? `err=${containsError.message}` : '');

          if (!containsError && containsMatch && containsMatch.type) {
            memberType = containsMatch.type;
          }
        }
      }

      console.log(`🏷️ [Approach4] Final memberType for ${userId}: ${memberType || 'NOT FOUND'}`);

      // Only fetch broadcast notifications for Trustee or Patron members
      if (memberType && (memberType === 'Trustee' || memberType === 'Patron')) {
        const { data: broadcastNotifications, error: broadcastError } = await supabase
          .from('notifications')
          .select('*')
          .in('target_audience', [memberType, 'Both'])
          .order('created_at', { ascending: false });

        console.log(`📢 [Approach4] Broadcast query for [${memberType}, Both]:`, broadcastNotifications ? `${broadcastNotifications.length} found` : 'none', broadcastError ? `err=${broadcastError.message}` : '');

        if (!broadcastError && broadcastNotifications && broadcastNotifications.length > 0) {
          allNotifications = [...allNotifications, ...broadcastNotifications];
        }
      } else if (memberType) {
        // Member found but type is not Trustee/Patron — still check 'Both' notifications
        console.log(`ℹ️ [Approach4] Member type "${memberType}" is not Trustee/Patron, skipping broadcast`);
      } else {
        console.log(`ℹ️ [Approach4] No member type found for ${userId} — skipping broadcast notifications`);
      }
    } catch (approachFourError) {
      console.error('⚠️ [Approach4] Error during member type lookup:', approachFourError?.message || approachFourError);
    }

    // Remove duplicates based on notification id
    const uniqueNotifications = allNotifications.filter((notification, index, self) =>
      index === self.findIndex(n => n.id === notification.id)
    );

    // Sort by created_at descending (newest first)
    uniqueNotifications.sort((a, b) => {
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);
      return dateB - dateA;
    });

    console.log(`✅ Returning ${uniqueNotifications.length} total unique notifications`);

    res.json({ success: true, data: uniqueNotifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Mark notification as read
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers['user-id'];

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    // First, verify the notification exists for this user
    const { data: existingNotification, error: fetchError } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', id)
      .limit(1);

    if (fetchError) {
      throw fetchError;
    }

    if (!existingNotification || existingNotification.length === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    // Update the notification
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Mark all as read
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.headers['user-id'];

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    // Get all unread notifications using the same matching logic as getNotifications
    let notificationIds = [];

    // Approach 1: Get notifications by phone number
    const { data: phoneNotifications, error: phoneError } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('is_read', false);

    if (!phoneError && phoneNotifications) {
      notificationIds = phoneNotifications.map(n => n.id);
    }

    // Approach 2: Get patient names for this phone number
    const { data: appointments, error: appointmentError } = await supabase
      .from('appointments')
      .select('patient_name')
      .eq('patient_phone', userId)
      .limit(100);

    if (!appointmentError && appointments && appointments.length > 0) {
      const patientNames = [...new Set(appointments.map(apt => apt.patient_name.trim()))];

      if (patientNames.length > 0) {
        const { data: nameNotifications, error: nameError } = await supabase
          .from('notifications')
          .select('id')
          .in('user_id', patientNames)
          .eq('is_read', false);

        if (!nameError && nameNotifications) {
          const nameNotificationIds = nameNotifications.map(n => n.id);
          notificationIds = [...notificationIds, ...nameNotificationIds];
        }
      }
    }

    // Approach 3: Also check referrals table for user_phone/user_id matches
    const { data: referrals, error: referralError } = await supabase
      .from('referrals')
      .select('user_id, user_phone')
      .or(`user_phone.eq.${userId},user_id.eq.${userId}`)
      .limit(100);

    if (!referralError && referrals && referrals.length > 0) {
      const referralUserIds = [...new Set(
        referrals
          .map(ref => ref.user_phone || ref.user_id)
          .filter(id => id && id !== userId)
      )];

      if (referralUserIds.length > 0) {
        const { data: referralNotifications, error: refNotifError } = await supabase
          .from('notifications')
          .select('id')
          .in('user_id', referralUserIds)
          .eq('is_read', false);

        if (!refNotifError && referralNotifications) {
          const refNotificationIds = referralNotifications.map(n => n.id);
          notificationIds = [...notificationIds, ...refNotificationIds];
        }
      }
    }

    // Remove duplicates
    const uniqueNotificationIds = [...new Set(notificationIds)];

    if (uniqueNotificationIds.length === 0) {
      return res.json({ success: true, message: 'No unread notifications found' });
    }

    // Mark all as read
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', uniqueNotificationIds);

    if (error) throw error;

    res.json({ success: true, message: `Marked ${uniqueNotificationIds.length} notifications as read` });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Check & create birthday notifications ──────────────────────────────────
export const checkBirthdayNotifications = async (req, res) => {
  try {
    const userId = req.headers['user-id'];

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    const { month, day, year } = getTodayIST();
    const todayStr = `${year}-${month}-${day}`; // e.g. 2026-02-24

    console.log(`🎂 Checking birthday for user ${userId} on ${todayStr}`);

    // 1. Find the user's profile by mobile number
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('name, dob, mobile, user_identifier')
      .or(`mobile.eq.${userId},user_identifier.eq.${userId}`)
      .limit(1)
      .single();

    if (profileError || !profile) {
      console.log(`ℹ️ No profile found for user ${userId}`);
      return res.json({ success: true, birthdayToday: false });
    }

    if (!profile.dob) {
      return res.json({ success: true, birthdayToday: false });
    }

    // 2. Extract month+day from DOB (format: YYYY-MM-DD)
    const dobParts = profile.dob.split('-');
    if (dobParts.length < 3) {
      return res.json({ success: true, birthdayToday: false });
    }
    const dobMonth = dobParts[1]; // MM
    const dobDay = dobParts[2].substring(0, 2); // DD (trim time if any)

    const isBirthday = dobMonth === month && dobDay === day;

    if (!isBirthday) {
      return res.json({ success: true, birthdayToday: false });
    }

    const userName = profile.name || 'Member';
    console.log(`🎉 Birthday match! User: ${userName}`);

    // 3. Check if birthday notification already sent today
    const { data: existing, error: checkError } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'birthday')
      .gte('created_at', `${todayStr}T00:00:00.000Z`)
      .limit(1);

    if (!checkError && existing && existing.length > 0) {
      console.log(`ℹ️ Birthday notification already sent today to ${userId}`);
      return res.json({ success: true, birthdayToday: true, alreadySent: true, name: userName });
    }

    // 4. Insert birthday notification into notifications table
    const birthdayMessage = `🎂 Maharaja Agrasen Samiti ki taraf se aapko janamdin ki hardik shubhkamnayein, ${userName} ji! Aapka yeh din bahut khaas ho! 🎉🎊`;

    const { error: insertError } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title: '🎂 Happy Birthday!',
        message: birthdayMessage,
        type: 'birthday',
        is_read: false,
        created_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('Error inserting birthday notification:', insertError);
      // Still return birthdayToday: true so app can show local notification
    } else {
      console.log(`✅ Birthday notification inserted for ${userName} (${userId})`);
    }

    return res.json({
      success: true,
      birthdayToday: true,
      alreadySent: false,
      name: userName,
      message: birthdayMessage,
    });
  } catch (error) {
    console.error('Error checking birthday notifications:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Admin: Send broadcast notification to Trustee / Patron / Both ──────────
export const sendAdminNotification = async (req, res) => {
  try {
    const { title, message, target_audience } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and message are required' });
    }

    const validAudiences = ['Trustee', 'Patron', 'Both'];
    if (!validAudiences.includes(target_audience)) {
      return res.status(400).json({ success: false, message: 'target_audience must be Trustee, Patron, or Both' });
    }

    console.log(`📢 Admin sending notification to ${target_audience}: "${title}"`);

    const { error: insertError } = await supabase
      .from('notifications')
      .insert({
        user_id: `ADMIN_BROADCAST_${target_audience}`,
        title: title.trim(),
        message: message.trim(),
        type: 'admin_message',
        target_audience: target_audience,
        is_read: false,
        created_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('Error inserting admin notification:', insertError);
      return res.status(500).json({ success: false, message: 'Failed to insert notification: ' + insertError.message });
    }

    console.log(`✅ Admin notification sent to ${target_audience} members`);
    return res.json({ success: true, message: `Notification sent to all ${target_audience} members!` });
  } catch (error) {
    console.error('Error sending admin notification:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Delete a specific notification
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers['user-id'];

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    // First, verify the notification exists
    const { data: existingNotification, error: fetchError } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', id)
      .limit(1);

    if (fetchError) {
      throw fetchError;
    }

    if (!existingNotification || existingNotification.length === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    const notification = existingNotification[0];
    let isAuthorized = false;

    // 1. Direct match: notification belongs to this user
    if (notification.user_id === userId) {
      isAuthorized = true;
    }

    // 2. Admin broadcast notification — check if user is an authorized recipient
    if (!isAuthorized && notification.user_id && notification.user_id.startsWith('ADMIN_BROADCAST_')) {
      const targetAudience = notification.target_audience; // 'Trustee', 'Patron', or 'Both'

      // Look up user's member type
      let memberType = null;

      const { data: exactMatch } = await supabase
        .from('Members Table')
        .select('type')
        .eq('Mobile', userId)
        .limit(1)
        .maybeSingle();

      if (exactMatch?.type) {
        memberType = exactMatch.type;
      } else {
        // Try last 10 digits
        const last10 = String(userId).replace(/\D/g, '').slice(-10);
        if (last10) {
          const { data: last10Match } = await supabase
            .from('Members Table')
            .select('type')
            .ilike('Mobile', `%${last10}`)
            .limit(1)
            .maybeSingle();
          if (last10Match?.type) memberType = last10Match.type;
        }
      }

      if (memberType) {
        if (
          targetAudience === 'Both' ||
          targetAudience === memberType ||
          !targetAudience // fallback: allow deletion if no target_audience set
        ) {
          isAuthorized = true;
        }
      } else {
        // If we can't find the member type, still allow deletion
        // (the notification was already shown to them, so they should be able to remove it)
        isAuthorized = true;
      }
    }

    // 3. Check if notification user_id matches any patient name for this phone number
    if (!isAuthorized) {
      const { data: appointments, error: appointmentError } = await supabase
        .from('appointments')
        .select('patient_name, patient_phone')
        .eq('patient_phone', userId)
        .limit(100);

      if (!appointmentError && appointments && appointments.length > 0) {
        const patientNames = [...new Set(appointments.map(apt => apt.patient_name.trim()))];
        if (patientNames.includes(notification.user_id)) {
          isAuthorized = true;
        }
      }
    }

    // 4. Check referral user IDs
    if (!isAuthorized) {
      const { data: referrals, error: referralError } = await supabase
        .from('referrals')
        .select('user_id, user_phone')
        .or(`user_phone.eq.${userId},user_id.eq.${userId}`)
        .limit(100);

      if (!referralError && referrals && referrals.length > 0) {
        const referralUserIds = [...new Set(
          referrals
            .map(ref => ref.user_phone || ref.user_id)
            .filter(id => id)
        )];

        if (referralUserIds.includes(notification.user_id)) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({ success: false, message: 'Unauthorized to delete this notification' });
    }

    // Delete the notification
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Test/Debug endpoint to send a test notification
export const sendTestNotification = async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'userId is required in request body' 
      });
    }
    
    console.log(`🧪 Sending test notification to user: ${userId}`);
    
    const testNotification = {
      user_id: String(userId).trim(),
      title: '🧪 Test Notification',
      message: `यह एक test notification है। अगर आप यह message देख रहे हैं तो notification system सही काम कर रहा है! 
      
Test Time: ${new Date().toISOString()}
User ID: ${userId}

🎉 Notification system है working perfectly!`,
      type: 'test',
      is_read: false,
      created_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('notifications')
      .insert([testNotification])
      .select();
    
    if (error) {
      console.error('❌ Test notification insert error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to send test notification',
        error: error.message 
      });
    }
    
    console.log(`✅ Test notification sent successfully:`, data);
    
    res.json({ 
      success: true, 
      message: 'Test notification sent successfully',
      data: data
    });
    
  } catch (error) {
    console.error('❌ Error sending test notification:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while sending test notification',
      error: error.message 
    });
  }
};

