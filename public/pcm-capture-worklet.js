/* global AudioWorkletProcessor, registerProcessor, sampleRate */

class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.active = true
    this.accumulator = 0
    this.samples = []
    this.port.onmessage = (event) => {
      if (event.data === 'pause') this.active = false
      if (event.data === 'resume') this.active = true
      if (event.data === 'reset') {
        this.accumulator = 0
        this.samples = []
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
      if (this.samples.length === 480) {
        const pcm = new Int16Array(this.samples)
        this.samples = []
        this.port.postMessage(pcm.buffer, [pcm.buffer])
      }
    }
    return true
  }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor)
