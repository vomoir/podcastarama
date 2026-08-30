# Podcastarama - Self-Hosted Podcast Platform

A lightweight, self-hosted podcast management system built with Node.js, Express, SQLite, and React. Host, manage, and distribute your podcasts directly from your server while retaining full ownership of your data.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Your Local Server                       │
│  (runs Podcastarama at 49.176.164.137)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Frontend - Admin Dashboard (React + Vite)                │  │
│  │ Port: 5173 (dev) or built static files                   │  │
│  │ Access: http://49.176.164.137:5173                       │  │
│  │ Features: Manage podcasts, upload episodes, edit metadata│  │
│  └────────────────────────┬─────────────────────────────────┘  │
│                           │                                    │
│                   API Requests (JSON)                          │
│                           │                                    │
│  ┌────────────────────────▼─────────────────────────────────┐  │
│  │ Backend API Server (Node.js + Express)                   │  │
│  │ Port: 5000                                               │  │
│  │ Access: http://49.176.164.137:5000                       │  │
│  │ Routes:                                                  │  │
│  │  - GET  /api/podcasts              (list all podcasts)   │  │
│  │  - POST /api/podcasts              (create podcast)      │  │
│  │  - PUT  /api/podcasts/:id          (update podcast)      │  │
│  │  - POST /api/podcasts/:id/cover    (upload cover image)  │  │
│  │  - GET  /api/podcasts/:id/episodes (list episodes)       │  │
│  │  - POST /api/episodes/upload-audio (upload audio)        │  │
│  │  - POST /api/podcasts/:id/episodes (create episode)      │  │
│  │  - PUT  /api/episodes/:id          (update episode)      │  │
│  │  - GET  /feeds/:slug               (RSS feed)            │  │
│  │  - GET  /uploads/*                 (stream audio/images) │  │
│  └────────────┬────────────────────────┬────────────────────┘  │
│               │                        │                       │
│    Reads/Writes                Stores Files                    │
│               │                        │                       │
│  ┌────────────▼──────────┐  ┌─────────▼───────────────────┐    │
│  │  SQLite Database      │  │ Local File Storage          │    │
│  │  /podcastarama.db     │  │ /uploads/                   │    │ 
│  │                       │  │  ├─ audio/       (MP3 files)│    │
│  │  Tables:              │  │  └─ images/      (Cover art)│    │
│  │  - podcasts           │  │                             │    │
│  │  - episodes           │  └─────────────────────────────┘    │
│  └───────────────────────┘                                     │
│                                                                │
└────────────────────────────────────────────────────────────────┘
                           │
                           │ Internet
                           │
        ┌──────────────────┴──────────────────┐
        │                                     │
   ┌────▼────────┐                    ┌──────▼─────────┐
   │ Podcast Apps│                    │ Directory      │
   │ (via RSS)   │                    │ Indexers       │
   ├─────────────┤                    ├────────────────┤
   │ • Apple Pod.│                    │ • Apple Pod.   │
   │ • Spotify   │                    │ • Spotify      │
   │ • Google Pod│                    │ • Google Pod.  │
   │ • Overcast  │                    │ • Amazon Music │
   │ • etc.      │                    │ • etc.         │
   └─────────────┘                    └────────────────┘
```

---

## 📋 Port Reference

| Service           | Port     | Protocol   | Purpose |
|-------------------|----------|------------|---------|
| **Backend API**   | `5000`   | HTTP       | REST API endpoints & audio streaming |
| **Frontend Dev**  | `5173`   | HTTP       | Admin dashboard (development only) |
| **Frontend Prod** | `80/443` | HTTP/HTTPS | Admin dashboard (via reverse proxy) |

---

## 🚀 Quick Setup

### Prerequisites
- **Node.js** v18+ and npm
- **Server IP**: 49.176.164.137
- Recommended: Reverse proxy (Nginx, Caddy) or Cloudflare Tunnel for SSL/public access

### 1. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configuration

Create a `.env` file in the `backend/` directory:

```bash
PORT=5000
NODE_ENV=development
```

For production, update to:
```bash
PORT=5000
NODE_ENV=production
```

### 3. Start the Application

**Development Mode** (with hot-reload):

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

Access:
- **Admin Dashboard**: http://localhost:5173
- **API**: http://localhost:5000

**Production Mode**:

```bash
# Backend
cd backend
npm start

# Frontend (build first, then serve static files)
cd frontend
npm run build
# Serve the dist/ folder via Nginx or your reverse proxy
```

---

## 📦 Deployment Guide

### Option A: Local Network Access (Simple)

1. **Start backend on your server**:
   ```bash
   cd backend
   npm start
   ```

2. **Access from local network**:
   - Admin: http://49.176.164.137:5173 (after frontend build)
   - API: http://49.176.164.137:5000

### Option B: Public Access with Reverse Proxy (Recommended)

Use **Cloudflare Tunnel** (free & secure, no port forwarding):

#### Install Cloudflare Tunnel

```bash
# Download cloudflared
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb

# Authenticate
cloudflared tunnel login

# Create a tunnel
cloudflared tunnel create podcastarama
```

#### Create tunnel configuration at `~/.cloudflared/config.yml`:

```yaml
tunnel: podcastarama
credentials-file: /home/YOUR_USER/.cloudflared/podcastarama.json

ingress:
  - hostname: podcasts.yourdomain.com
    service: http://localhost:5000
  - service: http_status:404
```

#### Route your domain to the tunnel

```bash
# Get your tunnel ID
cloudflared tunnel info podcastarama

# Add DNS record pointing to tunnel (follow Cloudflare Dashboard)
cloudflared tunnel route dns podcastarama podcasts.yourdomain.com
```

#### Run the tunnel

```bash
cloudflared tunnel run podcastarama
```

### Option C: Nginx Reverse Proxy (Advanced)

Create `/etc/nginx/sites-available/podcastarama`:

```nginx
server {
    listen 443 ssl http2;
    server_name podcasts.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    client_max_body_size 300M;  # Allow 300MB uploads

    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /feeds {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        # Range requests (crucial for audio streaming)
        proxy_set_header Range $http_range;
        proxy_set_header If-Range $http_if_range;
        proxy_pass_request_headers on;
    }

    location / {
        root /path/to/podcastarama/frontend/dist;
        try_files $uri /index.html;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name podcasts.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

Enable and restart Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/podcastarama /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 📝 Directory Structure

```
podcastarama/
├── backend/                    # Node.js + Express API
│   ├── server.js              # Main Express app & routes
│   ├── db.js                  # SQLite database functions
│   ├── rss.js                 # RSS feed generation
│   ├── package.json           # Backend dependencies
│   └── podcastarama.db        # SQLite database (auto-created)
│
├── frontend/                   # React + Vite admin dashboard
│   ├── src/                   # React components
│   ├── public/                # Static assets
│   ├── vite.config.js         # Vite configuration
│   └── package.json           # Frontend dependencies
│
├── uploads/                    # User uploads (created at runtime)
│   ├── audio/                 # Episode MP3 files
│   └── images/                # Podcast cover art
│
└── podcastarama.db            # SQLite database file
```

---

## 📚 API Endpoints

### Podcasts

```bash
# List all podcasts
GET /api/podcasts

# Get podcast details
GET /api/podcasts/:id

# Create podcast
POST /api/podcasts
Body: { title, description, author, email, category, language, websiteUrl, explicit, feedSlug }

# Update podcast
PUT /api/podcasts/:id
Body: { title, description, coverUrl, author, email, category, language, websiteUrl, explicit, feedSlug }

# Delete podcast
DELETE /api/podcasts/:id

# Upload podcast cover image
POST /api/podcasts/:id/cover
Body: FormData with 'cover' file
```

### Episodes

```bash
# List episodes for a podcast
GET /api/podcasts/:podcastId/episodes

# Get episode details
GET /api/episodes/:id

# Upload audio file (temporary)
POST /api/episodes/upload-audio
Body: FormData with 'audio' file
Response: { audioUrl, audioPath, audioSize }

# Create episode
POST /api/podcasts/:podcastId/episodes
Body: { title, description, audioUrl, audioPath, audioSize, audioDuration, publishDate, episodeNumber, seasonNumber, explicit, status }

# Update episode
PUT /api/episodes/:id
Body: Same as create

# Delete episode
DELETE /api/episodes/:id
```

### RSS Feed

```bash
# Public RSS feed (for podcast apps)
GET /feeds/:feedSlug

# Example: GET /feeds/my-podcast-slug
# Returns: iTunes-compliant XML feed
```

### File Serving

```bash
# Stream audio or images (supports HTTP Range requests)
GET /uploads/audio/:filename
GET /uploads/images/:filename
```

---

## 📤 Upload Limits

- **Audio files**: 300 MB max
- **Cover images**: 10 MB max

Adjust in `backend/server.js` lines 81 and 86 if needed.

---

## 🔐 Audio Server Hosting

The note mentions audio files are hosted on server `49.176.164.137`. The current setup stores all audio files locally in the `uploads/audio/` directory. If you want to use a separate audio server:

1. Configure your audio server to serve files publicly
2. Update episode `audioUrl` in the database to point to the external server
3. The RSS feed will reference the external URLs

---

## 🔄 Running as a Service (Systemd)

Create `/etc/systemd/system/podcastarama.service`:

```ini
[Unit]
Description=Podcastarama Podcast Server
After=network.target

[Service]
Type=simple
User=YOUR_USER
WorkingDirectory=/path/to/podcastarama/backend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment="NODE_ENV=production"
Environment="PORT=5000"

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable podcastarama
sudo systemctl start podcastarama
sudo systemctl status podcastarama
```

View logs:

```bash
sudo journalctl -u podcastarama -f
```

---

## 🧪 Testing

### Test RSS Feed

```bash
curl http://49.176.164.137:5000/feeds/my-podcast-slug
```

Should return valid XML. Validate at: https://castfeedvalidator.com/

### Test Audio Streaming

```bash
# Test byte-range request (required for seeking in podcast apps)
curl -r 0-99 http://49.176.164.137:5000/uploads/audio/filename.mp3
```

Should return `206 Partial Content` status.

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| **Port 5000 already in use** | Change `PORT` in `.env` or kill existing process |
| **CORS errors** | CORS is enabled globally; ensure frontend points to correct API URL |
| **Audio won't play** | Verify Range request support: `curl -I -r 0-99 http://...` should return 206 |
| **Large file uploads fail** | Increase `client_max_body_size` in Nginx (300M recommended) |
| **Database locked** | SQLite is single-writer; close other connections |
| **RSS feed not updating** | Clear browser cache; feeds update on-demand from database |

---

## 📖 Database Schema

### podcasts
```sql
CREATE TABLE podcasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  coverUrl TEXT,
  author TEXT,
  email TEXT,
  category TEXT,
  language TEXT DEFAULT 'en',
  websiteUrl TEXT,
  explicit BOOLEAN DEFAULT 0,
  feedSlug TEXT UNIQUE NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### episodes
```sql
CREATE TABLE episodes (
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
  explicit BOOLEAN DEFAULT 0,
  status TEXT DEFAULT 'draft',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (podcastId) REFERENCES podcasts(id)
);
```

---

## 📄 License

Self-hosted podcast management platform. Use at your discretion.

---

## 🤝 Support

For issues or questions about the architecture, refer to the implementation plan in `implementation_plan.md`.
