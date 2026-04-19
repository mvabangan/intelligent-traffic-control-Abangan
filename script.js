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
const pedestrianStatus = $('pedestrian-status');

const btnTransition = $('btn-transition');
const btnStartTimed = $('btn-start-timed');
const btnStopTimed = $('btn-stop-timed');
const btnPedestrian = $('btn-pedestrian');

const nsTimeInput = $('ns-time');
const ewTimeInput = $('ew-time');
const pedQueueInput = $('ped-queue');
const pedWalkInput = $('ped-walk');

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

  pedestrianActive: false,
  pedestrianQueued: false,
  pedestrianQueueTimeout: null,
  pedestrianWalkTimeout: null,
  pedestrianWarnTimeout: null,

  resumeLane: null,
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

function setPedestrianStatus(text, color, flash = false) {
  pedestrianStatus.textContent = text;
  pedestrianStatus.style.color = color;

  if (flash) {
    pedestrianStatus.classList.add('flash');
  } else {
    pedestrianStatus.classList.remove('flash');
  }
}

function clearAllTimeouts() {
  clearTimeout(State.timedTimeout);
  clearTimeout(State.transitionTimeout);
  clearTimeout(State.pedestrianQueueTimeout);
  clearTimeout(State.pedestrianWalkTimeout);
  clearTimeout(State.pedestrianWarnTimeout);

  State.timedTimeout = null;
  State.transitionTimeout = null;
  State.pedestrianQueueTimeout = null;
  State.pedestrianWalkTimeout = null;
  State.pedestrianWarnTimeout = null;
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

  setPedestrianStatus("DON'T WALK", '#ef4444', false);

  log(`⏱ Timed mode started — N–S: ${nsSeconds}s | E–W: ${ewSeconds}s`, 'info');
  log('✅ N–S is GO — E–W is STOP', 'success');

  runTimedCycle(nsSeconds, ewSeconds);
}

function runTimedCycle(nsSeconds, ewSeconds) {
  if (State.mode !== 'timed') return;
  if (State.pedestrianActive || State.pedestrianQueued) return;
  if (!State.timedRunning) return;

  const currentGoTime = State.ns === 'go' ? nsSeconds : ewSeconds;

  State.timedTimeout = setTimeout(function () {
    runManualTransition(function () {
      runTimedCycle(nsSeconds, ewSeconds);
    });
  }, currentGoTime * 1000);
}

function startPedestrianMode() {
  if (State.mode !== 'timed') return;

  if (!State.timedRunning) {
    log('⚠ Start timed mode first before using pedestrian', 'warning');
    return;
  }

  if (State.pedestrianActive || State.pedestrianQueued) return;

  const queueSec = parseFloat(pedQueueInput.value) || 3;
  const walkSec = parseFloat(pedWalkInput.value) || 3;

  State.pedestrianQueued = true;

  log(`🚶 Pedestrian requested — waiting ${queueSec} seconds`, 'warning');

  if (State.ns === 'go' || State.ns === 'warning') {
    State.resumeLane = 'ns';
  } else {
    State.resumeLane = 'ew';
  }

  setPedestrianStatus("DON'T WALK", '#ef4444', false);

  State.pedestrianQueueTimeout = setTimeout(function () {
    State.pedestrianQueued = false;
    State.pedestrianActive = true;

    clearTimeout(State.timedTimeout);
    clearTimeout(State.transitionTimeout);

    State.timedTimeout = null;
    State.transitionTimeout = null;
    State.transitioning = false;

    State.ns = 'stop';
    State.ew = 'stop';
    renderAll();

    setPedestrianStatus('WALK', '#22c55e', false);
    log(`🚶 WALK signal active — pedestrians may cross for ${walkSec} seconds`, 'success');

    State.pedestrianWalkTimeout = setTimeout(function () {
      setPedestrianStatus('WALK FAST', '#f59e0b', true);
      log(`⚠ WALK FAST — ${walkSec} seconds remaining warning phase`, 'warning');

      State.pedestrianWarnTimeout = setTimeout(function () {
        State.pedestrianActive = false;
        setPedestrianStatus("DON'T WALK", '#ef4444', false);

        if (State.resumeLane === 'ns') {
          State.ns = 'go';
          State.ew = 'stop';
          log('✅ Resuming N–S after pedestrian', 'success');
        } else {
          State.ew = 'go';
          State.ns = 'stop';
          log('✅ Resuming E–W after pedestrian', 'success');
        }

        renderAll();
        runTimedCycle(State.lastNsSeconds, State.lastEwSeconds);
      }, walkSec * 1000);
    }, walkSec * 1000);
  }, queueSec * 1000);
}

function stopTimedMode() {
  clearAllTimeouts();

  State.timedRunning = false;
  State.pedestrianActive = false;
  State.pedestrianQueued = false;
  State.transitioning = false;

  setPedestrianStatus("DON'T WALK", '#ef4444', false);

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

btnPedestrian.onclick = () => startPedestrianMode();

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
setPedestrianStatus("DON'T WALK", '#ef4444', false);
log('🚦 Traffic Simulator initialized', 'info');
log('✅ E–W is GO — N–S is STOP', 'success');