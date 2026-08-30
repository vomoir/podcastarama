import React, { useState, useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { Play, Pause, Square, Trash2, RotateCcw, Save, Loader, Info, Music } from 'lucide-react';

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:5000' 
  : window.location.origin;

export default function AudioEditor({ episode, onClose, onSave }) {
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);
   
  // Trim state
  const [trimMode, setTrimMode] = useState(null); // null | 'auto' | 'manual'
  const [selectedSegments, setSelectedSegments] = useState([]); // segments to REMOVE
  const [manualStart, setManualStart] = useState(0);
  const [manualEnd, setManualEnd] = useState(0);
  const [isTrimming, setIsTrimming] = useState(false);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const waveformRef = useRef(null);
  const wavesurferRef = useRef(null);

  // Playback queue for selected regions
  const playQueueRef = useRef([]);
  const playIndexRef = useRef(0);
  const playingSelectionRef = useRef(false);
  const audioprocessHandlerRef = useRef(null);

  const createWaveSurfer = (audioUrl) => {
    if (!waveformRef.current) return null;

    const regionsPlugin = RegionsPlugin.create({
      color: 'rgba(168, 85, 247, 0.22)'
    });

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: 'rgba(139, 92, 246, 0.3)',
      progressColor: 'rgba(139, 92, 246, 0.8)',
      cursorColor: 'rgb(139, 92, 246)',
      barWidth: 2,
      barGap: 1,
      responsive: true,
      height: 100,
      normalize: true,
      backend: 'WebAudio',
      plugins: [regionsPlugin]
    });

    ws.on('ready', () => {
      console.log('[AudioEditor] Audio loaded, duration:', ws.getDuration());
      setDuration(ws.getDuration());
      setCurrentTime(0);

      const dragSelection = regionsPlugin.enableDragSelection({
        color: 'rgba(168, 85, 247, 0.22)'
      }, 3);

      if (typeof dragSelection === 'function') {
        ws.__dragSelectionCleanup = dragSelection;
      }
    });

    ws.on('error', (error) => {
      console.error('[AudioEditor] Audio loading error:', error);
      setError(`Failed to load audio: ${error?.message || 'Unknown error'}`);
    });

    ws.on('timeupdate', () => {
      setCurrentTime(ws.getCurrentTime());
    });

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));

    ws.on('region-created', (region) => {
      pushRegionSelection(region);
      console.log('[AudioEditor] Region selected:', region.start, region.end);
    });

    ws.on('region-click', (region) => {
      pushRegionSelection(region);
    });

    console.log('[AudioEditor] Loading audio from:', audioUrl);
    ws.load(audioUrl);
    wavesurferRef.current = ws;
    return ws;
  };

  // Initialize Wavesurfer
  useEffect(() => {
    if (!waveformRef.current) return;

    const audioUrl = episode.audioUrl.startsWith('http')
      ? episode.audioUrl
      : `${API_BASE}${episode.audioUrl}`;

    if (wavesurferRef.current) {
      try {
        wavesurferRef.current.destroy();
      } catch {}
      wavesurferRef.current = null;
    }

    const ws = createWaveSurfer(audioUrl);

    return () => {
      if (ws) {
        try {
          if (ws.__dragSelectionCleanup) ws.__dragSelectionCleanup();
        } catch {}
        try {
          ws.stop();
        } catch {}
        try {
          ws.destroy();
        } catch {}
      }
      wavesurferRef.current = null;
    };
  }, [episode.audioUrl]);

  // Auto-analyze on mount
  useEffect(() => {
    analyzeAudio();
  }, []);

  const formatTime = (seconds) => {
    if (!seconds) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  };

  const analyzeAudio = async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/episodes/${episode.id}/analyze`);
      if (!res.ok) throw new Error('Analysis failed');
      const data = await res.json();
      setAnalysis(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const stopCurrentSelectionPlayback = () => {
    const ws = wavesurferRef.current;
    try {
      if (audioprocessHandlerRef.current && ws) {
        ws.un('audioprocess', audioprocessHandlerRef.current);
        audioprocessHandlerRef.current = null;
      }
    } catch (e) {}

    try { ws && ws.pause(); } catch (e) {}
    playingSelectionRef.current = false;
    playQueueRef.current = [];
    playIndexRef.current = 0;
    setIsPlaying(false);
  };

  const playSegmentAtIndex = (index) => {
    const ws = wavesurferRef.current;
    const queue = playQueueRef.current || [];
    if (!ws || index >= queue.length) {
      stopCurrentSelectionPlayback();
      return;
    }

    const seg = queue[index];
    playIndexRef.current = index;

    // Try to find a real region object (if present) to use region.play()
    let regionObj = null;
    try {
      const regionsContainer = ws.regions && (ws.regions.list || ws.regions.getRegions && ws.regions.getRegions());
      const regionsList = regionsContainer ? (Array.isArray(regionsContainer) ? regionsContainer : Object.values(regionsContainer)) : [];
      regionObj = regionsList.find(r => Math.abs(r.start - seg.start) < 0.05 && Math.abs(r.end - seg.end) < 0.05);
    } catch (e) { regionObj = null; }

    playingSelectionRef.current = true;

    if (regionObj && regionObj.play) {
      // listen for region-out for this region
      const onRegionOut = (r) => {
        try { ws.un('region-out', onRegionOut); } catch (e) {}
        // advance to next
        playSegmentAtIndex(index + 1);
      };
      try { ws.on('region-out', onRegionOut); } catch (e) {}
      try { regionObj.play(); } catch (e) { playSegmentAtIndex(index + 1); }
      setIsPlaying(true);
      return;
    }

    // Fallback: play via play(start, end) and watch audioprocess
    const onProcess = (time) => {
      if (time >= seg.end - 0.05) {
        try { ws.un('audioprocess', onProcess); } catch (e) {}
        try { ws.pause(); } catch (e) {}
        playSegmentAtIndex(index + 1);
      }
    };

    audioprocessHandlerRef.current = onProcess;
    try { ws.on('audioprocess', onProcess); } catch (e) {}
    try { ws.play(seg.start, seg.end); } catch (e) { onProcess(ws.getCurrentTime ? ws.getCurrentTime() : 0); }
    setIsPlaying(true);
  };

  const togglePlayback = () => {
    const segments = normalizeSegments(selectedSegments || []);

    // If already playing a selection, stop it
    if (playingSelectionRef.current) {
      stopCurrentSelectionPlayback();
      return;
    }

    // If user has selected regions, play them sequentially
    if (segments.length > 0) {
      playQueueRef.current = segments;
      playIndexRef.current = 0;
      playSegmentAtIndex(0);
      return;
    }

    // Default behavior: play/pause the whole track
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };

  const clearSelection = () => {
    if (wavesurferRef.current && wavesurferRef.current.regions) {
      wavesurferRef.current.regions.clear();
    }
    setSelectedSegments([]);
    setManualStart(0);
    setManualEnd(0);
    setTrimMode(null);
  };

  const removeSelectedSegment = (segmentToRemove) => {
    const remaining = normalizeSegments(selectedSegments).filter(seg => !(Math.abs(seg.start - segmentToRemove.start) < 0.01 && Math.abs(seg.end - segmentToRemove.end) < 0.01));

    if (wavesurferRef.current && wavesurferRef.current.regions) {
      const regions = wavesurferRef.current.regions.list;
      Object.values(regions).forEach((region) => {
        if (Math.abs(region.start - segmentToRemove.start) < 0.01 && Math.abs(region.end - segmentToRemove.end) < 0.01) {
          region.remove();
        }
      });
    }

    setSelectedSegments(remaining);
  };

  const confirmTrimSelectedRegions = () => {
    const segments = normalizeSegments(selectedSegments);
    if (!segments.length) {
      setError('Select a waveform region or auto-detected segment first.');
      return false;
    }

    const summary = segments
      .map((seg, idx) => `#${idx + 1}: ${formatTime(seg.start)} → ${formatTime(seg.end)} (${formatTime(seg.end - seg.start)})`)
      .join('\n');

    return window.confirm(`This will remove the selected region(s) and keep everything else.\n\n${summary}`);
  };

  const forceStopPlayback = () => {
    if (!wavesurferRef.current) return;

    try {
      const media = wavesurferRef.current.getMediaElement ? wavesurferRef.current.getMediaElement() : null;
      if (media) {
        media.pause();
        media.currentTime = 0;
      }
    } catch {}

    try {
      wavesurferRef.current.stop();
    } catch {}

    try {
      wavesurferRef.current.pause();
    } catch {}

    try {
      wavesurferRef.current.setTime(0);
    } catch {}

    try {
      wavesurferRef.current.destroy();
    } catch {}

    const audioUrl = episode.audioUrl.startsWith('http')
      ? episode.audioUrl
      : `${API_BASE}${episode.audioUrl}`;

    wavesurferRef.current = null;
    setIsPlaying(false);
    setCurrentTime(0);

    setTimeout(() => {
      try {
        createWaveSurfer(audioUrl);
      } catch (err) {
        console.error('[AudioEditor] Emergency stop reload failed:', err);
      }
    }, 50);
  };

  const toggleSegmentSelection = (segment) => {
    setSelectedSegments(prev => {
      const exists = prev.some(s => s.start === segment.start && s.end === segment.end);
      if (exists) {
        return prev.filter(s => !(s.start === segment.start && s.end === segment.end));
      } else {
        return [...prev, segment];
      }
    });
  };

  const normalizeSegments = (segments = []) => {
    return segments
      .filter(s => s && Number.isFinite(Number(s.start)) && Number.isFinite(Number(s.end)))
      .map(s => ({ start: Number(s.start), end: Number(s.end) }))
      .filter(s => s.end > s.start)
      .sort((a, b) => a.start - b.start);
  };

  const pushRegionSelection = (region) => {
    const segment = { start: region.start, end: region.end };
    setSelectedSegments(prev => {
      const normalized = normalizeSegments(prev);
      const exists = normalized.some(s => Math.abs(s.start - segment.start) < 0.01 && Math.abs(s.end - segment.end) < 0.01);
      if (exists) return normalized;
      return [...normalized, segment];
    });
    setManualStart(segment.start);
    setManualEnd(segment.end);
    setTrimMode('manual');
  };

  const handleTrimClick = (segment) => {
    setTrimMode('auto');
    setManualStart(segment.start);
    setManualEnd(segment.end);
  };

  const performTrim = async () => {
    if (manualStart >= manualEnd) {
      setError('Invalid trim range');
      return;
    }

    setIsTrimming(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/episodes/${episode.id}/trim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startTime: manualStart,
          endTime: manualEnd
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      const result = await res.json();
      alert(`✅ Trimmed! New duration: ${formatTime(result.newDuration)}`);
      onSave && onSave();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsTrimming(false);
    }
  };

  const trimSelectedRegion = async () => {
    const segments = normalizeSegments(selectedSegments);
    if (!segments.length) {
      setError('Select a waveform region or auto-detected segment first.');
      return;
    }

    if (!confirmTrimSelectedRegions()) {
      return;
    }

    setIsTrimming(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/episodes/${episode.id}/trim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segments })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      const result = await res.json();
      alert(`✅ Trimmed ${segments.length} selected region(s)! New duration: ${formatTime(result.newDuration)}`);
      onSave && onSave();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsTrimming(false);
    }
  };

  const restoreAudio = async () => {
    if (!window.confirm('Restore last backup? This will undo the last trim.')) return;

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/episodes/${episode.id}/restore`, {
        method: 'POST'
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      alert('✅ Audio restored from backup');
      onSave && onSave();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '900px' }}>
      <h2 style={{ marginTop: 0 }}>🎙️ Audio Editor: {episode.title}</h2>

      {/* Waveform Viewer */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-glass)',
        borderRadius: '8px',
        padding: '15px',
        marginBottom: '20px'
      }}>
        <h3 style={{ marginTop: 0, fontSize: '14px', textTransform: 'uppercase', opacity: 0.7 }}>
          Waveform Visualization
        </h3>
        <div 
          ref={waveformRef} 
          style={{
            background: 'linear-gradient(180deg, rgba(139, 92, 246, 0.1) 0%, transparent 100%)',
            borderRadius: '4px',
            marginBottom: '10px'
          }}
        />
        
        {/* Playback Controls */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={togglePlayback}
              style={{
                padding: '8px 16px',
                background: 'var(--accent-primary)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                gap: '6px',
                alignItems: 'center'
              }}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              {isPlaying ? 'Playing' : 'Play'}
            </button>

            <button
              onClick={forceStopPlayback}
              title="Emergency stop: kills stuck playback instantly"
              style={{
                padding: '8px 14px',
                background: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                gap: '6px',
                alignItems: 'center',
                fontWeight: 600
              }}
            >
              <Square size={14} />
              Kill Audio
            </button>

            <button
              onClick={clearSelection}
              title="Clear region selection"
              style={{
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.06)',
                color: 'inherit',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Clear Selection
            </button>
          </div>
          <div style={{ fontSize: '12px', opacity: 0.7 }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        <div style={{ marginTop: '10px', fontSize: '12px', opacity: 0.7 }}>
          Drag across the waveform to select a trim region. Click selected area to reuse it in the manual trim fields below.
        </div>

        {normalizeSegments(selectedSegments).length > 0 && (
          <div style={{ marginTop: '12px', background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.25)', borderRadius: '8px', padding: '12px' }}>
            <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7, marginBottom: '8px' }}>
              Selected Regions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {normalizeSegments(selectedSegments).map((segment, idx) => (
                <div
                  key={`${segment.start}-${segment.end}-${idx}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '6px',
                    padding: '8px 10px'
                  }}
                >
                  <button
                    onClick={() => {
                      setManualStart(segment.start);
                      setManualEnd(segment.end);
                      setTrimMode('manual');
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'inherit',
                      cursor: 'pointer',
                      textAlign: 'left',
                      flex: 1,
                      padding: 0,
                      fontSize: '13px'
                    }}
                  >
                    <strong>Region {idx + 1}:</strong> {formatTime(segment.start)} → {formatTime(segment.end)} ({formatTime(segment.end - segment.start)})
                  </button>
                  <button
                    onClick={() => removeSelectedSegment(segment)}
                    title="Remove this region"
                    style={{
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      color: '#fca5a5',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      padding: '4px 8px',
                      fontSize: '12px'
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Analysis Results */}
      {analysis && (
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-glass)',
          borderRadius: '8px',
          padding: '15px',
          marginBottom: '20px'
        }}>
          <h3 style={{ marginTop: 0, fontSize: '14px', textTransform: 'uppercase', opacity: 0.7 }}>
            <Music size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Auto-Detected Song Segments ({analysis.silenceSegments.length})
          </h3>

          {analysis.silenceSegments.length === 0 ? (
            <div style={{ opacity: 0.6, fontSize: '13px' }}>
              ℹ️ No significant silence detected (2+ seconds). This usually means:
              <ul style={{ marginTop: '8px', paddingLeft: '20px', opacity: 0.8 }}>
                <li>No intro/outro songs with silence</li>
                <li>Songs overlap with speech</li>
                <li>Consider manual trimming with time controls below</li>
              </ul>
            </div>
          ) : (
            <div>
              <div style={{ opacity: 0.7, fontSize: '12px', marginBottom: '10px' }}>
                🎵 These are silent passages (2+ seconds) - likely intro/outro songs or transitions:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {analysis.silenceSegments.slice(0, 5).map((seg, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(139, 92, 246, 0.15)',
                      border: selectedSegments.some(s => s.start === seg.start) 
                        ? '2px solid var(--accent-primary)' 
                        : '1px solid rgba(139, 92, 246, 0.3)',
                      borderRadius: '6px',
                      padding: '10px',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => toggleSegmentSelection(seg)}
                  >
                    <div style={{ fontSize: '13px' }}>
                      <strong>{formatTime(seg.start)}</strong> → <strong>{formatTime(seg.end)}</strong>
                      <span style={{ marginLeft: '10px', opacity: 0.6 }}>
                        ({formatTime(seg.duration)})
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTrimClick(seg);
                      }}
                      style={{
                        padding: '4px 12px',
                        background: 'var(--accent-primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Trim This
                    </button>
                  </div>
                ))}
                {analysis.silenceSegments.length > 5 && (
                  <div style={{ opacity: 0.6, fontSize: '12px' }}>
                    + {analysis.silenceSegments.length - 5} more segments (2+ seconds of silence)
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Trim Controls */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-glass)',
        borderRadius: '8px',
        padding: '15px',
        marginBottom: '20px'
      }}>
        <h3 style={{ marginTop: 0, fontSize: '14px', textTransform: 'uppercase', opacity: 0.7 }}>
          Manual Trim
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', opacity: 0.7, marginBottom: '6px' }}>
              Keep from (seconds)
            </label>
            <input
              type="number"
              min="0"
              max={duration}
              step="0.1"
              value={manualStart}
              onChange={(e) => setManualStart(parseFloat(e.target.value))}
              style={{
                width: '100%',
                padding: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '4px',
                color: 'inherit'
              }}
            />
            <div style={{ fontSize: '11px', opacity: 0.5, marginTop: '4px' }}>
              {formatTime(manualStart)}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', opacity: 0.7, marginBottom: '6px' }}>
              Keep until (seconds)
            </label>
            <input
              type="number"
              min="0"
              max={duration}
              step="0.1"
              value={manualEnd}
              onChange={(e) => setManualEnd(parseFloat(e.target.value))}
              style={{
                width: '100%',
                padding: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '4px',
                color: 'inherit'
              }}
            />
            <div style={{ fontSize: '11px', opacity: 0.5, marginTop: '4px' }}>
              {formatTime(manualEnd)}
            </div>
          </div>
        </div>
        <div style={{
          background: 'rgba(139, 92, 246, 0.1)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: '6px',
          padding: '10px',
          fontSize: '12px',
          marginBottom: '15px'
        }}>
          ✂️ <strong>Will keep:</strong> {formatTime(manualEnd - manualStart)} seconds
          <br />
          <span style={{ opacity: 0.7 }}>
            (removing {formatTime(manualStart)} from start + {formatTime(duration - manualEnd)} from end)
          </span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '6px',
          padding: '12px',
          marginBottom: '15px',
          color: '#fca5a5',
          fontSize: '13px'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        gap: '10px',
        justifyContent: 'flex-end',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={analyzeAudio}
          disabled={isAnalyzing}
          style={{
            padding: '8px 16px',
            background: 'rgba(139, 92, 246, 0.2)',
            color: 'var(--accent-primary)',
            border: '1px solid var(--accent-primary)',
            borderRadius: '6px',
            cursor: isAnalyzing ? 'not-allowed' : 'pointer',
            opacity: isAnalyzing ? 0.5 : 1,
            display: 'flex',
            gap: '6px',
            alignItems: 'center'
          }}
        >
          {isAnalyzing ? <Loader size={16} className="spin" /> : <Info size={16} />}
          Re-analyze
        </button>

        <button
          onClick={restoreAudio}
          disabled={isLoading}
          style={{
            padding: '8px 16px',
            background: 'rgba(100, 116, 139, 0.2)',
            color: 'rgb(148, 163, 184)',
            border: '1px solid rgb(148, 163, 184)',
            borderRadius: '6px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            display: 'flex',
            gap: '6px',
            alignItems: 'center'
          }}
        >
          <RotateCcw size={16} />
          Restore Backup
        </button>

        <button
          onClick={trimSelectedRegion}
          disabled={isTrimming || normalizeSegments(selectedSegments).length === 0}
          style={{
            padding: '8px 16px',
            background: '#8b5cf6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: isTrimming || normalizeSegments(selectedSegments).length === 0 ? 'not-allowed' : 'pointer',
            opacity: isTrimming || normalizeSegments(selectedSegments).length === 0 ? 0.5 : 1,
            display: 'flex',
            gap: '6px',
            alignItems: 'center'
          }}
        >
          {isTrimming ? <Loader size={16} className="spin" /> : <Save size={16} />}
          {isTrimming ? 'Trimming...' : 'Trim Selected Region'}
        </button>

        <button
          onClick={performTrim}
          disabled={isTrimming || manualStart >= manualEnd}
          style={{
            padding: '8px 16px',
            background: 'rgba(139, 92, 246, 0.2)',
            color: 'var(--accent-primary)',
            border: '1px solid var(--accent-primary)',
            borderRadius: '6px',
            cursor: isTrimming || manualStart >= manualEnd ? 'not-allowed' : 'pointer',
            opacity: isTrimming || manualStart >= manualEnd ? 0.5 : 1,
            display: 'flex',
            gap: '6px',
            alignItems: 'center'
          }}
        >
          {isTrimming ? <Loader size={16} className="spin" /> : <Save size={16} />}
          {isTrimming ? 'Trimming...' : 'Apply Trim'}
        </button>

        <button
          onClick={onClose}
          style={{
            padding: '8px 16px',
            background: 'transparent',
            color: 'inherit',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Close
        </button>
      </div>

      <style>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
