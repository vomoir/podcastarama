import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import {
  getDatabase,
  getAllPodcasts,
  getPodcastById,
  getPodcastBySlug,
  insertPodcast,
  updatePodcast,
  deletePodcast,
  getEpisodesForPodcast,
  getEpisodeById,
  insertEpisode,
  updateEpisode,
  deleteEpisode
} from './db.js';
import { generateRssFeed } from './rss.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '..', 'uploads');
const audioUploadsDir = path.join(uploadsDir, 'audio');
const imageUploadsDir = path.join(uploadsDir, 'images');

// Ensure upload directories exist
fs.mkdirSync(audioUploadsDir, { recursive: true });
fs.mkdirSync(imageUploadsDir, { recursive: true });

const app = express();
const port = process.env.PORT || 5000;

// Trust proxies (e.g. Cloudflare Tunnels, Nginx reverse proxy)
// This is critical so that req.protocol and req.get('host') respect forward headers
app.set('trust proxy', true);

app.use(cors());
app.use(express.json());

// Serve uploads statically. express.static automatically handles HTTP Range Requests (206 Partial Content)
// which is required for podcast applications to stream, fast-forward, and resume audio playback.
app.use('/uploads', express.static(uploadsDir));

// Helper to construct absolute URLs dynamically
function getHostUrl(req) {
  // If behind a proxy, we use the forwarded headers if available, otherwise fallback
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${protocol}://${host}`;
}

// Multer storage configurations
const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, audioUploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, imageUploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadAudio = multer({ 
  storage: audioStorage,
  limits: { fileSize: 300 * 1024 * 1024 } // 300MB limit for audio files
});

const uploadImage = multer({ 
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit for images
});

// --- API ROUTES ---

// 1. Podcasts
app.get('/api/podcasts', async (req, res) => {
  try {
    const podcasts = await getAllPodcasts();
    res.json(podcasts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/podcasts/:id', async (req, res) => {
  try {
    const podcast = await getPodcastById(req.params.id);
    if (!podcast) return res.status(404).json({ error: 'Podcast not found' });
    res.json(podcast);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/podcasts', async (req, res) => {
  try {
    const { title, description, author, email, category, language, websiteUrl, explicit, feedSlug } = req.body;
    if (!title || !feedSlug) {
      return res.status(400).json({ error: 'Title and Feed Slug are required.' });
    }
    
    // Check if feed slug already exists
    const existing = await getPodcastBySlug(feedSlug);
    if (existing) {
      return res.status(400).json({ error: 'Feed slug is already in use.' });
    }

    const lastId = await insertPodcast({
      title, description, author, email, category, language, websiteUrl, explicit, feedSlug, coverUrl: ''
    });
    res.status(201).json({ id: lastId, message: 'Podcast created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/podcasts/:id', async (req, res) => {
  try {
    const podcast = await getPodcastById(req.params.id);
    if (!podcast) return res.status(404).json({ error: 'Podcast not found' });

    const { title, description, coverUrl, author, email, category, language, websiteUrl, explicit, feedSlug } = req.body;
    if (!title || !feedSlug) {
      return res.status(400).json({ error: 'Title and Feed Slug are required.' });
    }

    // Check if feed slug is used by another podcast
    const existing = await getPodcastBySlug(feedSlug);
    if (existing && existing.id !== parseInt(req.params.id)) {
      return res.status(400).json({ error: 'Feed slug is already in use.' });
    }

    await updatePodcast(req.params.id, {
      title, description, coverUrl: coverUrl || podcast.coverUrl, author, email, category, language, websiteUrl, explicit, feedSlug
    });
    res.json({ message: 'Podcast updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/podcasts/:id', async (req, res) => {
  try {
    const podcast = await getPodcastById(req.params.id);
    if (!podcast) return res.status(404).json({ error: 'Podcast not found' });

    // Clean up all episodes' files
    const episodes = await getEpisodesForPodcast(req.params.id);
    for (const ep of episodes) {
      if (fs.existsSync(ep.audioPath)) {
        fs.unlinkSync(ep.audioPath);
      }
    }
    
    // Clean up cover image if it's local
    if (podcast.coverUrl && podcast.coverUrl.startsWith('/uploads/')) {
      const coverPath = path.join(uploadsDir, '..', podcast.coverUrl);
      if (fs.existsSync(coverPath)) {
        fs.unlinkSync(coverPath);
      }
    }

    await deletePodcast(req.params.id);
    res.json({ message: 'Podcast and associated episodes deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Podcast Cover Image Upload
app.post('/api/podcasts/:id/cover', uploadImage.single('cover'), async (req, res) => {
  try {
    const podcast = await getPodcastById(req.params.id);
    if (!podcast) return res.status(404).json({ error: 'Podcast not found' });
    if (!req.file) return res.status(400).json({ error: 'No image file uploaded' });

    // Remove old cover image if it exists and is local
    if (podcast.coverUrl && podcast.coverUrl.startsWith('/uploads/')) {
      const oldCoverPath = path.join(uploadsDir, '..', podcast.coverUrl);
      if (fs.existsSync(oldCoverPath)) {
        fs.unlinkSync(oldCoverPath);
      }
    }

    const relativeUrl = `/uploads/images/${req.file.filename}`;
    await updatePodcast(podcast.id, {
      ...podcast,
      coverUrl: relativeUrl
    });

    res.json({ coverUrl: relativeUrl, message: 'Cover image uploaded successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Episodes
app.get('/api/podcasts/:id/episodes', async (req, res) => {
  try {
    const episodes = await getEpisodesForPodcast(req.params.id);
    res.json(episodes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/episodes/:id', async (req, res) => {
  try {
    const episode = await getEpisodeById(req.params.id);
    if (!episode) return res.status(404).json({ error: 'Episode not found' });
    res.json(episode);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// File Upload endpoint for audio (pre-upload before creating/updating episode)
app.post('/api/episodes/upload-audio', uploadAudio.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });

    const relativeUrl = `/uploads/audio/${req.file.filename}`;
    res.json({
      audioUrl: relativeUrl,
      audioPath: req.file.path,
      audioSize: req.file.size
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/podcasts/:id/episodes', async (req, res) => {
  try {
    const podcastId = parseInt(req.params.id);
    const podcast = await getPodcastById(podcastId);
    if (!podcast) return res.status(404).json({ error: 'Podcast not found' });

    const { title, description, audioUrl, audioPath, audioSize, audioDuration, publishDate, episodeNumber, seasonNumber, explicit, status } = req.body;
    if (!title || !audioUrl || !audioPath || !audioSize || !publishDate) {
      return res.status(400).json({ error: 'Missing required episode fields: title, audioUrl, audioPath, audioSize, and publishDate are required.' });
    }

    const lastId = await insertEpisode({
      podcastId,
      title,
      description,
      audioUrl,
      audioPath,
      audioSize,
      audioDuration,
      publishDate,
      episodeNumber: episodeNumber ? parseInt(episodeNumber) : null,
      seasonNumber: seasonNumber ? parseInt(seasonNumber) : null,
      explicit,
      status
    });

    res.status(201).json({ id: lastId, message: 'Episode created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/episodes/:id', async (req, res) => {
  try {
    const episode = await getEpisodeById(req.params.id);
    if (!episode) return res.status(404).json({ error: 'Episode not found' });

    const { title, description, audioUrl, audioPath, audioSize, audioDuration, publishDate, episodeNumber, seasonNumber, explicit, status } = req.body;
    if (!title || !audioUrl || !audioPath || !audioSize || !publishDate) {
      return res.status(400).json({ error: 'Missing required episode fields.' });
    }

    // Clean up old audio file if it changed
    if (episode.audioPath && episode.audioPath !== audioPath) {
      if (fs.existsSync(episode.audioPath)) {
        fs.unlinkSync(episode.audioPath);
      }
    }

    await updateEpisode(req.params.id, {
      title,
      description,
      audioUrl,
      audioPath,
      audioSize,
      audioDuration,
      publishDate,
      episodeNumber: episodeNumber ? parseInt(episodeNumber) : null,
      seasonNumber: seasonNumber ? parseInt(seasonNumber) : null,
      explicit,
      status
    });

    res.json({ message: 'Episode updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/episodes/:id', async (req, res) => {
  try {
    const episode = await getEpisodeById(req.params.id);
    if (!episode) return res.status(404).json({ error: 'Episode not found' });

    // Clean up audio file
    if (episode.audioPath && fs.existsSync(episode.audioPath)) {
      fs.unlinkSync(episode.audioPath);
    }

    await deleteEpisode(req.params.id);
    res.json({ message: 'Episode deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- RSS FEED ROUTE ---
app.get('/feeds/:slug', async (req, res) => {
  try {
    const podcast = await getPodcastBySlug(req.params.slug);
    if (!podcast) {
      return res.status(404).send('Podcast feed not found');
    }

    const episodes = await getEpisodesForPodcast(podcast.id);
    const hostUrl = getHostUrl(req);
    const feedXml = generateRssFeed(podcast, episodes, hostUrl);

    res.header('Content-Type', 'application/xml; charset=utf-8');
    res.send(feedXml);
  } catch (error) {
    res.status(500).send('Error generating podcast RSS feed: ' + error.message);
  }
});

// Start DB and Express Server
const startServer = async () => {
  try {
    await getDatabase(); // Verify SQLite initialization
    app.listen(port, () => {
      console.log(`[Podcastarama] Server running at http://localhost:${port}`);
      console.log(`[Podcastarama] RSS feed endpoints active at http://localhost:${port}/feeds/<feed-slug>`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
