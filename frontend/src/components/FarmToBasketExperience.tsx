import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from './ui'

const farmToBasketVideo = '/videos/farm-to-basket.mp4'
// Exact 720p first frame exported directly from the hero video
const HERO_POSTER = '/videos/farm-to-basket-poster.webp'

/** Detect users who have requested reduced data usage or are on a slow connection. */
function shouldSkipVideo(): boolean {
  if (typeof navigator === 'undefined') return false
  // Respect Save-Data header / OS data saver setting
  const conn = (navigator as any).connection ?? (navigator as any).mozConnection ?? (navigator as any).webkitConnection
  if (conn) {
    if (conn.saveData) return true
    // Skip autoplay on slow 2G / 3G if effectiveType is available
    if (conn.effectiveType && (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g')) return true
  }
  return false
}

export function FarmToBasketExperience() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoLoaded, setVideoLoaded] = useState(false)
  const skipVideo = shouldSkipVideo()

  useEffect(() => {
    if (skipVideo) return
    const video = videoRef.current
    if (!video) return

    // Explicit iOS WebKit & Android mobile looping autoplay requirements
    video.muted = true
    video.defaultMuted = true
    video.playsInline = true
    video.loop = true
    video.setAttribute('muted', '')
    video.setAttribute('playsinline', '')
    video.setAttribute('webkit-playsinline', '')
    video.setAttribute('autoplay', '')

    const tryPlay = () => {
      video.muted = true
      const playPromise = video.play()
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setVideoLoaded(true)
          })
          .catch(() => {
            // Handled by touch interaction fallback
          })
      }
    }

    tryPlay()

    const handleReady = () => {
      setVideoLoaded(true)
      tryPlay()
    }

    video.addEventListener('loadeddata', handleReady)
    video.addEventListener('canplay', handleReady)
    video.addEventListener('playing', () => setVideoLoaded(true))

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      handleReady()
    }

    // Mobile gesture fallback (guarantees playback on first touch/scroll if iOS Low Power Mode was active)
    const onGesture = () => {
      if (video.paused) {
        tryPlay()
      }
    }
    window.addEventListener('touchstart', onGesture, { once: true, passive: true })
    window.addEventListener('click', onGesture, { once: true, passive: true })
    window.addEventListener('scroll', onGesture, { once: true, passive: true })

    // Pause when off-screen to save CPU/GPU, resume when visible
    let observer: IntersectionObserver | null = null
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              tryPlay()
            } else {
              video.pause()
            }
          }
        },
        { threshold: 0.05 }
      )
      observer.observe(video)
    }

    return () => {
      if (observer) observer.disconnect()
      video.removeEventListener('loadeddata', handleReady)
      video.removeEventListener('canplay', handleReady)
      window.removeEventListener('touchstart', onGesture)
      window.removeEventListener('click', onGesture)
      window.removeEventListener('scroll', onGesture)
    }
  }, [skipVideo])

  return (
    <section
      className="farm-to-basket relative isolate overflow-hidden"
      aria-label="Farm to basket freshness story"
    >
      <div className="farm-to-basket__media">
        {skipVideo ? (
          /* On Save-Data / slow connections show only the poster — no video download at all */
          <img
            className="farm-to-basket__video"
            src={HERO_POSTER}
            alt="FarmersHaus fresh produce"
            fetchPriority="high"
            decoding="async"
            width="1280"
            height="720"
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <video
            ref={videoRef}
            className="farm-to-basket__video"
            src={farmToBasketVideo}
            poster={HERO_POSTER}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            disablePictureInPicture
            aria-label="Farmers harvesting and washing produce before it is packed into a basket"
            style={{ opacity: videoLoaded ? 1 : 0, transition: 'opacity 0.6s ease' }}
          />
        )}
        {/* Show poster as background while video is buffering — prevents flash of blank */}
        {!skipVideo && !videoLoaded && (
          <img
            className="farm-to-basket__video"
            src={HERO_POSTER}
            alt=""
            aria-hidden="true"
            fetchPriority="high"
            decoding="async"
            width="1280"
            height="720"
            style={{ objectFit: 'cover', position: 'absolute', inset: 0 }}
          />
        )}
      </div>
      <div className="farm-to-basket__scrim" aria-hidden="true" />
      <div className="farm-to-basket__intro">
        <p className="farm-to-basket__eyebrow">From the people who grow it</p>
        <h1>FROM FARM<br />TO BASKET</h1>
        <p className="farm-to-basket__support">Discover the journey of freshness.</p>
        <Link className="button button-yellow farm-to-basket__cta" to="/shop">
          SHOP FRESH PRODUCE <Icon name="arrow" />
        </Link>
      </div>
    </section>
  )
}
