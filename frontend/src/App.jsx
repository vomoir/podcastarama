import React, { useState, useEffect, useRef } from 'react';
import { 
  Podcast, Plus, Settings, Radio, Play, Pause, Trash2, Edit, 
  Copy, Check, ExternalLink, ChevronRight, Image, ArrowLeft, 
  Calendar, AlertTriangle, Globe, Mail, Folder, HardDrive, Upload, Info, Wand2
} from 'lucide-react';
import AudioEditor from './AudioEditor';

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:5000' 
  : window.location.origin;

export default function App() {
  // Navigation & View State
  const [podcasts, setPodcasts] = useState([]);
  const [selectedPodcast, setSelectedPodcast] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  
  // UI Panels
  const [activeTab, setActiveTab] = useState('episodes'); // 'episodes' | 'settings'
  const [showPodcastModal, setShowPodcastModal] = useState(false);
  const [showEpisodeModal, setShowEpisodeModal] = useState(false);
  const [showAudioEditor, setShowAudioEditor] = useState(false);
  
  // Edit targets (null for create new)
  const [editPodcastTarget, setEditPodcastTarget] = useState(null);
  const [editEpisodeTarget, setEditEpisodeTarget] = useState(null);

  // Forms
  const [podcastForm, setPodcastForm] = useState({
    title: '', description: '', feedSlug: '', author: '', email: '', category: 'Society & Culture', language: 'en-us', websiteUrl: '', explicit: false
  });
  const [episodeForm, setEpisodeForm] = useState({
    title: '', description: '', seasonNumber: '', episodeNumber: '', publishDate: '', explicit: false, status: 'draft',
    audioUrl: '', audioPath: '', audioSize: 0, audioDuration: 0
  });

  // Audio Uploading State
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedAudioName, setSelectedAudioName] = useState('');

  // Audio Playback
  const [playingEpisode, setPlayingEpisode] = useState(null);
  const [audioState, setAudioState] = useState({ playing: false, duration: 0, progress: 0 });
  const audioRef = useRef(null);

  // Copy State
  const [copiedFeed, setCopiedFeed] = useState(false);

  // Load initial data
  useEffect(() => {
    fetchPodcasts();
  }, []);

  // Fetch Podcasts
  const fetchPodcasts = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/podcasts`);
      const data = await res.json();
      setPodcasts(data);
    } catch (e) {
      console.error('Error fetching podcasts:', e);
    }
  };

  // Fetch Episodes for selected podcast
  const fetchEpisodes = async (podcastId) => {
    try {
      const res = await fetch(`${API_BASE}/api/podcasts/${podcastId}/episodes`);
      const data = await res.json();
      setEpisodes(data);
    } catch (e) {
      console.error('Error fetching episodes:', e);
    }
  };

  // Select Podcast
  const handleSelectPodcast = (podcast) => {
    setSelectedPodcast(podcast);
    fetchEpisodes(podcast.id);
    setActiveTab('episodes');
  };

  // Copy feed URL to clipboard
  const handleCopyFeed = (slug) => {
    const url = `${API_BASE}/feeds/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedFeed(true);
    setTimeout(() => setCopiedFeed(false), 2000);
  };

  // Format Duration helper (seconds -> mm:ss or hh:mm:ss)
  const formatDuration = (secs) => {
    if (!secs) return '00:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  };

  // Podcast CRUD Handlers
  const handleOpenPodcastModal = (podcast = null) => {
    if (podcast) {
      setEditPodcastTarget(podcast);
      setPodcastForm({
        title: podcast.title,
        description: podcast.description || '',
        feedSlug: podcast.feedSlug,
        author: podcast.author || '',
        email: podcast.email || '',
        category: podcast.category || 'Society & Culture',
        language: podcast.language || 'en-us',
        websiteUrl: podcast.websiteUrl || '',
        explicit: podcast.explicit === 1
      });
    } else {
      setEditPodcastTarget(null);
      setPodcastForm({
        title: '', description: '', feedSlug: '', author: '', email: '', category: 'Society & Culture', language: 'en-us', websiteUrl: '', explicit: false
      });
    }
    setShowPodcastModal(true);
  };

  const handleSavePodcast = async (e) => {
    e.preventDefault();
    const url = editPodcastTarget 
      ? `${API_BASE}/api/podcasts/${editPodcastTarget.id}` 
      : `${API_BASE}/api/podcasts`;
    const method = editPodcastTarget ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(podcastForm)
      });
      const data = await res.json();
      if (res.ok) {
        setShowPodcastModal(false);
        fetchPodcasts();
        if (editPodcastTarget) {
          // Update currently active podcast
          setSelectedPodcast({ ...editPodcastTarget, ...podcastForm });
        }
      } else {
        alert(data.error || 'Failed to save podcast');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePodcast = async (id) => {
    if (!confirm('Are you absolutely sure you want to delete this podcast and all its episodes? This cannot be undone.')) return;
    try {
      const res = await fetch(`${API_BASE}/api/podcasts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSelectedPodcast(null);
        fetchPodcasts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedPodcast) return;

    const formData = new FormData();
    formData.append('cover', file);

    try {
      const res = await fetch(`${API_BASE}/api/podcasts/${selectedPodcast.id}/cover`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setSelectedPodcast({ ...selectedPodcast, coverUrl: data.coverUrl });
        fetchPodcasts();
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Episode CRUD Handlers
  const handleOpenEpisodeModal = (episode = null) => {
    setUploadProgress(0);
    setIsUploading(false);
    setSelectedAudioName('');

    const offset = new Date().getTimezoneOffset() * 60000;
    const localISOTime = new Date(Date.now() - offset).toISOString().slice(0, 16);

    if (episode) {
      setEditEpisodeTarget(episode);
      setEpisodeForm({
        title: episode.title,
        description: episode.description || '',
        seasonNumber: episode.seasonNumber || '',
        episodeNumber: episode.episodeNumber || '',
        publishDate: episode.publishDate.slice(0, 16),
        explicit: episode.explicit === 1,
        status: episode.status,
        audioUrl: episode.audioUrl,
        audioPath: episode.audioPath,
        audioSize: episode.audioSize,
        audioDuration: episode.audioDuration || 0
      });
      setSelectedAudioName('(Using existing audio file)');
    } else {
      setEditEpisodeTarget(null);
      setEpisodeForm({
        title: '',
        description: '',
        seasonNumber: '',
        episodeNumber: '',
        publishDate: localISOTime,
        explicit: false,
        status: 'draft',
        audioUrl: '',
        audioPath: '',
        audioSize: 0,
        audioDuration: 0
      });
    }
    setShowEpisodeModal(true);
  };

  // Read Audio file details and calculate duration in browser
  const handleAudioSelection = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedAudioName(file.name);
    
    // Calculate duration in the client browser! Avoids ffmpeg/probe on server.
    const audio = document.createElement('audio');
    audio.src = URL.createObjectURL(file);
    audio.addEventListener('loadedmetadata', () => {
      const duration = Math.round(audio.duration);
      setEpisodeForm(prev => ({
        ...prev,
        audioSize: file.size,
        audioDuration: duration
      }));
    });

    // Upload immediately
    uploadAudioFile(file);
  };

  const uploadAudioFile = (file) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('audio', file);

    setIsUploading(true);
    setUploadProgress(0);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        setUploadProgress(percent);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        setEpisodeForm(prev => ({
          ...prev,
          audioUrl: data.audioUrl,
          audioPath: data.audioPath,
          audioSize: data.audioSize
        }));
        setIsUploading(false);
      } else {
        alert('Upload failed: ' + xhr.responseText);
        setIsUploading(false);
        setSelectedAudioName('');
      }
    });

    xhr.addEventListener('error', () => {
      alert('Network error during upload.');
      setIsUploading(false);
      setSelectedAudioName('');
    });

    xhr.open('POST', `${API_BASE}/api/episodes/upload-audio`);
    xhr.send(formData);
  };

  const handleSaveEpisode = async (e) => {
    e.preventDefault();
    if (!episodeForm.audioUrl) {
      alert('Please upload an audio file for this episode.');
      return;
    }

    const url = editEpisodeTarget
      ? `${API_BASE}/api/episodes/${editEpisodeTarget.id}`
      : `${API_BASE}/api/podcasts/${selectedPodcast.id}/episodes`;
    const method = editEpisodeTarget ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(episodeForm)
      });
      if (res.ok) {
        setShowEpisodeModal(false);
        fetchEpisodes(selectedPodcast.id);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save episode.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteEpisode = async (id) => {
    if (!confirm('Are you sure you want to delete this episode? This will delete the audio file from the server.')) return;
    try {
      const res = await fetch(`${API_BASE}/api/episodes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (playingEpisode && playingEpisode.id === id) {
          handleStopAudio();
        }
        fetchEpisodes(selectedPodcast.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Inline Audio Player logic
  const handlePlayEpisode = (episode) => {
    if (playingEpisode && playingEpisode.id === episode.id) {
      if (audioState.playing) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(e => console.error(e));
      }
      return;
    }

    setPlayingEpisode(episode);
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.src = episode.audioUrl.startsWith('http') 
          ? episode.audioUrl 
          : `${API_BASE}${episode.audioUrl}`;
        audioRef.current.play()
          .then(() => {
            setAudioState(prev => ({ ...prev, playing: true }));
          })
          .catch(e => console.error(e));
      }
    }, 100);
  };

  const handleStopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setPlayingEpisode(null);
    setAudioState({ playing: false, duration: 0, progress: 0 });
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      setAudioState(prev => ({
        ...prev,
        progress: audioRef.current.currentTime,
        duration: audioRef.current.duration || 0
      }));
    }
  };

  const handleAudioEnded = () => {
    setAudioState({ playing: false, duration: 0, progress: 0 });
    setPlayingEpisode(null);
  };

  const handleAudioPause = () => {
    setAudioState(prev => ({ ...prev, playing: false }));
  };

  const handleAudioPlay = () => {
    setAudioState(prev => ({ ...prev, playing: true }));
  };

  const handleProgressBarChange = (e) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setAudioState(prev => ({ ...prev, progress: newTime }));
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar Navigation */}
      <aside className="glass-card" style={{ width: '280px', borderRight: '1px solid var(--border-glass)', display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, zIndex: 10 }}>
        <div style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border-glass)' }}>
          <div style={{ background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)', borderRadius: '10px', padding: '8px', display: 'flex' }}>
            <Radio size={24} color="#fff" />
          </div>
          <span style={{ fontSize: '1.25rem', fontFamily: 'var(--font-display)', fontWeight: 800, background: 'linear-gradient(135deg, #fff 40%, var(--accent-primary) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Podcastarama
          </span>
        </div>

        <nav style={{ padding: '20px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
          <button 
            className="btn btn-secondary" 
            style={{ width: '100%', display: 'flex', justifyContent: 'flex-start', background: !selectedPodcast ? 'var(--bg-tertiary)' : 'transparent', borderColor: !selectedPodcast ? 'rgba(139, 92, 246, 0.3)' : 'var(--border-glass)' }}
            onClick={() => setSelectedPodcast(null)}
          >
            <Folder size={18} />
            All Shows
          </button>
          
          {podcasts.length > 0 && (
            <>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', tracking: '0.05em', padding: '16px 12px 6px 12px', fontFamily: 'var(--font-display)' }}>
                Your Podcasts
              </div>
              {podcasts.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleSelectPodcast(p)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: selectedPodcast?.id === p.id ? 'var(--accent-glow)' : 'transparent',
                    border: 'none',
                    color: selectedPodcast?.id === p.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'var(--transition-smooth)'
                  }}
                  className="sidebar-item"
                >
                  <div style={{ width: '28px', height: '28px', borderRadius: '4px', background: 'var(--bg-tertiary)', backgroundSize: 'cover', backgroundImage: p.coverUrl ? `url(${p.coverUrl.startsWith('http') ? p.coverUrl : API_BASE + p.coverUrl})` : 'none', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {!p.coverUrl && <Podcast size={14} color="var(--text-muted)" />}
                  </div>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.9rem', fontWeight: selectedPodcast?.id === p.id ? 500 : 400 }}>
                    {p.title}
                  </span>
                </button>
              ))}
            </>
          )}
        </nav>

        <div style={{ padding: '16px', borderTop: '1px solid var(--border-glass)', background: 'rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <HardDrive size={14} />
            <span>Local Server Hosting Mode</span>
          </div>
        </div>
      </aside>

      {/* Main Workspace content */}
      <main style={{ flex: 1, padding: '40px', overflowY: 'auto', maxHeight: '100vh' }}>
        
        {/* VIEW 1: PODCASTS LIST (NO SELECTED PODCAST) */}
        {!selectedPodcast ? (
          <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
              <div>
                <h1 style={{ fontSize: '2rem', marginBottom: '8px' }} className="text-gradient">Local Podcast Library</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Host podcasts directly from this server. Manage metadata and generate public RSS feeds.</p>
              </div>
              <button className="btn btn-primary" onClick={() => handleOpenPodcastModal(null)}>
                <Plus size={18} />
                Create New Show
              </button>
            </div>

            {podcasts.length === 0 ? (
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 40px', textAlign: 'center' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', color: 'var(--accent-primary)' }}>
                  <Podcast size={40} />
                </div>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '12px' }}>No Podcast Created Yet</h2>
                <p style={{ color: 'var(--text-secondary)', maxWidth: '460px', marginBottom: '24px', fontSize: '0.95rem' }}>
                  Create your first podcast series to start staging episodes, uploading high-quality audio files, and producing Apple & Spotify compatible RSS feeds.
                </p>
                <button className="btn btn-primary" onClick={() => handleOpenPodcastModal(null)}>
                  <Plus size={18} />
                  Get Started
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
                {podcasts.map(p => (
                  <div key={p.id} className="glass-card" style={{ padding: '24px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '16px' }} onClick={() => handleSelectPodcast(p)}>
                    <div style={{ width: '100%', paddingBottom: '100%', borderRadius: 'var(--radius-md)', background: 'var(--bg-tertiary)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundImage: p.coverUrl ? `url(${p.coverUrl.startsWith('http') ? p.coverUrl : API_BASE + p.coverUrl})` : 'none', position: 'relative', overflow: 'hidden' }}>
                      {!p.coverUrl && (
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                          <Podcast size={48} />
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.2rem', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '8px' }}>By {p.author || 'Unknown'}</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <span>/{p.feedSlug}</span>
                        <ChevronRight size={16} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          
          /* VIEW 2: PODCAST DETAILED VIEW */
          <div className="animate-fade-in">
            {/* Breadcrumb / Back button */}
            <button 
              onClick={() => setSelectedPodcast(null)} 
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '24px', fontSize: '0.9rem', fontWeight: 500 }}
            >
              <ArrowLeft size={16} /> Back to Library
            </button>

            {/* Header / Podcast Banner card */}
            <div className="glass-card" style={{ padding: '32px', marginBottom: '32px', display: 'flex', gap: '32px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ width: '160px', height: '160px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-tertiary)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundImage: selectedPodcast.coverUrl ? `url(${selectedPodcast.coverUrl.startsWith('http') ? selectedPodcast.coverUrl : API_BASE + selectedPodcast.coverUrl})` : 'none', flexShrink: 0, position: 'relative', cursor: 'pointer', overflow: 'hidden', border: '1px solid var(--border-glass)' }}>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleCoverUpload} 
                  id="cover-upload-input" 
                  style={{ display: 'none' }} 
                />
                <label htmlFor="cover-upload-input" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', opacity: selectedPodcast.coverUrl ? 0 : 1, transition: 'var(--transition-smooth)', cursor: 'pointer', color: 'white', fontSize: '0.8rem', gap: '4px' }} className="cover-upload-label">
                  <Image size={20} />
                  Change Cover
                </label>
              </div>

              <div style={{ flex: 1, minWidth: '280px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  <h1 style={{ fontSize: '2.2rem' }} className="text-gradient">{selectedPodcast.title}</h1>
                  {selectedPodcast.explicit === 1 && (
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', background: 'var(--danger)', color: 'white', borderRadius: '4px', textTransform: 'uppercase' }}>Explicit</span>
                  )}
                </div>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5, fontSize: '0.95rem' }}>{selectedPodcast.description || 'No description provided.'}</p>
                
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Globe size={14} /> {selectedPodcast.category || 'General'}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Mail size={14} /> {selectedPodcast.author || 'No Author'} ({selectedPodcast.email || 'No Email'})</span>
                </div>
              </div>
            </div>

            {/* RSS Feed Card */}
            <div className="glass-card" style={{ padding: '20px 24px', marginBottom: '32px', background: 'rgba(139, 92, 246, 0.04)', borderColor: 'rgba(139, 92, 246, 0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)', flexShrink: 0 }}>
                  <Radio size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', marginBottom: '4px' }}>Dynamic XML Podcast RSS Feed</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Use this URL to index your show in Spotify, Apple Podcasts, or generic player apps.</p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '6px 6px 6px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', maxWidth: '100%', overflow: 'hidden' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px', fontFamily: 'monospace' }}>
                  {`${API_BASE}/feeds/${selectedPodcast.feedSlug}`}
                </span>
                <button 
                  onClick={() => handleCopyFeed(selectedPodcast.feedSlug)}
                  className="btn" 
                  style={{ padding: '8px 12px', background: copiedFeed ? 'var(--success)' : 'var(--bg-tertiary)', color: '#fff', fontSize: '0.8rem', display: 'flex', gap: '4px' }}
                >
                  {copiedFeed ? <Check size={14} /> : <Copy size={14} />}
                  {copiedFeed ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Tabs Selector */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-glass)', marginBottom: '24px', gap: '8px' }}>
              <button 
                onClick={() => setActiveTab('episodes')} 
                style={{ padding: '12px 20px', border: 'none', background: 'none', color: activeTab === 'episodes' ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: 600, borderBottom: activeTab === 'episodes' ? '2px solid var(--accent-primary)' : '2px solid transparent', cursor: 'pointer', transition: 'var(--transition-smooth)' }}
              >
                Episodes ({episodes.length})
              </button>
              <button 
                onClick={() => setActiveTab('settings')} 
                style={{ padding: '12px 20px', border: 'none', background: 'none', color: activeTab === 'settings' ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: 600, borderBottom: activeTab === 'settings' ? '2px solid var(--accent-primary)' : '2px solid transparent', cursor: 'pointer', transition: 'var(--transition-smooth)' }}
              >
                Settings & Management
              </button>
            </div>

            {/* TAB CONTENT: EPISODES */}
            {activeTab === 'episodes' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h2 style={{ fontSize: '1.25rem' }}>Episodes List</h2>
                  <button className="btn btn-primary" onClick={() => handleOpenEpisodeModal(null)}>
                    <Plus size={16} /> Create Episode
                  </button>
                </div>

                {episodes.length === 0 ? (
                  <div className="glass-card" style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <Info size={36} style={{ marginBottom: '16px', color: 'var(--text-muted)' }} />
                    <p style={{ fontSize: '0.95rem' }}>No episodes yet for this podcast. Click "Create Episode" above to upload your first audio track!</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {episodes.map(ep => (
                      <div 
                        key={ep.id} 
                        className="glass-card" 
                        style={{ padding: '20px', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap', borderColor: playingEpisode?.id === ep.id ? 'rgba(139, 92, 246, 0.4)' : 'var(--border-glass)' }}
                      >
                        {/* Play Button Icon */}
                        <button 
                          onClick={() => handlePlayEpisode(ep)}
                          style={{ width: '48px', height: '48px', borderRadius: '50%', background: playingEpisode?.id === ep.id && audioState.playing ? 'var(--accent-secondary)' : 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', color: 'white', cursor: 'pointer', flexShrink: 0, transition: 'var(--transition-smooth)' }}
                        >
                          {playingEpisode?.id === ep.id && audioState.playing ? <Pause size={20} /> : <Play size={20} style={{ marginLeft: '3px' }} />}
                        </button>

                        <div style={{ flex: 1, minWidth: '240px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '4px' }}>
                            <h3 style={{ fontSize: '1.1rem' }}>{ep.title}</h3>
                            <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px', background: ep.status === 'published' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: ep.status === 'published' ? 'var(--success)' : 'var(--warning)', fontWeight: 600, textTransform: 'uppercase' }}>
                              {ep.status}
                            </span>
                          </div>

                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ep.description}</p>
                          
                          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {ep.seasonNumber && <span>Season {ep.seasonNumber}</span>}
                            {ep.episodeNumber && <span>Episode {ep.episodeNumber}</span>}
                            <span>Duration: {formatDuration(ep.audioDuration)}</span>
                            <span>Size: {(ep.audioSize / (1024 * 1024)).toFixed(1)} MB</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={12} /> {new Date(ep.publishDate).toLocaleDateString()}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn btn-secondary" style={{ padding: '8px' }} onClick={() => { setEditEpisodeTarget(ep); setShowAudioEditor(true); }} title="Edit audio (trim, remove songs)">
                            <Wand2 size={16} />
                          </button>
                          <button className="btn btn-secondary" style={{ padding: '8px' }} onClick={() => handleOpenEpisodeModal(ep)}>
                            <Edit size={16} />
                          </button>
                          <button className="btn btn-danger" style={{ padding: '8px' }} onClick={() => handleDeleteEpisode(ep.id)}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: SETTINGS */}
            {activeTab === 'settings' && (
              <div className="glass-card" style={{ padding: '32px' }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '24px' }}>Podcast Settings</h2>
                <form onSubmit={handleSavePodcast} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Show Title</label>
                      <input 
                        type="text" 
                        required 
                        className="form-input" 
                        value={podcastForm.title} 
                        onChange={e => setPodcastForm({...podcastForm, title: e.target.value})} 
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Feed URL Slug (No spaces/symbols)</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="my-cool-show" 
                        className="form-input" 
                        value={podcastForm.feedSlug} 
                        onChange={e => setPodcastForm({...podcastForm, feedSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '')})} 
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Description / Summary</label>
                    <textarea 
                      className="form-textarea" 
                      value={podcastForm.description} 
                      onChange={e => setPodcastForm({...podcastForm, description: e.target.value})} 
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Author / Host Name</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={podcastForm.author} 
                        onChange={e => setPodcastForm({...podcastForm, author: e.target.value})} 
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Contact Email (Required for iTunes)</label>
                      <input 
                        type="email" 
                        className="form-input" 
                        value={podcastForm.email} 
                        onChange={e => setPodcastForm({...podcastForm, email: e.target.value})} 
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Category</label>
                      <select 
                        className="form-select" 
                        value={podcastForm.category} 
                        onChange={e => setPodcastForm({...podcastForm, category: e.target.value})}
                      >
                        <option>Arts</option>
                        <option>Business</option>
                        <option>Comedy</option>
                        <option>Education</option>
                        <option>Fiction</option>
                        <option>Government</option>
                        <option>History</option>
                        <option>Health & Fitness</option>
                        <option>Kids & Family</option>
                        <option>Leisure</option>
                        <option>Music</option>
                        <option>News</option>
                        <option>Religion & Spirituality</option>
                        <option>Science</option>
                        <option>Society & Culture</option>
                        <option>Sports</option>
                        <option>Technology</option>
                        <option>True Crime</option>
                        <option>TV & Film</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Language Code</label>
                      <input 
                        type="text" 
                        placeholder="en-us" 
                        className="form-input" 
                        value={podcastForm.language} 
                        onChange={e => setPodcastForm({...podcastForm, language: e.target.value})} 
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Website URL</label>
                      <input 
                        type="url" 
                        placeholder="https://" 
                        className="form-input" 
                        value={podcastForm.websiteUrl} 
                        onChange={e => setPodcastForm({...podcastForm, websiteUrl: e.target.value})} 
                      />
                    </div>
                    <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', height: '100%' }}>
                      <input 
                        type="checkbox" 
                        id="explicit-check" 
                        checked={podcastForm.explicit} 
                        onChange={e => setPodcastForm({...podcastForm, explicit: e.target.checked})}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <label htmlFor="explicit-check" className="form-label" style={{ cursor: 'pointer' }}>Contains Explicit Material</label>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-glass)', paddingTop: '24px', marginTop: '12px' }}>
                    <button type="button" className="btn btn-danger" onClick={() => handleDeletePodcast(selectedPodcast.id)}>
                      <Trash2 size={16} /> Delete Entire Podcast
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            )}

          </div>
        )}

      </main>

      {/* FLOATING AUDIO MINI PLAYER */}
      {playingEpisode && (
        <div className="glass-card" style={{ position: 'fixed', bottom: '24px', left: '304px', right: '24px', zIndex: 100, display: 'flex', alignItems: 'center', padding: '16px 24px', gap: '20px', background: 'rgba(11, 13, 25, 0.95)', border: '1px solid rgba(139, 92, 246, 0.4)', boxShadow: '0 -4px 32px rgba(139, 92, 246, 0.2)' }}>
          <button 
            onClick={() => handlePlayEpisode(playingEpisode)}
            style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justify: 'center', border: 'none', color: '#fff', cursor: 'pointer' }}
          >
            {audioState.playing ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: '2px' }} />}
          </button>
          
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem' }}>
              <span style={{ fontWeight: 500, maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {playingEpisode.title}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {formatDuration(Math.round(audioState.progress))} / {formatDuration(Math.round(audioState.duration))}
              </span>
            </div>
            
            <input 
              type="range"
              min="0"
              max={audioState.duration || 100}
              value={audioState.progress}
              onChange={handleProgressBarChange}
              style={{
                width: '100%',
                height: '4px',
                borderRadius: '2px',
                cursor: 'pointer',
                accentColor: 'var(--accent-primary)',
                background: 'rgba(255,255,255,0.1)'
              }}
            />
          </div>

          <button className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '0.8rem' }} onClick={handleStopAudio}>
            Close Player
          </button>
        </div>
      )}

      {/* HIDDEN AUDIO ELEMENT */}
      <audio 
        ref={audioRef} 
        onTimeUpdate={handleAudioTimeUpdate} 
        onEnded={handleAudioEnded}
        onPause={handleAudioPause}
        onPlay={handleAudioPlay}
      />

      {/* PODCAST CREATION/EDIT MODAL */}
      {showPodcastModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '640px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '24px' }}>
              {editPodcastTarget ? 'Edit Podcast Settings' : 'Create New Podcast'}
            </h2>
            <form onSubmit={handleSavePodcast} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input 
                  type="text" 
                  required 
                  className="form-input" 
                  value={podcastForm.title} 
                  onChange={e => setPodcastForm({...podcastForm, title: e.target.value})} 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Feed URL Slug * (Unique identifier, no spaces)</label>
                <input 
                  type="text" 
                  required 
                  placeholder="tech-talk" 
                  className="form-input" 
                  disabled={!!editPodcastTarget}
                  value={podcastForm.feedSlug} 
                  onChange={e => setPodcastForm({...podcastForm, feedSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '')})} 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description / Summary</label>
                <textarea 
                  className="form-textarea" 
                  value={podcastForm.description} 
                  onChange={e => setPodcastForm({...podcastForm, description: e.target.value})} 
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Author Name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={podcastForm.author} 
                    onChange={e => setPodcastForm({...podcastForm, author: e.target.value})} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Contact Email</label>
                  <input 
                    type="email" 
                    className="form-input" 
                    value={podcastForm.email} 
                    onChange={e => setPodcastForm({...podcastForm, email: e.target.value})} 
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select 
                    className="form-select" 
                    value={podcastForm.category} 
                    onChange={e => setPodcastForm({...podcastForm, category: e.target.value})}
                  >
                    <option>Arts</option>
                    <option>Business</option>
                    <option>Comedy</option>
                    <option>Education</option>
                    <option>Fiction</option>
                    <option>Government</option>
                    <option>History</option>
                    <option>Health & Fitness</option>
                    <option>Kids & Family</option>
                    <option>Leisure</option>
                    <option>Music</option>
                    <option>News</option>
                    <option>Religion & Spirituality</option>
                    <option>Science</option>
                    <option>Society & Culture</option>
                    <option>Sports</option>
                    <option>Technology</option>
                    <option>True Crime</option>
                    <option>TV & Film</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Language Code</label>
                  <input 
                    type="text" 
                    placeholder="en-us" 
                    className="form-input" 
                    value={podcastForm.language} 
                    onChange={e => setPodcastForm({...podcastForm, language: e.target.value})} 
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPodcastModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Podcast</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EPISODE CREATION/EDIT MODAL */}
      {showEpisodeModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '640px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '24px' }}>
              {editEpisodeTarget ? 'Edit Episode Details' : 'Create New Episode'}
            </h2>
            <form onSubmit={handleSaveEpisode} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* AUDIO UPLOAD AREA */}
              <div style={{ border: '2px dashed var(--border-glass)', padding: '20px', borderRadius: 'var(--radius-md)', background: 'rgba(0,0,0,0.1)', textAlign: 'center', position: 'relative' }}>
                <input 
                  type="file" 
                  accept="audio/mpeg, audio/mp3, audio/m4a" 
                  id="episode-audio-input" 
                  onChange={handleAudioSelection} 
                  style={{ display: 'none' }} 
                  disabled={isUploading}
                />
                
                {isUploading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                    <Upload size={24} className="pulse-glow" style={{ color: 'var(--accent-primary)' }} />
                    <span style={{ fontSize: '0.9rem' }}>Uploading: {uploadProgress}%</span>
                    <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--accent-primary)', transition: 'width 0.1s ease' }}></div>
                    </div>
                  </div>
                ) : (
                  <label htmlFor="episode-audio-input" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <Upload size={24} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                      {selectedAudioName ? selectedAudioName : 'Select Audio Track (.mp3, .m4a)'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {episodeForm.audioDuration ? `Duration detected: ${formatDuration(episodeForm.audioDuration)}` : 'Duration automatically calculated'}
                    </span>
                  </label>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Episode Title *</label>
                <input 
                  type="text" 
                  required 
                  className="form-input" 
                  value={episodeForm.title} 
                  onChange={e => setEpisodeForm({...episodeForm, title: e.target.value})} 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description / Show Notes</label>
                <textarea 
                  className="form-textarea" 
                  value={episodeForm.description} 
                  onChange={e => setEpisodeForm({...episodeForm, description: e.target.value})} 
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Season Number</label>
                  <input 
                    type="number" 
                    placeholder="e.g. 1" 
                    className="form-input" 
                    value={episodeForm.seasonNumber} 
                    onChange={e => setEpisodeForm({...episodeForm, seasonNumber: e.target.value})} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Episode Number</label>
                  <input 
                    type="number" 
                    placeholder="e.g. 12" 
                    className="form-input" 
                    value={episodeForm.episodeNumber} 
                    onChange={e => setEpisodeForm({...episodeForm, episodeNumber: e.target.value})} 
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Publication Date & Time *</label>
                  <input 
                    type="datetime-local" 
                    required 
                    className="form-input" 
                    value={episodeForm.publishDate} 
                    onChange={e => setEpisodeForm({...episodeForm, publishDate: e.target.value})} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Publication Status</label>
                  <select 
                    className="form-select" 
                    value={episodeForm.status} 
                    onChange={e => setEpisodeForm({...episodeForm, status: e.target.value})}
                  >
                    <option value="draft">Draft (Not in feed)</option>
                    <option value="published">Published</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center' }}>
                <input 
                  type="checkbox" 
                  id="episode-explicit-check" 
                  checked={episodeForm.explicit} 
                  onChange={e => setEpisodeForm({...episodeForm, explicit: e.target.checked})}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="episode-explicit-check" className="form-label" style={{ cursor: 'pointer' }}>Episode contains explicit language/themes</label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEpisodeModal(false)} disabled={isUploading}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isUploading || !episodeForm.audioUrl}>Save Episode</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AUDIO EDITOR MODAL */}
      {showAudioEditor && editEpisodeTarget && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px', overflowY: 'auto' }}>
          <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '900px', padding: '32px', marginY: '40px' }}>
            <AudioEditor 
              episode={editEpisodeTarget} 
              onClose={() => {
                setShowAudioEditor(false);
                setEditEpisodeTarget(null);
              }}
              onSave={() => {
                fetchEpisodes(selectedPodcast.id);
              }}
            />
          </div>
        </div>
      )}

    </div>
  );
}
