/* =========================================================================
   Metaluna — Image Studio
   One image per request so each frame lands as soon as it is ready.
   ========================================================================= */
(function () {
  "use strict";

  const SECONDS_PER_IMAGE = 80;

  var BACKEND_KEY = "metalune.imageFoundry.backend";
  var NOTEBOOK_KEY = "metalune.imageStudio.notebook";
  var DEFAULT_BACKEND = "https://amusement-hesitant-track.ngrok-free.dev";
  var DEFAULT_NOTEBOOK = "https://colab.research.google.com/";
  var RATIOS = ["1:1", "4:3", "3:4", "16:9", "9:16"];
  var OFFLINE = "Backend offline. Paste a fresh URL from Colab.";
  var HINT = "Name your set first";

  var $ = function (id) { return document.getElementById(id); };

  var promptEl = $("prompt");
  var nameEl = $("set-name");
  var form = $("studio-form");
  var generateBtn = $("generate");
  var genLabel = $("gen-label");
  var genRing = $("gen-ring");
  var timerEl = $("timer");
  var timerValue = $("timer-value");
  var timerEst = $("timer-est");
  var overrunEl = $("overrun");
  var regenerateBtn = $("regenerate");
  var stopBtn = $("stop");
  var statusEl = $("status");
  var grid = $("results");
  var emptyEl = $("stage-empty");
  var stage = $("stage");
  var stageTitle = $("stage-title");
  var stageCount = $("stage-count");
  var stageFoot = $("stage-foot");
  var downloadAllBtn = $("download-all");
  var downloadAllLabel = $("download-all-label");
  var downloadHint = $("download-hint");
  var nameHint = $("name-hint");
  var ratioReadout = $("ratio-readout");
  var countEst = $("count-est");
  var foundryPill = $("foundry-pill");
  var foundryLabel = $("foundry-label");
  var foundryWake = $("foundry-wake");
  var wakeBtn = $("wake-foundry");
  var lightbox = $("lightbox");
  var lbImage = $("lb-image");
  var lbIndex = $("lb-index");
  var lbName = $("lb-name");
  var lbPrev = $("lb-prev");
  var lbNext = $("lb-next");
  var settings = $("settings");
  var settingsScrim = $("settings-scrim");
  var openSettingsBtn = $("open-settings");
  var closeSettingsBtn = $("close-settings");
  var backendEl = $("backend-url");
  var backendNote = $("backend-state");
  var notebookEl = $("notebook-url");
  var notebookNote = $("notebook-state");

  var count = 2;
  var ratio = "1:1";
  var images = [];
  var requested = 0;
  var lastRequest = null;
  var currentRunId = 0;
  var abortController = null;
  var stopped = false;
  var running = false;
  var zipping = false;
  var runStartedAt = 0;
  var imageStartedAt = 0;
  var elapsedMs = 0;
  var tickId = null;
  var backendSaveId = null;
  var notebookSaveId = null;
  var healthTimer = null;
  var foundryReady = false;
  var lbAt = 0;

  /* ---------------------------------------------------------------- utils */

  function pad(n) { return String(n).padStart(2, "0"); }

  function formatClock(ms) {
    var total = Math.max(0, Math.floor(ms / 1000));
    return pad(Math.floor(total / 60)) + ":" + pad(total % 60);
  }

  function formatEstimate(seconds) {
    var total = Math.max(0, Math.round(seconds));
    return Math.floor(total / 60) + ":" + pad(total % 60);
  }

  function sanitizeName(raw) {
    return String(raw || "")
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[/\\:*?"<>|]/g, "")
      .replace(/^_+|_+$/g, "");
  }

  function baseName() { return sanitizeName(nameEl.value); }

  function extFor(src) {
    var match = /^data:([^;,]+)/i.exec(src || "");
    var mime = (match ? match[1] : "image/png").toLowerCase();
    var map = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/webp": "webp",
      "image/svg+xml": "svg",
      "image/avif": "avif",
      "image/gif": "gif"
    };
    if (map[mime]) return map[mime];
    var tail = mime.split("/")[1] || "";
    tail = tail.replace(/[^a-z0-9]/g, "");
    return tail || "png";
  }

  function ratioCss(value) {
    var pair = String(value || "1:1").split(":");
    return (pair[0] || 1) + " / " + (pair[1] || 1);
  }

  function setStatus(text, tone) {
    statusEl.textContent = text || "";
    if (tone) statusEl.setAttribute("data-tone", tone);
    else statusEl.removeAttribute("data-tone");
  }

  function backendBase() {
    var custom = backendEl.value.trim();
    if (custom && custom !== "https://engaged-hills-rational-probability.trycloudflare.com") {
      return custom.replace(/\/+$/, "");
    }
    return DEFAULT_BACKEND;
  }

  function notebookLink() {
    return notebookEl.value.trim() || DEFAULT_NOTEBOOK;
  }

  /* --------------------------------------------------------------- storage */

  function readStore(key) {
    try { return localStorage.getItem(key); } catch (err) { return null; }
  }

  function writeStore(key, value) {
    try {
      if (value) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
      return true;
    } catch (err) {
      return false;
    }
  }

  function loadSettings() {
    var storedBackend = readStore(BACKEND_KEY);
    if (storedBackend === "https://engaged-hills-rational-probability.trycloudflare.com") {
      storedBackend = "";
      writeStore(BACKEND_KEY, "");
    }
    backendEl.value = storedBackend || "";
    notebookEl.value = readStore(NOTEBOOK_KEY) || DEFAULT_NOTEBOOK;
    wakeBtn.href = notebookLink();
  }

  function persistBackend() {
    var value = backendEl.value.trim();
    if (writeStore(BACKEND_KEY, value)) {
      backendNote.textContent = value ? "Saved in this browser." : "Using default URL.";
      backendNote.classList.add("is-saved");
      backendNote.classList.remove("is-error");
    } else {
      backendNote.textContent = "This browser blocked local storage.";
      backendNote.classList.add("is-error");
      backendNote.classList.remove("is-saved");
    }
    startHealthLoop();
  }

  function persistNotebook() {
    var value = notebookEl.value.trim();
    if (writeStore(NOTEBOOK_KEY, value)) {
      notebookNote.textContent = "Saved in this browser.";
      notebookNote.classList.add("is-saved");
      notebookNote.classList.remove("is-error");
    } else {
      notebookNote.textContent = "This browser blocked local storage.";
      notebookNote.classList.add("is-error");
      notebookNote.classList.remove("is-saved");
    }
    wakeBtn.href = notebookLink();
  }

  /* --------------------------------------------------------------- health */

  function setFoundryState(state) {
    var wakeLine = foundryWake ? foundryWake.querySelector(".foundry-wake-line") : null;
    if (wakeLine) {
      wakeLine.textContent = "In Colab press Ctrl+F9, click Allow once, then come back here.";
    }

    if (state === "online") {
      foundryReady = true;
      foundryPill.setAttribute("data-state", "online");
      foundryLabel.textContent = "Foundry online";
      foundryWake.hidden = true;
      if (!running) generateBtn.disabled = false;
    } else if (state === "warming") {
      foundryReady = false;
      foundryPill.setAttribute("data-state", "warming");
      foundryLabel.textContent = "Foundry warming up";
      foundryWake.hidden = true;
      if (!running) generateBtn.disabled = true;
    } else {
      foundryReady = false;
      foundryPill.setAttribute("data-state", "offline");
      foundryLabel.textContent = "Foundry asleep";
      foundryWake.hidden = false;
      wakeBtn.href = notebookLink();
      if (!running) generateBtn.disabled = true;
    }
  }

  function checkHealth() {
    var base = backendBase();
    if (!/^https?:\/\/.+/i.test(base)) {
      setFoundryState("asleep");
      return;
    }

    var controller = window.AbortController ? new AbortController() : null;
    var cut = controller ? setTimeout(function () { controller.abort(); }, 7000) : null;

    fetch(base + "/health", {
      method: "GET",
      cache: "no-store",
      headers: {
        "ngrok-skip-browser-warning": "1"
      },
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      if (!res.ok) throw new Error("Health check failed");
      return res.json();
    }).then(function (data) {
      if (data && data.ready) {
        setFoundryState("online");
      } else if (data && data.ok && !data.ready) {
        setFoundryState("warming");
      } else {
        setFoundryState("asleep");
      }
    }).catch(function () {
      setFoundryState("asleep");
    }).then(function () {
      if (cut) clearTimeout(cut);
    });
  }

  function startHealthLoop() {
    if (healthTimer) clearInterval(healthTimer);
    checkHealth();
    healthTimer = setInterval(checkHealth, 10000);
  }

  /* ----------------------------------------------------------------- timing */

  function updateEstimate() {
    countEst.textContent = "~" + formatEstimate(SECONDS_PER_IMAGE) +
      " per image, about " + formatEstimate(count * SECONDS_PER_IMAGE) + " total";
  }

  function startTimer(total) {
    stopTimer();
    runStartedAt = Date.now();
    imageStartedAt = runStartedAt;
    elapsedMs = 0;
    timerValue.textContent = "00:00";
    timerEst.textContent = "of about " + formatEstimate(total * SECONDS_PER_IMAGE);
    overrunEl.hidden = true;
    tickId = setInterval(function () {
      elapsedMs = Date.now() - runStartedAt;
      timerValue.textContent = formatClock(elapsedMs);
      if (running && Date.now() - imageStartedAt > SECONDS_PER_IMAGE * 1000) {
        overrunEl.hidden = false;
      }
    }, 250);
  }

  function stopTimer() {
    if (tickId) clearInterval(tickId);
    tickId = null;
    if (runStartedAt) elapsedMs = Date.now() - runStartedAt;
    overrunEl.hidden = true;
  }

  function beginImage() {
    imageStartedAt = Date.now();
    overrunEl.hidden = true;
  }

  /* ----------------------------------------------------------- form state */

  function syncCount() {
    document.querySelectorAll("[data-count]").forEach(function (btn) {
      var on = Number(btn.getAttribute("data-count")) === count;
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    $("count-thumb").style.setProperty("--i", String(count - 1));
    updateEstimate();
  }

  function syncRatio() {
    document.querySelectorAll("[data-ratio]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", btn.getAttribute("data-ratio") === ratio ? "true" : "false");
    });
    if (ratioReadout) ratioReadout.textContent = ratio;
  }

  function setBusy(on) {
    running = on;
    document.body.setAttribute("data-busy", on ? "true" : "false");
    generateBtn.disabled = on || !foundryReady;
    regenerateBtn.disabled = on || !foundryReady;
    document.querySelectorAll("[data-count], [data-ratio]").forEach(function (btn) {
      btn.disabled = on;
    });
    stage.classList.toggle("is-generating", on);
    if (stopBtn) stopBtn.hidden = !on;
    if (on) {
      genRing.style.setProperty("--p", "0");
      timerEl.hidden = false;
    } else {
      stopTimer();
      genLabel.textContent = "Generate set";
      genRing.style.setProperty("--p", "0");
    }
  }

  function stopRun() {
    if (!running) return;
    stopped = true;
    if (abortController) {
      abortController.abort();
    }
    setBusy(false);
    stopTimer();
    timerEl.hidden = true;
    timerValue.textContent = "00:00";
    setStatus("Stopped. Kept " + images.length + " of " + requested + ".");
    updateDownloads();
  }

  function setProgress(index, total) {
    genLabel.textContent = "Image " + Math.min(index + 1, total) + " of " + total;
    genRing.style.setProperty("--p", String((index / total) * 100));
  }

  /* ------------------------------------------------------------ render */

  function createTile(i) {
    var img = images[i];
    var tile = document.createElement("figure");
    tile.className = "studio-tile";
    tile.setAttribute("role", "listitem");
    tile.style.setProperty("--ratio", img.width && img.height ? img.width + " / " + img.height : ratioCss(lastRequest ? lastRequest.ratio : ratio));

    var shot = document.createElement("button");
    shot.type = "button";
    shot.className = "studio-shot";
    shot.setAttribute("data-open", String(i));
    shot.setAttribute("aria-label", "Open image " + (i + 1) + " fullscreen");

    var image = document.createElement("img");
    image.src = img.src;
    image.alt = "Generated image " + (i + 1) + " for " + (baseName() || "an untitled set");
    shot.appendChild(image);

    var glint = document.createElement("span");
    glint.className = "studio-shot-glint";
    glint.setAttribute("aria-hidden", "true");
    shot.appendChild(glint);

    var caption = document.createElement("figcaption");
    caption.className = "studio-tile-foot";

    var meta = document.createElement("span");
    meta.className = "studio-tile-meta";
    meta.innerHTML = pad(i + 1) + " <i>·</i> " + (lastRequest ? lastRequest.ratio : ratio);

    var dl = document.createElement("button");
    dl.type = "button";
    dl.className = "studio-dl";
    dl.setAttribute("data-download", String(i));
    dl.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">download</span>Download';

    caption.appendChild(meta);
    caption.appendChild(dl);
    tile.appendChild(shot);
    tile.appendChild(caption);
    return tile;
  }

  function syncChrome() {
    var has = images.length > 0;
    emptyEl.hidden = has;
    grid.hidden = !has;
    stageFoot.hidden = !has;
    stageTitle.textContent = has ? (baseName() || "Untitled set") : "No images yet";
    stageCount.textContent = pad(images.length) + " / " + pad(requested);
    if (has) imageAltRefresh();
  }

  function imageAltRefresh() {
    var label = baseName() || "an untitled set";
    grid.querySelectorAll(".studio-shot img").forEach(function (img, i) {
      img.alt = "Generated image " + (i + 1) + " for " + label;
    });
  }

  function render() {
    syncChrome();
    while (grid.childElementCount < images.length) {
      grid.appendChild(createTile(grid.childElementCount));
    }
    updateDownloads();
  }

  function resetStage() {
    grid.innerHTML = "";
    grid.hidden = true;
    syncChrome();
  }

  /* ---------------------------------------------------------- downloads */

  function updateDownloads() {
    var base = baseName();
    var has = images.length > 0;
    var blocked = !base && has;

    downloadHint.hidden = !blocked;
    downloadHint.textContent = HINT;
    nameHint.hidden = !blocked;
    if (blocked) nameHint.textContent = HINT;

    downloadAllBtn.disabled = !base || !has || zipping;
    grid.querySelectorAll("[data-download]").forEach(function (btn, i) {
      btn.disabled = !base || !images[i];
      btn.title = base ? "Download image " + (i + 1) : HINT;
    });
  }

  function downloadImage(index) {
    var base = baseName();
    if (!base || !images[index]) return;
    var img = images[index];
    var a = document.createElement("a");
    a.href = img.src;
    a.download = base + "-" + (index + 1) + "." + (img.ext || "png");
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function downloadAll() {
    var base = baseName();
    if (!base || !images.length || zipping) return;

    if (!window.JSZip) {
      setStatus("The zip library has not loaded yet — try again in a moment.", "error");
      return;
    }

    zipping = true;
    updateDownloads();
    downloadAllLabel.textContent = "Packing…";

    Promise.all(images.map(function (img, i) {
      return fetch(img.src)
        .then(function (res) { return res.blob(); })
        .then(function (blob) {
          return { name: base + "-" + (i + 1) + "." + (img.ext || "png"), blob: blob };
        });
    })).then(function (files) {
      var zip = new window.JSZip();
      files.forEach(function (file) { zip.file(file.name, file.blob); });
      return zip.generateAsync({ type: "blob" });
    }).then(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = base + ".zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      setStatus("Packed " + base + ".zip.", "ok");
    }).catch(function () {
      setStatus("Could not pack the set. Try downloading the images one by one.", "error");
    }).finally(function () {
      zipping = false;
      downloadAllLabel.textContent = "Download all";
      updateDownloads();
    });
  }

  /* ------------------------------------------------------------ generate */

  function requestImage(base, request, signal) {
    return fetch(base + "/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "1"
      },
      body: JSON.stringify({ prompt: request.prompt, count: 1, ratio: request.ratio }),
      signal: signal
    }).catch(function (err) {
      if (err && (err.name === "AbortError" || (signal && signal.aborted))) {
        throw err;
      }
      var error = new Error(OFFLINE);
      error.offline = true;
      throw error;
    }).then(function (res) {
      if (res.status === 503) {
        var err503 = new Error("Foundry is warming up, try again in a minute.");
        err503.isWarming = true;
        throw err503;
      }
      if (!res.ok) throw new Error("The foundry answered with " + res.status + ".");
      return res.json();
    }).then(function (data) {
      if (data && data.error) throw new Error(String(data.error));
      var src = data && Array.isArray(data.images) ? data.images[0] : null;
      if (!src || typeof src !== "string" || src.indexOf("data:image/") !== 0) {
        throw new Error("The foundry returned no image.");
      }
      return {
        src: src,
        ext: extFor(src),
        width: Number(data.width) || 0,
        height: Number(data.height) || 0
      };
    });
  }

  function run(request) {
    if (running) return;

    var base = backendBase();
    if (!/^https?:\/\/.+/i.test(base)) {
      setStatus("Add the backend URL in settings first.", "error");
      openSettings();
      backendEl.focus();
      return;
    }

    var source = request || {
      prompt: promptEl.value.trim(),
      count: count,
      ratio: ratio
    };
    var prompt = String(source.prompt || "").trim();

    if (!prompt) {
      setStatus("Describe the image first.", "error");
      promptEl.focus();
      return;
    }

    var req = {
      prompt: prompt,
      count: Math.min(4, Math.max(1, Number(source.count) || 1)),
      ratio: RATIOS.indexOf(source.ratio) > -1 ? source.ratio : ratio
    };

    var runId = ++currentRunId;
    stopped = false;
    abortController = window.AbortController ? new AbortController() : null;

    lastRequest = req;
    requested = req.count;
    images = [];
    resetStage();
    setStatus("");

    regenerateBtn.hidden = false;
    setBusy(true);
    startTimer(req.count);

    var failure = null;

    var chain = Promise.resolve();
    for (var i = 0; i < req.count; i += 1) {
      (function (index) {
        chain = chain.then(function () {
          if (runId !== currentRunId || stopped || failure) return null;
          beginImage();
          setProgress(index, req.count);
          return requestImage(base, req, abortController ? abortController.signal : null).then(function (img) {
            if (runId !== currentRunId || stopped || (abortController && abortController.signal.aborted)) return;
            images.push(img);
            render();
            genRing.style.setProperty("--p", String(((index + 1) / req.count) * 100));
          }).catch(function (err) {
            if (runId !== currentRunId) return;
            if (err && (err.name === "AbortError" || (abortController && abortController.signal.aborted))) {
              stopped = true;
              return;
            }
            failure = err;
          });
        });
      })(i);
    }

    chain.then(function () {
      if (runId !== currentRunId) return;
      if (stopped) {
        setBusy(false);
        stopTimer();
        timerEl.hidden = true;
        timerValue.textContent = "00:00";
        setStatus("Stopped. Kept " + images.length + " of " + requested + ".");
        updateDownloads();
        return;
      }
      setBusy(false);
      if (failure) {
        if (failure.name === "AbortError" || (failure.message && failure.message.indexOf("abort") !== -1)) {
          setStatus("Stopped. Kept " + images.length + " of " + requested + ".");
          return;
        }
        var message = failure.isWarming
          ? "Foundry is warming up, try again in a minute."
          : (failure.offline ? OFFLINE : (failure.message || OFFLINE));
        setStatus(message, "error");
        if (failure.offline || failure.isWarming) checkHealth();
      } else {
        setStatus(images.length + (images.length === 1 ? " image" : " images") + " ready.", "ok");
      }
    });
  }

  /* -------------------------------------------------------------- viewer */

  function lightboxName() {
    var base = baseName();
    return (base || "Untitled set") + (lastRequest ? " · " + lastRequest.ratio : "");
  }

  function paintLightbox() {
    var img = images[lbAt];
    if (!img) return;
    lbImage.src = img.src;
    lbImage.alt = "Generated image " + (lbAt + 1) + " for " + (baseName() || "an untitled set");
    lbIndex.textContent = pad(lbAt + 1) + " / " + pad(images.length);
    lbName.textContent = lightboxName();
    var single = images.length < 2;
    lbPrev.disabled = single;
    lbNext.disabled = single;
  }

  function openLightbox(index) {
    if (!images[index]) return;
    lbAt = index;
    paintLightbox();
    lightbox.hidden = false;
    document.body.classList.add("is-locked");
    $("lb-close").focus();
  }

  function closeLightbox() {
    lightbox.hidden = true;
    if (settings.hidden) document.body.classList.remove("is-locked");
    lbImage.removeAttribute("src");
  }

  function stepLightbox(delta) {
    if (images.length < 2) return;
    lbAt = (lbAt + delta + images.length) % images.length;
    paintLightbox();
  }

  /* ------------------------------------------------------------- settings */

  function openSettings() {
    settings.hidden = false;
    settingsScrim.hidden = false;
    document.body.classList.add("is-locked");
    openSettingsBtn.setAttribute("aria-expanded", "true");
    backendEl.focus();
    backendEl.select();
  }

  function closeSettings() {
    settings.hidden = true;
    settingsScrim.hidden = true;
    openSettingsBtn.setAttribute("aria-expanded", "false");
    if (lightbox.hidden) document.body.classList.remove("is-locked");
  }

  /* --------------------------------------------------------------- events */

  loadSettings();
  syncCount();
  syncRatio();
  updateDownloads();
  startHealthLoop();

  document.querySelectorAll("[data-count]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (running) return;
      count = Number(btn.getAttribute("data-count"));
      syncCount();
    });
  });

  document.querySelectorAll("[data-ratio]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (running) return;
      ratio = btn.getAttribute("data-ratio");
      syncRatio();
    });
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    run(null);
  });

  if (stopBtn) {
    stopBtn.addEventListener("click", stopRun);
  }

  regenerateBtn.addEventListener("click", function () {
    if (running || !lastRequest) return;
    count = lastRequest.count;
    ratio = lastRequest.ratio;
    syncCount();
    syncRatio();
    run(lastRequest);
  });

  nameEl.addEventListener("input", function () {
    syncChrome();
    updateDownloads();
    if (!lightbox.hidden) lbName.textContent = lightboxName();
  });

  backendEl.addEventListener("input", function () {
    backendNote.textContent = "Unsaved changes.";
    backendNote.classList.remove("is-saved", "is-error");
    if (backendSaveId) clearTimeout(backendSaveId);
    backendSaveId = setTimeout(persistBackend, 700);
  });

  backendEl.addEventListener("change", persistBackend);

  notebookEl.addEventListener("input", function () {
    notebookNote.textContent = "Unsaved changes.";
    notebookNote.classList.remove("is-saved", "is-error");
    wakeBtn.href = notebookLink();
    if (notebookSaveId) clearTimeout(notebookSaveId);
    notebookSaveId = setTimeout(persistNotebook, 700);
  });

  notebookEl.addEventListener("change", persistNotebook);

  openSettingsBtn.addEventListener("click", openSettings);
  closeSettingsBtn.addEventListener("click", closeSettings);
  settingsScrim.addEventListener("click", closeSettings);

  grid.addEventListener("click", function (event) {
    var openBtn = event.target.closest("[data-open]");
    if (openBtn) {
      openLightbox(Number(openBtn.getAttribute("data-open")));
      return;
    }
    var dlBtn = event.target.closest("[data-download]");
    if (dlBtn && !dlBtn.disabled) downloadImage(Number(dlBtn.getAttribute("data-download")));
  });

  downloadAllBtn.addEventListener("click", downloadAll);

  lightbox.addEventListener("click", function (event) {
    if (event.target.closest("[data-lb-control]")) return;
    closeLightbox();
  });

  $("lb-close").addEventListener("click", closeLightbox);
  lbPrev.addEventListener("click", function () { stepLightbox(-1); });
  lbNext.addEventListener("click", function () { stepLightbox(1); });

  document.addEventListener("keydown", function (event) {
    if (!settings.hidden) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSettings();
      }
      return;
    }
    if (lightbox.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeLightbox();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      stepLightbox(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      stepLightbox(-1);
    }
  });

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) checkHealth();
  });
})();
