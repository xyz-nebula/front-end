/* global AudioWorkletProcessor, registerProcessor, sampleRate */

class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.active = true
    this.accumulator = 0
    this.samples = []
    this.sumSquares = 0
    this.port.onmessage = (event) => {
      if (event.data === 'pause') this.active = false
      if (event.data === 'resume') this.active = true
      if (event.data === 'reset') {
        this.accumulator = 0
        this.samples = []
        this.sumSquares = 0
      }
    }
  }

  process(inputs) {
    if (!this.active) return true
    const channel = inputs[0]?.[0]
    if (!channel) return true

    for (let index = 0; index < channel.length; index += 1) {
      this.accumulator += 24000
      if (this.accumulator < sampleRate) continue
      this.accumulator -= sampleRate
      const value = Math.max(-1, Math.min(1, channel[index]))
      this.samples.push(value < 0 ? Math.round(value * 32768) : Math.round(value * 32767))
      this.sumSquares += value * value
      if (this.samples.length === 480) {
        const pcm = new Int16Array(this.samples)
        const rms = Math.sqrt(this.sumSquares / this.samples.length)
        this.samples = []
        this.sumSquares = 0
        this.port.postMessage({ buffer: pcm.buffer, rms }, [pcm.buffer])
      }
    }
    return true
  }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor)
