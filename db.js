import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'podcastarama.db');

let dbInstance = null;

export async function getDatabase() {
  if (dbInstance) return dbInstance;

  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Enable foreign keys
  await dbInstance.run('PRAGMA foreign_keys = ON');

  // Create podcasts table
  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS podcasts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      coverUrl TEXT,
      author TEXT,
      email TEXT,
      category TEXT,
      language TEXT DEFAULT 'en-us',
      websiteUrl TEXT,
      explicit INTEGER DEFAULT 0,
      feedSlug TEXT UNIQUE NOT NULL
    )
  `);

  // Create episodes table
  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS episodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      podcastId INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      audioUrl TEXT NOT NULL,
      audioPath TEXT NOT NULL,
      audioSize INTEGER NOT NULL,
      audioDuration INTEGER,
      publishDate TEXT NOT NULL,
      episodeNumber INTEGER,
      seasonNumber INTEGER,
      explicit INTEGER DEFAULT 0,
      status TEXT DEFAULT 'draft',
      FOREIGN KEY (podcastId) REFERENCES podcasts(id) ON DELETE CASCADE
    )
  `);

  return dbInstance;
}

export async function getAllPodcasts() {
  const db = await getDatabase();
  return db.all('SELECT * FROM podcasts');
}

export async function getPodcastById(id) {
  const db = await getDatabase();
  return db.get('SELECT * FROM podcasts WHERE id = ?', id);
}

export async function getPodcastBySlug(slug) {
  const db = await getDatabase();
  return db.get('SELECT * FROM podcasts WHERE feedSlug = ?', slug);
}

export async function insertPodcast({ title, description, coverUrl, author, email, category, language, websiteUrl, explicit, feedSlug }) {
  const db = await getDatabase();
  const result = await db.run(
    `INSERT INTO podcasts (title, description, coverUrl, author, email, category, language, websiteUrl, explicit, feedSlug)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, description, coverUrl, author, email, category, language || 'en-us', websiteUrl, explicit ? 1 : 0, feedSlug]
  );
  return result.lastID;
}

export async function updatePodcast(id, { title, description, coverUrl, author, email, category, language, websiteUrl, explicit, feedSlug }) {
  const db = await getDatabase();
  await db.run(
    `UPDATE podcasts
     SET title = ?, description = ?, coverUrl = ?, author = ?, email = ?, category = ?, language = ?, websiteUrl = ?, explicit = ?, feedSlug = ?
     WHERE id = ?`,
    [title, description, coverUrl, author, email, category, language, websiteUrl, explicit ? 1 : 0, feedSlug, id]
  );
  return id;
}

export async function deletePodcast(id) {
  const db = await getDatabase();
  await db.run('DELETE FROM podcasts WHERE id = ?', id);
}

export async function getEpisodesForPodcast(podcastId) {
  const db = await getDatabase();
  return db.all('SELECT * FROM episodes WHERE podcastId = ? ORDER BY publishDate DESC, id DESC', podcastId);
}

export async function getEpisodeById(id) {
  const db = await getDatabase();
  return db.get('SELECT * FROM episodes WHERE id = ?', id);
}

export async function insertEpisode({ podcastId, title, description, audioUrl, audioPath, audioSize, audioDuration, publishDate, episodeNumber, seasonNumber, explicit, status }) {
  const db = await getDatabase();
  const result = await db.run(
    `INSERT INTO episodes (podcastId, title, description, audioUrl, audioPath, audioSize, audioDuration, publishDate, episodeNumber, seasonNumber, explicit, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [podcastId, title, description, audioUrl, audioPath, audioSize, audioDuration, publishDate, episodeNumber, seasonNumber, explicit ? 1 : 0, status || 'draft']
  );
  return result.lastID;
}

export async function updateEpisode(id, { title, description, audioUrl, audioPath, audioSize, audioDuration, publishDate, episodeNumber, seasonNumber, explicit, status }) {
  const db = await getDatabase();
  await db.run(
    `UPDATE episodes
     SET title = ?, description = ?, audioUrl = ?, audioPath = ?, audioSize = ?, audioDuration = ?, publishDate = ?, episodeNumber = ?, seasonNumber = ?, explicit = ?, status = ?
     WHERE id = ?`,
    [title, description, audioUrl, audioPath, audioSize, audioDuration, publishDate, episodeNumber, seasonNumber, explicit ? 1 : 0, status, id]
  );
  return id;
}

export async function deleteEpisode(id) {
  const db = await getDatabase();
  await db.run('DELETE FROM episodes WHERE id = ?', id);
}
