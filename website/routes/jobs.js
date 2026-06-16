import { Router } from 'express';
import { getProcessedJobs, getSelectedJobs } from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const [processed, selected] = await Promise.all([
      getProcessedJobs(),
      getSelectedJobs(),
    ]);
    res.render('jobs', { processed, selected });
  } catch (error) {
    console.error('Jobs page error:', error);
    res.render('jobs', { processed: [], selected: [] });
  }
});

export default router;
