# 🎙️ Manual Audio Trimming Guide

**Podcastarama** includes a powerful **Manual Trim** feature that lets you precisely remove intro/outro songs or edit any part of your podcast audio.

## When to Use Manual Trimming

✅ **Use Manual Trim when:**
- Your intro/outro songs are **shorter than 2 seconds**
- Your intro/outro has **background music or noise** (not pure silence)
- You want **precise control** over what gets removed
- You need to edit **multiple segments** (intro AND outro)
- Auto-detection misses your intro/outro

✅ **Most Reliable** - works with any podcast format

## Step-by-Step Workflow

### 1️⃣ Upload & Open Audio Editor
```
Podcast Episode → Upload Audio File → Click ✨ Edit Audio
```

### 2️⃣ Play & Identify Times
In the **Waveform Visualization** section:
1. Click ▶️ **Play** to listen to the audio
2. Watch the waveform visualization (purple area shows audio)
3. **Note the exact time** when:
   - The intro song ends and speech begins
   - The speech ends and outro song begins

**Tip:** Use the waveform to visually identify quiet sections (thinner purple areas = quieter audio)

### 3️⃣ Set Trim Boundaries

In the **Manual Trim** section:

```
Keep from (seconds):  [___]  → Start of CONTENT (where you want to keep)
Keep until (seconds): [___]  → End of CONTENT (where you want to keep)
```

**Example:** For a podcast with 30-second intro and 20-second outro:
- **Keep from:** `30.0` (skip 30s intro)
- **Keep until:** `3577.0` (if total is 3597s, cut off 20s outro)

### 4️⃣ Preview Your Trim

Before applying, verify the times are correct:
1. Check the displayed formatted times below each field
2. The times should represent your actual podcast content
3. Do NOT include intro/outro songs in this range

### 5️⃣ Apply Trim

Click the **"Apply Trim"** button:
```
✅ System creates automatic backup of original file
✅ Trims audio to your specified range
✅ Updates episode duration in database
✅ Notifies you with "✅ Trimmed! New duration: MM:SS"
```

### 6️⃣ Verify & Save

1. Close the Audio Editor
2. Episode duration should be updated
3. Next time you play the episode, intro/outro are gone ✅

## Getting Precise Times

### Method 1: Using Waveform Visual
- Watch the purple waveform as you play
- Quieter audio = thinner/lighter visualization
- Speech = dense purple bars
- Intro/outro songs = thin or missing bars (silence)

### Method 2: Using Progress Bar
- Click play, watch the progress indicator
- When speech starts, note the time
- When speech ends, note the time

### Method 3: Manual Playback
- Play the audio
- Pause exactly where intro ends → note time from player
- Pause exactly where outro starts → note time from player
- Enter these times in Manual Trim fields

## Common Scenarios

### Scenario 1: Song + Speech + Song
```
0:00 ────── 0:30 Speech starts (intro ends)
                │
                ├─ Keep from: 30.0
                │
3:50 ────── 3:56 Speech ends (outro starts)
                │
                ├─ Keep until: 3600.0
                │
3:56 ────────────────── End
```

**Settings:**
- Keep from: `30.0`
- Keep until: `3600.0`

### Scenario 2: Quick Intro + Long Content
```
0:00 ─ 0:05 Intro song (very short!)
0:05 ─ 59:50 Podcast content
59:50 ─ 60:00 Outro music
```

**Settings:**
- Keep from: `5.0`
- Keep until: `3590.0`

### Scenario 3: Multiple Music Breaks (Manual Edit Required)

If you need to remove MIDDLE audio (not just intro/outro), trim twice:

**First trim:** Remove intro
- Keep from: `30.0`
- Keep until: `3600.0`
- **Result:** Intro gone, full content saved

**Open editor again, then manually identify any other breaks**

## Backup & Restore

Every time you trim, the system **automatically backs up** the original:

- Original audio → `filename-backup-TIMESTAMP.mp3`
- New trimmed audio → `filename.mp3`

### To Restore Original:
1. Open Audio Editor for the episode
2. Scroll to **Restore Backup** section
3. Click **"Restore Backup"** button
4. Original audio restored, backup deleted
5. Duration reverts to original length

**Note:** Only the most recent backup is kept to save storage.

## Troubleshooting

### "Trim Failed" Error
- Check the time range is valid (start < end)
- Verify both times are within total duration
- Check that backend has write permissions to uploads folder
- See `TROUBLESHOOTING_FIXES.md` for more

### Audio Won't Play
- Check browser console (F12) for `[AudioEditor]` error messages
- Verify audio file format is supported (MP3, WAV, M4A)
- Try refreshing the page

### Times Are Confusing
- Click **Play** first to get comfortable with the audio
- Look at the waveform visualization
- The time display below each field shows MM:SS format for clarity

### Backup Not Showing
- Backups only exist if you've successfully trimmed before
- If trim failed, no backup was created
- Check backend logs for trim errors

## Technical Details

### What Gets Trimmed?
- **Kept:** Audio from "Keep from" to "Keep until" (in seconds)
- **Removed:** Everything outside this range
- **Preserved:** Audio quality, mono/stereo, bitrate

### Processing Time
- Small files (< 50 MB): 5-30 seconds
- Large files (100+ MB): 1-5 minutes
- Happens in background, no blocking

### Storage Impact
- Original backup stored temporarily
- After trim: original file replaced, backup kept
- Restore deletes backup and restores original

## Tips & Tricks

💡 **Pro Tips:**

1. **Round to nearest second** - `30.5` instead of `30.123` is easier to track
2. **Add buffer for safety** - If speech starts at 30s, use `29.5` to ensure no speech cut off
3. **Test short intro first** - Trim 5 seconds from start, verify it worked before larger edits
4. **Note times during upload** - Before clicking Edit Audio, remember approximately when content starts/ends
5. **Use the format help** - The MM:SS display helps verify your times are reasonable

## Example Workflow

**Your podcast:**
- 25 second music intro
- 45 minute content
- 15 second music outro
- Total: ~45:40

**Steps:**

1. Upload file → Click ✨ Edit Audio
2. Click ▶️ Play, listen for when intro music ends → note `~0:25`
3. Let it play to the end, listen for when outro starts → note `~45:25`
4. Set:
   - Keep from: `25.0`
   - Keep until: `2725.0` (45:25 = 45*60 + 25 = 2725)
5. Click "Apply Trim"
6. ✅ Done! Episode now 45 minutes without intro/outro

## API Integration

If building a custom tool, the trim API:

```bash
POST /api/episodes/{id}/trim
Content-Type: application/json

{
  "startTime": 30.5,
  "endTime": 3570.5
}

Response:
{
  "success": true,
  "newDuration": 3540.0,
  "message": "Audio trimmed successfully"
}
```

## Limitations

- ❌ Can't remove MIDDLE segments (only start/end)
- ❌ One trim at a time (use Restore to undo)
- ❌ No visual trim markers on waveform yet (planned)

## Next Steps

✅ Try manual trimming on your first episode!
✅ Use the waveform and playback to identify times
✅ Apply trim with confidence (backup always available)
✅ Restore if needed

Questions? Check the browser console (F12) for diagnostic messages!
