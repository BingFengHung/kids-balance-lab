// Kids Balance Lab - PWA Main Application JavaScript

// Register PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker registered successfully!', reg.scope))
      .catch(err => console.error('Service Worker registration failed:', err));
  });
}

// Matter.js Module aliases
const { Engine, World, Bodies, Body, Constraint, Composite } = Matter;

// Application Configurations
const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 550;

// Emojis, sizes, and colors for weight templates
const templates = {
  rabbit: { weight: 1, emoji: '🐰', radius: 25, color: '#00f0ff' },
  fox: { weight: 2, emoji: '🦊', radius: 30, color: '#ffaa00' },
  pig: { weight: 4, emoji: '🐷', radius: 35, color: '#ff00ff' },
  lion: { weight: 8, emoji: '🦁', radius: 40, color: '#ffef00' },
  elephant: { weight: 16, emoji: '🐘', radius: 48, color: '#a000ff' }
};

// 6 Balancing Puzzles for Challenge Mode
const levels = [
  {
    id: 1,
    title: "Twin Rabbits",
    instructions: "Place a 🐰 Rabbit (1kg) at distance 2 on the right to balance the 🐰 Rabbit at distance 2 on the left!",
    leftSetup: [
      { type: "rabbit", hookIndex: 1 } // Hook 1: offset -160 (dist 2)
    ]
  },
  {
    id: 2,
    title: "Fox Balance",
    instructions: "Balance the 🦊 Fox (2kg) at distance 3 on the left. Find where to place a Fox (2kg) on the right!",
    leftSetup: [
      { type: "fox", hookIndex: 0 } // Hook 0: offset -240 (dist 3)
    ]
  },
  {
    id: 3,
    title: "Piggy Power",
    instructions: "The 🐷 Pig (4kg) is at distance 2 (torque 8). Balance it using a Fox (2kg) at distance 3 and another Fox at distance 1!",
    leftSetup: [
      { type: "pig", hookIndex: 1 } // Hook 1: offset -160 (dist 2)
    ]
  },
  {
    id: 4,
    title: "Lion's Lever",
    instructions: "A sleepy 🦁 Lion (8kg) is at distance 1 on the left. Balance it using a 🐷 Pig (4kg) on the right!",
    leftSetup: [
      { type: "lion", hookIndex: 2 } // Hook 2: offset -80 (dist 1)
    ]
  },
  {
    id: 5,
    title: "Heavy Elephant",
    instructions: "A 🦁 Lion (8kg) is at distance 3 (torque 24). Balance it using an 🐘 Elephant (16kg) at distance 1 and a 🐷 Pig (4kg) at distance 2!",
    leftSetup: [
      { type: "lion", hookIndex: 0 } // Hook 0: offset -240 (dist 3)
    ]
  },
  {
    id: 6,
    title: "Grand Challenge",
    instructions: "A giant 🐘 Elephant (16kg) is at distance 2 (torque 32). Balance it using a 🦁 Lion (8kg) at distance 3 and a 🐷 Pig (4kg) at distance 2!",
    leftSetup: [
      { type: "elephant", hookIndex: 1 } // Hook 1: offset -160 (dist 2)
    ]
  }
];

// Audio State
let audioCtx = null;
let soundEnabled = true;

// Initialize Audio Context on user interaction
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

// Audio Synthesis functions using Web Audio API
function playSnapSound() {
  if (!soundEnabled) return;
  initAudio();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(350, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(700, audioCtx.currentTime + 0.08);
  
  gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
  
  osc.start();
  osc.stop(audioCtx.currentTime + 0.08);
}

function playErrorSound() {
  if (!soundEnabled) return;
  initAudio();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(140, audioCtx.currentTime);
  osc.frequency.linearRampToValueAtTime(90, audioCtx.currentTime + 0.22);
  
  gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.22);
  
  osc.start();
  osc.stop(audioCtx.currentTime + 0.22);
}

function playSuccessSound() {
  if (!soundEnabled) return;
  initAudio();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  const now = audioCtx.currentTime;
  const notes = [261.63, 329.63, 392.00, 523.25, 659.25]; // C4, E4, G4, C5, E5
  
  notes.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + i * 0.08);
    
    gain.gain.setValueAtTime(0, now + i * 0.08);
    gain.gain.linearRampToValueAtTime(0.15, now + i * 0.08 + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.005, now + i * 0.08 + 0.3);
    
    osc.start(now + i * 0.08);
    osc.stop(now + i * 0.08 + 0.35);
  });
}

// Application State
let currentMode = 'challenge'; // 'challenge' or 'sandbox'
let activeLevelId = 1;
let completedLevels = new Set(JSON.parse(localStorage.getItem('completedLevels') || '[]'));
let isBalanced = false;
let particles = [];

// Matter.js engine & world setup
const engine = Engine.create();
const world = engine.world;
world.gravity.y = 1.0;

// Setup physical bodies
const ground = Bodies.rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 30, CANVAS_WIDTH, 60, { 
  isStatic: true,
  collisionFilter: { category: 0x0001 }
});
const leftWall = Bodies.rectangle(-15, CANVAS_HEIGHT / 2, 30, CANVAS_HEIGHT, { 
  isStatic: true,
  collisionFilter: { category: 0x0001 }
});
const rightWall = Bodies.rectangle(CANVAS_WIDTH + 15, CANVAS_HEIGHT / 2, 30, CANVAS_HEIGHT, { 
  isStatic: true,
  collisionFilter: { category: 0x0001 }
});

// Balance Scale components
const beam = Bodies.rectangle(CANVAS_WIDTH / 2, 340, 600, 20, { 
  density: 0.006, 
  frictionAir: 0.05,
  collisionFilter: { category: 0x0004 } // Different category to not collide with animals
});

const pivot = Constraint.create({
  pointA: { x: CANVAS_WIDTH / 2, y: 340 },
  bodyB: beam,
  pointB: { x: 0, y: 0 },
  stiffness: 1.0,
  length: 0
});

// Soft springs to restore scale to horizontal level gently when empty/balanced
const leftSpring = Constraint.create({
  pointA: { x: CANVAS_WIDTH / 2 - 300, y: 340 },
  bodyB: beam,
  pointB: { x: -300, y: 0 },
  stiffness: 0.0012,
  length: 0
});
const rightSpring = Constraint.create({
  pointA: { x: CANVAS_WIDTH / 2 + 300, y: 340 },
  bodyB: beam,
  pointB: { x: 300, y: 0 },
  stiffness: 0.0012,
  length: 0
});

Composite.add(world, [ground, leftWall, rightWall, beam, pivot, leftSpring, rightSpring]);

// Hook management
// Index mapping:
// 0: dist 3 (Left), 1: dist 2 (Left), 2: dist 1 (Left)
// 3: dist 1 (Right), 4: dist 2 (Right), 5: dist 3 (Right)
let hooks = Array(6).fill(null); // holds animal body instances
let hookConstraints = Array(6).fill(null); // holds constraint instances

function getHookWorldPos(beamBody, index) {
  const offsets = [-240, -160, -80, 80, 160, 240];
  const dx = offsets[index];
  const dy = 25; // drop slightly below beam
  const cos = Math.cos(beamBody.angle);
  const sin = Math.sin(beamBody.angle);
  return {
    x: beamBody.position.x + dx * cos - dy * sin,
    y: beamBody.position.y + dx * sin + dy * cos
  };
}

// Drag State
let draggedBody = null;
let mousePos = { x: 0, y: 0 };
let isMouseDown = false;

// HTML Elements
const canvas = document.getElementById('physics-canvas');
const ctx = canvas.getContext('2d');
const btnChallenge = document.getElementById('btn-challenge');
const btnSandbox = document.getElementById('btn-sandbox');
const sectionChallenge = document.getElementById('challenge-section');
const sectionSandbox = document.getElementById('sandbox-section');
const levelListContainer = document.getElementById('level-list');
const levelInstructions = document.getElementById('level-instructions');
const soundBtn = document.getElementById('btn-sound');
const resetBtn = document.getElementById('btn-reset');
const successOverlay = document.getElementById('success-overlay');
const successMessage = document.getElementById('success-message');
const btnNextLevel = document.getElementById('btn-next-level');
const leftTorqueVal = document.getElementById('left-torque-val');
const rightTorqueVal = document.getElementById('right-torque-val');
const sandboxStatusText = document.getElementById('sandbox-status-text');
const animalShelf = document.getElementById('animal-shelf');

// Set canvas dimensions
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// Drag and drop helper functions
function getMouseCoordinates(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: ((clientX - rect.left) / rect.width) * CANVAS_WIDTH,
    y: ((clientY - rect.top) / rect.height) * CANVAS_HEIGHT
  };
}

// Create animal body
function createAnimalBody(type, x, y, isFixed = false) {
  const template = templates[type];
  if (!template) return null;
  
  const body = Bodies.circle(x, y, template.radius, {
    density: 0.001,
    friction: 0.8,
    restitution: 0.2,
    collisionFilter: {
      category: 0x0002,
      mask: 0x0001 | 0x0002 // collide with ground and other animals
    }
  });

  body.plugin = {
    type: type,
    weight: template.weight,
    emoji: template.emoji,
    color: template.color,
    isSnapped: false,
    snappedHookIndex: null,
    isFixed: isFixed,
    isDragging: false
  };

  Composite.add(world, body);
  return body;
}

// Snapping implementation
function snapToHook(body, hookIndex) {
  if (hooks[hookIndex]) {
    playErrorSound();
    return false;
  }
  
  // Position body directly at hook world space coordinates initially
  const targetWorld = getHookWorldPos(beam, hookIndex);
  Body.setPosition(body, targetWorld);
  Body.setVelocity(body, { x: 0, y: 0 });
  Body.setAngularVelocity(body, 0);
  
  // Weld constraint
  const offsets = [-240, -160, -80, 80, 160, 240];
  const dx = offsets[hookIndex];
  const dy = 25;
  
  const constraint = Constraint.create({
    bodyA: beam,
    pointA: { x: dx, y: dy },
    bodyB: body,
    pointB: { x: 0, y: 0 },
    stiffness: 1.0,
    length: 0
  });

  body.plugin.isSnapped = true;
  body.plugin.snappedHookIndex = hookIndex;
  
  // Disable collisions while snapped so it doesn't clip with the beam or other animals
  body.collisionFilter.mask = 0;

  hooks[hookIndex] = body;
  hookConstraints[hookIndex] = constraint;

  Composite.add(world, constraint);
  playSnapSound();
  return true;
}

// Unsnapping implementation
function unsnapFromHook(body) {
  const hookIndex = body.plugin.snappedHookIndex;
  if (hookIndex === null || hookIndex === undefined) return;
  
  const constraint = hookConstraints[hookIndex];
  if (constraint) {
    Composite.remove(world, constraint);
  }
  
  body.plugin.isSnapped = false;
  body.plugin.snappedHookIndex = null;
  body.collisionFilter.mask = 0x0001 | 0x0002; // Restore collisions

  hooks[hookIndex] = null;
  hookConstraints[hookIndex] = null;
}

// Clean all animals on scale
function clearAllAnimals() {
  for (let i = 0; i < 6; i++) {
    if (hooks[i]) {
      unsnapFromHook(hooks[i]);
    }
  }
  
  const bodies = Composite.allBodies(world);
  bodies.forEach(body => {
    if (body.plugin && body.plugin.emoji) {
      Composite.remove(world, body);
    }
  });

  hooks.fill(null);
  hookConstraints.fill(null);
  
  Body.setAngle(beam, 0);
  Body.setAngularVelocity(beam, 0);
  Body.setPosition(beam, { x: CANVAS_WIDTH / 2, y: 340 });
}

// Load levels
function loadLevel(levelId) {
  clearAllAnimals();
  activeLevelId = levelId;
  isBalanced = false;
  successOverlay.classList.add('hidden');
  
  const level = levels.find(l => l.id === levelId);
  if (!level) return;
  
  levelInstructions.innerHTML = `<strong>${level.title}</strong><br>${level.instructions}`;
  
  // Setup the target challenge bodies on the Left
  level.leftSetup.forEach(item => {
    // Left side coordinates are approximately x = 200 to 450 depending on index
    const body = createAnimalBody(item.type, 200, 100, true);
    if (body) {
      snapToHook(body, item.hookIndex);
    }
  });

  // Re-render level selector buttons
  renderLevelButtons();
}

function renderLevelButtons() {
  levelListContainer.innerHTML = '';
  levels.forEach(level => {
    const btn = document.createElement('button');
    btn.className = `level-btn ${level.id === activeLevelId ? 'active' : ''} ${completedLevels.has(level.id) ? 'completed' : ''}`;
    btn.textContent = level.id;
    btn.onclick = () => loadLevel(level.id);
    levelListContainer.appendChild(btn);
  });
}

// Calculation of current torques
function calculateTorques() {
  let left = 0;
  let right = 0;
  for (let i = 0; i < 6; i++) {
    const body = hooks[i];
    if (body) {
      const weight = body.plugin.weight;
      if (i < 3) {
        left += weight * (3 - i); // Hook 0: dist 3, Hook 1: dist 2, Hook 2: dist 1
      } else {
        right += weight * (i - 2); // Hook 3: dist 1, Hook 4: dist 2, Hook 5: dist 3
      }
    }
  }
  return { left, right };
}

// Floating Bubble particles
function spawnSuccessParticles() {
  const colors = ['#00f0ff', '#ff00ff', '#ffef00', '#00ff66', '#a000ff'];
  for (let i = 0; i < 60; i++) {
    particles.push({
      x: Math.random() * CANVAS_WIDTH,
      y: CANVAS_HEIGHT + Math.random() * 80,
      vx: (Math.random() - 0.5) * 2,
      vy: -Math.random() * 3 - 1.5,
      radius: Math.random() * 14 + 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1.0,
      fadeRate: Math.random() * 0.006 + 0.003
    });
  }
}

// Update UI Text Panels
function updateUIStats(left, right) {
  if (currentMode === 'sandbox') {
    leftTorqueVal.textContent = left;
    rightTorqueVal.textContent = right;
    
    if (left === 0 && right === 0) {
      sandboxStatusText.textContent = "Scale Empty ⚖️";
      sandboxStatusText.className = "status-alert";
    } else if (left === right) {
      sandboxStatusText.textContent = "Perfect Balance! 🌟";
      sandboxStatusText.className = "status-alert balanced";
    } else {
      sandboxStatusText.textContent = "Unbalanced ⚖️";
      sandboxStatusText.className = "status-alert";
    }
  }
}

// Mode Selection Actions
function switchMode(mode) {
  currentMode = mode;
  clearAllAnimals();
  isBalanced = false;
  successOverlay.classList.add('hidden');
  
  if (mode === 'challenge') {
    btnChallenge.classList.add('active');
    btnSandbox.classList.remove('active');
    sectionChallenge.classList.remove('hidden');
    sectionSandbox.classList.add('hidden');
    loadLevel(activeLevelId);
  } else {
    btnSandbox.classList.add('active');
    btnChallenge.classList.remove('active');
    sectionSandbox.classList.remove('hidden');
    sectionChallenge.classList.add('hidden');
  }
}

// Render Loops
function drawBackground(ctx) {
  // Deep dark lab gradient
  const bgGrad = ctx.createRadialGradient(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 50, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH);
  bgGrad.addColorStop(0, '#150a30');
  bgGrad.addColorStop(1, '#05020c');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Decorative Grid lines
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.04)';
  ctx.lineWidth = 1;
  const spacing = 45;
  for (let x = 0; x < CANVAS_WIDTH; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CANVAS_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y < CANVAS_HEIGHT; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CANVAS_WIDTH, y);
    ctx.stroke();
  }

  // Draw cyber lab floor
  ctx.fillStyle = '#0a0418';
  ctx.fillRect(0, CANVAS_HEIGHT - 60, CANVAS_WIDTH, 60);
  
  // Neon floor top glow line
  ctx.save();
  ctx.shadowBlur = 12;
  ctx.shadowColor = '#ff00ff';
  ctx.strokeStyle = 'rgba(255, 0, 255, 0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, CANVAS_HEIGHT - 60);
  ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT - 60);
  ctx.stroke();
  ctx.restore();
}

function drawFulcrum(ctx) {
  ctx.save();
  // Outer glowing Neon stand
  ctx.shadowBlur = 12;
  ctx.shadowColor = '#00f0ff';
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 4;
  
  const gradient = ctx.createLinearGradient(CANVAS_WIDTH / 2 - 30, 340, CANVAS_WIDTH / 2 + 30, CANVAS_HEIGHT - 60);
  gradient.addColorStop(0, 'rgba(0, 240, 255, 0.15)');
  gradient.addColorStop(1, 'rgba(0, 114, 255, 0.45)');
  ctx.fillStyle = gradient;

  ctx.beginPath();
  ctx.moveTo(CANVAS_WIDTH / 2, 340);
  ctx.lineTo(CANVAS_WIDTH / 2 - 45, CANVAS_HEIGHT - 60);
  ctx.lineTo(CANVAS_WIDTH / 2 + 45, CANVAS_HEIGHT - 60);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Central joint metallic knob
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(CANVAS_WIDTH / 2, 340, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#080312';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  ctx.restore();
}

function drawBeam(ctx) {
  ctx.save();
  ctx.translate(beam.position.x, beam.position.y);
  ctx.rotate(beam.angle);

  // Neon pink balance bar
  ctx.shadowBlur = 15;
  ctx.shadowColor = '#ff007f';
  
  const barGrad = ctx.createLinearGradient(-300, 0, 300, 0);
  barGrad.addColorStop(0, '#ff007f');
  barGrad.addColorStop(0.5, '#ff00ff');
  barGrad.addColorStop(1, '#ff007f');
  
  ctx.fillStyle = barGrad;
  ctx.beginPath();
  ctx.roundRect(-300, -10, 600, 20, 10);
  ctx.fill();
  
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Draw numbers (-3, -2, -1, +1, +2, +3)
  ctx.shadowBlur = 0;
  ctx.font = 'bold 13px "Outfit", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  const offsets = [-240, -160, -80, 80, 160, 240];
  const labels = ["-3", "-2", "-1", "+1", "+2", "+3"];
  for (let i = 0; i < 6; i++) {
    ctx.fillText(labels[i], offsets[i], -18);
  }

  ctx.restore();
}

function drawHooks(ctx) {
  for (let i = 0; i < 6; i++) {
    const hookWorld = getHookWorldPos(beam, i);
    const isOccupied = hooks[i] !== null;
    
    ctx.save();
    ctx.translate(hookWorld.x, hookWorld.y);
    ctx.rotate(beam.angle);

    ctx.strokeStyle = isOccupied ? '#00ff66' : '#ffef00';
    ctx.shadowBlur = isOccupied ? 12 : 5;
    ctx.shadowColor = isOccupied ? '#00ff66' : '#ffef00';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';

    // Hook hanger design
    ctx.beginPath();
    ctx.moveTo(0, -25);
    ctx.lineTo(0, -10);
    ctx.arc(0, 0, 10, -Math.PI, 0, true);
    ctx.stroke();

    // Show dashed snapping circle overlay if dragged item is nearby
    if (!isOccupied && draggedBody) {
      const dist = Math.hypot(draggedBody.position.x - hookWorld.x, draggedBody.position.y - hookWorld.y);
      if (dist < 45) {
        ctx.strokeStyle = '#00ff66';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, draggedBody.circleRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

function drawAnimal(ctx, body) {
  const { x, y } = body.position;
  const radius = body.circleRadius;
  const angle = body.angle;
  const { emoji, color, weight, isDragging, isFixed } = body.plugin;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Outer Neon Halo
  ctx.shadowBlur = isDragging ? 18 : 6;
  ctx.shadowColor = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.fillStyle = 'rgba(13, 6, 31, 0.85)';
  
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Draw Emoji
  ctx.shadowBlur = 0;
  ctx.font = `${radius * 1.1}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 0, -2);

  // Draw Fixed Lock indicator if fixed
  if (isFixed) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Arial';
    ctx.fillText('🔒', 0, 0);
  } else {
    // Draw weight value tag
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(radius - 8, -radius + 8, 9, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = '#0d061f';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = 'bold 8.5px "Outfit", sans-serif';
    ctx.fillStyle = '#0d061f';
    ctx.fillText(`${weight}k`, radius - 8, -radius + 8.5);
  }

  ctx.restore();
}

function drawDragGuideline(ctx) {
  let closestIdx = -1;
  let minDist = Infinity;

  for (let i = 0; i < 6; i++) {
    if (hooks[i]) continue;
    const hookWorld = getHookWorldPos(beam, i);
    const dist = Math.hypot(draggedBody.position.x - hookWorld.x, draggedBody.position.y - hookWorld.y);
    if (dist < minDist) {
      minDist = dist;
      closestIdx = i;
    }
  }

  if (closestIdx !== -1 && minDist < 150) {
    const hookWorld = getHookWorldPos(beam, closestIdx);
    ctx.save();
    ctx.strokeStyle = minDist < 45 ? '#00ff66' : 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    
    ctx.beginPath();
    ctx.moveTo(draggedBody.position.x, draggedBody.position.y);
    ctx.lineTo(hookWorld.x, hookWorld.y);
    ctx.stroke();
    
    ctx.restore();
  }
}

function updateAndDrawParticles(ctx) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= p.fadeRate;

    if (p.alpha <= 0 || p.x < 0 || p.x > CANVAS_WIDTH || p.y < -30) {
      particles.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.shadowBlur = 8;
    ctx.shadowColor = p.color;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Bubble specular reflection
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x - p.radius * 0.3, p.y - p.radius * 0.3, p.radius * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Game loop logic
function animate() {
  // Update Physics
  Engine.update(engine, 16.666);

  // Calculate current torques
  const { left, right } = calculateTorques();
  updateUIStats(left, right);

  // Smoothly interpolate the scale beam angle proportional to the torque difference
  const maxAngle = 0.35;
  const torqueDiff = right - left; // Positive if tilted to the right
  const targetAngle = Math.max(-maxAngle, Math.min(maxAngle, torqueDiff * 0.022)); // 0.022 sensitivity factor

  const currentAngle = beam.angle;
  const newAngle = currentAngle + (targetAngle - currentAngle) * 0.08; // 8% lerp adjustment per frame for smooth dampening
  
  Body.setAngle(beam, newAngle);
  Body.setAngularVelocity(beam, 0);

  // Keep snapped animals rigidly locked onto hooks relative coordinates
  for (let i = 0; i < 6; i++) {
    const body = hooks[i];
    if (body) {
      const hookWorld = getHookWorldPos(beam, i);
      Body.setPosition(body, hookWorld);
      Body.setVelocity(body, { x: 0, y: 0 });
      Body.setAngle(body, beam.angle);
      Body.setAngularVelocity(body, beam.angularVelocity);
    }
  }

  // Update dragged body to exact pointer coordinates
  if (draggedBody) {
    Body.setPosition(draggedBody, mousePos);
    Body.setVelocity(draggedBody, { x: 0, y: 0 });
    Body.setAngle(draggedBody, 0);
    Body.setAngularVelocity(draggedBody, 0);
  }

  // Draw background and lab layouts
  drawBackground(ctx);
  drawFulcrum(ctx);
  drawBeam(ctx);
  drawHooks(ctx);

  // Draw other bodies (animals)
  const allBodies = Composite.allBodies(world);
  allBodies.forEach(body => {
    if (body.plugin && body.plugin.emoji) {
      drawAnimal(ctx, body);
    }
  });

  // Highlight connections
  if (draggedBody) {
    drawDragGuideline(ctx);
  }

  // Floating celebration bubbles
  updateAndDrawParticles(ctx);

  // Evaluate balance conditions
  if (left === right && left > 0) {
    if (!isBalanced) {
      isBalanced = true;
      playSuccessSound();
      spawnSuccessParticles();
      
      if (currentMode === 'challenge') {
        completedLevels.add(activeLevelId);
        localStorage.setItem('completedLevels', JSON.stringify(Array.from(completedLevels)));
        renderLevelButtons();
        
        // Show success splash banner after a short delay
        setTimeout(() => {
          if (isBalanced && currentMode === 'challenge') {
            successMessage.textContent = `You balanced the scale with ${left} kg⋅m of torque!`;
            successOverlay.classList.remove('hidden');
          }
        }, 800);
      }
    }
  } else {
    isBalanced = false;
  }

  requestAnimationFrame(animate);
}

// Start Drag Event
function handleDragStart(coord) {
  isMouseDown = true;
  mousePos = coord;
  
  // Query all active bodies under the mouse coordinates
  const bodies = Composite.allBodies(world);
  const clickedBodies = Matter.Query.point(bodies, coord);
  
  const animal = clickedBodies.find(b => b.plugin && b.plugin.emoji && !b.plugin.isFixed);
  
  if (animal) {
    draggedBody = animal;
    draggedBody.plugin.isDragging = true;
    
    // Temporarily set static to disable weight forces during dragging
    Body.setStatic(draggedBody, true);
    
    if (draggedBody.plugin.isSnapped) {
      unsnapFromHook(draggedBody);
    }
  }
}

// Drag Move Event
function handleDragMove(coord) {
  mousePos = coord;
}

// Drag End Event
function handleDragEnd() {
  if (!isMouseDown) return;
  isMouseDown = false;

  if (draggedBody) {
    draggedBody.plugin.isDragging = false;
    Body.setStatic(draggedBody, false);
    
    // Find closest vacant hook
    let closestIndex = -1;
    let minDistance = Infinity;

    for (let i = 0; i < 6; i++) {
      if (hooks[i]) continue; // Already occupied
      
      const hookWorld = getHookWorldPos(beam, i);
      const dist = Math.hypot(draggedBody.position.x - hookWorld.x, draggedBody.position.y - hookWorld.y);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = i;
      }
    }

    // Attempt snapping if close enough (within 45px range)
    if (closestIndex !== -1 && minDistance < 45) {
      const snapped = snapToHook(draggedBody, closestIndex);
      if (!snapped) {
        // Fall back to ground
        draggedBody.collisionFilter.mask = 0x0001 | 0x0002;
      }
    } else {
      // Free falling animal, restore physics filter
      draggedBody.collisionFilter.mask = 0x0001 | 0x0002;
    }
    
    draggedBody = null;
  }
}

// Event Listeners for Canvas Interaction
canvas.addEventListener('mousedown', (e) => {
  initAudio();
  handleDragStart(getMouseCoordinates(e));
});
window.addEventListener('mousemove', (e) => {
  handleDragMove(getMouseCoordinates(e));
});
window.addEventListener('mouseup', () => {
  handleDragEnd();
});

// Mobile Touch Support
canvas.addEventListener('touchstart', (e) => {
  initAudio();
  if (e.cancelable) e.preventDefault();
  handleDragStart(getMouseCoordinates(e));
}, { passive: false });
window.addEventListener('touchmove', (e) => {
  handleDragMove(getMouseCoordinates(e));
}, { passive: true });
window.addEventListener('touchend', () => {
  handleDragEnd();
});

// HTML Weight Shelf Click/Touch event: Spawns animal and immediately initiates drag
const shelfButtons = document.querySelectorAll('.shelf-item');
shelfButtons.forEach(btn => {
  const handler = (e) => {
    initAudio();
    if (e.cancelable) e.preventDefault();
    
    const type = btn.getAttribute('data-animal');
    const touchCoords = getMouseCoordinates(e);
    
    // Spawn animal directly at the coordinates
    const animal = createAnimalBody(type, touchCoords.x, touchCoords.y, false);
    if (animal) {
      isMouseDown = true;
      mousePos = touchCoords;
      draggedBody = animal;
      draggedBody.plugin.isDragging = true;
      Body.setStatic(draggedBody, true);
    }
  };
  
  btn.addEventListener('mousedown', handler);
  btn.addEventListener('touchstart', handler, { passive: false });
});

// UI Event Handlers
btnChallenge.onclick = () => switchMode('challenge');
btnSandbox.onclick = () => switchMode('sandbox');

soundBtn.onclick = () => {
  soundEnabled = !soundEnabled;
  soundBtn.textContent = soundEnabled ? "🔊" : "🔇";
};

resetBtn.onclick = () => {
  clearAllAnimals();
  if (currentMode === 'challenge') {
    loadLevel(activeLevelId);
  }
};

btnNextLevel.onclick = () => {
  successOverlay.classList.add('hidden');
  if (activeLevelId < levels.length) {
    loadLevel(activeLevelId + 1);
  } else {
    // Wrap around to level 1
    loadLevel(1);
  }
};

// Force cache refresh action
document.getElementById('btn-clear-cache').onclick = () => {
  if (navigator.serviceWorker) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => r.unregister());
    }).then(() => {
      caches.keys().then(keys => {
        return Promise.all(keys.map(k => caches.delete(k)));
      }).then(() => {
        window.location.reload(true);
      });
    });
  } else {
    window.location.reload(true);
  }
};

// Start the Laboratory app
switchMode('challenge');
requestAnimationFrame(animate);
