# 🎙️ Podcastarama Audio Editing Suite

Complete guide to using Podcastarama's integrated audio editing, analysis, and trimming system.

---

## 🎯 Features

Podcastarama now includes a comprehensive audio editing system for managing podcast episodes:

### ✨ Core Features

1. **Waveform Visualization** 📊
   - Real-time visual representation of audio waveform
   - Interactive playback with progress tracking
   - Zoom and navigate through the audio timeline

2. **Auto-Detection of Song Segments** 🎵
   - Automatic silence detection (identifies intro/outro songs)
   - Displays detected segments with start/end times
   - Suggests segments for removal with one-click trimming

3. **Manual Trimming Controls** ✂️
   - Precise start and end time controls (to 0.1 seconds)
   - Preview area showing what will be kept
   - Visual summary of removed segments

4. **Audio File Management** 💾
   - Non-destructive editing (automatic backups)
   - Restore previous versions from backup
   - Real-time file size and duration updates

---

## 🚀 Getting Started

### ⚡ Quick Answer: Use Manual Trimming

For most podcasts with **short intro/outro songs (< 2 seconds) or songs with background music**, use **Manual Trimming** - it's the most reliable method.

**See [MANUAL_TRIMMING_GUIDE.md](./MANUAL_TRIMMING_GUIDE.md)** for step-by-step instructions with examples.

---

### Accessing the Audio Editor

1. **In the Episodes List:**
   - Locate the episode you want to edit
   - Click the **✨ (magic wand)** button next to the episode
   - This opens the Audio Editor modal

2. **From Episode Details:**
   - Click **Edit Episode** (pencil icon)
   - Audio editor controls appear in the modal

### Basic Workflow

```
Upload Audio File
        ↓
     Click "✨ Edit Audio"
        ↓
     Review Waveform
        ↓
  Auto-Analyze Segments
        ↓
  Select Segments to Remove
        ↓
   Apply Trim
        ↓
   Save & Publish
```

---

## 🔧 Using the Audio Editor

### 1. Waveform Visualization

The waveform is displayed at the top of the editor:

```
┌─────────────────────────────────────────────────┐
│     🌊 Audio Waveform (purple gradient)         │
│                                                 │
│  ▼ (Current playback position)                  │
└─────────────────────────────────────────────────┘
```

**Controls:**
- **▶ Play/Pause Button**: Start/stop playback
- **Time Display**: Shows current position / total duration
- **Click on Waveform**: Seek to position

### 2. Auto-Detection of Silence Segments

After uploading, click **"Re-analyze"** to detect potential song segments:

```
Auto-Detected Segments (5 found)

[00:00:15 → 00:00:45] (00:00:30)  [Trim This]
[00:15:00 → 00:15:30] (00:00:30)  [Trim This]
[01:22:45 → 01:23:15] (00:00:30)  [Trim This]
...
```

**What It Detects:**
- Silence periods > 0.5 seconds
- Often corresponds to intro/outro songs
- Marked by FFmpeg's silence detection filter

**Interpreting Results:**
- Segments with **no voice/speaking** are likely songs
- Segments with **high volume spikes** without speech = music
- Segments with **very quiet audio** = silence/dead air

### 3. Manual Trim Controls

Use manual controls for precise editing:

```
Keep from (seconds)     Keep until (seconds)
[  0.0  ] 0:00          [ 600.0 ] 10:00

Will keep: 10:00 seconds
(removing 0:00 from start + 2:30 from end)
```

**Setting Start/End Times:**
1. Enter the start time (in seconds) where you want to keep audio
2. Enter the end time where you want to keep audio end
3. The preview shows what will be removed
4. Adjust with slider or direct input

**Example: Remove 30-second intro**
- Start Time: `30.0` (keep from 30 seconds)
- End Time: Keep default or set to total duration
- Result: First 30 seconds removed

**Example: Remove 2-minute outro**
- Assuming 1-hour episode (3600 seconds)
- Start Time: `0.0` (keep from beginning)
- End Time: `3480.0` (keep until 58:00, remove last 2 min)
- Result: Last 2 minutes removed

---

## 📊 Auto-Detection Deep Dive

### How Silence Detection Works

Podcastarama uses **FFmpeg's silencedetect filter** to automatically identify segments where the audio level drops below a threshold:

```bash
# Technical command used:
ffmpeg -i audio.mp3 -af silencedetect=n=-40dB:d=2 -f null -
```

**Parameters:**
- `n=-40dB`: Silence threshold (-40 decibels) - picks up quiet background
- `d=2`: Minimum silence duration (**2 seconds**) - focuses on actual intro/outro songs, not speech pauses

**Updated:** Previously was `d=0.5` which found too many ~1 second pauses in speech. Now set to `d=2` to find actual songs!

### What It Detects Well

✅ **Intro/Outro Songs** - Usually include silent passages  
✅ **Music Segments** - Often have quieter moments or intros  
✅ **Dead Air** - Complete silence between segments  
✅ **Transitions** - Fades between music and speech  

### What It Doesn't Detect

❌ **Quiet Speech** - Soft-spoken segments above threshold  
❌ **Background Music** - If mixed with speech at -40dB+  
❌ **Subtle Fades** - Very gradual volume changes  

### Refining Detection

If auto-detection isn't perfect:

1. **Review the Waveform** - Visual inspection is very reliable
2. **Use Manual Trimming** - Precise control over start/end
3. **Re-Analyze** - Try again with different settings (backend can be tuned)

---

## 💾 File Management & Safety

### Backup System

Podcastarama automatically backs up your original audio:

```
uploads/audio/
├── episode-123-original.mp3           (your original)
├── episode-123-backup-1693840000.mp3  (after 1st trim)
├── episode-123-backup-1693840120.mp3  (after 2nd trim)
└── episode-123-trimmed.mp3            (current active)
```

### Restoring from Backup

Click **"Restore Backup"** to:
- Undo the last trim operation
- Revert to the previous file version
- Keep backups for future reference

**Important:** Only the most recent backup is kept to save storage.

---

## 🎬 Workflow Examples

### Example 1: Remove Intro Song (30 seconds)

Episode: "My Podcast Episode 42" (Duration: 1:05:30 = 3930 seconds)

**Steps:**
1. Click "Edit Audio" (✨) button
2. Wait for waveform to load and play
3. Click "Re-analyze" to detect segments
4. **See detected silence at 0:00-0:30** ← Likely intro song
5. Click "Trim This" on that segment
6. Verify trim range: Start `0`, End `3900`
3. Click **"Apply Trim"**
4. Wait for trimming (~10-30 seconds depending on file size)
5. ✅ Episode now saved at 1:05:00

### Example 2: Remove Intro & Outro Songs

Episode: "Interview Show" (Duration: 45:00 = 2700 seconds)

**Steps:**
1. Open Audio Editor
2. Re-analyze and find:
   - Segment 1: `0:00-0:45` (intro song)
   - Segment 2: `44:15-45:00` (outro song)
3. For **First Trim:**
   - Start Time: `45.0` (skip intro)
   - End Time: `2655.0` (keep until 44:15)
   - Click "Apply Trim"
4. After first trim, **Restore Backup**
5. For **Second Approach** (trim both at once):
   - Start Time: `45.0`
   - End Time: `2655.0`
   - This removes both in one operation ✂️

### Example 3: Manual Edit (No Auto-Detection)

Episode: "Podcast #5" (Duration: 30:00)

**You want to keep only 15:00-20:00 (middle 5 minutes)**

**Steps:**
1. Open Audio Editor
2. Ignore auto-detected segments
3. Under "Manual Trim":
   - Start Time: `900.0` (15:00)
   - End Time: `1200.0` (20:00)
4. Preview shows: "Will keep 5:00 seconds"
5. Click "Apply Trim"
6. ✅ Episode now contains only those 5 minutes

---

## 🛠️ Technical Details

### API Endpoints Used

**Analyze Audio:**
```bash
GET /api/episodes/:id/analyze
Response: { silenceSegments: [...], totalDuration, detectionMethod }
```

**Trim Audio:**
```bash
POST /api/episodes/:id/trim
Body: { startTime: <seconds>, endTime: <seconds> }
Response: { success: true, newSize, newDuration, backup }
```

**Restore from Backup:**
```bash
POST /api/episodes/:id/restore
Response: { message: "Audio restored from backup", backup: <path> }
```

### Time Format

All times are in **seconds** (floating point):
- `0.5` = 0.5 seconds
- `30.0` = 30 seconds (0:30)
- `125.5` = 2 minutes 5.5 seconds (2:05.5)
- `3661.0` = 1 hour, 1 minute, 1 second (1:01:01)

### Supported Audio Formats

- ✅ **MP3** (.mp3) - Most compatible
- ✅ **M4A** (.m4a) - iPhone/Apple compatible
- ✅ Other formats supported by FFmpeg

---

## 📋 Best Practices

### Before Trimming

1. ✅ **Always listen to the preview** - Play the segment to confirm
2. ✅ **Test on a copy first** - Try editing test files first
3. ✅ **Note the original duration** - Remember what you started with
4. ✅ **Check file size** - Very large files take longer to process

### During Trimming

1. ✅ **Don't close the browser** - Wait for the trim to complete
2. ✅ **Watch the progress** - Spinner indicates processing
3. ✅ **Be patient** - Trimming large files can take 30+ seconds

### After Trimming

1. ✅ **Verify the result** - Play the episode to confirm quality
2. ✅ **Update metadata if needed** - Adjust duration if it changed significantly
3. ✅ **Publish when ready** - Set episode status to "Published"
4. ✅ **Backups are automatic** - No need to manually backup

---

## ⚠️ Troubleshooting

### Issue: "Audio won't load in waveform"
**Solution:**
- Check file format (MP3 or M4A recommended)
- Verify file isn't corrupted
- Try re-uploading the audio file

### Issue: "No segments detected"
**Solution:**
- Silence detection threshold may not match your audio
- Use manual trimming instead
- Intro/outro may not have significant silence

### Issue: "Trimming is very slow"
**Solution:**
- This is normal for large files (500MB+ takes 30-60 seconds)
- FFmpeg needs to re-encode the audio
- Don't close the browser during trimming

### Issue: "Trimmed file sounds wrong"
**Solution:**
- Click **"Restore Backup"** to undo
- Try adjusting start/end times slightly
- Verify you want to remove the correct segment

### Issue: "Backup not available"
**Solution:**
- Backups only kept for the most recent trim
- Older trims cannot be restored
- You can re-trim from scratch if needed

---

## 📈 Performance Notes

**File Processing Times:**

| File Size | Estimated Time |
|-----------|----------------|
| 10 MB | 5-10 seconds |
| 50 MB | 10-20 seconds |
| 100 MB | 20-40 seconds |
| 300 MB (max) | 60-120 seconds |

**Factors Affecting Speed:**
- Server CPU load
- Audio bitrate (higher = slower)
- Trim complexity (multiple segments)
- Server disk I/O speed

---

## 🔐 Privacy & Storage

- ✅ All audio trimming happens **on your server** (49.176.164.137)
- ✅ No audio leaves your server
- ✅ Backups stored locally
- ✅ Temporary files cleaned up automatically
- ✅ You control all data

---

## 📞 Getting Help

If you encounter issues:

1. **Check the troubleshooting section** above
2. **Review server logs**: `backend/podcastarama.db` database stores episode info
3. **Check file permissions**: Ensure `uploads/` directory is writable
4. **Verify FFmpeg**: Run `which ffmpeg` to confirm installation
5. **Backend must be running**: API endpoints require the Node.js server

---

## 🎓 Learn More

- **Waveform Library**: https://wavesurfer.xyz/
- **FFmpeg Docs**: https://ffmpeg.org/documentation.html
- **Audio Formats**: https://en.wikipedia.org/wiki/Audio_codec

---

## Changelog

**v1.0.0** (2024)
- ✨ Initial Audio Editor release
- ✨ Waveform visualization with Wavesurfer.js
- ✨ Automatic silence detection with FFmpeg
- ✨ Manual trim controls with backup system
- ✨ Full integration with episode management
