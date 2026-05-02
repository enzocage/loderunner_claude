/**
 * WebGL2 CRT post-process pipeline.
 * Renders the game canvas as a texture through a fullscreen-quad GLSL shader.
 * Effects (in order): barrel distortion → chromatic aberration → scanlines →
 * vignette → colour grade → noise grain → phosphor persistence.
 */

const VS = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main(){
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision mediump float;
in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_game;
uniform sampler2D u_prev;
uniform float u_time;
uniform float u_scanAlpha;
uniform float u_barrelK;
uniform float u_caStrength;
uniform float u_grainAmt;
uniform float u_persistBlend;
uniform vec3  u_tint;

vec2 barrel(vec2 uv){
  vec2 p = uv * 2.0 - 1.0;
  float r2 = dot(p, p);
  p *= 1.0 + u_barrelK * r2;
  return p * 0.5 + 0.5;
}

float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }

void main(){
  vec2 uv = barrel(v_uv);
  if(uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0){
    fragColor = vec4(0.0,0.0,0.0,1.0);
    return;
  }

  // Chromatic aberration
  float ca = u_caStrength;
  float r = texture(u_game, uv + vec2( ca, 0.0)).r;
  float g = texture(u_game, uv).g;
  float b = texture(u_game, uv - vec2( ca, 0.0)).b;
  vec3 col = vec3(r, g, b);

  // Scanlines
  float scan = sin(uv.y * 400.0 * 3.14159) * 0.5 + 0.5;
  col *= mix(1.0 - u_scanAlpha, 1.0, scan);

  // Vignette
  vec2 vig = (uv - 0.5) * 2.0;
  float vign = 1.0 - dot(vig, vig) * 0.18;
  col *= clamp(vign, 0.0, 1.0);

  // Colour grade (tint)
  col *= u_tint;

  // Noise grain
  float noise = hash(uv + fract(u_time * 0.1)) * u_grainAmt;
  col += noise;

  // Phosphor persistence
  vec3 prev = texture(u_prev, v_uv).rgb;
  col = mix(col, max(col, prev * 0.92), u_persistBlend);

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

// CRT presets
const PRESETS = {
  amber: { tint:[1.1, 0.82, 0.2],  scanAlpha:0.18, barrel:0.06, ca:0.003, grain:0.025, persist:0.18 },
  green: { tint:[0.2, 1.1, 0.25],  scanAlpha:0.20, barrel:0.07, ca:0.002, grain:0.020, persist:0.22 },
  cold:  { tint:[0.75, 0.88, 1.1], scanAlpha:0.14, barrel:0.05, ca:0.004, grain:0.018, persist:0.15 },
  off:   { tint:[1.0, 1.0, 1.0],   scanAlpha:0.0,  barrel:0.0,  ca:0.0,   grain:0.0,   persist:0.0  },
};

export default class WebGLPostProcess {
  constructor(crtCanvas, gameCanvas) {
    this._crtCanvas  = crtCanvas;
    this._gameCanvas = gameCanvas;
    this._gl = null;
    this._prog = null;
    this._locs = {};
    this._gameTex = null;
    this._prevTex = null;
    this._prevFBO = null;
    this._frame = 0;
    this._preset = PRESETS.amber;
    this._enabled = true;
    this._ok = false;

    this._init();
  }

  _init() {
    const gl = this._crtCanvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) { console.warn('WebGL2 not available; CRT disabled.'); return; }
    this._gl = gl;

    // Compile shaders
    const vert = this._compile(gl.VERTEX_SHADER,   VS);
    const frag = this._compile(gl.FRAGMENT_SHADER, FS);
    if (!vert || !frag) return;

    const prog = gl.createProgram();
    gl.attachShader(prog, vert); gl.attachShader(prog, frag);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('WebGL link error:', gl.getProgramInfoLog(prog)); return;
    }
    this._prog = prog;

    // Fullscreen quad
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const aPos = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    this._vao = vao;

    // Uniform locations
    const u = (n) => gl.getUniformLocation(prog, n);
    this._locs = {
      game: u('u_game'), prev: u('u_prev'), time: u('u_time'),
      scanAlpha: u('u_scanAlpha'), barrelK: u('u_barrelK'),
      caStrength: u('u_caStrength'), grainAmt: u('u_grainAmt'),
      persistBlend: u('u_persistBlend'), tint: u('u_tint'),
    };

    // Game texture (updated each frame from the 2D game canvas)
    this._gameTex = this._makeTexture();

    // Persistence: previous-frame texture + FBO
    const [pw, ph] = [this._crtCanvas.width, this._crtCanvas.height];
    this._prevTex = this._makeTexture(pw, ph);
    this._prevFBO = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._prevFBO);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this._prevTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    this._ok = true;
  }

  _compile(type, src) {
    const gl = this._gl;
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(sh)); return null;
    }
    return sh;
  }

  _makeTexture(w = this._gameCanvas.width, h = this._gameCanvas.height) {
    const gl = this._gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return tex;
  }

  setPreset(name) {
    this._preset = PRESETS[name] || PRESETS.amber;
  }

  get enabled() { return this._enabled; }
  set enabled(v) { this._enabled = v; }
  get ok() { return this._ok; }

  /**
   * Call after the game has drawn to this._gameCanvas.
   * Renders the WebGL post-process to this._crtCanvas.
   */
  render() {
    if (!this._ok) return;
    const gl = this._gl;
    const p  = this._preset;

    // Upload game canvas to GPU texture
    gl.bindTexture(gl.TEXTURE_2D, this._gameTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._gameCanvas);

    // === Pass 1: render scene → crtCanvas (default FBO) ===
    const [cw, ch] = [this._crtCanvas.width, this._crtCanvas.height];
    gl.viewport(0, 0, cw, ch);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(this._prog);
    gl.bindVertexArray(this._vao);

    gl.uniform1f(this._locs.time,         this._frame * 0.016);
    gl.uniform1f(this._locs.scanAlpha,    this._enabled ? p.scanAlpha   : 0);
    gl.uniform1f(this._locs.barrelK,      this._enabled ? p.barrel      : 0);
    gl.uniform1f(this._locs.caStrength,   this._enabled ? p.ca          : 0);
    gl.uniform1f(this._locs.grainAmt,     this._enabled ? p.grain       : 0);
    gl.uniform1f(this._locs.persistBlend, this._enabled ? p.persist     : 0);
    gl.uniform3fv(this._locs.tint,        this._enabled ? p.tint        : [1,1,1]);

    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this._gameTex);
    gl.uniform1i(this._locs.game, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this._prevTex);
    gl.uniform1i(this._locs.prev, 1);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // === Pass 2: copy result into prevFBO for next frame's persistence ===
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this._prevFBO);
    gl.blitFramebuffer(0, 0, cw, ch, 0, 0, cw, ch, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    this._frame++;
  }

  resize(w, h) {
    if (!this._ok) return;
    const gl = this._gl;
    this._crtCanvas.width  = w;
    this._crtCanvas.height = h;
    gl.viewport(0, 0, w, h);
    // Recreate persistence FBO at new size
    gl.deleteTexture(this._prevTex);
    gl.deleteFramebuffer(this._prevFBO);
    this._prevTex = this._makeTexture(w, h);
    this._prevFBO = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._prevFBO);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this._prevTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
}
