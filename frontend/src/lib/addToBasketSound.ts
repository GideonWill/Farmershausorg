let audioContext: AudioContext | null = null

export function prepareAddToBasketSound() {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return
  audioContext ??= new AudioContext()
  if (audioContext.state === 'suspended') {
    void audioContext.resume().catch((error: unknown) => {
      console.warn('Could not enable the add-to-basket sound.', error)
    })
  }
}

export function playAddToBasketSound() {
  const context = audioContext
  if (!context) return

  const play = () => {
    if (context.state !== 'running') return
    const now = context.currentTime
    const notes = [660, 880]
    notes.forEach((frequency, index) => {
      const start = now + index * 0.08
      const oscillator = context.createOscillator()
      const volume = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(frequency, start)
      volume.gain.setValueAtTime(0.0001, start)
      volume.gain.exponentialRampToValueAtTime(0.12, start + 0.015)
      volume.gain.exponentialRampToValueAtTime(0.0001, start + 0.16)
      oscillator.connect(volume)
      volume.connect(context.destination)
      oscillator.start(start)
      oscillator.stop(start + 0.17)
    })
  }

  if (context.state === 'suspended') {
    void context.resume().then(play).catch((error: unknown) => {
      console.warn('Could not play the add-to-basket sound.', error)
    })
    return
  }
  play()
}
