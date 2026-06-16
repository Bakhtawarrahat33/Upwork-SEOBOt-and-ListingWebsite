import { Router } from 'express';
import { getProducts, getProductBySlug } from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const products = await getProducts();
    res.render('products', { products });
  } catch (error) {
    console.error('Products page error:', error);
    res.render('products', { products: [] });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const product = await getProductBySlug(req.params.slug);
    if (!product) return res.status(404).send('Product not found');
    const data = product.content ? JSON.parse(product.content) : {};
    res.render('product', { product, data });
  } catch (error) {
    console.error('Product detail error:', error);
    res.status(500).send('Error loading product');
  }
});

export default router;
