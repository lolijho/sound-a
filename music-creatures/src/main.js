import { AudioAnalyzer } from './AudioAnalyzer.js';
import { Creature, Butterfly } from './Creature.js';
import { GeometryRenderer } from './GeometryRenderer.js';
import { DrawingRenderer } from './DrawingRenderer.js';

// --- DOM ---
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const audioEl = document.getElementById('audio-player');
const btnMic = document.getElementById('btn-mic');
const fileInput = document.getElementById('file-input');
const statusText = document.getElementById('status-text');
const bpmDisplay = document.getElementById('bpm-display');
const modeBtns = document.querySelectorAll('.mode-btn');

// Recording DOM
const formatBtns = document.querySelectorAll('.format-btn');
const btnRec = document.getElementById('btn-rec');
const recTimer = document.getElementById('rec-timer');
const recTimeEl = document.getElementById('rec-time');
const exportOverlay = document.getElementById('export-overlay');
const exportInfo = document.getElementById('export-info');
const btnDownload = document.getElementById('btn-download');
const btnDiscard = document.getElementById('btn-discard');

// --- State ---
let mode = 'creature'; // 'creature' | 'geometry' | 'drawing' | 'both'
let creatures = [];
let butterflies = [];
let lastTime = 0;
let micActive = false;
let audioSourceConnected = false;

// Recording state
let exportFormat = '16:9';
let isRecording = false;
let isFadingOut = false;
let fadeOutAlpha = 0; // 0 = no fade, 1 = fully black
let recStartTime = 0;
let mediaRecorder = null;
let recordedChunks = [];
let recordedBlob = null;

// Fixed recording resolutions
const REC_RESOLUTIONS = {
  '16:9': { w: 1920, h: 1080 },
  '9:16': { w: 1080, h: 1920 }
};

const analyzer = new AudioAnalyzer();
const geoRenderer = new GeometryRenderer();
let drawingRenderer = null;

// --- Canvas resize ---
function resize() {
  if (isRecording || isFadingOut) return; // Don't resize during recording
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.classList.remove('letterbox');
  canvas.style.width = '';
  canvas.style.height = '';
  initCreatures();
  drawingRenderer = new DrawingRenderer(canvas.width, canvas.height);
}

function initCreatures() {
  creatures = [];
  butterflies = [];
  for (let i = 0; i < 5; i++) {
    creatures.push(new Creature(canvas.width, canvas.height));
  }
  for (let i = 0; i < 4; i++) {
    butterflies.push(new Butterfly(canvas.width, canvas.height));
  }
}

window.addEventListener('resize', resize);
resize();

// --- Mode toggle ---
modeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    modeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    mode = btn.dataset.mode;
  });
});

// --- Format toggle ---
formatBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    if (isRecording) return;
    formatBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    exportFormat = btn.dataset.format;
  });
});

// --- Microphone ---
btnMic.addEventListener('click', async () => {
  if (micActive) {
    analyzer.disconnectMicrophone();
    micActive = false;
    btnMic.classList.remove('active');
    statusText.textContent = 'Microphone off';
    return;
  }

  try {
    audioEl.pause();
    audioEl.currentTime = 0;

    await analyzer.connectMicrophone();
    micActive = true;
    btnMic.classList.add('active');
    statusText.textContent = 'Listening to microphone...';
  } catch (err) {
    statusText.textContent = 'Microphone access denied';
    console.error(err);
  }
});

// --- File upload ---
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (micActive) {
    analyzer.disconnectMicrophone();
    micActive = false;
    btnMic.classList.remove('active');
  }

  const url = URL.createObjectURL(file);
  audioEl.src = url;

  if (!audioSourceConnected) {
    analyzer.connectAudioElement(audioEl);
    audioSourceConnected = true;
  }

  audioEl.play();
  statusText.textContent = `Playing: ${file.name}`;
});

// --- Recording ---
btnRec.addEventListener('click', () => {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
});

function startRecording() {
  const res = REC_RESOLUTIONS[exportFormat];

  // Set canvas to fixed recording resolution
  canvas.width = res.w;
  canvas.height = res.h;

  // Letterbox display: fit canvas in viewport maintaining aspect ratio
  canvas.classList.add('letterbox');
  fitCanvasDisplay();

  initCreatures();
  drawingRenderer = new DrawingRenderer(canvas.width, canvas.height);

  // Clear canvas to black before recording starts
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Start MediaRecorder on canvas stream
  const stream = canvas.captureStream(60);

  // Also capture audio if available
  if (analyzer.ctx && analyzer.ctx.destination) {
    try {
      const audioDest = analyzer.ctx.createMediaStreamDestination();
      if (analyzer.analyser) {
        analyzer.analyser.connect(audioDest);
      }
      for (const track of audioDest.stream.getAudioTracks()) {
        stream.addTrack(track);
      }
    } catch {}
  }

  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm';

  recordedChunks = [];
  mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };

  mediaRecorder.onstop = () => {
    recordedBlob = new Blob(recordedChunks, { type: mimeType });
    showExportPanel();
  };

  mediaRecorder.start(1000); // chunk every second
  isRecording = true;
  isFadingOut = false;
  fadeOutAlpha = 0;
  recStartTime = performance.now();

  btnRec.classList.add('recording');
  btnRec.querySelector('span:last-child').textContent = 'STOP';
  recTimer.classList.remove('hidden');
  statusText.textContent = `Recording ${exportFormat}...`;
}

function stopRecording() {
  // Start fade-out: visuals disappear over ~1.5s, then stop recorder
  isFadingOut = true;
  fadeOutAlpha = 0;
  btnRec.classList.remove('recording');
  btnRec.querySelector('span:last-child').textContent = 'REC';
  statusText.textContent = 'Fading out...';
}

function finishRecording() {
  isRecording = false;
  isFadingOut = false;
  fadeOutAlpha = 0;
  recTimer.classList.add('hidden');

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }

  // Restore canvas to fullscreen
  resize();
}

function fitCanvasDisplay() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cw = canvas.width;
  const ch = canvas.height;
  const scale = Math.min(vw / cw, vh / ch);
  canvas.style.width = (cw * scale) + 'px';
  canvas.style.height = (ch * scale) + 'px';
}

// --- Export panel ---
function showExportPanel() {
  if (!recordedBlob) return;
  const sizeMB = (recordedBlob.size / (1024 * 1024)).toFixed(1);
  const res = REC_RESOLUTIONS[exportFormat];
  const dur = formatTime(recDuration());
  exportInfo.textContent = `${res.w}×${res.h} · ${dur} · ${sizeMB} MB · WebM`;
  exportOverlay.classList.remove('hidden');
}

function hideExportPanel() {
  exportOverlay.classList.add('hidden');
  if (recordedBlob) {
    URL.revokeObjectURL(recordedBlob);
    recordedBlob = null;
  }
  recordedChunks = [];
}

btnDownload.addEventListener('click', () => {
  if (!recordedBlob) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(recordedBlob);
  const res = REC_RESOLUTIONS[exportFormat];
  a.download = `music-creatures-${res.w}x${res.h}.webm`;
  a.click();
  URL.revokeObjectURL(a.href);
  hideExportPanel();
});

btnDiscard.addEventListener('click', () => {
  hideExportPanel();
});

// --- Helpers ---
function recDuration() {
  return (performance.now() - recStartTime) / 1000;
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Keep letterbox sizing on window resize during recording
window.addEventListener('resize', () => {
  if ((isRecording || isFadingOut) && canvas.classList.contains('letterbox')) {
    fitCanvasDisplay();
  }
});

// --- Render loop ---
function loop(timestamp) {
  requestAnimationFrame(loop);

  const dt = lastTime ? Math.min((timestamp - lastTime) / 1000, 0.05) : 0.016;
  lastTime = timestamp;

  // Update timer display
  if (isRecording) {
    recTimeEl.textContent = formatTime(recDuration());
  }

  // Update analyzer
  analyzer.update();

  const { bass, mid, treble, isBeat, volume } = analyzer;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  // Trail effect - lighter trail for drawing mode to keep pencil lines visible
  const trailAlpha = (mode === 'drawing') ? 0.04 : 0.18;
  ctx.fillStyle = `rgba(0, 0, 0, ${trailAlpha})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // During fade-out, draw increasingly opaque black overlay
  if (isFadingOut) {
    fadeOutAlpha += dt / 1.5; // 1.5 seconds fade
    if (fadeOutAlpha >= 1) {
      fadeOutAlpha = 1;
      // Hold pure black for a couple frames, then finish
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      finishRecording();
      return;
    }
  }

  // Only draw visuals if not fully faded
  if (fadeOutAlpha < 1) {
    const showGeo = mode === 'geometry' || mode === 'both';
    const showCreature = mode === 'creature' || mode === 'both';
    const showDrawing = mode === 'drawing' || mode === 'both';

    // Beat events
    if (isBeat && showGeo) {
      geoRenderer.onBeat(cx, cy, canvas.width, canvas.height);
    }

    // Update & draw geometry
    if (showGeo) {
      geoRenderer.update(dt);
      geoRenderer.drawBars(ctx, analyzer.freqData, canvas.width, canvas.height);
      geoRenderer.drawPolygons(ctx, canvas.width, canvas.height, bass, mid);
      geoRenderer.drawEffects(ctx);
    }

    // Update & draw creatures
    if (showCreature) {
      for (const c of creatures) {
        c.update(dt, bass, mid, treble, isBeat, canvas.width, canvas.height);
        c.draw(ctx, treble);
      }
      for (const b of butterflies) {
        b.update(dt, bass, mid, treble, isBeat, canvas.width, canvas.height);
        b.draw(ctx, treble, bass);
      }
    }

    // Update & draw pencil lines
    if (showDrawing && drawingRenderer) {
      drawingRenderer.update(dt, bass, mid, treble, isBeat, canvas.width, canvas.height);
      drawingRenderer.draw(ctx, treble);
    }

    // Fade-out overlay
    if (isFadingOut && fadeOutAlpha > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${fadeOutAlpha})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  // BPM display
  if (analyzer.bpm > 0) {
    bpmDisplay.textContent = `${analyzer.bpm} BPM`;
  } else {
    bpmDisplay.textContent = '-- BPM';
  }
}

requestAnimationFrame(loop);
