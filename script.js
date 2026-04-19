function $(id) {
  return document.getElementById(id);
}

const nsLights = {
  red: $('ns-red'),
  yellow: $('ns-yellow'),
  green: $('ns-green'),
};

const ewLights = {
  red: $('ew-red'),
  yellow: $('ew-yellow'),
  green: $('ew-green'),
};

const nsStateText = $('ns-state-text');
const ewStateText = $('ew-state-text');

const btnTransition = $('btn-transition');
const btnStartTimed = $('btn-start-timed');
const btnStopTimed = $('btn-stop-timed');

const nsTimeInput = $('ns-time');
const ewTimeInput = $('ew-time');

const modeSlider = $('mode-slider');
const manualControls = $('manual-controls');
const timedControls = $('timed-controls');

const logContainer = $('log-container');
const btnClearLog = $('btn-clear-log');

const State = {
  ns: 'stop',
  ew: 'go',
  mode: 'manual',

  transitioning: false,
  transitionTimeout: null,
  timedTimeout: null,
  timedRunning: false,

  lastNsSeconds: 10,
  lastEwSeconds: 7,
};

function log(message, type = 'info') {
  const entry = document.createElement('div');
  entry.className = 'log-entry ' + type;

  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  entry.innerHTML = `<span class="log-time">[${time}]</span>${message}`;

  logContainer.prepend(entry);
}

function renderLight(lights, stateText, state) {
  lights.red.classList.remove('active');
  lights.yellow.classList.remove('active');
  lights.green.classList.remove('active');

  if (state === 'stop') {
    lights.red.classList.add('active');
    stateText.textContent = 'STOP';
    stateText.style.color = '#ef4444';
  } else if (state === 'warning') {
    lights.yellow.classList.add('active');
    stateText.textContent = 'SLOW';
    stateText.style.color = '#eab308';
  } else {
    lights.green.classList.add('active');
    stateText.textContent = 'GO';
    stateText.style.color = '#22c55e';
  }
}

function renderAll() {
  renderLight(nsLights, nsStateText, State.ns);
  renderLight(ewLights, ewStateText, State.ew);
}

function clearAllTimeouts() {
  clearTimeout(State.timedTimeout);
  clearTimeout(State.transitionTimeout);

  State.timedTimeout = null;
  State.transitionTimeout = null;
}

function runManualTransition(callback) {
  if (State.transitioning) return;

  State.transitioning = true;

  const nsActive = State.ns === 'go';

  if (nsActive) {
    State.ns = 'warning';
    log('⚠ N–S changing to WARNING', 'warning');
  } else {
    State.ew = 'warning';
    log('⚠ E–W changing to WARNING', 'warning');
  }

  renderAll();

  State.transitionTimeout = setTimeout(function () {
    if (nsActive) {
      State.ns = 'stop';
      State.ew = 'go';
      log('✅ E–W is GO — N–S is STOP', 'success');
    } else {
      State.ew = 'stop';
      State.ns = 'go';
      log('✅ N–S is GO — E–W is STOP', 'success');
    }

    renderAll();
    State.transitioning = false;
    State.transitionTimeout = null;

    if (callback) callback();
  }, 3000);
}

function startTimedMode() {
  const nsSeconds = parseFloat(nsTimeInput.value) || 10;
  const ewSeconds = parseFloat(ewTimeInput.value) || 7;

  State.lastNsSeconds = nsSeconds;
  State.lastEwSeconds = ewSeconds;
  State.timedRunning = true;
  State.transitioning = false;

  State.ns = 'go';
  State.ew = 'stop';
  renderAll();

  log(`⏱ Timed mode started — N–S: ${nsSeconds}s | E–W: ${ewSeconds}s`, 'info');
  log('✅ N–S is GO — E–W is STOP', 'success');

  runTimedCycle(nsSeconds, ewSeconds);
}

function runTimedCycle(nsSeconds, ewSeconds) {
  if (State.mode !== 'timed') return;
  if (!State.timedRunning) return;

  const currentGoTime = State.ns === 'go' ? nsSeconds : ewSeconds;

  State.timedTimeout = setTimeout(function () {
    runManualTransition(function () {
      runTimedCycle(nsSeconds, ewSeconds);
    });
  }, currentGoTime * 1000);
}

function stopTimedMode() {
  clearAllTimeouts();

  State.timedRunning = false;
  State.transitioning = false;

  log('⏹ Timed mode stopped', 'warning');
}

btnTransition.onclick = () => runManualTransition();

btnStartTimed.onclick = () => {
  stopTimedMode();

  State.ns = 'go';
  State.ew = 'stop';
  State.transitioning = false;

  startTimedMode();
};

btnStopTimed.onclick = () => stopTimedMode();

modeSlider.oninput = () => {
  if (modeSlider.value === '0') {
    State.mode = 'manual';
    manualControls.classList.remove('hidden');
    timedControls.classList.add('hidden');
  } else {
    State.mode = 'timed';
    manualControls.classList.add('hidden');
    timedControls.classList.remove('hidden');
  }
};

btnClearLog.onclick = () => {
  logContainer.innerHTML = '';
};

renderAll();
log('🚦 Traffic Simulator initialized', 'info');
log('✅ E–W is GO — N–S is STOP', 'success');