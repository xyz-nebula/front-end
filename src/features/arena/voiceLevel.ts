const SILENCE_RMS = 0.00001
const INITIAL_NOISE_FLOOR_DB = -60
const MAX_NOISE_FLOOR_DB = -30
const GATE_OFFSET_DB = 6
const FULL_VOICE_DB = -12

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export class AdaptiveVoiceLevel {
  private noiseFloorDb = INITIAL_NOISE_FLOOR_DB

  push(rms: number): number {
    if (!Number.isFinite(rms) || rms <= SILENCE_RMS) return 0

    const decibels = 20 * Math.log10(clamp(rms, SILENCE_RMS, 1))
    if (decibels < -18) {
      const targetFloor = Math.min(decibels, MAX_NOISE_FLOOR_DB)
      const adaptation = targetFloor > this.noiseFloorDb ? 0.04 : 0.08
      this.noiseFloorDb += (targetFloor - this.noiseFloorDb) * adaptation
    }

    const gateDb = Math.min(this.noiseFloorDb + GATE_OFFSET_DB, -24)
    if (decibels <= gateDb) return 0

    const linearLevel = clamp((decibels - gateDb) / (FULL_VOICE_DB - gateDb), 0, 1)
    return Math.pow(linearLevel, 0.72)
  }

  reset(): void {
    this.noiseFloorDb = INITIAL_NOISE_FLOOR_DB
  }
}
