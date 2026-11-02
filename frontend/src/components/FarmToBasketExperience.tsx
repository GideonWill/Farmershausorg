import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import farmToBasketVideo from '../assets/Farmers_harvesting_and_washing_p…_796fecb2.mp4'
import { Icon } from './ui'

type VideoState = 'loading' | 'playing' | 'paused' | 'error'

export function FarmToBasketExperience() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoState, setVideoState] = useState<VideoState>('loading')
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleMotionPreferenceChange = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches)
    motionPreference.addEventListener('change', handleMotionPreferenceChange)
    return () => motionPreference.removeEventListener('change', handleMotionPreferenceChange)
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const startPlayback = () => {
      if (prefersReducedMotion) {
        video.pause()
        setVideoState('paused')
        return
      }
      video.muted = true
      void video.play().catch(() => {
        setVideoState('paused')
      })
    }

    const handleReady = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        setVideoState('error')
        return
      }
      setVideoState('playing')
    }
    const handlePlaying = () => setVideoState('playing')
    const handlePause = () => {
      if (!video.ended) setVideoState('paused')
    }
    const handleError = () => setVideoState('error')

    video.addEventListener('loadeddata', handleReady)
    video.addEventListener('playing', handlePlaying)
    video.addEventListener('pause', handlePause)
    video.addEventListener('error', handleError)

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) handleReady()

    // IntersectionObserver to pause when off-screen and play when visible
    let observer: IntersectionObserver | null = null
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting && !prefersReducedMotion) {
              startPlayback()
            } else {
              video.pause()
              setVideoState('paused')
            }
          }
        },
        { threshold: 0.15 }
      )
      observer.observe(video)
    } else {
      startPlayback()
    }

    return () => {
      if (observer) observer.disconnect()
      video.removeEventListener('loadeddata', handleReady)
      video.removeEventListener('playing', handlePlaying)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('error', handleError)
      video.pause()
    }
  }, [prefersReducedMotion])

  function playVideo() {
    const video = videoRef.current
    if (!video) return
    video.muted = true
    void video.play().catch(() => setVideoState('paused'))
  }

  return (
    <section
      className="farm-to-basket relative isolate overflow-hidden"
      aria-label="Farm to basket freshness story"
      aria-busy={videoState === 'loading'}
      data-video-state={videoState}
    >
      <div className="farm-to-basket__media">
        <video
          ref={videoRef}
          className="farm-to-basket__video"
          src={farmToBasketVideo}
          autoPlay={!prefersReducedMotion}
          loop
          muted
          playsInline
          preload="metadata"
          disablePictureInPicture
          aria-label="Farmers harvesting and washing produce before it is packed into a basket"
        />
      </div>
      {videoState === 'loading' && (
        <div className="farm-to-basket__loading" role="status">
          <span className="farm-to-basket__loading-mark" aria-hidden="true">FH</span>
          <span>Preparing the freshness story…</span>
        </div>
      )}
      {videoState === 'error' && (
        <div className="farm-to-basket__error" role="status">
          <p>The farm-to-basket video could not be loaded.</p>
          <Link className="button button-yellow" to="/shop">Shop fresh produce <Icon name="arrow" /></Link>
        </div>
      )}
      <div className="farm-to-basket__scrim" aria-hidden="true" />
      <div className="farm-to-basket__intro">
        <p className="farm-to-basket__eyebrow">From the people who grow it</p>
        <h1>FROM FARM<br />TO BASKET</h1>
        <p className="farm-to-basket__support">Discover the journey of freshness.</p>
        <Link className="button button-yellow farm-to-basket__cta" to="/shop">
          SHOP FRESH PRODUCE <Icon name="arrow" />
        </Link>
      </div>
      {videoState === 'paused' && (
        <button className="farm-to-basket__play" onClick={playVideo}>
          <span aria-hidden="true">▶</span>
          Play the freshness story
        </button>
      )}
    </section>
  )
}
