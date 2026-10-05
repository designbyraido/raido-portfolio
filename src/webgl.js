// three r163+ only supports WebGL2, so a WebGL1-only browser counts as unsupported.
// Add ?nowebgl to the URL to preview the fallback experience.
function detectWebGL2() {
  if (new URLSearchParams(window.location.search).has('nowebgl')) return false
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    if (!gl) return false
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}

export const hasWebGL = detectWebGL2()
