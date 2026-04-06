import { AudioAnalyzer } from './AudioAnalyzer.js';
import { Creature } from './Creature.js';
import { GeometryRenderer } from './GeometryRenderer.js';

// --- DOM ---
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const audioEl = document.getElementById('audio-player');
const btnMic = document.getElementById('btn-mic');
const fileInput = document.getElementById('file-input');
const statusText = document.getElementById('status-text');
const bpmDisplay = document.getElementById('bpm-display');
const modeBtns = document.querySelectorAll('.mode-btn');

// --- State ---
let mode = 'creature'; // 'creature' | 'geometry' | 'both'
let creatures = [];
let lastTime = 0;
let micActive = false;
let audioSourceConnected = false;

const analyzer = new AudioAnalyzer();
const geoRenderer = new GeometryRenderer();

// --- Canvas resize ---
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  initCreatures();
}

function initCreatures() {
  creatures = [];
  for (let i = 0; i < 5; i++) {
    creatures.push(new Creature(canvas.width, canvas.height));
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
    // Stop file playback if any
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

  // Stop mic if active
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

// --- Render loop ---
function loop(timestamp) {
  requestAnimationFrame(loop);

  const dt = lastTime ? Math.min((timestamp - lastTime) / 1000, 0.05) : 0.016;
  lastTime = timestamp;

  // Update analyzer
  analyzer.update();

  const { bass, mid, treble, isBeat, volume } = analyzer;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  // Trail effect
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Beat events
  if (isBeat) {
    if (mode === 'geometry' || mode === 'both') {
      geoRenderer.onBeat(cx, cy);
    }
  }

  // Update & draw geometry
  if (mode === 'geometry' || mode === 'both') {
    geoRenderer.update(dt);
    geoRenderer.drawBars(ctx, analyzer.freqData, canvas.width, canvas.height);
    geoRenderer.drawCentralPolygon(ctx, cx, cy, bass, mid);
    geoRenderer.drawEffects(ctx);
  }

  // Update & draw creatures
  if (mode === 'creature' || mode === 'both') {
    for (const c of creatures) {
      c.update(dt, bass, mid, treble, isBeat, canvas.width, canvas.height);
      c.draw(ctx, treble);
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
