export interface CaptureAttempt {
  discardIfStale: (dispose: () => void) => boolean
  isCurrent: () => boolean
}

export class CaptureAttemptGuard {
  private generation = 0

  begin(isContextCurrent: () => boolean): CaptureAttempt {
    const generation = ++this.generation
    const isCurrent = () => generation === this.generation && isContextCurrent()
    return {
      discardIfStale: (dispose) => {
        if (isCurrent()) return false
        dispose()
        return true
      },
      isCurrent,
    }
  }

  invalidate(): void {
    this.generation += 1
  }
}
