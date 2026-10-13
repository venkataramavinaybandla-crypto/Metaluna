/**
 * Metalune Real-Time Liquid Metal Mixer (Phase 3)
 * Pure WebGL2 with WebGL1 fallback. Zero external libraries.
 */

(() => {
  'use strict';

  // --- DESIGN SYSTEM ALLOY PALETTES (DESIGN.md) ---
  // Lilac Alloy: #7B6FD0 (shadow), #A89CF2 (base), #D6CEFF (specular)
  // Glaucous Alloy: #55689A (shadow), #7C93C9 (base), #B4C4EC (specular)
  // Snow Alloy: #AEB3D1 (shadow), #DCDFF2 (base), #F6F7FF (specular)
  // Basin Ground: #0D0C12

  const ALLOY_INFO = [
    {
      id: 0,
      name: 'Lilac',
      key: 'lilac',
      viscosity: 0.88,
      shadowHex: '#7B6FD0',
      baseHex: '#A89CF2',
      crestHex: '#D6CEFF',
      // Linear RGB
      shadow: [0.198, 0.160, 0.632],
      base: [0.395, 0.337, 0.890],
      crest: [0.677, 0.622, 1.000]
    },
    {
      id: 1,
      name: 'Snow',
      key: 'snow',
      viscosity: 0.80,
      shadowHex: '#AEB3D1',
      baseHex: '#DCDFF2',
      crestHex: '#F6F7FF',
      // Linear RGB
      shadow: [0.428, 0.457, 0.639],
      base: [0.720, 0.742, 0.890],
      crest: [0.926, 0.934, 1.000]
    },
    {
      id: 2,
      name: 'Glaucous',
      key: 'glaucous',
      viscosity: 0.85,
      shadowHex: '#55689A',
      baseHex: '#7C93C9',
      crestHex: '#B4C4EC',
      // Linear RGB
      shadow: [0.090, 0.138, 0.327],
      base: [0.202, 0.297, 0.587],
      crest: [0.463, 0.554, 0.843]
    }
  ];

  // DOM Elements
  const canvas = document.getElementById('mixer-canvas');
  const fallbackImg = document.getElementById('hero-fallback-image');
  const mixerControls = document.getElementById('hero-mixer-controls');
  const hudViscosity = document.getElementById('hud-viscosity');
  const hudRoughness = document.getElementById('hud-roughness');
  const hudPurity = document.getElementById('hud-purity');
  const dropPctLilac = document.getElementById('drop-pct-lilac');
  const dropPctSnow = document.getElementById('drop-pct-snow');
  const dropPctGlaucous = document.getElementById('drop-pct-glaucous');
  const resetBtn = document.getElementById('mixer-reset-btn');
  const copyBlendBtn = document.getElementById('mixer-copy-blend-btn');
  const dropButtons = document.querySelectorAll('.hero-alloy-drop');
  const keyboardCursor = document.getElementById('mixer-keyboard-cursor');

  if (!canvas) return;

  // Accessibility Announcer
  let liveRegion = document.getElementById('a11y-live-region');
  function announce(msg) {
    if (liveRegion) {
      liveRegion.textContent = msg;
    }
  }

  // Check Reduced Motion
  let isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
    isReducedMotion = e.matches;
  });

  // --- WebGL Context Initialization ---
  let gl = null;
  let isWebGL2 = false;

  const glOptions = {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false
  };

  try {
    gl = canvas.getContext('webgl2', glOptions);
    if (gl) {
      isWebGL2 = true;
    } else {
      gl = canvas.getContext('webgl', glOptions) || canvas.getContext('experimental-webgl', glOptions);
      isWebGL2 = false;
    }
  } catch (e) {
    gl = null;
  }

  if (!gl) {
    console.warn('WebGL is unavailable. Preserving static hero basin visual fallback.');
    if (fallbackImg) fallbackImg.style.display = 'block';
    if (mixerControls) mixerControls.style.display = 'none';
    return;
  }

  // Shader Sources
  const vsSourceWebGL2 = `#version 300 es
    in vec2 a_position;
    out vec2 v_uv;
    void main() {
      v_uv = (a_position + 1.0) * 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fsSourceWebGL2 = `#version 300 es
    precision highp float;
    in vec2 v_uv;
    out vec4 fragColor;

    uniform vec2 u_resolution;
    uniform float u_time;
    uniform float u_roughness;
    uniform float u_viscosity;
    uniform vec2 u_stir_pos;
    uniform float u_stir_strength;
    uniform int u_num_pours;
    uniform vec4 u_pours[16]; // xy = pos, z = alloyId, w = strength/age

    // Hash & Simplex-style flow field
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    vec2 curl(vec2 p, float t) {
      float n1 = noise(p * 2.5 + vec2(t * 0.15, -t * 0.12));
      float n2 = noise(p * 2.5 + vec2(-t * 0.13, t * 0.16) + 4.5);
      return vec2(n1 - 0.5, n2 - 0.5) * 2.0;
    }

    float getSurfaceHeight(vec2 uv, float t) {
      float h1 = sin(uv.x * 6.0 + t * 0.4) * cos(uv.y * 6.0 - t * 0.35);
      float h2 = sin(uv.x * 12.0 - uv.y * 10.0 + t * 0.7) * 0.45;
      float h3 = noise(uv * 18.0 + t * 0.25) * 0.3;
      return h1 * 0.5 + h2 + h3;
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;
      float aspect = u_resolution.x / u_resolution.y;

      // Stir swirl velocity
      vec2 dStir = uv - u_stir_pos;
      float rStir = length(dStir);
      float swirlAmt = exp(-rStir * 3.5) * u_stir_strength;
      vec2 swirlDir = vec2(-dStir.y, dStir.x);

      // Layered domain warping
      vec2 flow1 = curl(uv * 1.8, u_time);
      vec2 flow2 = curl(uv * 3.6 + flow1 * 0.4, u_time * 0.85);
      vec2 warpedUV = uv + (flow1 * 0.18 + flow2 * 0.10) / (u_viscosity * 1.1) + swirlDir * swirlAmt * 0.45;

      // Alloy weights accumulator
      float wLilac = 0.01;
      float wSnow = 0.01;
      float wGlaucous = 0.01;
      float totalHeight = 0.0;

      for (int i = 0; i < 16; i++) {
        if (i >= u_num_pours) break;
        vec4 p = u_pours[i];
        vec2 pPos = p.xy;
        float alloyId = p.z;
        float strength = p.w;

        float dist = length(warpedUV - pPos);
        float field = exp(-dist * dist * 4.8) * strength;
        totalHeight += field;

        if (alloyId < 0.5) {
          wLilac += field;
        } else if (alloyId < 1.5) {
          wSnow += field;
        } else {
          wGlaucous += field;
        }
      }

      float sumW = wLilac + wSnow + wGlaucous;
      vec3 weights = vec3(wLilac, wSnow, wGlaucous) / sumW;

      // Surface normal via finite differences
      float eps = 0.0035;
      float hCenter = getSurfaceHeight(warpedUV, u_time) + totalHeight * 0.35;
      float hRight = getSurfaceHeight(warpedUV + vec2(eps, 0.0), u_time) + totalHeight * 0.35;
      float hUp = getSurfaceHeight(warpedUV + vec2(0.0, eps), u_time) + totalHeight * 0.35;

      vec3 normal = normalize(vec3(-(hRight - hCenter) / eps * 0.3, -(hUp - hCenter) / eps * 0.3, 1.0));

      // Molten Lighting Model
      vec3 lightDir = normalize(vec3(-0.65, 0.72, 0.85));
      vec3 viewDir = vec3(0.0, 0.0, 1.0);
      vec3 halfDir = normalize(lightDir + viewDir);

      float NdotL = max(dot(normal, lightDir), 0.0);
      float NdotV = max(dot(normal, viewDir), 0.0);
      float NdotH = max(dot(normal, halfDir), 0.0);

      // Specular Crest (roughness-governed)
      float specPower = mix(128.0, 16.0, u_roughness);
      float spec = pow(NdotH, specPower);
      float hardBand = smoothstep(0.4, 0.95, spec) * 1.4;

      // Fresnel rim
      float fresnel = pow(1.0 - NdotV, 3.2);

      // Linear Alloy Palettes
      vec3 lilacCol = mix(vec3(0.198, 0.160, 0.632), vec3(0.395, 0.337, 0.890), NdotL) + vec3(0.677, 0.622, 1.000) * hardBand;
      vec3 snowCol = mix(vec3(0.428, 0.457, 0.639), vec3(0.720, 0.742, 0.890), NdotL) + vec3(0.926, 0.934, 1.000) * hardBand;
      vec3 glaucousCol = mix(vec3(0.090, 0.138, 0.327), vec3(0.202, 0.297, 0.587), NdotL) + vec3(0.463, 0.554, 0.843) * hardBand;

      vec3 linearColor = weights.x * lilacCol + weights.y * snowCol + weights.z * glaucousCol;

      // Anisotropic luster and fresnel highlight
      vec3 sheenGleam = mix(vec3(0.677, 0.622, 1.0), vec3(0.926, 0.934, 1.0), weights.y);
      linearColor += sheenGleam * fresnel * 0.38;

      // Vignette towards obsidian ground (#0D0C12)
      float rimRadius = length(uv / vec2(aspect * 0.96, 0.96));
      float basinMask = smoothstep(1.15, 0.45, rimRadius);
      vec3 groundLinear = vec3(0.002, 0.002, 0.004);
      linearColor = mix(groundLinear, linearColor, basinMask);

      // Convert to sRGB gamma
      vec3 srgbColor = pow(clamp(linearColor, 0.0, 1.0), vec3(1.0 / 2.2));
      fragColor = vec4(srgbColor, 1.0);
    }
  `;

  const vsSourceWebGL1 = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
      v_uv = (a_position + 1.0) * 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fsSourceWebGL1 = `
    precision highp float;
    varying vec2 v_uv;

    uniform vec2 u_resolution;
    uniform float u_time;
    uniform float u_roughness;
    uniform float u_viscosity;
    uniform vec2 u_stir_pos;
    uniform float u_stir_strength;
    uniform int u_num_pours;
    uniform vec4 u_pours[16];

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    vec2 curl(vec2 p, float t) {
      float n1 = noise(p * 2.5 + vec2(t * 0.15, -t * 0.12));
      float n2 = noise(p * 2.5 + vec2(-t * 0.13, t * 0.16) + 4.5);
      return vec2(n1 - 0.5, n2 - 0.5) * 2.0;
    }

    float getSurfaceHeight(vec2 uv, float t) {
      float h1 = sin(uv.x * 6.0 + t * 0.4) * cos(uv.y * 6.0 - t * 0.35);
      float h2 = sin(uv.x * 12.0 - uv.y * 10.0 + t * 0.7) * 0.45;
      float h3 = noise(uv * 18.0 + t * 0.25) * 0.3;
      return h1 * 0.5 + h2 + h3;
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;
      float aspect = u_resolution.x / u_resolution.y;

      vec2 dStir = uv - u_stir_pos;
      float rStir = length(dStir);
      float swirlAmt = exp(-rStir * 3.5) * u_stir_strength;
      vec2 swirlDir = vec2(-dStir.y, dStir.x);

      vec2 flow1 = curl(uv * 1.8, u_time);
      vec2 flow2 = curl(uv * 3.6 + flow1 * 0.4, u_time * 0.85);
      vec2 warpedUV = uv + (flow1 * 0.18 + flow2 * 0.10) / (u_viscosity * 1.1) + swirlDir * swirlAmt * 0.45;

      float wLilac = 0.01;
      float wSnow = 0.01;
      float wGlaucous = 0.01;
      float totalHeight = 0.0;

      for (int i = 0; i < 16; i++) {
        if (i >= u_num_pours) break;
        vec4 p = u_pours[i];
        vec2 pPos = p.xy;
        float alloyId = p.z;
        float strength = p.w;

        float dist = length(warpedUV - pPos);
        float field = exp(-dist * dist * 4.8) * strength;
        totalHeight += field;

        if (alloyId < 0.5) {
          wLilac += field;
        } else if (alloyId < 1.5) {
          wSnow += field;
        } else {
          wGlaucous += field;
        }
      }

      float sumW = wLilac + wSnow + wGlaucous;
      vec3 weights = vec3(wLilac, wSnow, wGlaucous) / sumW;

      float eps = 0.0035;
      float hCenter = getSurfaceHeight(warpedUV, u_time) + totalHeight * 0.35;
      float hRight = getSurfaceHeight(warpedUV + vec2(eps, 0.0), u_time) + totalHeight * 0.35;
      float hUp = getSurfaceHeight(warpedUV + vec2(0.0, eps), u_time) + totalHeight * 0.35;

      vec3 normal = normalize(vec3(-(hRight - hCenter) / eps * 0.3, -(hUp - hCenter) / eps * 0.3, 1.0));

      vec3 lightDir = normalize(vec3(-0.65, 0.72, 0.85));
      vec3 viewDir = vec3(0.0, 0.0, 1.0);
      vec3 halfDir = normalize(lightDir + viewDir);

      float NdotL = max(dot(normal, lightDir), 0.0);
      float NdotV = max(dot(normal, viewDir), 0.0);
      float NdotH = max(dot(normal, halfDir), 0.0);

      float specPower = mix(128.0, 16.0, u_roughness);
      float spec = pow(NdotH, specPower);
      float hardBand = smoothstep(0.4, 0.95, spec) * 1.4;

      float fresnel = pow(1.0 - NdotV, 3.2);

      vec3 lilacCol = mix(vec3(0.198, 0.160, 0.632), vec3(0.395, 0.337, 0.890), NdotL) + vec3(0.677, 0.622, 1.000) * hardBand;
      vec3 snowCol = mix(vec3(0.428, 0.457, 0.639), vec3(0.720, 0.742, 0.890), NdotL) + vec3(0.926, 0.934, 1.000) * hardBand;
      vec3 glaucousCol = mix(vec3(0.090, 0.138, 0.327), vec3(0.202, 0.297, 0.587), NdotL) + vec3(0.463, 0.554, 0.843) * hardBand;

      vec3 linearColor = weights.x * lilacCol + weights.y * snowCol + weights.z * glaucousCol;
      vec3 sheenGleam = mix(vec3(0.677, 0.622, 1.0), vec3(0.926, 0.934, 1.0), weights.y);
      linearColor += sheenGleam * fresnel * 0.38;

      float rimRadius = length(uv / vec2(aspect * 0.96, 0.96));
      float basinMask = smoothstep(1.15, 0.45, rimRadius);
      vec3 groundLinear = vec3(0.002, 0.002, 0.004);
      linearColor = mix(groundLinear, linearColor, basinMask);

      vec3 srgbColor = pow(clamp(linearColor, 0.0, 1.0), vec3(1.0 / 2.2));
      gl_FragColor = vec4(srgbColor, 1.0);
    }
  `;

  function createShader(glCtx, type, source) {
    const s = glCtx.createShader(type);
    glCtx.shaderSource(s, source);
    glCtx.compileShader(s);
    if (!glCtx.getShaderParameter(s, glCtx.COMPILE_STATUS)) {
      console.warn('Shader compile failed:', glCtx.getShaderInfoLog(s));
      glCtx.deleteShader(s);
      return null;
    }
    return s;
  }

  function createProgram(glCtx, vsSrc, fsSrc) {
    const vs = createShader(glCtx, glCtx.VERTEX_SHADER, vsSrc);
    const fs = createShader(glCtx, glCtx.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;
    const prog = glCtx.createProgram();
    glCtx.attachShader(prog, vs);
    glCtx.attachShader(prog, fs);
    glCtx.linkProgram(prog);
    if (!glCtx.getProgramParameter(prog, glCtx.LINK_STATUS)) {
      console.warn('Program link failed:', glCtx.getProgramInfoLog(prog));
      return null;
    }
    return prog;
  }

  let program = isWebGL2
    ? createProgram(gl, vsSourceWebGL2, fsSourceWebGL2)
    : createProgram(gl, vsSourceWebGL1, fsSourceWebGL1);

  if (!program && isWebGL2) {
    // Retry with WebGL1 shaders
    program = createProgram(gl, vsSourceWebGL1, fsSourceWebGL1);
  }

  if (!program) {
    console.warn('WebGL shader compilation failed. Retaining fallback image.');
    if (fallbackImg) fallbackImg.style.display = 'block';
    if (mixerControls) mixerControls.style.display = 'none';
    return;
  }

  // Reveal canvas and mixer controls now that WebGL is operational
  canvas.classList.remove('hidden');
  if (fallbackImg) {
    fallbackImg.style.opacity = '0';
    setTimeout(() => {
      fallbackImg.style.display = 'none';
    }, 700);
  }
  if (mixerControls) mixerControls.classList.remove('hidden');

  // Full-screen Quad Setup
  const quadBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1.0, -1.0,
     1.0, -1.0,
    -1.0,  1.0,
    -1.0,  1.0,
     1.0, -1.0,
     1.0,  1.0
  ]), gl.STATIC_DRAW);

  const aPositionLoc = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(aPositionLoc);
  gl.vertexAttribPointer(aPositionLoc, 2, gl.FLOAT, false, 0, 0);

  // Uniform Locations
  const uResLoc = gl.getUniformLocation(program, 'u_resolution');
  const uTimeLoc = gl.getUniformLocation(program, 'u_time');
  const uRoughnessLoc = gl.getUniformLocation(program, 'u_roughness');
  const uViscosityLoc = gl.getUniformLocation(program, 'u_viscosity');
  const uStirPosLoc = gl.getUniformLocation(program, 'u_stir_pos');
  const uStirStrLoc = gl.getUniformLocation(program, 'u_stir_strength');
  const uNumPoursLoc = gl.getUniformLocation(program, 'u_num_pours');
  const uPoursLoc = gl.getUniformLocation(program, 'u_pours');

  // --- SIMULATION STATE ---
  // Initial Pours (baseline ratio: Lilac 38%, Snow 42%, Glaucous 20%)
  const INITIAL_POURS = [
    { x: -0.28, y: -0.05, alloyId: 0, strength: 0.95 }, // Lilac
    { x:  0.02, y:  0.10, alloyId: 1, strength: 1.05 }, // Snow
    { x:  0.30, y: -0.08, alloyId: 2, strength: 0.50 }  // Glaucous
  ];

  let pours = JSON.parse(JSON.stringify(INITIAL_POURS));
  let selectedAlloyId = 0; // Default Lilac

  let roughness = 0.04;
  let targetRoughness = 0.04;
  let viscosity = 0.84;

  let stirPos = [0.0, 0.0];
  let stirStrength = 0.0;

  let isStirring = false;
  let lastPointerPos = { x: 0, y: 0, time: 0 };

  // Keyboard navigation cursor (normalized coordinates: -aspect to aspect, -1 to 1)
  let keyboardCursorPos = { x: 0.0, y: 0.0 };

  // --- ADAPTIVE PERFORMANCE ---
  let maxDPR = Math.min(window.devicePixelRatio || 1, 2.0);
  let renderScale = window.innerWidth < 640 ? 0.75 : 1.0;
  let frameTimeSamples = [];
  let isScaleLocked = false;
  let isHeroVisible = true;
  let isTabActive = !document.hidden;

  // Frame timing profiler
  let frameCount = 0;
  let lastFpsTime = performance.now();
  let measuredAvgFrameTime = 16.0;

  function updateHUDReadouts() {
    // 1. Calculate live alloy proportions
    let w0 = 0.001; // Lilac
    let w1 = 0.001; // Snow
    let w2 = 0.001; // Glaucous

    pours.forEach((p) => {
      if (p.alloyId === 0) w0 += p.strength;
      else if (p.alloyId === 1) w1 += p.strength;
      else if (p.alloyId === 2) w2 += p.strength;
    });

    const sum = w0 + w1 + w2;
    const pctL = Math.round((w0 / sum) * 100);
    const pctS = Math.round((w1 / sum) * 100);
    const pctG = Math.max(0, 100 - pctL - pctS);

    // Update drop badges
    if (dropPctLilac) dropPctLilac.textContent = `Lilac ${pctL}%`;
    if (dropPctSnow) dropPctSnow.textContent = `Snow ${pctS}%`;
    if (dropPctGlaucous) dropPctGlaucous.textContent = `Glaucous ${pctG}%`;

    // 2. Viscosity (weighted mean)
    viscosity = (pctL * 0.88 + pctS * 0.80 + pctG * 0.85) / 100;
    if (hudViscosity) {
      hudViscosity.textContent = `${viscosity.toFixed(2)} P`;
    }

    // 3. Roughness
    if (hudRoughness) {
      hudRoughness.textContent = roughness.toFixed(2);
    }

    // 4. Blend Balance (Normalized Shannon Entropy)
    if (hudPurity) {
      const pL = pctL / 100;
      const pS = pctS / 100;
      const pG = pctG / 100;
      let sumPLogP = 0;
      if (pL > 0) sumPLogP += pL * Math.log(pL);
      if (pS > 0) sumPLogP += pS * Math.log(pS);
      if (pG > 0) sumPLogP += pG * Math.log(pG);
      const H = -sumPLogP / Math.log(3);
      const display = (H * 100).toFixed(1) + '%';
      hudPurity.textContent = display;
    }

    return { pctL, pctG, pctS };
  }

  // --- POUR OPERATION ---
  function pourAlloy(normX, normY, alloyId) {
    if (pours.length >= 16) {
      pours.shift(); // Gracefully drop oldest pour
    }

    pours.push({
      x: normX,
      y: normY,
      alloyId: alloyId,
      strength: 1.0
    });

    // Momentary viscosity & roughness disturbance
    targetRoughness = Math.min(0.09, roughness + 0.03);

    const { pctL, pctG, pctS } = updateHUDReadouts();
    const alloyName = ALLOY_INFO[alloyId].name;
    announce(`Poured ${alloyName} alloy. Live composition: Lilac ${pctL}%, Snow ${pctS}%, Glaucous ${pctG}%.`);

    if (isReducedMotion) {
      renderSingleFrame();
    }
  }

  // Convert client (X, Y) to normalized basin coordinates
  function clientToBasinCoords(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const aspect = canvas.width / canvas.height;
    const normX = ((x / rect.width) - 0.5) * aspect;
    const normY = -((y / rect.height) - 0.5); // WebGL Y inverted
    return { normX, normY };
  }

  // --- INTERACTION: DROPS SELECTION & DRAG ---
  dropButtons.forEach((btn) => {
    const alloyId = parseInt(btn.getAttribute('data-alloy-id') || '0', 10);

    // Click: Select alloy
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      selectedAlloyId = alloyId;
      dropButtons.forEach((b) => b.classList.remove('drop-selected'));
      btn.classList.add('drop-selected');
      announce(`Selected ${ALLOY_INFO[alloyId].name} alloy for pouring.`);
    });

    // Keyboard Enter: Pour at basin center
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        selectedAlloyId = alloyId;
        dropButtons.forEach((b) => b.classList.remove('drop-selected'));
        btn.classList.add('drop-selected');
        pourAlloy(0.0, 0.0, alloyId);
      }
    });

    // Drag-and-drop support
    btn.setAttribute('draggable', 'true');
    btn.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', alloyId.toString());
      e.dataTransfer.effectAllowed = 'copy';
      selectedAlloyId = alloyId;
    });
  });

  // Highlight initial selected drop
  if (dropButtons[0]) dropButtons[0].classList.add('drop-selected');

  // Canvas Drag & Drop Listeners
  canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    const rawId = e.dataTransfer.getData('text/plain');
    const alloyId = rawId !== '' ? parseInt(rawId, 10) : selectedAlloyId;
    const { normX, normY } = clientToBasinCoords(e.clientX, e.clientY);
    pourAlloy(normX, normY, alloyId);
  });

  // --- CANVAS POINTER INTERACTIONS (CLICK TO POUR & DRAG TO STIR) ---
  let isPointerDown = false;
  let didMoveSignificantly = false;
  let pointerStartPos = { x: 0, y: 0 };
  canvas.style.touchAction = 'pan-y';

  canvas.addEventListener('pointerdown', (e) => {
    isPointerDown = true;
    didMoveSignificantly = false;
    pointerStartPos = { x: e.clientX, y: e.clientY };
    lastPointerPos = { x: e.clientX, y: e.clientY, time: performance.now() };
  });

  window.addEventListener('pointermove', (e) => {
    if (!isPointerDown) return;

    const dx = e.clientX - lastPointerPos.x;
    const dy = e.clientY - lastPointerPos.y;
    const distFromStart = Math.hypot(e.clientX - pointerStartPos.x, e.clientY - pointerStartPos.y);

    if (distFromStart > 6) {
      didMoveSignificantly = true;
      canvas.style.touchAction = 'none';
    }

    // Add swirl stir momentum
    const now = performance.now();
    const dt = Math.max(1, now - lastPointerPos.time);
    const speed = Math.hypot(dx, dy) / dt;

    if (speed > 0.08) {
      const { normX, normY } = clientToBasinCoords(e.clientX, e.clientY);
      stirPos = [normX, normY];
      stirStrength = Math.min(3.5, stirStrength + speed * 0.4);
      targetRoughness = Math.min(0.08, roughness + 0.015);
    }

    lastPointerPos = { x: e.clientX, y: e.clientY, time: now };
  });

  function handlePointerEnd(e) {
    if (!isPointerDown) return;
    isPointerDown = false;
    canvas.style.touchAction = 'pan-y';

    // If it was a click (not a stir drag), pour the selected alloy!
    if (!didMoveSignificantly) {
      const rect = canvas.getBoundingClientRect();
      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        const { normX, normY } = clientToBasinCoords(e.clientX, e.clientY);
        pourAlloy(normX, normY, selectedAlloyId);
      }
    }
  }

  window.addEventListener('pointerup', handlePointerEnd);
  window.addEventListener('pointercancel', () => {
    isPointerDown = false;
    canvas.style.touchAction = 'pan-y';
  });

  // --- KEYBOARD ACCESSIBILITY ON CANVAS ---
  canvas.addEventListener('focus', () => {
    if (keyboardCursor) {
      keyboardCursor.classList.remove('hidden');
      updateKeyboardCursorUI();
    }
    announce('Basin canvas focused. Use arrow keys to reposition cursor, Space to pour, Escape to exit.');
  });

  canvas.addEventListener('blur', () => {
    if (keyboardCursor) {
      keyboardCursor.classList.add('hidden');
    }
  });

  function updateKeyboardCursorUI() {
    if (!keyboardCursor) return;
    const rect = canvas.getBoundingClientRect();
    const aspect = canvas.width / canvas.height;
    const clientX = (keyboardCursorPos.x / aspect + 0.5) * rect.width;
    const clientY = (-keyboardCursorPos.y + 0.5) * rect.height;

    keyboardCursor.style.transform = `translate(${clientX}px, ${clientY}px)`;
  }

  canvas.addEventListener('keydown', (e) => {
    const step = 0.08;
    const aspect = canvas.width / canvas.height;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      keyboardCursorPos.x = Math.min(aspect * 0.9, keyboardCursorPos.x + step);
      updateKeyboardCursorUI();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      keyboardCursorPos.x = Math.max(-aspect * 0.9, keyboardCursorPos.x - step);
      updateKeyboardCursorUI();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      keyboardCursorPos.y = Math.min(0.9, keyboardCursorPos.y + step);
      updateKeyboardCursorUI();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      keyboardCursorPos.y = Math.max(-0.9, keyboardCursorPos.y - step);
      updateKeyboardCursorUI();
    } else if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      pourAlloy(keyboardCursorPos.x, keyboardCursorPos.y, selectedAlloyId);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      canvas.blur();
      if (dropButtons[selectedAlloyId]) {
        dropButtons[selectedAlloyId].focus();
      }
    }
  });

  // --- RESET BUTTON ---
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      pours = JSON.parse(JSON.stringify(INITIAL_POURS));
      stirStrength = 0.0;
      targetRoughness = 0.04;
      roughness = 0.04;
      updateHUDReadouts();
      announce('Basin reset to initial harmonic formulation.');
      if (isReducedMotion) renderSingleFrame();
    });
  }

  // --- COPY BLEND TOKEN ---
  async function copyBlendToken() {
    const { pctL, pctG, pctS } = updateHUDReadouts();

    // Build gradient stops from DESIGN.md hexes ordered by live percentage weights
    // Lilac: #7B6FD0, #A89CF2, #D6CEFF
    // Glaucous: #55689A, #7C93C9, #B4C4EC
    // Snow: #AEB3D1, #DCDFF2, #F6F7FF

    const snippet = `:root {\n  --finish-blend-l${pctL}-g${pctG}-s${pctS}: linear-gradient(135deg, #7B6FD0 0%, #A89CF2 ${Math.round(pctL * 0.5)}%, #D6CEFF ${pctL}%, #55689A ${pctL + Math.round(pctG * 0.3)}%, #7C93C9 ${pctL + Math.round(pctG * 0.7)}%, #B4C4EC ${pctL + pctG}%, #AEB3D1 ${pctL + pctG + Math.round(pctS * 0.4)}%, #DCDFF2 ${pctL + pctG + Math.round(pctS * 0.8)}%, #F6F7FF 100%);\n}`;

    let copied = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(snippet);
        copied = true;
      } catch (err) {}
    }

    if (!copied) {
      const ta = document.createElement('textarea');
      ta.value = snippet;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        copied = true;
      } catch (e) {}
      document.body.removeChild(ta);
    }

    if (copyBlendBtn) {
      const origText = copyBlendBtn.innerHTML;
      copyBlendBtn.textContent = 'COPIED';
      copyBlendBtn.classList.add('bg-primary', 'text-on-primary');
      announce(`Copied blend token l${pctL}-g${pctG}-s${pctS}`);
      setTimeout(() => {
        copyBlendBtn.innerHTML = origText;
        copyBlendBtn.classList.remove('bg-primary', 'text-on-primary');
      }, 1600);
    }
  }

  if (copyBlendBtn) {
    copyBlendBtn.addEventListener('click', copyBlendToken);
  }

  // --- MOBILE KEBAB MENU (<768px) ---
  const kebabBtn = document.getElementById('mixer-kebab-btn');
  const kebabDropdown = document.getElementById('mixer-mobile-dropdown');
  const mobileResetBtn = document.getElementById('mobile-mixer-reset-btn');
  const mobileCopyBtn = document.getElementById('mobile-mixer-copy-btn');

  function closeKebabMenu() {
    if (!kebabDropdown) return;
    kebabDropdown.classList.add('hidden');
    kebabDropdown.classList.remove('flex');
    if (kebabBtn) kebabBtn.setAttribute('aria-expanded', 'false');
  }

  function openKebabMenu() {
    if (!kebabDropdown) return;
    kebabDropdown.classList.remove('hidden');
    kebabDropdown.classList.add('flex');
    if (kebabBtn) kebabBtn.setAttribute('aria-expanded', 'true');
  }

  if (kebabBtn && kebabDropdown) {
    kebabBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !kebabDropdown.classList.contains('hidden');
      if (isOpen) {
        closeKebabMenu();
      } else {
        openKebabMenu();
      }
    });

    if (mobileResetBtn) {
      mobileResetBtn.addEventListener('click', () => {
        closeKebabMenu();
        if (resetBtn) resetBtn.click();
      });
    }

    if (mobileCopyBtn) {
      mobileCopyBtn.addEventListener('click', () => {
        closeKebabMenu();
        if (copyBlendBtn) copyBlendBtn.click();
      });
    }

    document.addEventListener('click', (e) => {
      if (!kebabDropdown.classList.contains('hidden') && !kebabDropdown.contains(e.target) && !kebabBtn.contains(e.target)) {
        closeKebabMenu();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !kebabDropdown.classList.contains('hidden')) {
        e.stopPropagation();
        closeKebabMenu();
        kebabBtn.focus();
      }
    });
  }

  // --- RESIZE & DPR HANDLING ---
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(300, Math.floor(rect.width * maxDPR * renderScale));
    const height = Math.max(168, Math.floor(rect.height * maxDPR * renderScale));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      if (isReducedMotion) renderSingleFrame();
    }
  }

  const resizeObserver = new ResizeObserver(() => {
    resizeCanvas();
  });
  resizeObserver.observe(canvas);
  resizeCanvas();

  // --- VISIBILITY MONITORING ---
  const heroSection = document.getElementById('material-engine');
  if (heroSection) {
    const visibilityObserver = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        isHeroVisible = e.isIntersecting;
      });
    }, { threshold: 0.05 });
    visibilityObserver.observe(heroSection);
  }

  document.addEventListener('visibilitychange', () => {
    isTabActive = !document.hidden;
  });

  // --- CONTEXT LOSS & RESTORATION ---
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    console.warn('WebGL context lost. Pausing renderer and restoring visual fallback.');
    if (fallbackImg) fallbackImg.style.display = 'block';
  });

  canvas.addEventListener('webglcontextrestored', () => {
    console.info('WebGL context restored. Recompiling shader program.');
    program = isWebGL2
      ? createProgram(gl, vsSourceWebGL2, fsSourceWebGL2)
      : createProgram(gl, vsSourceWebGL1, fsSourceWebGL1);
    resizeCanvas();
    if (fallbackImg) fallbackImg.style.display = 'none';
  });

  // --- MAIN RENDER LOOP ---
  let simTime = 0.0;
  let lastFrameTime = performance.now();

  function uploadUniforms(currentTime) {
    gl.useProgram(program);
    gl.uniform2f(uResLoc, canvas.width, canvas.height);
    gl.uniform1f(uTimeLoc, simTime);
    gl.uniform1f(uRoughnessLoc, roughness);
    gl.uniform1f(uViscosityLoc, viscosity);
    gl.uniform2f(uStirPosLoc, stirPos[0], stirPos[1]);
    gl.uniform1f(uStirStrLoc, stirStrength);

    // Pack pours into flat array
    const pourData = new Float32Array(64);
    for (let i = 0; i < 16; i++) {
      if (i < pours.length) {
        pourData[i * 4 + 0] = pours[i].x;
        pourData[i * 4 + 1] = pours[i].y;
        pourData[i * 4 + 2] = pours[i].alloyId;
        pourData[i * 4 + 3] = pours[i].strength;
      } else {
        pourData[i * 4 + 0] = 0.0;
        pourData[i * 4 + 1] = 0.0;
        pourData[i * 4 + 2] = 0.0;
        pourData[i * 4 + 3] = 0.0;
      }
    }

    gl.uniform1i(uNumPoursLoc, Math.min(16, pours.length));
    gl.uniform4fv(uPoursLoc, pourData);
  }

  function renderSingleFrame() {
    uploadUniforms(performance.now());
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function frameLoop(now) {
    requestAnimationFrame(frameLoop);

    if (!isHeroVisible || !isTabActive) {
      lastFrameTime = now;
      return;
    }

    const dt = Math.min(100, now - lastFrameTime);
    lastFrameTime = now;

    // Adaptive Quality Monitoring
    frameTimeSamples.push(dt);
    if (frameTimeSamples.length > 120) {
      frameTimeSamples.shift();
      if (!isScaleLocked) {
        const avg = frameTimeSamples.reduce((a, b) => a + b, 0) / frameTimeSamples.length;
        measuredAvgFrameTime = avg;
        if (avg > 24.0) {
          // Frame budget exceeded (> 24ms for ~2s): Step down resolution scale
          renderScale = Math.max(0.5, renderScale * 0.75);
          isScaleLocked = true; // Never step back up in the same session
          resizeCanvas();
        }
      }
    }

    // Reduced motion: Pause time evolution
    if (!isReducedMotion) {
      simTime += (dt * 0.001) / (viscosity * 1.2);
    }

    // Dynamic parameter damping
    roughness += (targetRoughness - roughness) * 0.04;
    targetRoughness += (0.04 - targetRoughness) * 0.02;
    stirStrength *= 0.96; // exponential decay of stir momentum

    // Draw
    renderSingleFrame();
  }

  // Initialize
  updateHUDReadouts();
  requestAnimationFrame(frameLoop);

  // Expose profiler for verification
  window.__metaluneMixer = {
    getFPS: () => (1000 / measuredAvgFrameTime).toFixed(1),
    getAvgFrameTime: () => measuredAvgFrameTime.toFixed(2),
    getRenderScale: () => renderScale,
    getPoursCount: () => pours.length,
    pour: pourAlloy,
    reset: () => resetBtn && resetBtn.click(),
    copyToken: copyBlendToken
  };
})();
