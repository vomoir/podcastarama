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
import { analyzeAudio, simpleTrimAudio, getAudioMetadata } from './audioAnalyzer.js';

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

// --- AUDIO EDITING ROUTES ---

// Analyze audio for silence segments (auto-detect intro/outro songs)
app.get('/api/episodes/:id/analyze', async (req, res) => {
  try {
    const episode = await getEpisodeById(req.params.id);
    if (!episode) return res.status(404).json({ error: 'Episode not found' });
    if (!episode.audioPath || !fs.existsSync(episode.audioPath)) {
      return res.status(404).json({ error: 'Audio file not found' });
    }

    const analysis = await analyzeAudio(episode.audioPath);
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: 'Audio analysis failed: ' + error.message });
  }
});

// Get audio metadata (duration, bitrate, codec, etc.)
app.get('/api/episodes/:id/metadata', async (req, res) => {
  try {
    const episode = await getEpisodeById(req.params.id);
    if (!episode) return res.status(404).json({ error: 'Episode not found' });
    if (!episode.audioPath || !fs.existsSync(episode.audioPath)) {
      return res.status(404).json({ error: 'Audio file not found' });
    }

    const metadata = await getAudioMetadata(episode.audioPath);
    res.json(metadata);
  } catch (error) {
    res.status(500).json({ error: 'Metadata extraction failed: ' + error.message });
  }
});

// Trim audio: remove specified segments (intro/outro songs)
app.post('/api/episodes/:id/trim', async (req, res) => {
  try {
    const episode = await getEpisodeById(req.params.id);
    if (!episode) return res.status(404).json({ error: 'Episode not found' });
    if (!episode.audioPath || !fs.existsSync(episode.audioPath)) {
      return res.status(404).json({ error: 'Audio file not found' });
    }

    const { startTime, endTime } = req.body;
    if (startTime === undefined || endTime === undefined) {
      return res.status(400).json({ error: 'startTime and endTime are required' });
    }

    // Create trimmed output file with timestamp to avoid conflicts
    const ext = path.extname(episode.audioPath);
    const basename = path.basename(episode.audioPath, ext);
    const trimmedFilename = `${basename}-trimmed-${Date.now()}${ext}`;
    const trimmedPath = path.join(audioUploadsDir, trimmedFilename);

    // Perform trim
    await simpleTrimAudio(episode.audioPath, startTime, endTime, trimmedPath);

    // Backup original and replace with trimmed version
    const backupPath = path.join(audioUploadsDir, `${basename}-backup-${Date.now()}${ext}`);
    fs.renameSync(episode.audioPath, backupPath);
    fs.renameSync(trimmedPath, episode.audioPath);

    // Update episode metadata
    const newSize = fs.statSync(episode.audioPath).size;
    const newDuration = endTime - startTime;

    await updateEpisode(episode.id, {
      ...episode,
      audioSize: newSize,
      audioDuration: Math.round(newDuration)
    });

    res.json({
      message: 'Audio trimmed successfully',
      backup: backupPath,
      newSize,
      newDuration: Math.round(newDuration),
      trimmed: { startTime, endTime }
    });
  } catch (error) {
    res.status(500).json({ error: 'Audio trimming failed: ' + error.message });
  }
});

// Undo trim: restore from backup
app.post('/api/episodes/:id/restore', async (req, res) => {
  try {
    const episode = await getEpisodeById(req.params.id);
    if (!episode) return res.status(404).json({ error: 'Episode not found' });

    const ext = path.extname(episode.audioPath);
    const basename = path.basename(episode.audioPath, ext);
    const dir = path.dirname(episode.audioPath);
    
    // Find most recent backup
    const files = fs.readdirSync(dir);
    const backups = files
      .filter(f => f.includes(basename) && f.includes('-backup-'))
      .sort()
      .reverse();

    if (backups.length === 0) {
      return res.status(404).json({ error: 'No backup found' });
    }

    const backupPath = path.join(dir, backups[0]);
    const currentPath = episode.audioPath;

    // Restore backup
    fs.renameSync(backupPath, currentPath + '.tmp');
    fs.renameSync(currentPath, backupPath);
    fs.renameSync(currentPath + '.tmp', currentPath);

    res.json({ message: 'Audio restored from backup', backup: backupPath });
  } catch (error) {
    res.status(500).json({ error: 'Restore failed: ' + error.message });
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
