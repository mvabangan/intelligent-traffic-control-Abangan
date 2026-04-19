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

const nsCountdown = $('ns-countdown');
const ewCountdown = $('ew-countdown');
const pedestrianCountdown = $('pedestrian-countdown');

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
const labelManual = $('label-manual');
const labelTimed = $('label-timed');

const State = {
  ns: 'stop',
  ew: 'go',
  mode: 'manual',

  transitioning: false,
  transitionTimeout: null,
  transitionInterval: null,

  timedTimeout: null,
  timedRunning: false,

  pedestrianActive: false,
  pedestrianQueued: false,
  pedestrianQueueTimeout: null,
  pedestrianQueueInterval: null,
  pedestrianWalkTimeout: null,
  pedestrianWalkInterval: null,
  pedestrianWarnTimeout: null,
  pedestrianWarnInterval: null,

  resumeLane: null,
  lastNsSeconds: 10,
  lastEwSeconds: 7,
};

function log(message, type = 'info') {
  const entry = document.createElement('div');
  entry.className = 'log-entry ' + type;

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour12: false });

  entry.innerHTML = `<span class="log-time">[${timeStr}]</span>${message}`;
  logContainer.prepend(entry);

  while (logContainer.children.length > 80) {
    logContainer.removeChild(logContainer.lastChild);
  }
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

function setPedestrianStatus(text, color = '#ef4444', flashing = false) {
  pedestrianStatus.textContent = text;
  pedestrianStatus.style.color = color;

  if (flashing) {
    pedestrianStatus.classList.add('flash');
  } else {
    pedestrianStatus.classList.remove('flash');
  }
}

function setTimerState(el, state) {
  el.classList.remove('go', 'stop', 'warning');
  el.classList.add(state);
}

function setLaneCountdowns(nsValue = '-', ewValue = '-', nsState = 'stop', ewState = 'stop') {
  if (State.mode !== 'timed' && State.ns !== 'warning' && State.ew !== 'warning') {
    nsCountdown.textContent = '-';
    ewCountdown.textContent = '-';
    setTimerState(nsCountdown, 'stop');
    setTimerState(ewCountdown, 'stop');
    return;
  }

  nsCountdown.textContent = nsValue;
  ewCountdown.textContent = ewValue;
  setTimerState(nsCountdown, nsState);
  setTimerState(ewCountdown, ewState);
}

function setPedCountdown(value = '-', state = 'stop') {
  pedestrianCountdown.textContent = value;
  setTimerState(pedestrianCountdown, state);
}

function clearAllTimeouts() {
  clearTimeout(State.timedTimeout);
  clearTimeout(State.transitionTimeout);
  clearTimeout(State.pedestrianQueueTimeout);
  clearTimeout(State.pedestrianWalkTimeout);
  clearTimeout(State.pedestrianWarnTimeout);

  clearInterval(State.transitionInterval);
  clearInterval(State.pedestrianQueueInterval);
  clearInterval(State.pedestrianWalkInterval);
  clearInterval(State.pedestrianWarnInterval);

  State.timedTimeout = null;
  State.transitionTimeout = null;
  State.pedestrianQueueTimeout = null;
  State.pedestrianWalkTimeout = null;
  State.pedestrianWarnTimeout = null;

  State.transitionInterval = null;
  State.pedestrianQueueInterval = null;
  State.pedestrianWalkInterval = null;
  State.pedestrianWarnInterval = null;
}

function runManualTransition(callback) {
  if (State.transitioning) return;

  State.transitioning = true;

  const nsActive = State.ns === 'go';
  let remaining = 3;

  if (nsActive) {
    State.ns = 'warning';
    log('⚠ N–S changing to WARNING', 'warning');
  } else {
    State.ew = 'warning';
    log('⚠ E–W changing to WARNING', 'warning');
  }

  renderAll();

  function updateWarningCountdown() {
    if (nsActive) {
      setLaneCountdowns(remaining, remaining, 'warning', 'stop');
    } else {
      setLaneCountdowns(remaining, remaining, 'stop', 'warning');
    }
  }

  updateWarningCountdown();

  State.transitionInterval = setInterval(function () {
    remaining--;

    if (remaining > 0) {
      updateWarningCountdown();
    }
  }, 1000);

  State.transitionTimeout = setTimeout(function () {
    clearInterval(State.transitionInterval);
    State.transitionInterval = null;

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

    if (State.mode !== 'timed') {
      setLaneCountdowns('-', '-', 'stop', 'stop');
    }

    State.transitioning = false;
    State.transitionTimeout = null;

    if (typeof callback === 'function') {
      callback();
    }
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
  setPedCountdown('-', 'stop');
  setLaneCountdowns(nsSeconds, nsSeconds + 3, 'go', 'stop');

  log(`⏱ Timed mode started — N–S: ${nsSeconds}s | E–W: ${ewSeconds}s`, 'info');
  log('✅ N–S is GO — E–W is STOP', 'success');

  runTimedCycle(nsSeconds, ewSeconds);
}

function runTimedCycle(nsSeconds, ewSeconds) {
  if (State.mode !== 'timed') return;
  if (State.pedestrianActive || State.pedestrianQueued) return;
  if (!State.timedRunning) return;

  const nsActive = State.ns === 'go';
  let activeRemaining = nsActive ? nsSeconds : ewSeconds;
  let stopRemaining = activeRemaining + 3;

  function tick() {
    if (State.mode !== 'timed') return;
    if (State.pedestrianActive || State.pedestrianQueued) return;
    if (!State.timedRunning) return;

    if (activeRemaining > 0) {
      if (nsActive) {
        setLaneCountdowns(activeRemaining, stopRemaining, 'go', 'stop');
      } else {
        setLaneCountdowns(stopRemaining, activeRemaining, 'stop', 'go');
      }

      activeRemaining--;
      stopRemaining--;

      State.timedTimeout = setTimeout(tick, 1000);
      return;
    }

    runManualTransition(function () {
      runTimedCycle(nsSeconds, ewSeconds);
    });
  }

  tick();
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

  let queueRemaining = queueSec;
  setPedCountdown(queueRemaining, 'stop');

  State.pedestrianQueueInterval = setInterval(function () {
    queueRemaining--;

    if (queueRemaining > 0) {
      setPedCountdown(queueRemaining, 'stop');
    }
  }, 1000);

  State.pedestrianQueueTimeout = setTimeout(function () {
    clearInterval(State.pedestrianQueueInterval);
    State.pedestrianQueueInterval = null;

    State.pedestrianQueued = false;
    State.pedestrianActive = true;

    clearTimeout(State.timedTimeout);
    clearTimeout(State.transitionTimeout);
    clearInterval(State.transitionInterval);

    State.timedTimeout = null;
    State.transitionTimeout = null;
    State.transitionInterval = null;
    State.transitioning = false;

    State.ns = 'stop';
    State.ew = 'stop';
    renderAll();
    setLaneCountdowns(walkSec + walkSec, walkSec + walkSec, 'stop', 'stop');

    setPedestrianStatus('WALK', '#22c55e', false);
    setPedCountdown(walkSec, 'go');
    log(`🚶 WALK signal active — pedestrians may cross for ${walkSec} seconds`, 'success');

    let walkRemaining = walkSec;

    State.pedestrianWalkInterval = setInterval(function () {
      walkRemaining--;

      if (walkRemaining > 0) {
        setPedCountdown(walkRemaining, 'go');
        setLaneCountdowns(walkRemaining + walkSec, walkRemaining + walkSec, 'stop', 'stop');
      }
    }, 1000);

    State.pedestrianWalkTimeout = setTimeout(function () {
      clearInterval(State.pedestrianWalkInterval);
      State.pedestrianWalkInterval = null;

      setPedestrianStatus('WALK FAST', '#f59e0b', true);
      setPedCountdown(walkSec, 'warning');
      log(`⚠ WALK FAST — ${walkSec} seconds remaining warning phase`, 'warning');

      let warnRemaining = walkSec;

      State.pedestrianWarnInterval = setInterval(function () {
        warnRemaining--;

        if (warnRemaining > 0) {
          setPedCountdown(warnRemaining, 'warning');
          setLaneCountdowns(warnRemaining, warnRemaining, 'stop', 'stop');
        }
      }, 1000);

      State.pedestrianWarnTimeout = setTimeout(function () {
        clearInterval(State.pedestrianWarnInterval);
        State.pedestrianWarnInterval = null;

        State.pedestrianActive = false;
        setPedestrianStatus("DON'T WALK", '#ef4444', false);
        setPedCountdown('-', 'stop');

        if (State.resumeLane === 'ns') {
          State.ns = 'go';
          State.ew = 'stop';
          log('✅ Resuming N–S after pedestrian', 'success');
          setLaneCountdowns(State.lastNsSeconds, State.lastNsSeconds + 3, 'go', 'stop');
        } else {
          State.ew = 'go';
          State.ns = 'stop';
          log('✅ Resuming E–W after pedestrian', 'success');
          setLaneCountdowns(State.lastEwSeconds + 3, State.lastEwSeconds, 'stop', 'go');
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
  setPedCountdown('-', 'stop');
  setLaneCountdowns('-', '-', 'stop', 'stop');

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

    clearAllTimeouts();
    State.timedRunning = false;
    State.transitioning = false;

    setLaneCountdowns('-', '-', 'stop', 'stop');
    setPedCountdown('-', 'stop');
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
setLaneCountdowns('-', '-', 'stop', 'stop');
setPedestrianStatus("DON'T WALK", '#ef4444', false);
setPedCountdown('-', 'stop');
log('🚦 Traffic Simulator initialized', 'info');
log('✅ E–W is GO — N–S is STOP', 'success');