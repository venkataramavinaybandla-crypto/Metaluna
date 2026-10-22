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

  /* Account, sync state & local migration */
  var authGate = $("auth-gate");
  var authForm = $("auth-form");
  var authEmail = $("auth-email");
  var authPassword = $("auth-password");
  var authError = $("auth-error");
  var authSubmit = $("auth-submit");
  var authSubmitLabel = $("auth-submit-label");
  var authSwitch = $("auth-switch");
  var authSwitchPrompt = $("auth-switch-prompt");
  var authTitle = $("auth-title");
  var syncPill = $("sync-pill");
  var toastStack = $("toast-stack");
  var signoutBtn = $("signout-btn");
  var sidebarUserEmail = $("sidebar-user-email");
  var accountChip = $("account-chip");
  var accountChipAvatar = $("account-chip-avatar");
  var accountMenu = $("account-menu");
  var accountScrim = $("account-scrim");
  var accountMenuEmail = $("account-menu-email");
  var accountMenuSignout = $("account-menu-signout");
  var migrateField = $("migrate-field");
  var migrateNote = $("migrate-note");
  var migrateBtn = $("migrate-btn");
  var migrateProgress = $("migrate-progress");
  var migrateBar = $("migrate-bar");
  var migrateConfirm = $("migrate-confirm");
  var migrateConfirmNote = $("migrate-confirm-note");
  var migrateClear = $("migrate-clear");
  var migrateKeep = $("migrate-keep");

  /* Sessions, Memory & Starred Elements */
  var gateEl = $("session-gate");
  var gateForm = $("gate-create-form");
  var gateNameInput = $("gate-name-input");
  var gateSubmitBtn = $("gate-submit-btn");
  var gateError = $("gate-error");
  var gateList = $("gate-sessions-list");
  var gateCountLabel = $("gate-count-label");
  var gateEmptyNote = $("gate-empty-note");

  var sidebarEl = $("studio-sidebar");
  var sidebarScrim = $("sidebar-scrim");
  var openSidebarBtn = $("open-sidebar");
  var closeSidebarBtn = $("close-sidebar");
  var activeSessionPill = $("active-session-pill");
  var sidebarNewToggle = $("sidebar-new-toggle");
  var sidebarNewForm = $("sidebar-new-form");
  var sidebarNameInput = $("sidebar-name-input");
  var sidebarNameError = $("sidebar-name-error");
  var sidebarCreateBtn = $("sidebar-create-btn");
  var sidebarCancelBtn = $("sidebar-cancel-btn");
  var sidebarSessionsList = $("sidebar-sessions-list");

  var collectionPanel = $("collection-panel");
  var collectionScrim = $("collection-scrim");
  var openMemoryBtn = $("open-memory");
  var openStarredBtn = $("open-starred");
  var closeCollectionBtn = $("close-collection");
  var tabMemory = $("tab-memory");
  var tabStarred = $("tab-starred");
  var memoryBadge = $("memory-badge");
  var starredBadge = $("starred-badge");
  var memoryEmpty = $("memory-empty");
  var starredEmpty = $("starred-empty");
  var collectionGrid = $("collection-grid");

  var patinaToggle = $("patina-toggle");
  var patinaEnabled = false;
  var ACTIVE_SESSION_KEY = "metaluna.activeSessionId";
  var activeSession = null;
  var allSessions = [];
  var activeCollectionTab = "memory";
  var deleteConfirmId = null;

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

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatSessionDate(ts) {
    if (!ts) return "";
    try {
      var d = new Date(ts);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch (e) {
      return "";
    }
  }

  function dataURItoBlob(dataURI) {
    try {
      if (!dataURI) return null;
      var parts = dataURI.split(",");
      var mimeMatch = parts[0].match(/:(.*?);/);
      var mime = mimeMatch ? mimeMatch[1] : "image/png";
      var byteString = atob(parts[1]);
      var ab = new ArrayBuffer(byteString.length);
      var ia = new Uint8Array(ab);
      for (var i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      return new Blob([ab], { type: mime });
    } catch (err) {
      console.error("dataURItoBlob failed", err);
      return null;
    }
  }

  /* ------------------------------------------------------------- supabase */

  var SUPABASE_URL = "https://okxdeiaatifbqluivalv.supabase.co";
  var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9reGRlaWFhdGlmYnFsdWl2YWx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2NDQxNjAsImV4cCI6MjEwODIyMDE2MH0.LlPvbEruGKm9Gz8YH3ea_9Fz2YxH34FQkUvOgGmK9So";
  var IMAGE_BUCKET = "images";
  var SIGNED_URL_TTL = 3600;
  var LEGACY_DB = "metaluna";
  var PATINA_KEY = "metaluna.surfacePatina";
  var JPEG_QUALITY = 0.85;
  var JPEG_MAX_EDGE = 1280;

  var sb = null;
  try {
    if (window.supabase && typeof window.supabase.createClient === "function") {
      sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
  } catch (err) {
    sb = null;
  }

  var currentUser = null;
  var sessionsLoading = true;
  var syncDepth = 0;

  function syncStart() {
    syncDepth += 1;
    if (syncPill) syncPill.hidden = false;
  }

  function syncStop() {
    syncDepth = Math.max(0, syncDepth - 1);
    if (syncDepth === 0 && syncPill) syncPill.hidden = true;
  }

  function toast(message, tone) {
    if (!toastStack || !message) return;
    var el = document.createElement("div");
    el.className = "toast" + (tone === "error" ? " is-error" : "");
    el.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">' +
      (tone === "error" ? "error" : "check_circle") + "</span><span>" + escapeHtml(message) + "</span>";
    toastStack.appendChild(el);
    setTimeout(function () {
      el.classList.add("is-leaving");
      setTimeout(function () { el.remove(); }, 340);
    }, 5200);
  }

  function friendlyError(err, fallback) {
    var msg = String((err && (err.message || err.error_description || err.msg)) || "");
    if (/duplicate key|unique constraint/i.test(msg)) return "That name is already taken.";
    if (/row-level security|permission denied/i.test(msg)) return "This account cannot reach that data.";
    if (/failed to fetch|networkerror|network request/i.test(msg)) return "The studio could not reach its server.";
    if (/jwt|token/i.test(msg)) return "The session expired. Sign in again.";
    if (msg && msg.length < 130 && msg.indexOf("{") !== 0) return msg;
    return fallback || "Something did not go through. Try again.";
  }

  function tracked(promiseLike, fallback) {
    syncStart();
    return Promise.resolve(promiseLike).then(function (value) {
      syncStop();
      if (value && value.error) throw value.error;
      return value;
    }, function (err) {
      syncStop();
      toast(friendlyError(err, fallback), "error");
      throw err;
    });
  }

  function requireUser() {
    if (currentUser) return Promise.resolve(currentUser);
    return Promise.reject(new Error("Please sign in to continue."));
  }

  /* --------------------------------------------------------------- images */

  function compressToJpegBlob(source) {
    return new Promise(function (resolve, reject) {
      var isString = typeof source === "string";
      var objectUrl = isString ? null : URL.createObjectURL(source);
      var img = new Image();

      function cleanup() {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      }

      img.onerror = function () {
        cleanup();
        reject(new Error("That image could not be read."));
      };

      img.onload = function () {
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        if (!w || !h) {
          cleanup();
          reject(new Error("That image could not be read."));
          return;
        }
        if (w > JPEG_MAX_EDGE || h > JPEG_MAX_EDGE) {
          if (w >= h) {
            h = Math.round((h * JPEG_MAX_EDGE) / w);
            w = JPEG_MAX_EDGE;
          } else {
            w = Math.round((w * JPEG_MAX_EDGE) / h);
            h = JPEG_MAX_EDGE;
          }
        }
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);

        if (canvas.toBlob) {
          canvas.toBlob(function (blob) {
            cleanup();
            if (blob) resolve(blob);
            else reject(new Error("That image could not be compressed."));
          }, "image/jpeg", JPEG_QUALITY);
          return;
        }
        try {
          var blob = dataURItoBlob(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
          cleanup();
          if (blob) resolve(blob);
          else reject(new Error("That image could not be compressed."));
        } catch (err) {
          cleanup();
          reject(err);
        }
      };

      img.src = objectUrl || source;
    });
  }

  function storagePath() {
    var id = (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : Date.now() + "-" + Math.random().toString(36).slice(2, 10);
    return currentUser.id + "/" + id + ".jpg";
  }

  function uploadJpeg(blob) {
    var path = storagePath();
    return tracked(
      sb.storage.from(IMAGE_BUCKET).upload(path, blob, {
        contentType: "image/jpeg",
        cacheControl: "3600",
        upsert: false
      }),
      "That image could not be uploaded."
    ).then(function () {
      return path;
    });
  }

  function removeStored(paths) {
    var list = (paths || []).filter(Boolean);
    if (!list.length) return Promise.resolve();
    return tracked(sb.storage.from(IMAGE_BUCKET).remove(list), "A stored file could not be removed.")
      .then(function () {});
  }

  function signedLinks(paths) {
    var unique = [];
    (paths || []).forEach(function (path) {
      if (path && unique.indexOf(path) === -1) unique.push(path);
    });
    if (!unique.length) return Promise.resolve({});
    return tracked(
      sb.storage.from(IMAGE_BUCKET).createSignedUrls(unique, SIGNED_URL_TTL),
      "The stored images could not be opened."
    ).then(function (res) {
      var map = {};
      (res.data || []).forEach(function (row) {
        if (row && row.path && row.signedUrl && !row.error) map[row.path] = row.signedUrl;
      });
      return map;
    });
  }

  function downloadStored(url, label) {
    if (!url) {
      toast("That stored copy could not be opened.", "error");
      return;
    }
    var name = (sanitizeName(label) || "metaluna-still").slice(0, 48);
    tracked(fetch(url), "That stored copy could not be downloaded.").then(function (res) {
      if (!res || !res.ok) throw new Error("That stored copy could not be downloaded.");
      return res.blob();
    }).then(function (blob) {
      var objectUrl = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = objectUrl;
      a.download = name + ".jpg";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 4000);
    }).catch(function () {});
  }

  /* --------------------------------------------------------------- rows */

  function mapSessionRow(row) {
    return {
      id: row.id,
      name: row.name,
      createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
    };
  }

  function mapMemoryRow(row) {
    return {
      id: row.id,
      sessionId: row.session_id,
      path: row.path,
      prompt: row.prompt || "",
      note: row.note || "",
      createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
    };
  }

  function mapStarRow(row) {
    return {
      id: row.id,
      path: row.path,
      prompt: row.prompt || "",
      note: row.note || "",
      createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
    };
  }

  function fetchSessions() {
    return requireUser().then(function (user) {
      return tracked(
        sb.from("sessions").select("id,name,created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
        "Sessions could not be loaded."
      );
    }).then(function (res) {
      return (res.data || []).map(mapSessionRow);
    });
  }

  function createSessionRow(name) {
    return requireUser().then(function (user) {
      return tracked(
        sb.from("sessions").insert({
          user_id: user.id,
          name: name,
          created_at: new Date().toISOString()
        }).select("id,name,created_at").single(),
        "That session could not be created."
      );
    }).then(function (res) {
      return mapSessionRow(res.data);
    });
  }

  function fetchMemory(sessionId) {
    return requireUser().then(function (user) {
      return tracked(
        sb.from("memory").select("id,session_id,path,prompt,note,created_at")
          .eq("user_id", user.id).eq("session_id", sessionId)
          .order("created_at", { ascending: false }),
        "Session memory could not be loaded."
      );
    }).then(function (res) {
      return (res.data || []).map(mapMemoryRow);
    });
  }

  function fetchStars() {
    return requireUser().then(function (user) {
      return tracked(
        sb.from("stars").select("id,path,prompt,note,created_at")
          .eq("user_id", user.id).order("created_at", { ascending: false }),
        "Starred images could not be loaded."
      );
    }).then(function (res) {
      return (res.data || []).map(mapStarRow);
    });
  }

  function fetchMemoryPaths(sessionId) {
    return requireUser().then(function (user) {
      return tracked(
        sb.from("memory").select("path").eq("user_id", user.id).eq("session_id", sessionId),
        "Session files could not be read."
      );
    }).then(function (res) {
      return (res.data || []).map(function (row) { return row.path; }).filter(Boolean);
    });
  }

  function saveMemoryImage(source, sessionId, prompt) {
    return requireUser().then(function (user) {
      return compressToJpegBlob(source).catch(function (err) {
        toast("That image could not be prepared for upload.", "error");
        throw err;
      }).then(function (blob) {
        return uploadJpeg(blob);
      }).then(function (path) {
        return tracked(
          sb.from("memory").insert({
            user_id: user.id,
            session_id: sessionId,
            path: path,
            prompt: prompt || "",
            note: "",
            created_at: new Date().toISOString()
          }).select("id").single(),
          "That image could not be saved to memory."
        ).then(function (res) {
          return { id: res.data.id, path: path };
        });
      });
    });
  }

  function saveStarImage(source, prompt) {
    return requireUser().then(function (user) {
      return compressToJpegBlob(source).catch(function (err) {
        toast("That image could not be prepared for upload.", "error");
        throw err;
      }).then(function (blob) {
        return uploadJpeg(blob);
      }).then(function (path) {
        return tracked(
          sb.from("stars").insert({
            user_id: user.id,
            path: path,
            prompt: prompt || "",
            note: "",
            created_at: new Date().toISOString()
          }).select("id").single(),
          "That image could not be starred."
        ).then(function (res) {
          return { id: res.data.id, path: path };
        });
      });
    });
  }

  function deleteMemoryRecord(record) {
    return tracked(sb.from("memory").delete().eq("id", record.id), "That image could not be removed.")
      .then(function () { return removeStored([record.path]); });
  }

  function deleteStarRecord(record) {
    return tracked(sb.from("stars").delete().eq("id", record.id), "That star could not be removed.")
      .then(function () { return removeStored([record.path]); });
  }

  function deleteSessionRecord(sessionId) {
    return fetchMemoryPaths(sessionId)
      .then(function (paths) { return removeStored(paths); })
      .then(function () {
        return tracked(sb.from("memory").delete().eq("session_id", sessionId), "Session memory could not be cleared.");
      })
      .then(function () {
        return tracked(sb.from("sessions").delete().eq("id", sessionId), "That session could not be deleted.");
      });
  }

  /* --------------------------------------------------- attachments (visit) */

  /* The studio keeps no attachment table, so patina add-ons live for the
     current visit only; saved images themselves always go to the account. */
  var attachmentStore = {};

  function attachmentList(itemKey) {
    return Promise.resolve((attachmentStore[itemKey] || []).slice());
  }

  function attachmentAdd(record) {
    var list = attachmentStore[record.itemKey] || (attachmentStore[record.itemKey] = []);
    list.push(record);
    return Promise.resolve(record);
  }

  function attachmentRemove(id) {
    Object.keys(attachmentStore).forEach(function (key) {
      attachmentStore[key] = attachmentStore[key].filter(function (att) { return att.id !== id; });
    });
    return Promise.resolve(true);
  }

  /* ------------------------------------------------- legacy browser saves */

  function readLegacyStore(db, name) {
    return new Promise(function (resolve) {
      try {
        if (!db.objectStoreNames.contains(name)) { resolve([]); return; }
        var req = db.transaction(name, "readonly").objectStore(name).getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { resolve([]); };
      } catch (err) {
        resolve([]);
      }
    });
  }

  function readLegacySaves() {
    return new Promise(function (resolve) {
      if (!window.indexedDB) { resolve(null); return; }

      function readOpenDb() {
        var req;
        try {
          req = indexedDB.open(LEGACY_DB);
        } catch (err) {
          resolve(null);
          return;
        }
        req.onerror = function () { resolve(null); };
        req.onupgradeneeded = function () {};
        req.onsuccess = function () {
          var db = req.result;
          Promise.all([
            readLegacyStore(db, "sessions"),
            readLegacyStore(db, "memory"),
            readLegacyStore(db, "stars")
          ]).then(function (parts) {
            try { db.close(); } catch (err) {}
            var data = { sessions: parts[0] || [], memory: parts[1] || [], stars: parts[2] || [] };
            var total = data.sessions.length + data.memory.length + data.stars.length;
            resolve(total > 0 ? data : null);
          });
        };
      }

      if (indexedDB.databases) {
        indexedDB.databases().then(function (list) {
          var found = (list || []).some(function (item) { return item && item.name === LEGACY_DB; });
          if (found) readOpenDb();
          else resolve(null);
        }).catch(readOpenDb);
      } else {
        readOpenDb();
      }
    });
  }

  function showAttNotice(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    setTimeout(function () {
      el.textContent = "";
      el.hidden = true;
    }, 4000);
  }

  function downscaleImage(file, noticeEl) {
    return new Promise(function (resolve) {
      if (!file.type || !file.type.startsWith("image/")) {
        showAttNotice(noticeEl, "Image files only");
        resolve(null);
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        showAttNotice(noticeEl, "File exceeds 8 MB");
        resolve(null);
        return;
      }
      var reader = new FileReader();
      reader.onerror = function () {
        showAttNotice(noticeEl, "Read error");
        resolve(null);
      };
      reader.onload = function (e) {
        var img = new Image();
        img.onerror = function () {
          showAttNotice(noticeEl, "Invalid file");
          resolve(null);
        };
        img.onload = function () {
          var w = img.naturalWidth || img.width;
          var h = img.naturalHeight || img.height;
          var maxEdge = 1280;
          if (w > maxEdge || h > maxEdge) {
            if (w >= h) {
              h = Math.round((h * maxEdge) / w);
              w = maxEdge;
            } else {
              w = Math.round((w * maxEdge) / h);
              h = maxEdge;
            }
          }
          var canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          try {
            var dataUrl = canvas.toDataURL("image/jpeg", 0.8);
            resolve(dataUrl);
          } catch (err) {
            showAttNotice(noticeEl, "Encoding error");
            resolve(null);
          }
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function ensureActiveSession() {
    if (activeSession) return Promise.resolve(activeSession);
    if (allSessions && allSessions.length > 0) {
      activateSession(allSessions[0]);
      return Promise.resolve(allSessions[0]);
    }
    return createSessionRow("Atelier 01").then(function (newSess) {
      allSessions.unshift(newSess);
      activateSession(newSess);
      return newSess;
    });
  }

  function handleUploadFiles(files, targetItemKey, noticeEl) {
    if (!files || !files.length) return Promise.resolve();
    var chain = Promise.resolve();
    files.forEach(function (file) {
      chain = chain.then(function () {
        if (!file.type || file.type.indexOf("image/") !== 0) {
          showAttNotice(noticeEl, "Image files only");
          return;
        }
        if (file.size > 8 * 1024 * 1024) {
          showAttNotice(noticeEl, "File exceeds 8 MB");
          return;
        }
        if (targetItemKey) {
          return downscaleImage(file, noticeEl).then(function (dataUrl) {
            if (!dataUrl) return;
            return attachmentAdd({
              id: "att_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
              itemKey: targetItemKey,
              dataUrl: dataUrl,
              createdAt: Date.now()
            });
          });
        }

        var promptName = file.name ? file.name.replace(/\.[^/.]+$/, "") : "Attachment";
        if (activeCollectionTab === "memory") {
          return ensureActiveSession().then(function (sess) {
            return saveMemoryImage(file, sess.id, promptName);
          }).catch(function () {
            showAttNotice(noticeEl, "Upload failed");
          });
        }
        return saveStarImage(file, promptName).catch(function () {
          showAttNotice(noticeEl, "Upload failed");
        });
      });
    });
    return chain.then(function () {
      updateBadges();
      if (collectionPanel && !collectionPanel.hidden) {
        renderCollection();
      }
    });
  }

  function renderItemAttachments(barEl, itemKey, noticeEl) {
    barEl.innerHTML = "";
    var fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.multiple = true;
    fileInput.hidden = true;

    var addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "collection-att-add";
    addBtn.setAttribute("aria-label", "Add attachment");
    addBtn.title = "Add attachment";
    addBtn.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">add</span>';

    addBtn.addEventListener("click", function () {
      fileInput.click();
    });

    fileInput.addEventListener("change", function () {
      var files = Array.from(fileInput.files || []);
      if (!files.length) return;
      fileInput.value = "";
      handleUploadFiles(files, itemKey, noticeEl).then(function () {
        renderItemAttachments(barEl, itemKey, noticeEl);
      });
    });

    barEl.appendChild(fileInput);
    barEl.appendChild(addBtn);

    attachmentList(itemKey).then(function (atts) {
      atts.forEach(function (att) {
        var wrap = document.createElement("div");
        wrap.className = "collection-thumb-wrap";

        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "collection-thumb-btn";
        btn.setAttribute("aria-label", "View attachment");
        btn.innerHTML = '<img src="' + att.dataUrl + '" alt=""/>';
        btn.addEventListener("click", function () {
          openLightboxCustom(att.dataUrl, "Attachment", "");
        });

        var del = document.createElement("button");
        del.type = "button";
        del.className = "collection-thumb-remove";
        del.setAttribute("aria-label", "Remove attachment");
        del.innerHTML = "&times;";
        del.addEventListener("click", function (e) {
          e.stopPropagation();
          attachmentRemove(att.id).then(function () {
            renderItemAttachments(barEl, itemKey, noticeEl);
          });
        });

        wrap.appendChild(btn);
        wrap.appendChild(del);
        barEl.insertBefore(wrap, addBtn);
      });
    });
  }

  function validateSessionName(raw, sessions, currentId) {
    var trimmed = String(raw || "").trim();
    if (trimmed.length < 1 || trimmed.length > 40) {
      return { valid: false, error: null, trimmed: trimmed };
    }
    var lower = trimmed.toLowerCase();
    var isDup = (sessions || []).some(function (s) {
      if (currentId && s.id === currentId) return false;
      return String(s.name || "").trim().toLowerCase() === lower;
    });
    if (isDup) {
      return { valid: false, error: "A session with this name already exists", trimmed: trimmed };
    }
    return { valid: true, error: null, trimmed: trimmed };
  }

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

    var actions = document.createElement("div");
    actions.className = "studio-tile-actions";

    var memBtn = document.createElement("button");
    memBtn.type = "button";
    memBtn.className = "studio-tile-btn studio-memory-btn" + (img.inMemory ? " is-saved" : "");
    memBtn.setAttribute("data-memory", String(i));
    memBtn.disabled = Boolean(img.inMemory);
    memBtn.title = img.inMemory ? "Saved to session memory" : "Add to memory";
    memBtn.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">' + (img.inMemory ? "bookmark_added" : "history_edu") + '</span><span>' + (img.inMemory ? "Saved" : "Add to memory") + '</span>';

    var starBtn = document.createElement("button");
    starBtn.type = "button";
    starBtn.className = "studio-tile-btn studio-star-btn" + (img.isStarred ? " is-starred" : "");
    starBtn.setAttribute("data-star", String(i));
    starBtn.title = img.isStarred ? "Starred" : "Star";
    starBtn.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">' + (img.isStarred ? "star" : "star_outline") + '</span><span>' + (img.isStarred ? "Starred" : "Star") + '</span>';

    var dl = document.createElement("button");
    dl.type = "button";
    dl.className = "studio-dl";
    dl.setAttribute("data-download", String(i));
    dl.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">download</span><span>Download</span>';

    actions.appendChild(memBtn);
    actions.appendChild(starBtn);
    actions.appendChild(dl);

    caption.appendChild(meta);
    caption.appendChild(actions);
    tile.appendChild(shot);
    tile.appendChild(caption);
    return tile;
  }

  function handleAddToMemory(index) {
    if (!activeSession) return;
    var img = images[index];
    if (!img || img.inMemory || img.saving) return;

    var prompt = img.prompt || (lastRequest ? lastRequest.prompt : promptEl.value) || "";
    img.saving = true;
    saveMemoryImage(img.src, activeSession.id, prompt).then(function (saved) {
      img.saving = false;
      img.inMemory = true;
      img.memoryId = saved.id;
      img.memoryPath = saved.path;
      updateTileActions(index);
      updateBadges();
      if (collectionPanel && !collectionPanel.hidden && activeCollectionTab === "memory") {
        renderCollection();
      }
    }).catch(function () {
      img.saving = false;
    });
  }

  function handleToggleStar(index) {
    var img = images[index];
    if (!img || img.savingStar) return;

    if (img.isStarred) {
      if (!img.starId) return;
      img.savingStar = true;
      deleteStarRecord({ id: img.starId, path: img.starPath }).then(function () {
        img.savingStar = false;
        img.isStarred = false;
        img.starId = null;
        img.starPath = null;
        updateTileActions(index);
        updateBadges();
        if (collectionPanel && !collectionPanel.hidden && activeCollectionTab === "starred") {
          renderCollection();
        }
      }).catch(function () {
        img.savingStar = false;
      });
    } else {
      var prompt = img.prompt || (lastRequest ? lastRequest.prompt : promptEl.value) || "";
      img.savingStar = true;
      saveStarImage(img.src, prompt).then(function (saved) {
        img.savingStar = false;
        img.isStarred = true;
        img.starId = saved.id;
        img.starPath = saved.path;
        updateTileActions(index);
        updateBadges();
        if (collectionPanel && !collectionPanel.hidden && activeCollectionTab === "starred") {
          renderCollection();
        }
      }).catch(function () {
        img.savingStar = false;
      });
    }
  }

  function updateTileActions(index) {
    var tile = grid.children[index];
    if (!tile) return;
    var img = images[index];
    if (!img) return;

    var memBtn = tile.querySelector("[data-memory]");
    if (memBtn) {
      memBtn.disabled = Boolean(img.inMemory);
      memBtn.className = "studio-tile-btn studio-memory-btn" + (img.inMemory ? " is-saved" : "");
      memBtn.title = img.inMemory ? "Saved to session memory" : "Add to memory";
      memBtn.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">' + (img.inMemory ? "bookmark_added" : "history_edu") + '</span><span>' + (img.inMemory ? "Saved" : "Add to memory") + '</span>';
    }

    var starBtn = tile.querySelector("[data-star]");
    if (starBtn) {
      starBtn.className = "studio-tile-btn studio-star-btn" + (img.isStarred ? " is-starred" : "");
      starBtn.title = img.isStarred ? "Starred" : "Star";
      starBtn.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">' + (img.isStarred ? "star" : "star_outline") + '</span><span>' + (img.isStarred ? "Starred" : "Star") + '</span>';
    }
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
        id: "img_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
        src: src,
        ext: extFor(src),
        prompt: request.prompt || "",
        width: Number(data.width) || 0,
        height: Number(data.height) || 0,
        inMemory: false,
        memoryId: null,
        isStarred: false,
        starId: null
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

  function openLightboxCustom(src, name, prompt) {
    lbImage.src = src;
    lbImage.alt = prompt || "";
    lbIndex.textContent = "";
    lbName.textContent = name || "Metaluna still";
    lbPrev.disabled = true;
    lbNext.disabled = true;
    lightbox.hidden = false;
    document.body.classList.add("is-locked");
    $("lb-close").focus();
  }

  function activateSession(session, preserveSidebar) {
    if (!session) return;
    activeSession = session;
    try {
      localStorage.setItem(ACTIVE_SESSION_KEY, session.id);
    } catch (e) {}

    if (activeSessionPill) {
      activeSessionPill.textContent = session.name;
    }
    deleteConfirmId = null;
    hideSessionGate();
    renderSidebar();
    updateBadges();

    if (!preserveSidebar && window.innerWidth < 1024) {
      closeSidebar();
    }

    if (collectionPanel && !collectionPanel.hidden && activeCollectionTab === "memory") {
      renderCollection();
    }
  }

  function showSessionGate() {
    activeSession = null;
    if (gateEl) {
      gateEl.hidden = false;
      document.body.classList.add("is-locked");
    }
    renderGateSessions();
    if (gateNameInput) {
      gateNameInput.value = "";
      validateGateForm();
    }
  }

  function hideSessionGate() {
    if (gateEl) {
      gateEl.hidden = true;
      if (settings.hidden && lightbox.hidden && (collectionPanel && collectionPanel.hidden) && (!sidebarEl || !sidebarEl.classList.contains("is-open"))) {
        document.body.classList.remove("is-locked");
      }
    }
  }

  function validateGateForm() {
    if (!gateNameInput || !gateSubmitBtn) return;
    var res = validateSessionName(gateNameInput.value, allSessions);
    gateSubmitBtn.disabled = !res.valid;
    if (gateError) {
      if (res.error) {
        gateError.hidden = false;
        gateError.textContent = res.error;
      } else {
        gateError.hidden = true;
      }
    }
  }

  function renderGateSessions() {
    if (!gateList) return;
    gateList.innerHTML = "";

    if (sessionsLoading) {
      if (gateCountLabel) gateCountLabel.textContent = "loading";
      if (gateEmptyNote) gateEmptyNote.hidden = true;
      for (var s = 0; s < 3; s += 1) {
        var skel = document.createElement("div");
        skel.className = "skeleton skeleton-row";
        skel.setAttribute("aria-hidden", "true");
        gateList.appendChild(skel);
      }
      return;
    }

    if (gateCountLabel) {
      gateCountLabel.textContent = allSessions.length + " recorded";
    }
    if (gateEmptyNote) {
      gateEmptyNote.hidden = allSessions.length > 0;
    }

    allSessions.forEach(function (sess) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "session-gate-item";
      btn.innerHTML = '<span class="session-gate-item-name">' + escapeHtml(sess.name) + '</span><span class="session-gate-item-meta">' + formatSessionDate(sess.createdAt) + '</span>';
      btn.addEventListener("click", function () {
        activateSession(sess);
      });
      gateList.appendChild(btn);
    });
  }

  function openSidebar() {
    if (sidebarEl) sidebarEl.classList.add("is-open");
    if (sidebarScrim) sidebarScrim.hidden = false;
    document.body.classList.add("is-locked");
  }

  function closeSidebar() {
    if (sidebarEl) sidebarEl.classList.remove("is-open");
    if (sidebarScrim) sidebarScrim.hidden = true;
    if (settings.hidden && lightbox.hidden && (collectionPanel && collectionPanel.hidden) && (gateEl && gateEl.hidden)) {
      document.body.classList.remove("is-locked");
    }
  }

  function renderSidebar() {
    if (!sidebarSessionsList) return;
    sidebarSessionsList.innerHTML = "";

    if (sessionsLoading) {
      var skelWrap = document.createElement("div");
      skelWrap.className = "skeleton-wrap";
      for (var s = 0; s < 4; s += 1) {
        var skelRow = document.createElement("div");
        skelRow.className = "skeleton skeleton-row";
        skelRow.setAttribute("aria-hidden", "true");
        skelWrap.appendChild(skelRow);
      }
      sidebarSessionsList.appendChild(skelWrap);
      return;
    }

    allSessions.forEach(function (sess) {
      var item = document.createElement("div");
      var isActive = activeSession && sess.id === activeSession.id;
      item.className = "studio-sidebar-item" + (isActive ? " is-active" : "");

      var row = document.createElement("div");
      row.className = "studio-sidebar-row";

      var selectBtn = document.createElement("button");
      selectBtn.type = "button";
      selectBtn.className = "studio-sidebar-btn";
      selectBtn.innerHTML = '<span class="studio-sidebar-btn-name">' + escapeHtml(sess.name) + '</span><span class="studio-sidebar-btn-date">' + formatSessionDate(sess.createdAt) + '</span>';
      selectBtn.addEventListener("click", function () {
        if (!activeSession || sess.id !== activeSession.id) {
          activateSession(sess);
        }
      });
      row.appendChild(selectBtn);

      var delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "studio-sidebar-del-btn";
      delBtn.title = "Delete session";
      delBtn.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">delete</span>';
      delBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        deleteConfirmId = (deleteConfirmId === sess.id) ? null : sess.id;
        renderSidebar();
      });
      row.appendChild(delBtn);

      item.appendChild(row);

      if (deleteConfirmId === sess.id) {
        var conf = document.createElement("div");
        conf.className = "studio-sidebar-confirm";
        conf.innerHTML = '<span class="studio-sidebar-confirm-label">Delete atelier?</span>' +
          '<div class="studio-sidebar-confirm-actions">' +
            '<button type="button" class="studio-sidebar-confirm-btn studio-sidebar-confirm-yes">Delete</button>' +
            '<button type="button" class="studio-sidebar-confirm-btn studio-sidebar-confirm-no">Cancel</button>' +
          '</div>';

        conf.querySelector(".studio-sidebar-confirm-yes").addEventListener("click", function () {
          deleteSession(sess.id);
        });
        conf.querySelector(".studio-sidebar-confirm-no").addEventListener("click", function () {
          deleteConfirmId = null;
          renderSidebar();
        });
        item.appendChild(conf);
      }

      sidebarSessionsList.appendChild(item);
    });
  }

  function deleteSession(id) {
    deleteSessionRecord(id).then(function () {
      allSessions = allSessions.filter(function (s) { return s.id !== id; });
      deleteConfirmId = null;
      if (activeSession && activeSession.id === id) {
        if (allSessions.length > 0) {
          activateSession(allSessions[0]);
        } else {
          try { localStorage.removeItem(ACTIVE_SESSION_KEY); } catch (e) {}
          showSessionGate();
        }
      } else {
        renderSidebar();
      }
    }).catch(function () {
      deleteConfirmId = null;
      renderSidebar();
    });
  }

  function validateSidebarForm() {
    if (!sidebarNameInput || !sidebarCreateBtn) return;
    var res = validateSessionName(sidebarNameInput.value, allSessions);
    sidebarCreateBtn.disabled = !res.valid;
    if (sidebarNameError) {
      if (res.error) {
        sidebarNameError.hidden = false;
        sidebarNameError.textContent = res.error;
      } else {
        sidebarNameError.hidden = true;
      }
    }
  }

  function openCollection(tab) {
    activeCollectionTab = tab || "memory";
    if (tabMemory) {
      tabMemory.classList.toggle("is-active", activeCollectionTab === "memory");
      tabMemory.setAttribute("aria-selected", activeCollectionTab === "memory" ? "true" : "false");
    }
    if (tabStarred) {
      tabStarred.classList.toggle("is-active", activeCollectionTab === "starred");
      tabStarred.setAttribute("aria-selected", activeCollectionTab === "starred" ? "true" : "false");
    }
    if (collectionPanel) collectionPanel.hidden = false;
    if (collectionScrim) collectionScrim.hidden = false;
    document.body.classList.add("is-locked");
    renderCollection();
  }

  function closeCollection() {
    if (collectionPanel) collectionPanel.hidden = true;
    if (collectionScrim) collectionScrim.hidden = true;
    if (settings.hidden && lightbox.hidden && (gateEl && gateEl.hidden) && (!sidebarEl || !sidebarEl.classList.contains("is-open"))) {
      document.body.classList.remove("is-locked");
    }
  }

  function collectionSkeletons() {
    if (!collectionGrid) return;
    collectionGrid.innerHTML = "";
    for (var i = 0; i < 4; i += 1) {
      var card = document.createElement("div");
      card.className = "skeleton skeleton-card";
      card.setAttribute("aria-hidden", "true");
      collectionGrid.appendChild(card);
    }
  }

  function collectionEmptyBox(kind) {
    var emptyBox = document.createElement("div");
    emptyBox.className = "collection-empty-box";
    emptyBox.innerHTML = '<p class="collection-empty-tip">' +
      (kind === "memory" ? "No images saved to this session yet." : "No starred images saved yet.") + '</p>' +
      '<button type="button" class="collection-att-add is-empty-add" aria-label="Add attachment"><span class="material-symbols-outlined" aria-hidden="true">add</span><span>Add attachment</span></button>' +
      '<p class="collection-paste-tip">or paste with Ctrl + V</p>' +
      '<span class="collection-att-notice" role="status" hidden></span>';

    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.hidden = true;
    emptyBox.appendChild(input);

    var notice = emptyBox.querySelector(".collection-att-notice");
    emptyBox.querySelector(".is-empty-add").addEventListener("click", function () {
      input.click();
    });
    input.addEventListener("change", function () {
      var files = Array.from(input.files || []);
      input.value = "";
      handleUploadFiles(files, null, notice);
    });
    return emptyBox;
  }

  function collectionFigure(item, url, kind) {
    var fig = document.createElement("figure");
    fig.className = "collection-item";

    var shot = document.createElement("button");
    shot.type = "button";
    shot.className = "collection-shot";
    shot.setAttribute("aria-label", "Open image fullscreen");
    shot.innerHTML = '<img src="' + (url || "") + '" alt="' + escapeHtml(item.prompt) + '"/>' +
      '<div class="collection-overlay"><p class="collection-prompt">' + escapeHtml(item.prompt) + '</p></div>';
    shot.addEventListener("click", function () {
      if (!url) {
        toast("That stored copy could not be opened.", "error");
        return;
      }
      openLightboxCustom(
        url,
        kind === "memory" ? "Memory · " + (activeSession ? activeSession.name : "") : "Starred still",
        item.prompt
      );
    });
    fig.appendChild(shot);

    if (patinaEnabled) {
      var attBar = document.createElement("div");
      attBar.className = "collection-att-bar";
      var attNotice = document.createElement("span");
      attNotice.className = "collection-att-notice";
      attNotice.setAttribute("role", "status");
      attNotice.hidden = true;
      fig.appendChild(attBar);
      fig.appendChild(attNotice);
      renderItemAttachments(attBar, kind + ":" + item.id, attNotice);
    }

    var foot = document.createElement("div");
    foot.className = "collection-item-foot";
    foot.innerHTML = '<span class="collection-item-time">' + formatSessionDate(item.createdAt) + '</span>' +
      '<div class="collection-item-actions">' +
        '<button type="button" class="collection-dl-btn" title="Download the stored copy"><span class="material-symbols-outlined" aria-hidden="true">download</span></button>' +
        '<button type="button" class="collection-remove-btn" title="' +
          (kind === "memory" ? "Remove from memory" : "Remove star") +
        '"><span class="material-symbols-outlined" aria-hidden="true">delete</span></button>' +
      '</div>';

    foot.querySelector(".collection-dl-btn").addEventListener("click", function () {
      downloadStored(url, item.prompt || kind);
    });

    foot.querySelector(".collection-remove-btn").addEventListener("click", function () {
      var removal = kind === "memory" ? deleteMemoryRecord(item) : deleteStarRecord(item);
      removal.then(function () {
        images.forEach(function (img, idx) {
          if (kind === "memory" && img.memoryId === item.id) {
            img.inMemory = false;
            img.memoryId = null;
            img.memoryPath = null;
            updateTileActions(idx);
          }
          if (kind === "starred" && img.starId === item.id) {
            img.isStarred = false;
            img.starId = null;
            img.starPath = null;
            updateTileActions(idx);
          }
        });
        renderCollection();
        updateBadges();
      }).catch(function () {
        renderCollection();
      });
    });

    fig.appendChild(foot);
    return fig;
  }

  function renderCollectionList(rows, kind) {
    collectionGrid.innerHTML = "";

    if (rows.length === 0) {
      if (patinaEnabled) {
        collectionGrid.appendChild(collectionEmptyBox(kind));
      } else if (kind === "memory" && memoryEmpty) {
        memoryEmpty.hidden = false;
      } else if (kind === "starred" && starredEmpty) {
        starredEmpty.hidden = false;
      }
      return;
    }

    return signedLinks(rows.map(function (row) { return row.path; })).then(function (links) {
      collectionGrid.innerHTML = "";
      rows.forEach(function (row) {
        collectionGrid.appendChild(collectionFigure(row, links[row.path], kind));
      });
    });
  }

  function renderCollection() {
    if (!collectionGrid) return;

    if (memoryEmpty) {
      memoryEmpty.textContent = "No images saved to this session's memory yet.";
      memoryEmpty.hidden = true;
    }
    if (starredEmpty) {
      starredEmpty.textContent = "No starred images saved yet.";
      starredEmpty.hidden = true;
    }

    if (activeCollectionTab === "memory") {
      if (!activeSession) {
        if (patinaEnabled) {
          ensureActiveSession().then(function () {
            renderCollection();
          }).catch(function () {});
          return;
        }
        collectionGrid.innerHTML = "";
        if (memoryEmpty) memoryEmpty.hidden = false;
        return;
      }

      collectionSkeletons();
      fetchMemory(activeSession.id).then(function (mems) {
        if (memoryBadge) memoryBadge.textContent = String(mems.length);
        return renderCollectionList(mems, "memory");
      }).catch(function () {
        collectionGrid.innerHTML = "";
        if (memoryEmpty) {
          memoryEmpty.textContent = "Session memory could not be loaded.";
          memoryEmpty.hidden = false;
        }
      });
      return;
    }

    collectionSkeletons();
    fetchStars().then(function (stars) {
      if (starredBadge) starredBadge.textContent = String(stars.length);
      return renderCollectionList(stars, "starred");
    }).catch(function () {
      collectionGrid.innerHTML = "";
      if (starredEmpty) {
        starredEmpty.textContent = "Starred images could not be loaded.";
        starredEmpty.hidden = false;
      }
    });
  }

  function updateBadges() {
    if (activeSession) {
      fetchMemory(activeSession.id).then(function (mems) {
        if (memoryBadge) memoryBadge.textContent = String(mems.length);
      }).catch(function () {});
    } else if (memoryBadge) {
      memoryBadge.textContent = "0";
    }

    fetchStars().then(function (stars) {
      if (starredBadge) starredBadge.textContent = String(stars.length);
    }).catch(function () {});
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
    if (lightbox.hidden && (collectionPanel && collectionPanel.hidden) && (gateEl && gateEl.hidden) && (!sidebarEl || !sidebarEl.classList.contains("is-open"))) {
      document.body.classList.remove("is-locked");
    }
  }

  /* --------------------------------------------------------------- events */

  loadSettings();
  initPatina();
  syncCount();
  syncRatio();
  updateDownloads();
  startHealthLoop();

  /* Session Gate Events */
  if (gateNameInput) {
    gateNameInput.addEventListener("input", validateGateForm);
  }

  if (gateForm) {
    gateForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = validateSessionName(gateNameInput.value, allSessions);
      if (!res.valid) return;

      createSessionRow(res.trimmed).then(function (newSess) {
        allSessions.unshift(newSess);
        activateSession(newSess);
      }).catch(function () {});
    });
  }

  /* Sidebar Events */
  if (openSidebarBtn) {
    openSidebarBtn.addEventListener("click", openSidebar);
  }

  if (closeSidebarBtn) {
    closeSidebarBtn.addEventListener("click", closeSidebar);
  }

  if (sidebarScrim) {
    sidebarScrim.addEventListener("click", closeSidebar);
  }

  if (sidebarNewToggle) {
    sidebarNewToggle.addEventListener("click", function () {
      if (sidebarNewForm) {
        sidebarNewForm.hidden = !sidebarNewForm.hidden;
        if (!sidebarNewForm.hidden && sidebarNameInput) {
          sidebarNameInput.value = "";
          validateSidebarForm();
          sidebarNameInput.focus();
        }
      }
    });
  }

  if (sidebarCancelBtn) {
    sidebarCancelBtn.addEventListener("click", function () {
      if (sidebarNewForm) sidebarNewForm.hidden = true;
    });
  }

  if (sidebarNameInput) {
    sidebarNameInput.addEventListener("input", validateSidebarForm);
  }

  if (sidebarNewForm) {
    sidebarNewForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = validateSessionName(sidebarNameInput.value, allSessions);
      if (!res.valid) return;

      createSessionRow(res.trimmed).then(function (newSess) {
        allSessions.unshift(newSess);
        sidebarNewForm.hidden = true;
        activateSession(newSess, true);
      }).catch(function () {});
    });
  }

  /* Collection Panel Events */
  if (openMemoryBtn) {
    openMemoryBtn.addEventListener("click", function () { openCollection("memory"); });
  }

  if (openStarredBtn) {
    openStarredBtn.addEventListener("click", function () { openCollection("starred"); });
  }

  if (closeCollectionBtn) {
    closeCollectionBtn.addEventListener("click", closeCollection);
  }

  if (collectionScrim) {
    collectionScrim.addEventListener("click", closeCollection);
  }

  if (tabMemory) {
    tabMemory.addEventListener("click", function () { openCollection("memory"); });
  }

  if (tabStarred) {
    tabStarred.addEventListener("click", function () { openCollection("starred"); });
  }

  /* Tile actions: Memory, Star, Download, Fullscreen */
  grid.addEventListener("click", function (event) {
    var memAction = event.target.closest("[data-memory]");
    if (memAction) {
      handleAddToMemory(Number(memAction.getAttribute("data-memory")));
      return;
    }

    var starAction = event.target.closest("[data-star]");
    if (starAction) {
      handleToggleStar(Number(starAction.getAttribute("data-star")));
      return;
    }

    var openBtn = event.target.closest("[data-open]");
    if (openBtn) {
      openLightbox(Number(openBtn.getAttribute("data-open")));
      return;
    }

    var dlBtn = event.target.closest("[data-download]");
    if (dlBtn && !dlBtn.disabled) {
      downloadImage(Number(dlBtn.getAttribute("data-download")));
      return;
    }
  });

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

  var collectionHeadAdd = $("collection-head-add");
  var collectionHeadFile = $("collection-head-file");

  function updatePatinaUI() {
    if (patinaToggle) {
      patinaToggle.setAttribute("aria-checked", patinaEnabled ? "true" : "false");
    }
    if (collectionHeadAdd) {
      collectionHeadAdd.hidden = !patinaEnabled;
    }
  }

  function initPatina() {
    patinaEnabled = readStore(PATINA_KEY) === "1";
    updatePatinaUI();
  }

  if (patinaToggle) {
    patinaToggle.addEventListener("click", function () {
      patinaEnabled = !patinaEnabled;
      updatePatinaUI();
      writeStore(PATINA_KEY, patinaEnabled ? "1" : "");
      if (collectionPanel && !collectionPanel.hidden) {
        renderCollection();
      }
    });
  }

  if (collectionHeadAdd && collectionHeadFile) {
    collectionHeadAdd.addEventListener("click", function () {
      collectionHeadFile.click();
    });
    collectionHeadFile.addEventListener("change", function () {
      var files = Array.from(collectionHeadFile.files || []);
      collectionHeadFile.value = "";
      handleUploadFiles(files, null, null);
    });
  }

  document.addEventListener("paste", function (e) {
    if (!patinaEnabled) return;
    var cd = e.clipboardData || (window.clipboardData);
    if (!cd || !cd.items) return;
    var imageFiles = [];
    for (var i = 0; i < cd.items.length; i++) {
      if (cd.items[i].type && cd.items[i].type.indexOf("image") !== -1) {
        var f = cd.items[i].getAsFile();
        if (f) imageFiles.push(f);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      if (collectionPanel && collectionPanel.hidden) {
        openCollection(activeCollectionTab || "memory");
      }
      handleUploadFiles(imageFiles, null, null);
    }
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
    if (accountMenu && !accountMenu.hidden) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAccountMenu();
        if (accountChip) accountChip.focus();
      }
      return;
    }
    if (!settings.hidden) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSettings();
      }
      return;
    }
    if (collectionPanel && !collectionPanel.hidden) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeCollection();
      }
      return;
    }
    if (sidebarEl && sidebarEl.classList.contains("is-open")) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSidebar();
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

  /* ----------------------------------------------------------------- auth */

  var authMode = "signin";
  var authBusy = false;
  var loadedUserId = null;
  var legacyData = null;
  var migrating = false;

  function showAuthError(message) {
    if (!authError) return;
    authError.textContent = message || "";
    authError.hidden = !message;
  }

  /* ------------------------------------------------------------ account chip */

  function accountInitial(user) {
    var email = String((user && user.email) || "").trim();
    return (email.charAt(0) || "M").toUpperCase();
  }

  function paintAccount(user) {
    var email = String((user && user.email) || "");
    if (accountChipAvatar) accountChipAvatar.textContent = accountInitial(user);
    if (accountMenuEmail) {
      accountMenuEmail.textContent = email || "Signed in";
      accountMenuEmail.title = email;
    }
    if (accountChip) accountChip.hidden = !user;
  }

  function openAccountMenu() {
    if (!accountMenu || !currentUser) return;
    accountMenu.hidden = false;
    if (accountScrim) accountScrim.hidden = false;
    if (accountChip) accountChip.setAttribute("aria-expanded", "true");
    if (accountMenuSignout) accountMenuSignout.focus();
  }

  function closeAccountMenu() {
    if (accountMenu) accountMenu.hidden = true;
    if (accountScrim) accountScrim.hidden = true;
    if (accountChip) accountChip.setAttribute("aria-expanded", "false");
  }

  function validateAuthForm() {
    if (!authSubmit) return;
    var email = authEmail ? authEmail.value.trim() : "";
    var pass = authPassword ? authPassword.value : "";
    var filled = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && pass.length >= 6;
    authSubmit.disabled = authBusy || !filled;
    authSubmit.classList.toggle("is-quiet", !authBusy && !filled);
  }

  function setAuthMode(mode) {
    authMode = mode === "signup" ? "signup" : "signin";
    var signup = authMode === "signup";
    if (authTitle) authTitle.textContent = signup ? "Open an account" : "Enter the studio";
    if (authSubmitLabel) authSubmitLabel.textContent = signup ? "Create account" : "Sign in";
    if (authSwitchPrompt) authSwitchPrompt.textContent = signup ? "Already have an account?" : "No account yet?";
    if (authSwitch) {
      authSwitch.textContent = signup ? "Sign in" : "Create account";
      authSwitch.setAttribute("aria-pressed", signup ? "true" : "false");
    }
    if (authPassword) authPassword.setAttribute("autocomplete", signup ? "new-password" : "current-password");
    showAuthError("");
    validateAuthForm();
  }

  function calmAuthError(err) {
    var msg = String((err && (err.message || err.error_description || err.msg)) || "");
    if (/invalid login credentials|invalid_grant|invalid credentials/i.test(msg)) {
      return "That email and password do not match an account.";
    }
    if (/email not confirmed/i.test(msg)) return "Confirm your email first, then sign in.";
    if (/already registered|already exists|user already/i.test(msg)) {
      return "That email already has an account. Sign in instead.";
    }
    if (/rate limit|too many/i.test(msg)) return "Too many attempts. Give it a minute.";
    if (/failed to fetch|network/i.test(msg)) return "The studio could not reach its server.";
    if (/password/i.test(msg) && /(least|short|weak|6|characters)/i.test(msg)) {
      return "Use a password of at least 6 characters.";
    }
    if (/valid email/i.test(msg)) return "Enter a valid email address.";
    if (msg && msg.length < 130 && msg.indexOf("{") !== 0) return msg;
    return "That did not go through. Try again.";
  }

  function setAuthBusy(on) {
    authBusy = on;
    validateAuthForm();
  }

  function handleAuthSubmit(event) {
    event.preventDefault();
    if (authBusy) return;

    var email = authEmail ? authEmail.value.trim() : "";
    var pass = authPassword ? authPassword.value : "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showAuthError("Enter a valid email address.");
      return;
    }
    if (pass.length < 6) {
      showAuthError("Use a password of at least 6 characters.");
      return;
    }
    if (!sb) {
      showAuthError("The studio could not reach its server.");
      return;
    }

    showAuthError("");
    setAuthBusy(true);

    var request = authMode === "signup"
      ? sb.auth.signUp({ email: email, password: pass })
      : sb.auth.signInWithPassword({ email: email, password: pass });

    request.then(function (res) {
      setAuthBusy(false);
      if (res && res.error) {
        showAuthError(calmAuthError(res.error));
        return;
      }
      if (res && res.data && res.data.session && res.data.user) {
        onSignedIn(res.data.user);
        return;
      }
      if (authMode === "signup") {
        if (authPassword) authPassword.value = "";
        setAuthMode("signin");
        showAuthError("Account created. Confirm the email we sent, then sign in.");
        return;
      }
      showAuthError("Sign in did not complete. Try again.");
    }).catch(function (err) {
      setAuthBusy(false);
      showAuthError(calmAuthError(err));
    });
  }

  function showAuthGate(message) {
    if (!authGate) return;
    authGate.hidden = false;
    document.body.classList.add("is-locked");
    setAuthMode(authMode);
    if (message) showAuthError(message);
    if (authEmail && !authEmail.value) authEmail.focus();
  }

  function onSignedIn(user) {
    currentUser = user || null;
    if (authGate) authGate.hidden = true;
    if (sidebarUserEmail) sidebarUserEmail.textContent = (currentUser && currentUser.email) || "Signed in";
    paintAccount(currentUser);
    if (authPassword) authPassword.value = "";
    showAuthError("");
    validateAuthForm();

    if (loadedUserId && currentUser && loadedUserId === currentUser.id) return;
    loadedUserId = currentUser ? currentUser.id : null;

    refreshStudio();
    probeLegacySaves();
  }

  function refreshStudio() {
    sessionsLoading = true;
    allSessions = [];
    activeSession = null;
    showSessionGate();
    renderSidebar();
    updateBadges();

    fetchSessions().then(function (list) {
      sessionsLoading = false;
      allSessions = list;
      renderGateSessions();
      renderSidebar();
      if (!allSessions.length) {
        showSessionGate();
        return;
      }

      var storedId = null;
      try { storedId = localStorage.getItem(ACTIVE_SESSION_KEY); } catch (e) {}
      var matched = null;
      if (storedId) {
        allSessions.forEach(function (sess) {
          if (sess.id === storedId) matched = sess;
        });
      }
      if (matched) activateSession(matched);
      else showSessionGate();
    }).catch(function () {
      sessionsLoading = false;
      renderGateSessions();
      renderSidebar();
      showSessionGate();
    });
  }

  function resetSignedOutState() {
    currentUser = null;
    loadedUserId = null;
    legacyData = null;
    sessionsLoading = true;
    allSessions = [];
    activeSession = null;
    deleteConfirmId = null;

    if (activeSessionPill) activeSessionPill.textContent = "Session";
    if (memoryBadge) memoryBadge.textContent = "0";
    if (starredBadge) starredBadge.textContent = "0";
    if (sidebarUserEmail) sidebarUserEmail.textContent = "\u00a0";
    if (gateEl) gateEl.hidden = true;
    if (sidebarEl) sidebarEl.classList.remove("is-open");
    if (sidebarScrim) sidebarScrim.hidden = true;
    if (collectionPanel) collectionPanel.hidden = true;
    if (collectionScrim) collectionScrim.hidden = true;
    if (settings) settings.hidden = true;
    if (settingsScrim) settingsScrim.hidden = true;
    if (migrateField) migrateField.hidden = true;
    if (openSettingsBtn) openSettingsBtn.setAttribute("aria-expanded", "false");
    closeAccountMenu();
    if (accountChip) accountChip.hidden = true;
    if (lightbox) lightbox.hidden = true;
    if (lbImage) lbImage.removeAttribute("src");
    images = [];
    attachmentStore = {};
    if (collectionGrid) collectionGrid.innerHTML = "";
    try { localStorage.removeItem(ACTIVE_SESSION_KEY); } catch (e) {}
    requested = 0;
    lastRequest = null;
    resetStage();
    showAuthGate();
  }

  function signOut() {
    if (!sb) return;
    syncStart();
    sb.auth.signOut().then(function (res) {
      syncStop();
      if (res && res.error) {
        toast(friendlyError(res.error, "Sign out did not complete."), "error");
        return;
      }
      resetSignedOutState();
    }).catch(function (err) {
      syncStop();
      toast(friendlyError(err, "Sign out did not complete."), "error");
    });
  }

  function startAuth() {
    if (!sb) {
      showAuthGate("The studio could not reach its account service. Reload the page.");
      if (authSubmit) authSubmit.disabled = true;
      return;
    }

    sb.auth.getSession().then(function (res) {
      var session = res && res.data ? res.data.session : null;
      if (session && session.user) onSignedIn(session.user);
      else showAuthGate();
    }).catch(function () {
      showAuthGate();
    });

    sb.auth.onAuthStateChange(function (event, session) {
      /* Keep data calls out of the auth callback so the client lock is free. */
      setTimeout(function () {
        if (event === "SIGNED_OUT") {
          resetSignedOutState();
          return;
        }
        if (event === "SIGNED_IN" && session && session.user) {
          if (!currentUser || currentUser.id !== session.user.id) onSignedIn(session.user);
        }
      }, 0);
    });
  }

  /* ------------------------------------------------------- local migration */

  function migrationProgress(done, total) {
    if (migrateNote) migrateNote.textContent = "Uploading " + done + " of " + total + "…";
    if (migrateProgress) migrateProgress.hidden = false;
    if (migrateBar) migrateBar.style.width = (total ? Math.round((done / total) * 100) : 0) + "%";
  }

  function probeLegacySaves() {
    readLegacySaves().then(function (data) {
      legacyData = data;
      if (!migrateField) return;
      if (!data) {
        migrateField.hidden = true;
        return;
      }
      var total = data.sessions.length + data.memory.length + data.stars.length;
      migrateField.hidden = false;
      if (migrateBtn) {
        migrateBtn.hidden = false;
        migrateBtn.disabled = false;
        migrateBtn.textContent = "Upload my local saves";
      }
      if (migrateConfirm) migrateConfirm.hidden = true;
      if (migrateProgress) migrateProgress.hidden = true;
      if (migrateNote) {
        migrateNote.textContent = total + (total === 1 ? " local save" : " local saves") + " found in this browser.";
      }
    }).catch(function () {
      if (migrateField) migrateField.hidden = true;
    });
  }

  function freeSessionName(raw, taken) {
    var base = String(raw || "").trim() || "Imported atelier";
    var candidate = base.slice(0, 40);
    var n = 2;
    while (taken[candidate.toLowerCase()]) {
      var suffix = " (" + n + ")";
      candidate = base.slice(0, 40 - suffix.length) + suffix;
      n += 1;
    }
    taken[candidate.toLowerCase()] = true;
    return candidate;
  }

  function runMigration() {
    if (migrating || !legacyData || !currentUser) return;

    migrating = true;
    if (migrateBtn) {
      migrateBtn.disabled = true;
      migrateBtn.textContent = "Uploading…";
    }
    if (migrateConfirm) migrateConfirm.hidden = true;

    var data = legacyData;
    var total = data.sessions.length + data.memory.length + data.stars.length;
    var done = 0;
    var taken = {};
    var idMap = {};

    allSessions.forEach(function (sess) {
      taken[String(sess.name || "").toLowerCase()] = true;
    });

    var bump = function () {
      done += 1;
      migrationProgress(done, total);
    };

    var chain = Promise.resolve();

    data.sessions.forEach(function (old) {
      chain = chain.then(function () {
        return createSessionRow(freeSessionName(old.name, taken)).then(function (sess) {
          idMap[old.id] = sess.id;
          allSessions.unshift(sess);
          bump();
        }, bump);
      });
    });

    data.memory.forEach(function (old) {
      chain = chain.then(function () {
        var sessionId = idMap[old.sessionId];
        if (!sessionId || !old.blob) {
          bump();
          return;
        }
        return saveMemoryImage(old.blob, sessionId, old.prompt || "").then(bump, bump);
      });
    });

    data.stars.forEach(function (old) {
      chain = chain.then(function () {
        if (!old.blob) {
          bump();
          return;
        }
        return saveStarImage(old.blob, old.prompt || "").then(bump, bump);
      });
    });

    chain.then(function () {
      migrating = false;
      if (migrateProgress) migrateProgress.hidden = true;
      if (migrateBtn) migrateBtn.hidden = true;
      if (migrateNote) migrateNote.textContent = "Copied to your account.";
      renderGateSessions();
      renderSidebar();
      updateBadges();
      toast("Local saves copied to your account.");
      if (migrateConfirm) {
        migrateConfirm.hidden = false;
        if (migrateConfirmNote) {
          migrateConfirmNote.textContent = "Copied " + done + " of " + total + " saves. Clear the local copies stored in this browser?";
        }
      }
    }).catch(function () {
      migrating = false;
      if (migrateProgress) migrateProgress.hidden = true;
      if (migrateBtn) {
        migrateBtn.disabled = false;
        migrateBtn.textContent = "Upload my local saves";
      }
      if (migrateNote) migrateNote.textContent = "Some saves did not go through. Try again.";
    });
  }

  function clearLocalSaves() {
    try {
      var req = indexedDB.deleteDatabase(LEGACY_DB);
      req.onsuccess = function () {
        legacyData = null;
        if (migrateField) migrateField.hidden = true;
        toast("Local copies cleared.");
      };
      req.onerror = function () {
        toast("Could not clear the local copies.", "error");
      };
      req.onblocked = function () {
        toast("Close other studio tabs, then clear again.", "error");
      };
    } catch (err) {
      toast("Could not clear the local copies.", "error");
    }
  }

  if (authForm) authForm.addEventListener("submit", handleAuthSubmit);

  if (authEmail) {
    authEmail.addEventListener("input", function () {
      showAuthError("");
      validateAuthForm();
    });
  }

  if (authPassword) {
    authPassword.addEventListener("input", function () {
      showAuthError("");
      validateAuthForm();
    });
  }

  if (authSwitch) {
    authSwitch.addEventListener("click", function () {
      setAuthMode(authMode === "signin" ? "signup" : "signin");
      if (authEmail) authEmail.focus();
    });
  }

  if (signoutBtn) signoutBtn.addEventListener("click", signOut);

  if (accountChip) {
    accountChip.addEventListener("click", function (event) {
      event.stopPropagation();
      if (accountMenu && !accountMenu.hidden) closeAccountMenu();
      else openAccountMenu();
    });
  }

  if (accountScrim) accountScrim.addEventListener("click", closeAccountMenu);

  if (accountMenuSignout) {
    accountMenuSignout.addEventListener("click", function () {
      closeAccountMenu();
      signOut();
    });
  }

  if (migrateBtn) migrateBtn.addEventListener("click", runMigration);

  if (migrateClear) migrateClear.addEventListener("click", clearLocalSaves);

  if (migrateKeep) {
    migrateKeep.addEventListener("click", function () {
      if (migrateConfirm) migrateConfirm.hidden = true;
      if (migrateNote) migrateNote.textContent = "Local copies kept in this browser.";
    });
  }

  startAuth();
})();
