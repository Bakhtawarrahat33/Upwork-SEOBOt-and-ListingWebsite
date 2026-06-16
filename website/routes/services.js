import { Router } from 'express';
import { getServices, getServiceBySlug } from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const services = await getServices();
    res.render('services', { services });
  } catch (error) {
    console.error('Services page error:', error);
    res.render('services', { services: [] });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const service = await getServiceBySlug(req.params.slug);
    if (!service) return res.status(404).send('Service not found');
    const data = service.content ? JSON.parse(service.content) : {};
    res.render('service', { service, data });
  } catch (error) {
    console.error('Service detail error:', error);
    res.status(500).send('Error loading service');
  }
});

export default router;
