import { Router } from 'express';
import { getProducts, getBlogPosts, getServices } from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const [products, blogs, services] = await Promise.all([
      getProducts(),
      getBlogPosts(),
      getServices(),
    ]);
    res.render('index', {
      products: products.slice(0, 6),
      blogs: blogs.slice(0, 3),
      services: services.slice(0, 3),
    });
  } catch (error) {
    console.error('Home page error:', error);
    res.render('index', { products: [], blogs: [], services: [] });
  }
});

export default router;
