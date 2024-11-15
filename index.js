const fs = require('fs');
const { spawn } = require('child_process');
const express = require('express');

const app = express();
const PORT = 5000;

// Helper to extract audio URLs from file
function extractAudioFromFile(filePath) {
  try {
    const audioUrls = fs.readFileSync(filePath, 'utf8').split('\n');
    return audioUrls.filter((url) => url.trim() !== '');
  } catch (error) {
    console.error(`Error reading audio URLs from file: ${error.message}`);
    return [];
  }
}

// Helper to run FFmpeg to stream audio
function streamAudio(audioUrl, loopingVideoPath, outputUrl) {
  const ffmpegCommand = [
    '-re',
    '-stream_loop', '-1',
    '-i', loopingVideoPath,
    '-i', audioUrl,
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-b:v', '200k',
    '-maxrate', '200k',
    '-bufsize', '400k',
    '-r', '15',
    '-s', '640x360',
    '-vf', 'format=yuv420p',
    '-g', '30',
    '-shortest',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-map', '0:v',
    '-map', '1:a',
    '-f', 'flv',
    outputUrl,
  ];

  const ffmpeg = spawn('ffmpeg', ffmpegCommand);

  ffmpeg.stdout.on('data', (data) => console.log(`FFmpeg: ${data}`));
  ffmpeg.stderr.on('data', (data) => console.error(`FFmpeg Error: ${data}`));
  ffmpeg.on('close', (code) => console.log(`FFmpeg exited with code ${code}`));
}

// Start streaming
function startStreaming(streamKey, loopingVideoPath, audioUrlFile) {
  const audioUrls = extractAudioFromFile(audioUrlFile);
  if (!audioUrls.length) {
    console.error('No audio URLs found in the file.');
    return;
  }

  const outputUrl = `rtmp://a.rtmp.youtube.com/live2/${streamKey}`;
  let currentIndex = 0;

  setInterval(() => {
    const audioUrl = audioUrls[currentIndex];
    console.log(`Streaming: ${audioUrl}`);
    streamAudio(audioUrl, loopingVideoPath, outputUrl);

    currentIndex = (currentIndex + 1) % audioUrls.length; // Loop through audio URLs
  }, 1000 * 60 * 10); // Restart stream every 10 minutes
}

// Start the server
app.get('/start', (req, res) => {
  const streamKey = process.env.STREAM_KEY;
  const loopingVideoPath = process.env.LOOPING_VIDEO_PATH;
  const audioUrlFile = process.env.AUDIO_URL_FILE;

  if (!streamKey || !loopingVideoPath || !audioUrlFile) {
    res.status(500).send('Missing environment variables.');
    return;
  }

  startStreaming(streamKey, loopingVideoPath, audioUrlFile);
  res.send('Streaming started!');
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
