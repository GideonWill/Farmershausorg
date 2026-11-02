import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const SPLASH_LETTERS = [
  { char: 'F', src: '/brand/splash/letter-0-f.png', width: 96, produce: 'Crisp Lettuce' },
  { char: 'A', src: '/brand/splash/letter-1-a.png', width: 89, produce: 'Fresh Orange' },
  { char: 'R', src: '/brand/splash/letter-2-r.png', width: 92, produce: 'Red Apple' },
  { char: 'M', src: '/brand/splash/letter-3-m.png', width: 121, produce: 'Green Collards' },
  { char: 'E', src: '/brand/splash/letter-4-e.png', width: 80, produce: 'Ripe Bananas' },
  { char: 'R', src: '/brand/splash/letter-5-r.png', width: 92, produce: 'Vine Tomatoes' },
  { char: 'S', src: '/brand/splash/letter-6-s.png', width: 82, produce: 'Bell Pepper' },
  { char: 'H', src: '/brand/splash/letter-7-h.png', width: 101, produce: 'Sweet Corn' },
  { char: 'A', src: '/brand/splash/letter-8-a.png', width: 88, produce: 'Garden Greens' },
  { char: 'U', src: '/brand/splash/letter-9-u.png', width: 92, produce: 'Blueberries' },
  { char: 'S', src: '/brand/splash/letter-10-s.png', width: 91, produce: 'Yellow Lemons' },
] as const

const TOTAL_LETTERS = SPLASH_LETTERS.length
const TOTAL_WIDTH = 1024

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [typedCount, setTypedCount] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? TOTAL_LETTERS
      : 0,
  )
  const [isFinishing, setIsFinishing] = useState(false)
  const [visible, setVisible] = useState(true)
  const timerRef = useRef<number | null>(null)
  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  const finishSplash = useCallback(() => {
    try {
      sessionStorage.setItem('farmershaus:splash-seen', 'true')
    } catch {
      // ignore
    }
    setVisible(false)
    setTimeout(() => {
      onCompleteRef.current()
    }, 280)
  }, [])

  // Typing progression effect
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const timeout = window.setTimeout(() => finishSplash(), 800)
      return () => window.clearTimeout(timeout)
    }

    const typeNextLetter = (currentIndex: number) => {
      if (currentIndex < TOTAL_LETTERS) {
        setTypedCount(currentIndex + 1)
        const variableDelay = 35 + (currentIndex % 3) * 8
        timerRef.current = window.setTimeout(() => {
          typeNextLetter(currentIndex + 1)
        }, variableDelay)
      } else {
        timerRef.current = window.setTimeout(() => {
          setIsFinishing(true)
          timerRef.current = window.setTimeout(() => {
            finishSplash()
          }, 450)
        }, 220)
      }
    }

    const initialDelay = window.setTimeout(() => {
      typeNextLetter(0)
    }, 80)

    return () => {
      window.clearTimeout(initialDelay)
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [finishSplash])

  // Keyboard shortcut (Escape, Space, Enter) to skip
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === ' ' || event.key === 'Enter') {
        finishSplash()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [finishSplash])

  const typedWidth = SPLASH_LETTERS.slice(0, typedCount).reduce((sum, letter) => sum + letter.width, 0)
  const caretLeftPercent = (typedWidth / TOTAL_WIDTH) * 100

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          role="status"
          aria-live="polite"
          aria-label="FarmersHaus loading splashscreen"
          className="farmershaus-splash fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-brand-cream select-none"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.03 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          onClick={finishSplash}
        >
          {/* Immediate Skip Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              finishSplash()
            }}
            className="absolute top-5 right-5 z-30 inline-flex items-center gap-1.5 rounded-full border border-brand-green/20 bg-white/90 px-4 py-1.5 text-xs font-bold text-brand-green shadow-xs backdrop-blur-xs transition hover:bg-white active:scale-95 cursor-pointer"
          >
            <span>Skip to store</span> &rarr;
          </button>
          <div className="farmershaus-splash__glow pointer-events-none absolute inset-0 -z-10" />

          {/* Central Logo Construction */}
          <div className="relative mx-auto flex w-full max-w-[94vw] flex-col items-center px-4 sm:max-w-2xl md:max-w-3xl lg:max-w-4xl">
            {/* Produce letters typing container */}
            <div
              className="relative w-full"
              style={{
                aspectRatio: '1024 / 342',
              }}
            >
              <div className="flex h-full w-full items-center justify-between">
                {SPLASH_LETTERS.map((letter, index) => {
                  const isTyped = index < typedCount
                  const isJustTyped = index === typedCount - 1
                  const widthPercent = (letter.width / TOTAL_WIDTH) * 100

                  return (
                    <div
                      key={index}
                      className="relative h-full flex-shrink-0"
                      style={{ width: `${widthPercent}%` }}
                    >
                      <AnimatePresence>
                        {isTyped && (
                          <motion.img
                            src={letter.src}
                            alt={letter.produce}
                            className="h-full w-full object-contain"
                            initial={{
                              opacity: 0,
                              scale: 0.72,
                              y: 12,
                            }}
                            animate={{
                              opacity: 1,
                              scale: 1,
                              y: 0,
                            }}
                            transition={{
                              type: 'spring',
                              stiffness: 450,
                              damping: 24,
                              mass: 0.8,
                            }}
                          />
                        )}
                      </AnimatePresence>
                      {isJustTyped && !isFinishing && (
                        <motion.span
                          className="pointer-events-none absolute inset-0 rounded-lg bg-brand-yellow/30"
                          initial={{ opacity: 0.65, scale: 1.15 }}
                          animate={{ opacity: 0, scale: 1 }}
                          transition={{ duration: 0.28 }}
                        />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Typing Caret / Cursor */}
              {!isFinishing && typedCount < TOTAL_LETTERS && (
                <motion.div
                  className="farmershaus-splash__caret pointer-events-none absolute top-1/2 -translate-y-1/2"
                  style={{ left: `${caretLeftPercent}%` }}
                  initial={{ opacity: 1 }}
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{
                    repeat: Infinity,
                    duration: 0.65,
                    ease: 'linear',
                  }}
                >
                  <span className="block h-[58%] min-h-[32px] w-[3px] rounded-full bg-brand-green shadow-xs sm:w-[4px]" />
                </motion.div>
              )}

              {/* Shimmer sweep effect when all letters are finished typing */}
              {isFinishing && (
                <motion.div
                  className="farmershaus-splash__shimmer pointer-events-none absolute inset-0 overflow-hidden"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <motion.div
                    className="h-full w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                    initial={{ x: '-100%' }}
                    animate={{ x: '400%' }}
                    transition={{ duration: 0.75, ease: 'easeInOut' }}
                  />
                </motion.div>
              )}
            </div>

            {/* Tagline reveals underneath */}
            <div className="mt-6 flex flex-col items-center sm:mt-8">
              <motion.div
                className="flex items-center gap-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{
                  opacity: typedCount >= 6 ? 1 : 0,
                  y: typedCount >= 6 ? 0 : 10,
                }}
                transition={{ duration: 0.4 }}
              >
                <span className="h-px w-6 bg-brand-green/30 sm:w-10" />
                <p className="font-brand-subheading text-xs font-bold tracking-[0.24em] text-brand-green sm:text-sm md:text-base uppercase">
                  Everyday Fruits &amp; Veggies
                </p>
                <span className="h-px w-6 bg-brand-green/30 sm:w-10" />
              </motion.div>

              <motion.p
                className="mt-2 text-[11px] font-medium tracking-wide text-brand-ink/55 sm:text-xs"
                initial={{ opacity: 0 }}
                animate={{
                  opacity: typedCount === TOTAL_LETTERS ? 1 : 0,
                }}
                transition={{ duration: 0.45, delay: 0.15 }}
              >
                Fresh from our local farmers to your home
              </motion.p>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
