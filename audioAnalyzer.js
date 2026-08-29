import ffmpeg from 'fluent-ffmpeg';
import { spawn } from 'child_process';
import path from 'path';

/**
 * Analyze audio file for silence segments and volume patterns
 * Returns detected segments where intros/outros (songs) likely exist
 * 
 * Silence Detection Strategy:
 * - Look for silence of 2+ seconds (real intro/outro songs)
 * - Use -40dB threshold to catch quiet background music
 * - Filter out tiny pauses (< 1.5 seconds) that are just speech breaks
 */
export async function analyzeAudio(audioPath) {
  return new Promise((resolve, reject) => {
    try {
      const silenceSegments = [];
      let output = '';

      const ffmpegProcess = spawn('ffmpeg', [
        '-i', audioPath,
        '-af', 'silencedetect=n=-40dB:d=2',  // 2 seconds minimum (was 0.5)
        '-f', 'null',
        '-'
      ], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      ffmpegProcess.stderr.on('data', (data) => {
        output += data.toString();
      });

      ffmpegProcess.on('close', (code) => {
        if (code !== 0 && code !== 1) {
          return reject(new Error(`FFmpeg exited with code ${code}`));
        }

        // Parse silence_start and silence_end patterns
        const silencePattern = /silence_(start|end):\s+([\d.]+)/g;
        let match;
        let currentSilence = null;

        while ((match = silencePattern.exec(output)) !== null) {
          const time = parseFloat(match[2]);
          
          if (match[1] === 'start') {
            currentSilence = { start: time };
          } else if (match[1] === 'end' && currentSilence) {
            currentSilence.end = time;
            currentSilence.duration = time - currentSilence.start;
            
            // Only include meaningful silences (2+ seconds = likely songs)
            if (currentSilence.duration >= 2.0) {
              silenceSegments.push(currentSilence);
            }
            currentSilence = null;
          }
        }

        // Get total duration
        const durationMatch = output.match(/Duration:\s+(\d+):(\d+):([\d.]+)/);
        let totalDuration = 0;
        if (durationMatch) {
          totalDuration = parseInt(durationMatch[1]) * 3600 + 
                         parseInt(durationMatch[2]) * 60 + 
                         parseFloat(durationMatch[3]);
        }

        resolve({
          silenceSegments,
          totalDuration,
          detectionMethod: 'ffmpeg_silencedetect',
          detectionNote: 'Segments 2+ seconds of silence (typical intro/outro songs)'
        });
      });

      ffmpegProcess.on('error', (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Trim audio file by removing or keeping specified segments
 * @param {string} inputPath - Path to input audio file
 * @param {array} segments - Array of {start, end} times to keep or remove
 * @param {string} outputPath - Path where trimmed audio will be saved
 * @param {string} mode - 'keep' to keep segments, 'remove' to remove them
 */
export async function trimAudio(inputPath, segments, outputPath, mode = 'remove') {
  return new Promise((resolve, reject) => {
    try {
      // Get duration first
      ffmpeg(inputPath)
        .ffprobe((err, metadata) => {
          if (err) return reject(err);
          
          const totalDuration = metadata.format.duration;
          const segmentsToKeep = mode === 'remove' 
            ? invertSegments(segments, totalDuration)
            : segments;

          // Build concat filter for segments to keep
          const filterParts = [];
          let filterIndex = 0;

          segmentsToKeep.forEach((seg, idx) => {
            filterParts.push(`[0:a]atrim=start=${seg.start}:end=${seg.end}[seg${idx}]`);
            filterIndex++;
          });

          if (segmentsToKeep.length > 1) {
            let concatFilter = '';
            for (let i = 0; i < segmentsToKeep.length; i++) {
              concatFilter += `[seg${i}]`;
            }
            concatFilter += `concat=n=${segmentsToKeep.length}:v=0:a=1[outa]`;
            filterParts.push(concatFilter);
          } else if (segmentsToKeep.length === 1) {
            filterParts.push(`[seg0]aformat=sample_rates=44100[outa]`);
          }

          const complexFilter = filterParts.join('; ') + '[outa]';

          ffmpeg(inputPath)
            .audioFilter(filterParts.join('; '))
            .output(outputPath)
            .on('end', () => {
              resolve({ outputPath, success: true });
            })
            .on('error', (err) => {
              reject(err);
            })
            .run();
        });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Simple trim by time range (easier approach)
 * Remove audio before startTime and after endTime
 */
export async function simpleTrimAudio(inputPath, startTime, endTime, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      ffmpeg(inputPath)
        .seekInput(startTime)
        .duration(endTime - startTime)
        .audioCodec('libmp3lame')
        .audioBitrate('192k')
        .output(outputPath)
        .on('end', () => {
          resolve({ outputPath, success: true, trimmed: { startTime, endTime } });
        })
        .on('error', (err) => {
          reject(err);
        })
        .run();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Get audio file metadata (duration, bitrate, etc.)
 */
export async function getAudioMetadata(audioPath) {
  return new Promise((resolve, reject) => {
    try {
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (err) return reject(err);
        
        const format = metadata.format;
        resolve({
          duration: format.duration,
          bitrate: format.bit_rate,
          sampleRate: metadata.streams[0]?.sample_rate,
          channels: metadata.streams[0]?.channels,
          codec: metadata.streams[0]?.codec_name
        });
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Helper: Invert segments (turn "remove" into "keep")
 */
function invertSegments(removeSegments, totalDuration) {
  if (removeSegments.length === 0) {
    return [{ start: 0, end: totalDuration }];
  }

  const keepSegments = [];
  let currentTime = 0;

  removeSegments.sort((a, b) => a.start - b.start);

  removeSegments.forEach(seg => {
    if (currentTime < seg.start) {
      keepSegments.push({ start: currentTime, end: seg.start });
    }
    currentTime = Math.max(currentTime, seg.end);
  });

  if (currentTime < totalDuration) {
    keepSegments.push({ start: currentTime, end: totalDuration });
  }

  return keepSegments;
}
