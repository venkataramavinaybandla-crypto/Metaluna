/* =========================================================================
   Metalune — Image Foundry
   Sequential single-image casting so each frame lands as soon as it cools.
   ========================================================================= */
(function () {
  "use strict";

  var STORAGE_KEY = "metalune.imageFoundry.backend";
  var DEFAULT_BACKEND = "https://engaged-hills-rational-probability.trycloudflare.com";
  var RATIOS = ["1:1", "4:3", "3:4", "16:9", "9:16"];
  var OFFLINE = "Backend offline. Paste a fresh URL from Colab.";
  var HINT = "Name your set first";

  var $ = function (id) { return document.getElementById(id); };

  var promptEl = $("prompt");
  var nameEl = $("set-name");
  var backendEl = $("backend-url");
  var backendState = $("backend-state");
  var form = $("studio-form");
  var generateBtn = $("generate");
  var genLabel = $("gen-label");
  var genRing = $("gen-ring");
  var timerEl = $("timer");
  var timerValue = $("timer-value");
  var regenerateBtn = $("regenerate");
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
  var foundryState = $("foundry-state");
  var ratioReadout = $("ratio-readout");
  var lightbox = $("lightbox");
  var lbImage = $("lb-image");
  var lbIndex = $("lb-index");
  var lbName = $("lb-name");
  var lbPrev = $("lb-prev");
  var lbNext = $("lb-next");

  var count = 2;
  var ratio = "1:1";
  var images = [];
  var requested = 0;
  var lastRequest = null;
  var running = false;
  var zipping = false;
  var startedAt = 0;
  var elapsedMs = 0;
  var tickId = null;
  var saveId = null;
  var lbAt = 0;

  /* ---------------------------------------------------------------- utils */

  function pad(n) { return String(n).padStart(2, "0"); }

  function formatClock(ms) {
    var total = Math.floor(ms / 1000);
    return pad(Math.floor(total / 60)) + ":" + pad(total % 60);
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

  function setFoundry(label) {
    var span = foundryState.querySelector("span");
    if (span) span.textContent = label;
  }

  function backendBase() {
    return backendEl.value.trim().replace(/\/+$/, "");
  }

  /* --------------------------------------------------------------- backend */

  function loadBackend() {
    var saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (err) { saved = null; }
    backendEl.value = saved || DEFAULT_BACKEND;
  }

  function persistBackend() {
    var value = backendEl.value.trim();
    try {
      if (value) localStorage.setItem(STORAGE_KEY, value);
      else localStorage.removeItem(STORAGE_KEY);
      backendState.textContent = value ? "saved locally" : "not set";
      backendState.classList.toggle("is-live", Boolean(value));
    } catch (err) {
      backendState.textContent = "could not save";
      backendState.classList.remove("is-live");
    }
  }

  /* ----------------------------------------------------------- form state */

  function syncCount() {
    document.querySelectorAll("[data-count]").forEach(function (btn) {
      var on = Number(btn.getAttribute("data-count")) === count;
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    $("count-thumb").style.setProperty("--i", String(count - 1));
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
    generateBtn.disabled = on;
    regenerateBtn.disabled = on;
    document.querySelectorAll("[data-count], [data-ratio]").forEach(function (btn) {
      btn.disabled = on;
    });
    stage.classList.toggle("is-generating", on);
    setFoundry(on ? "Casting…" : "Foundry idle");
    if (on) {
      genRing.style.setProperty("--p", "0");
      timerEl.hidden = false;
      startTimer();
    } else {
      stopTimer();
      genLabel.textContent = "Generate set";
      genRing.style.setProperty("--p", "0");
    }
  }

  function startTimer() {
    stopTimer();
    startedAt = Date.now();
    timerValue.textContent = "00:00";
    tickId = setInterval(function () {
      elapsedMs = Date.now() - startedAt;
      timerValue.textContent = formatClock(elapsedMs);
    }, 200);
  }

  function stopTimer() {
    if (tickId) clearInterval(tickId);
    tickId = null;
    if (startedAt) elapsedMs = Date.now() - startedAt;
  }

  function setProgress(index, total) {
    genLabel.textContent = "Image " + Math.min(index + 1, total) + " of " + total;
    genRing.style.setProperty("--p", String((index / total) * 100));
  }

  /* -------------------------------------------------------------- render */

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
    shot.setAttribute("aria-label", "Open frame " + (i + 1) + " fullscreen");

    var image = document.createElement("img");
    image.src = img.src;
    image.alt = "Generated frame " + (i + 1) + " for " + (baseName() || "an untitled set");
    shot.appendChild(image);

    var glint = document.createElement("span");
    glint.className = "studio-shot-glint";
    glint.setAttribute("aria-hidden", "true");
    shot.appendChild(glint);

    var caption = document.createElement("figcaption");
    caption.className = "studio-tile-foot";

    var meta = document.createElement("span");
    meta.className = "studio-tile-meta";
    meta.innerHTML = pad(i + 1) + " <i>·</i> " + (lastRequest ? lastRequest.ratio : ratio) +
      " <i>·</i> " + (img.seconds ? Math.round(img.seconds) + "s" : "—");

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
    stageTitle.textContent = has ? (baseName() || "Untitled edition") : "No frames yet";
    stageCount.textContent = pad(images.length) + " / " + pad(requested);
    if (images.length) {
      imageAltRefresh();
    }
  }

  function imageAltRefresh() {
    var label = baseName() || "an untitled set";
    grid.querySelectorAll(".studio-shot img").forEach(function (img, i) {
      img.alt = "Generated frame " + (i + 1) + " for " + label;
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

  /* ------------------------------------------------------------ downloads */

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
      btn.title = base ? "Download frame " + (i + 1) : HINT;
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
      setStatus("Set packed as " + base + ".zip.", "ok");
    }).catch(function () {
      setStatus("Could not pack the set. Try downloading the frames one by one.", "error");
    }).finally(function () {
      zipping = false;
      downloadAllLabel.textContent = "Download all";
      updateDownloads();
    });
  }

  /* ------------------------------------------------------------- generate */

  function requestImage(base, request) {
    return fetch(base + "/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: request.prompt, count: 1, ratio: request.ratio })
    }).then(function (res) {
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
        height: Number(data.height) || 0,
        seconds: Number(data.seconds) || 0
      };
    }, function () {
      var error = new Error(OFFLINE);
      error.offline = true;
      throw error;
    });
  }

  function run(request) {
    if (running) return;

    var base = backendBase();
    if (!/^https?:\/\/.+/i.test(base)) {
      setStatus("Add the backend URL from Colab first.", "error");
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
      setStatus("Describe your set before casting.", "error");
      promptEl.focus();
      return;
    }

    var req = {
      prompt: prompt,
      count: Math.min(4, Math.max(1, Number(source.count) || 1)),
      ratio: RATIOS.indexOf(source.ratio) > -1 ? source.ratio : ratio
    };

    lastRequest = req;
    requested = req.count;
    images = [];
    resetStage();
    setStatus("");
    persistBackend();

    regenerateBtn.hidden = false;
    setBusy(true);

    var failure = null;

    var chain = Promise.resolve();
    for (var i = 0; i < req.count; i += 1) {
      (function (index) {
        chain = chain.then(function () {
          if (failure) return null;
          setProgress(index, req.count);
          return requestImage(base, req).then(function (img) {
            images.push(img);
            render();
            genRing.style.setProperty("--p", String(((index + 1) / req.count) * 100));
          }).catch(function (err) {
            failure = err;
          });
        });
      })(i);
    }

    chain.then(function () {
      setBusy(false);
      if (failure) {
        var message = failure.offline ? OFFLINE : (failure.message || OFFLINE);
        setStatus(message, "error");
        setFoundry(failure.offline ? "Line cut" : "Foundry idle");
      } else {
        setStatus(
          images.length + (images.length === 1 ? " frame" : " frames") + " developed in " + formatClock(elapsedMs) + ".",
          "ok"
        );
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
    lbImage.alt = "Generated frame " + (lbAt + 1) + " for " + (baseName() || "an untitled set");
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
    document.body.classList.remove("is-locked");
    lbImage.removeAttribute("src");
  }

  function stepLightbox(delta) {
    if (images.length < 2) return;
    lbAt = (lbAt + delta + images.length) % images.length;
    paintLightbox();
  }

  /* --------------------------------------------------------------- events */

  loadBackend();
  persistBackend();
  syncCount();
  syncRatio();
  updateDownloads();

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
    backendState.textContent = "unsaved";
    backendState.classList.remove("is-live");
    if (saveId) clearTimeout(saveId);
    saveId = setTimeout(persistBackend, 700);
  });

  backendEl.addEventListener("change", persistBackend);

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
})();
