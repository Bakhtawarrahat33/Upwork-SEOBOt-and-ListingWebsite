import { Router } from 'express';
import { getBlogPosts, getBlogPostBySlug } from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const blogs = await getBlogPosts();
    res.render('blogs', { blogs });
  } catch (error) {
    console.error('Blogs page error:', error);
    res.render('blogs', { blogs: [] });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const blog = await getBlogPostBySlug(req.params.slug);
    if (!blog) return res.status(404).send('Blog not found');
    res.render('blog', { blog });
  } catch (error) {
    console.error('Blog detail error:', error);
    res.status(500).send('Error loading blog');
  }
});

export default router;
