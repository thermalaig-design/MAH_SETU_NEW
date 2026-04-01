import { supabase } from '../config/supabase.js';

// Get all active sponsors
export const getSponsors = async (req, res) => {
  try {
    const { trust_id: trustId } = req.query;

    let query = supabase
      .from('sponsors')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: true });

    if (trustId) {
      query = query.eq('trust_id', trustId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching sponsors:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch sponsors',
        error: error.message
      });
    }

    res.json({
      success: true,
      data: data || [],
      count: data?.length || 0
    });
  } catch (error) {
    console.error('Error in getSponsors:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get all sponsors (including inactive) - Admin only
export const getAllSponsors = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('sponsors')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all sponsors:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch sponsors',
        error: error.message
      });
    }

    res.json({
      success: true,
      data: data || [],
      count: data?.length || 0
    });
  } catch (error) {
    console.error('Error in getAllSponsors:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get sponsor by ID
export const getSponsorById = async (req, res) => {
  try {
    const { id } = req.params;
    const { trust_id: trustId } = req.query;

    let query = supabase
      .from('sponsors')
      .select('*')
      .eq('id', id)
      .eq('is_active', true);

    if (trustId) {
      query = query.eq('trust_id', trustId);
    }

    const { data, error } = await query.single();

    if (error) {
      console.error('Error fetching sponsor:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch sponsor',
        error: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Sponsor not found'
      });
    }

    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Error in getSponsorById:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Add new sponsor (Admin only)
export const addSponsor = async (req, res) => {
  try {
    const { name, position, positions = [], about, photo_url, priority = 0, created_by = 'admin' } = req.body;

    if (!name || !position) {
      return res.status(400).json({
        success: false,
        message: 'Name and position are required'
      });
    }

    const { data, error } = await supabase
      .from('sponsors')
      .insert([
        {
          name: name.trim(),
          position: position.trim(),
          positions: positions,
          about: about ? about.trim() : null,
          photo_url: photo_url ? photo_url.trim() : null,
          priority: parseInt(priority) || 0,
          created_by: created_by,
          updated_by: created_by
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error adding sponsor:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to add sponsor',
        error: error.message
      });
    }

    res.status(201).json({
      success: true,
      message: 'Sponsor added successfully',
      data: data
    });
  } catch (error) {
    console.error('Error in addSponsor:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update sponsor (Admin only)
export const updateSponsor = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, position, positions, about, photo_url, priority, is_active, updated_by = 'admin' } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (position !== undefined) updateData.position = position.trim();
    if (positions !== undefined) updateData.positions = positions;
    if (about !== undefined) updateData.about = about.trim();
    if (photo_url !== undefined) updateData.photo_url = photo_url.trim();
    if (priority !== undefined) updateData.priority = parseInt(priority);
    if (is_active !== undefined) updateData.is_active = Boolean(is_active);
    updateData.updated_by = updated_by;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('sponsors')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating sponsor:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update sponsor',
        error: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Sponsor not found'
      });
    }

    res.json({
      success: true,
      message: 'Sponsor updated successfully',
      data: data
    });
  } catch (error) {
    console.error('Error in updateSponsor:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Delete sponsor (Admin only)
export const deleteSponsor = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('sponsors')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting sponsor:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete sponsor',
        error: error.message
      });
    }

    res.json({
      success: true,
      message: 'Sponsor deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteSponsor:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
