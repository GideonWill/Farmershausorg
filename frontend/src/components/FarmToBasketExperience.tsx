import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
const farmToBasketVideo = '/videos/farm-to-basket.mp4'
import { Icon } from './ui'

export function FarmToBasketExperience() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoLoaded, setVideoLoaded] = useState(false)

  useEffect(() => {
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
  }, [])

  return (
    <section
      className="farm-to-basket relative isolate overflow-hidden"
      aria-label="Farm to basket freshness story"
    >
      <div className="farm-to-basket__media">
        <video
          ref={videoRef}
          className={`farm-to-basket__video transition-opacity duration-700 ${videoLoaded ? 'opacity-100' : 'opacity-90'}`}
          src={farmToBasketVideo}
          poster="/brand/farmershaus-healthy-life-poster.webp"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          aria-label="Farmers harvesting and washing produce before it is packed into a basket"
        />
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
