import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import indexRouter from './routes/index.js';
import productsRouter from './routes/products.js';
import blogsRouter from './routes/blogs.js';
import servicesRouter from './routes/services.js';
import jobsRouter from './routes/jobs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/products', productsRouter);
app.use('/blogs', blogsRouter);
app.use('/services', servicesRouter);
app.use('/jobs', jobsRouter);

app.use((req, res) => {
  res.status(404).render('partials/header', { title: '404 - Not Found' });
});

app.listen(PORT, () => {
  console.log(`Listing website running at http://localhost:${PORT}`);
});
