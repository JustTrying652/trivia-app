let audioCtx = null
let muted = false

function getContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  return audioCtx
}

function tone(freq, duration, { type = 'sine', gain = 0.15, delay = 0 } = {}) {
  if (muted) return
  const ctx = getContext()
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  osc.connect(g)
  g.connect(ctx.destination)

  const start = ctx.currentTime + delay
  g.gain.setValueAtTime(gain, start)
  g.gain.exponentialRampToValueAtTime(0.001, start + duration)

  osc.start(start)
  osc.stop(start + duration)
}

export function playTick() {
  tone(880, 0.06, { type: 'square', gain: 0.06 })
}

export function playCorrect() {
  tone(523.25, 0.12)              // C5
  tone(783.99, 0.18, { delay: 0.1 })  // G5
}

export function playIncorrect() {
  tone(160, 0.3, { type: 'sawtooth', gain: 0.1 })
}

export function playRoundStart() {
  tone(392, 0.08, { delay: 0 })     // G4
  tone(523.25, 0.08, { delay: 0.08 }) // C5
  tone(659.25, 0.15, { delay: 0.16 }) // E5
}

export function setMuted(value) {
  muted = value
}

export function isMuted() {
  return muted
}