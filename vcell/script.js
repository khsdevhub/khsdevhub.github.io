function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function nudge(key, amount) {
  state[key] = clamp(state[key] + amount);
}

function expSeries(x) {
  let sum = 1;
  let term = 1;

  for (let i = 1; i <= 12; i += 1) {
    term *= x / i;
    sum += term;
  }

  return sum;
}

function curiosityAutonomyDrive(curiosity) {
  const lowCuriosity = 1 - curiosity / 100;
  const exponent = -4.2 * lowCuriosity * lowCuriosity;
  return clamp(1 - expSeries(exponent), 0, 1);
}

function normalCurve(value, mean, deviation) {
  const z = (value - mean) / deviation;
  return clamp(expSeries(-0.5 * z * z), 0, 1);
}

function bondApproachDrive(bond) {
  return normalCurve(bond, 80, 24);
}

function energySpeedDrive(energy) {
  const normalizedEnergy = energy / 100;
  return clamp(0.04 + normalizedEnergy * normalizedEnergy * 1.2, 0.04, 1.24);
}

function distanceToMouse() {
  return Math.hypot(mouseX - cellX, mouseY - cellY);
}

function setMessage(text) {
  messageText.textContent = text;
}

function updateState(dt) {
  const distance = distanceToMouse();
  const mouseIdle = performance.now() - lastMoveAt > 1800;

  nudge('energy', -dt * (isFollowing ? 1.6 : 0.55));
  nudge('stress', mouseIdle ? -dt * 3.4 : -dt * 1.5);
  nudge('curiosity', mouseIdle ? -dt * 4.4 : dt * 0.25);

  if (observationMode) {
    nudge('curiosity', -dt * 1.35);
    nudge('stress', -dt * 0.7);
  }

  if (distance < 130) {
    nudge('bond', dt * 3.2);
    nudge('stress', -dt * 1.2);
  } else if (distance > 360) {
    nudge('bond', -dt * 0.8);
  }

  if (state.energy < 20) {
    nudge('stress', dt * 2.8);
  }
}

function chooseMood() {
  if (state.energy < 18) {
    return ['tired', '움직임을 아끼며 천천히 반응합니다.'];
  }

  if (state.stress > 68) {
    return ['startled', '자극이 너무 강해 떨리고 있습니다.'];
  }

  if (!isFollowing) {
    return ['resting', '멈춰 있지만 계속 지켜보고 있습니다.'];
  }

  if (freeAction.active) {
    return ['free', freeAction.mode === 'orbit'
      ? '당신 주변에서 스스로 경로를 고릅니다.'
      : '잠시 혼자서 배회합니다.'];
  }

  if (state.bond > 64) {
    return ['attached', '당신의 움직임을 기억하고 가까이 다가옵니다.'];
  }

  if (state.curiosity > 62) {
    return ['curious', '움직임을 관찰하며 형태를 바꿉니다.'];
  }

  return ['calm', '가까이 움직이고, 잠시 기다린 뒤 부드럽게 클릭해보세요.'];
}

function moodLabel(mood) {
  const labels = {
    calm: '차분함',
    curious: '호기심',
    attached: '친밀함',
    free: '자율행동',
    resting: '휴식',
    startled: '놀람',
    tired: '피곤함'
  };

  return labels[mood] || mood;
}

function updateMood() {
  const result = chooseMood();
  const mood = result[0];
  const message = result[1];

  moodText.textContent = moodLabel(mood);
  setMessage(message);

  cell.classList.toggle('curious', mood === 'curious');
  cell.classList.toggle('attached', mood === 'attached');
  cell.classList.toggle('startled', mood === 'startled');
  cell.classList.toggle('tired', mood === 'tired');
  cell.classList.toggle('resting', mood === 'resting');
  cell.classList.toggle('free', mood === 'free');
}

function updateReadout() {
  energyText.textContent = Math.round(state.energy);
  curiosityText.textContent = Math.round(state.curiosity);
  bondText.textContent = Math.round(state.bond);
  stressText.textContent = Math.round(state.stress);
}

function pushStatHistory(now) {
  if (now - lastHistoryAt < 220) {
    return;
  }

  lastHistoryAt = now;

  for (const key of Object.keys(statHistory)) {
    statHistory[key].push(state[key]);

    if (statHistory[key].length > HISTORY_LIMIT) {
      statHistory[key].shift();
    }
  }
}

function drawStatLine(values, style) {
  if (values.length < 2) {
    return;
  }

  const width = statGraph.width;
  const height = statGraph.height;
  const pad = 8;
  const step = (width - pad * 2) / (HISTORY_LIMIT - 1);

  statGraphCtx.save();
  statGraphCtx.globalAlpha = style.alpha;
  statGraphCtx.strokeStyle = '#000';
  statGraphCtx.lineWidth = style.width;
  statGraphCtx.setLineDash(style.dash);
  statGraphCtx.beginPath();

  for (let i = 0; i < values.length; i += 1) {
    const x = pad + i * step;
    const y = height - pad - clamp(values[i]) / 100 * (height - pad * 2);

    if (i === 0) {
      statGraphCtx.moveTo(x, y);
    } else {
      statGraphCtx.lineTo(x, y);
    }
  }

  statGraphCtx.stroke();
  statGraphCtx.restore();
}

function drawStatGraph() {
  const width = statGraph.width;
  const height = statGraph.height;

  statGraphCtx.clearRect(0, 0, width, height);
  statGraphCtx.strokeStyle = '#eee';
  statGraphCtx.lineWidth = 1;

  for (let i = 1; i < 4; i += 1) {
    const y = Math.round((height / 4) * i) + 0.5;
    statGraphCtx.beginPath();
    statGraphCtx.moveTo(0, y);
    statGraphCtx.lineTo(width, y);
    statGraphCtx.stroke();
  }

  drawStatLine(statHistory.energy, { alpha: 1, width: 1.2, dash: [] });
  drawStatLine(statHistory.curiosity, { alpha: 0.85, width: 1, dash: [4, 3] });
  drawStatLine(statHistory.bond, { alpha: 1, width: 2, dash: [] });
  drawStatLine(statHistory.stress, { alpha: 0.45, width: 1, dash: [] });
}

function radiusSet(a, b, c, d) {
  return a.toFixed(1) + '% ' + b.toFixed(1) + '% ' + c.toFixed(1) + '% ' + d.toFixed(1) + '%';
}

function updateMembrane(now) {
  const t = now * 0.001;
  const energy = state.energy / 100;
  const curiosity = state.curiosity / 100;
  const bond = state.bond / 100;
  const stress = state.stress / 100;
  const tired = 1 - energy;

  const baseAmp = 4 + energy * 5 + curiosity * 4;
  const stressAmp = stress * 10;
  const calmAmp = bond * 3 - tired * 2;

  const a = 50
    + Math.sin(t * 1.7) * baseAmp
    + Math.cos(t * 2.35 + stress * 2) * (3 + stressAmp);
  const b = 50
    + Math.cos(t * 1.25 + 1.6) * (baseAmp + calmAmp)
    - Math.sin(t * 2.05) * (3 + curiosity * 7);
  const c = 50
    + Math.sin(t * 1.1 + 2.2) * (baseAmp + curiosity * 6)
    + Math.cos(t * 2.9 + bond) * (2 + stressAmp * 0.5);
  const d = 50
    + Math.cos(t * 1.95 + 0.8) * (baseAmp + bond * 5)
    - Math.sin(t * 2.55 + stress) * (3 + stressAmp * 0.6);

  const innerA = 50
    + Math.cos(t * 1.35 + 0.4) * (4 + energy * 5)
    - Math.sin(t * 2.1) * tired * 3;
  const innerB = 50
    + Math.sin(t * 1.75 + 2.1) * (5 + curiosity * 5);
  const innerC = 50
    + Math.cos(t * 2.2 + 1.2) * (5 + stress * 6);
  const innerD = 50
    + Math.sin(t * 1.5 + 3.4) * (4 + bond * 5);

  wall.style.setProperty('--wall-radius', radiusSet(a, b, c, d));
  wall.style.setProperty('--inner-radius', radiusSet(innerA, innerB, innerC, innerD));
}

function randomTargetNear(x, y, radius) {
  const angle = Math.random() * Math.PI * 2;
  const distance = radius * (0.35 + Math.random() * 0.65);
  const margin = 110;

  return {
    x: clamp(x + Math.cos(angle) * distance, margin, window.innerWidth - margin),
    y: clamp(y + Math.sin(angle) * distance, margin, window.innerHeight - margin)
  };
}

function startFreeAction(now) {
  const orbit = state.bond > 55 && state.curiosity > 24;
  const lowCuriosity = 1 - state.curiosity / 100;

  freeAction.active = true;
  freeAction.mode = orbit ? 'orbit' : 'explore';
  freeAction.until = now + 1800 + lowCuriosity * 2600 + Math.random() * 1600;
  freeAction.target = orbit
    ? randomTargetNear(mouseX, mouseY, 120 + state.bond * 0.7)
    : randomTargetNear(cellX, cellY, 150 + lowCuriosity * 150);

  nudge('energy', -3);
  nudge('curiosity', orbit ? -1 : -2);
  nudge('bond', orbit ? 0.8 : -0.4);
}

function updateFreeAction(now) {
  if (!freeAction.active) {
    if (now < freeAction.nextCheck || !isFollowing || state.energy < 24 || state.stress > 62) {
      return;
    }

    const curiosityDrive = curiosityAutonomyDrive(state.curiosity);
    const bondInfluence = Math.max(0, state.bond - 35) / 65;
    const energyInfluence = state.energy / 100;
    const stressPenalty = state.stress / 100;
    const observationBoost = observationMode ? 0.24 : 0;
    const chance = clamp(
      curiosityDrive * 0.72
        + bondInfluence * 0.08
        + energyInfluence * 0.05
        + observationBoost
        - stressPenalty * 0.16,
      0,
      0.72
    );

    freeAction.nextCheck = now + 550 + Math.random() * 1100;

    if (Math.random() < chance) {
      startFreeAction(now);
    }

    return;
  }

  if (now > freeAction.until || state.stress > 74 || state.energy < 16) {
    freeAction.active = false;
    freeAction.nextCheck = now + 1800;
    setMessage('다시 당신을 의식합니다.');
    return;
  }

  const targetDistance = Math.hypot(freeAction.target.x - cellX, freeAction.target.y - cellY);

  if (targetDistance < 55) {
    const lowCuriosity = 1 - state.curiosity / 100;

    freeAction.target = freeAction.mode === 'orbit'
      ? randomTargetNear(mouseX, mouseY, 120 + state.bond * 0.65)
      : randomTargetNear(cellX, cellY, 140 + lowCuriosity * 140);
  }
}

function moveCell(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;
  const actionSpeed = BASE_ACTION_SPEED * energySpeedDrive(state.energy);

  updateState(dt);
  updateFreeAction(now);
  updateMood();
  updateMembrane(now);
  pushStatHistory(now);

  if (isFollowing) {
    const distance = distanceToMouse();
    const fear = state.stress > 70 ? -0.018 : 0;
    const freeBoost = freeAction.active ? 0.0018 + Math.max(0, 68 - state.curiosity) * 0.000018 : 0;
    const bondBoost = freeAction.active ? 0 : bondApproachDrive(state.bond) * 0.0055;
    const attraction = 0.0038 + bondBoost + state.curiosity * 0.000025 + fear + freeBoost;
    const driftScale = freeAction.active ? 0.25 : 1;
    const driftX = Math.sin(now * 0.0011) * (state.curiosity / 80) * driftScale;
    const driftY = Math.cos(now * 0.0013) * (state.curiosity / 90) * driftScale;
    const targetX = freeAction.active ? freeAction.target.x : (observationMode ? cellX : mouseX);
    const targetY = freeAction.active ? freeAction.target.y : (observationMode ? cellY : mouseY);

    cellVX += (targetX - cellX) * attraction;
    cellVY += (targetY - cellY) * attraction;

    if (!observationMode && !freeAction.active && distance < 80 && state.stress > 45) {
      cellVX -= (mouseX - cellX) * 0.007;
      cellVY -= (mouseY - cellY) * 0.007;
    }

    cellVX += driftX;
    cellVY += driftY;
  }

  const damping = freeAction.active ? 0.78 : (state.energy < 20 ? 0.8 : 0.84);
  cellVX *= damping;
  cellVY *= damping;
  cellX += cellVX * actionSpeed;
  cellY += cellVY * actionSpeed;

  const margin = 90;
  cellX = Math.max(margin, Math.min(window.innerWidth - margin, cellX));
  cellY = Math.max(margin, Math.min(window.innerHeight - margin, cellY));

  const pulse = 1 + Math.sin(now * 0.006) * (0.01 + state.energy / 5000);
  const rotate = Math.sin(now * 0.001 + state.curiosity) * (state.stress / 18);
  cell.style.transform = 'translate(' + (cellX - 90) + 'px, ' + (cellY - 90) + 'px) scale(' + pulse + ') rotate(' + rotate + 'deg)';

  updateReadout();

  if (!infoPanel.hidden) {
    drawStatGraph();
  }

  requestAnimationFrame(moveCell);
}

function burstAndReborn() {
  isFollowing = false;

  cell.classList.remove('stop', 'newborn');
  cell.classList.add('burst');
  nudge('stress', 24);
  nudge('energy', -18);

  setTimeout(function() {
    cell.classList.remove('burst');

    cellX = Math.random() * (window.innerWidth - 180) + 90;
    cellY = Math.random() * (window.innerHeight - 180) + 90;
    cellVX = 0;
    cellVY = 0;
    mouseX = cellX;
    mouseY = cellY;
    applyCellName('');

    state.energy = clamp(state.energy + 35);
    state.curiosity = 52;
    state.stress = 18;
    state.bond = clamp(state.bond * 0.55);
    isFollowing = true;

    cell.classList.add('newborn');
    setMessage('당신에 대한 희미한 기억을 가진 채 다시 형성됩니다.');

    setTimeout(function() {
      cell.classList.remove('newborn');
    }, 900);
  }, 700);
}

// 요소 불러오기
const cell = document.getElementById('cell');
const wall = cell.querySelector('.wall');
const cellNameText = document.getElementById('cellName');
const moodText = document.getElementById('mood');
const messageText = document.getElementById('message');
const statGraph = document.getElementById('statGraph');
const statGraphCtx = statGraph.getContext('2d');
const energyText = document.getElementById('energyText');
const curiosityText = document.getElementById('curiosityText');
const bondText = document.getElementById('bondText');
const stressText = document.getElementById('stressText');
const feedBtn = document.getElementById('feedBtn');
const infoBtn = document.getElementById('infoBtn');
const infoPanel = document.getElementById('infoPanel');
const controlBtn = document.getElementById('controlBtn');
const controlPanel = document.getElementById('controlPanel');
const callBtn = document.getElementById('callBtn');
const observeBtn = document.getElementById('observeBtn');
const restBtn = document.getElementById('restBtn');
const sootheBtn = document.getElementById('sootheBtn');
const nameInput = document.getElementById('nameInput');
const saveNameBtn = document.getElementById('saveNameBtn');

let isFollowing = true;
let observationMode = false;
let clickTimer = null;
let lastTime = performance.now();
let lastMoveAt = performance.now();
let lastHistoryAt = 0;

let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;
let cellX = window.innerWidth / 2;
let cellY = window.innerHeight / 2;
let cellVX = 0;
let cellVY = 0;

const BASE_ACTION_SPEED = 1;
const HISTORY_LIMIT = 96;

const statHistory = {
  energy: [],
  curiosity: [],
  bond: [],
  stress: []
};

const initialState = {
  energy: 72,
  curiosity: 38,
  bond: 12,
  stress: 8
};

const state = { ...initialState };

const freeAction = {
  active: false,
  mode: 'explore',
  target: { x: cellX, y: cellY },
  until: 0,
  nextCheck: performance.now() + 1200
};

function applyCellName(name) {
  const nextName = name.trim();

  cellNameText.hidden = !nextName;
  cellNameText.textContent = nextName ? '(' + nextName + ')' : '';
  nameInput.value = nextName;
}

function setControlPanelOpen(open) {
  controlPanel.hidden = !open;
  controlBtn.classList.toggle('active', open);
  controlBtn.setAttribute('aria-expanded', String(open));

  if (open) {
    setInfoPanelOpen(false);
  }
}

function setInfoPanelOpen(open) {
  infoPanel.hidden = !open;
  infoBtn.classList.toggle('active', open);
  infoBtn.setAttribute('aria-expanded', String(open));

  if (open) {
    controlPanel.hidden = true;
    controlBtn.classList.remove('active');
    controlBtn.setAttribute('aria-expanded', 'false');
    drawStatGraph();
  }
}

document.addEventListener('mousemove', function(e) {
  const moved = Math.hypot(e.clientX - mouseX, e.clientY - mouseY);

  mouseX = e.clientX;
  mouseY = e.clientY;
  lastMoveAt = performance.now();

  nudge('curiosity', moved * 0.012);

  if (distanceToMouse() < 170) {
    nudge('bond', 0.12);
  }
});

document.addEventListener('mouseleave', function() {
  nudge('curiosity', -8);
  nudge('stress', -4);
  freeAction.active = false;
  setMessage('당신이 마지막으로 있던 자리 근처에서 기다립니다.');
});


cell.addEventListener('click', function() {
  if (clickTimer) {
    clearTimeout(clickTimer);
    clickTimer = null;
    burstAndReborn();
    return;
  }

  nudge('stress', 12);
  nudge('curiosity', 8);

  clickTimer = setTimeout(function() {
    isFollowing = !isFollowing;
    freeAction.active = false;
    cell.classList.toggle('stop', !isFollowing);
    nudge('bond', isFollowing ? 5 : -2);
    nudge('stress', isFollowing ? 4 : -8);
    setMessage(isFollowing ? '다시 따라오기 시작합니다.' : '멈춰서 주변을 감지합니다.');
    clickTimer = null;
  }, 230);
});

feedBtn.addEventListener('click', function() {
  nudge('energy', 24);
  nudge('curiosity', 5);
  nudge('stress', 3);
  setMessage('에너지가 올라가고 반응이 또렷해집니다.');
});

controlBtn.addEventListener('click', function(e) {
  e.stopPropagation();
  setControlPanelOpen(controlPanel.hidden);
});

infoBtn.addEventListener('click', function(e) {
  e.stopPropagation();
  setInfoPanelOpen(infoPanel.hidden);
});

saveNameBtn.addEventListener('click', function() {
  applyCellName(nameInput.value);
  setMessage(nameInput.value.trim()
    ? '이름을 붙였습니다.'
    : '이름을 비워두었습니다.');
});

nameInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    applyCellName(nameInput.value);
    setMessage(nameInput.value.trim()
      ? '이름을 붙였습니다.'
      : '이름을 비워두었습니다.');
  }
});

callBtn.addEventListener('click', function() {
  isFollowing = true;
  freeAction.active = false;
  cell.classList.remove('stop');
  nudge('bond', 7);
  nudge('curiosity', 12);
  nudge('stress', 4);
  setMessage('호출 신호를 감지하고 당신 쪽으로 의식을 돌립니다.');
  setControlPanelOpen(false);
});

observeBtn.addEventListener('click', function() {
  observationMode = !observationMode;
  observeBtn.classList.toggle('active', observationMode);

  if (observationMode) {
    freeAction.nextCheck = performance.now();
    nudge('curiosity', -10);
    nudge('stress', -4);
    setMessage('관찰 모드가 켜졌습니다. VCell이 마우스를 직접 따라오지 않습니다.');
  } else {
    freeAction.active = false;
    setMessage('관찰 모드가 꺼졌습니다. VCell이 다시 당신의 움직임에 더 반응합니다.');
  }
});

restBtn.addEventListener('click', function() {
  isFollowing = false;
  freeAction.active = false;
  cell.classList.add('stop');
  nudge('stress', -12);
  nudge('curiosity', -6);
  setMessage('휴식 명령을 받아 움직임을 줄이고 에너지를 아낍니다.');
  setControlPanelOpen(false);
});

sootheBtn.addEventListener('click', function() {
  nudge('stress', -28);
  nudge('bond', 8);
  setMessage('신호를 받아 막의 긴장이 부드럽게 풀립니다.');
});

document.addEventListener('click', function(e) {
  if (!controlPanel.hidden && !e.target.closest('.controls')) {
    setControlPanelOpen(false);
  }

  if (!infoPanel.hidden && !e.target.closest('.controls')) {
    setInfoPanelOpen(false);
  }
});

window.addEventListener('resize', function() {
  cellX = Math.max(90, Math.min(window.innerWidth - 90, cellX));
  cellY = Math.max(90, Math.min(window.innerHeight - 90, cellY));
});

requestAnimationFrame(moveCell);
