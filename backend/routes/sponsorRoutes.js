import express from 'express';
import { 
  getSponsors, 
  getAllSponsors, 
  getSponsorById, 
  addSponsor, 
  updateSponsor, 
  deleteSponsor 
} from '../controllers/sponsorController.js';
import { authenticateAdminByKey } from '../middleware/adminAuth.js'; // Using admin key authentication

const router = express.Router();

// Public routes - anyone can access active sponsors
router.get('/', getSponsors);           // Get all active sponsors
router.get('/:id', getSponsorById);     // Get specific sponsor by ID

// Admin routes - only authenticated admins can access
router.use(authenticateAdminByKey);         // Apply admin authentication to all routes below

router.get('/all', getAllSponsors);    // Get all sponsors (active and inactive)
router.post('/', addSponsor);          // Add new sponsor
router.put('/:id', updateSponsor);     // Update sponsor
router.delete('/:id', deleteSponsor);  // Delete sponsor

export default router;