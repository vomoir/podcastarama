# ⚡ Manual Trimming Quick Reference

Your podcast has **short intro/outro songs (< 2 seconds)** or **songs with background music**. 
**Manual Trimming** is the most reliable editing method.

---

## 🚀 In 5 Steps

### Step 1: Open Audio Editor
```
Episode → Click ✨ Edit Audio
```

### Step 2: Play & Listen
```
Click ▶️ Play
Note when intro ends and speech begins
Note when speech ends and outro begins
```

### Step 3: Identify Exact Times
Use the time display and waveform:
- Intro ends: `30.0` (example)
- Outro starts: `3570.0` (example)

### Step 4: Set Trim Range
```
Keep from: 30.0     (where content STARTS)
Keep until: 3570.0  (where content ENDS)
```

### Step 5: Apply
```
Click "Apply Trim"
✅ Done! Backup created, audio trimmed
```

---

## 🎯 For Your Podcast

Example with 25-second intro + 45-minute content + 15-second outro:

```
Timeline:
0:00 ─────────────────── 0:25  [Intro Song]
0:25 ─────────────────── 45:25 [Your Content] ← KEEP THIS
45:25 ────────────────── 45:40 [Outro Song]

Manual Trim Settings:
Keep from:  25.0   (skip 25 second intro)
Keep until: 2725.0 (45 minutes, 25 seconds = 2725 seconds)
```

---

## 💾 Backup & Restore

Every trim creates an automatic backup:
- Your original file is safe
- If needed, click "Restore Backup" to undo
- Only latest backup kept (to save space)

---

## ⚙️ Getting Precise Times

### Visual Method
- Watch the waveform while playing
- Purple bars = audio intensity
- Thin/missing bars = quiet (intro/outro)
- Dense bars = speech (keep this)

### Exact Method
- Play the audio
- Pause exactly at boundaries
- Note the time from the player
- Enter times in Manual Trim

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Audio won't play" | Check browser console (F12), look for `[AudioEditor]` messages |
| "Trim failed" | Verify start < end, both within total duration |
| "Times are confusing" | Use MM:SS display below each field to verify |
| "Need to undo" | Click "Restore Backup" |

---

## 📊 Your Current Settings

**Threshold:** 2 seconds (finds intro/outro 2+ seconds of silence)

**When to adjust:**
- Intro/outro < 2 seconds? Lower to `1.5` or `1.0`
- Too much false detection? Use Manual Trim instead
- Need help? Edit `/backend/audioAnalyzer.js` line 22

---

## 🎙️ Full Workflow Example

1. **Upload episode:** Select "New Episode" → Upload audio.mp3
2. **Open editor:** Click ✨ Edit Audio
3. **Preview:** Click ▶️ Play, listen for intro/outro boundaries
4. **Set times:** Manual Trim → Keep from: 25.0, Keep until: 2725.0
5. **Apply:** Click "Apply Trim" → Wait for completion
6. **Verify:** Episode duration should update automatically
7. **Done!** Next play will skip intro/outro ✅

---

## 🔗 More Info

- **Full Manual Trimming Guide:** [MANUAL_TRIMMING_GUIDE.md](./MANUAL_TRIMMING_GUIDE.md)
- **Auto-Detection Details:** [AUDIO_EDITING.md](./AUDIO_EDITING.md)
- **Troubleshooting:** [TROUBLESHOOTING_FIXES.md](./TROUBLESHOOTING_FIXES.md)

---

## ✅ Next Step

Upload an episode and try manual trimming!
Need help? Check the browser console (F12) for detailed error messages.
