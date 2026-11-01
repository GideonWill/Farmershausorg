import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Product } from '../lib/api'
import { ProductCard } from './ProductCard'
import { Icon } from './ui'

export function FeaturedProductShowcase({
  products,
  isLoading,
}: {
  products: Product[]
  isLoading: boolean
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const featured = products

  useEffect(() => {
    const track = trackRef.current
    if (!track || !featured.length) return

    let frame = 0
    const updateActiveSlide = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const trackCenter = track.getBoundingClientRect().left + track.clientWidth / 2
        const slides = Array.from(track.querySelectorAll<HTMLElement>('.featured-showcase__slide'))
        const closestIndex = slides.reduce((closest, slide, index) => {
          const slideCenter = slide.getBoundingClientRect().left + slide.clientWidth / 2
          const closestCenter = slides[closest].getBoundingClientRect().left + slides[closest].clientWidth / 2
          return Math.abs(slideCenter - trackCenter) < Math.abs(closestCenter - trackCenter) ? index : closest
        }, 0)
        setActiveIndex((current) => current === closestIndex ? current : closestIndex)
      })
    }

    updateActiveSlide()
    track.addEventListener('scroll', updateActiveSlide, { passive: true })
    window.addEventListener('resize', updateActiveSlide)
    return () => {
      cancelAnimationFrame(frame)
      track.removeEventListener('scroll', updateActiveSlide)
      window.removeEventListener('resize', updateActiveSlide)
    }
  }, [featured.length])

  function moveToSlide(direction: -1 | 1) {
    const slides = trackRef.current?.querySelectorAll<HTMLElement>('.featured-showcase__slide')
    if (!slides?.length) return
    const nextIndex = Math.max(0, Math.min(slides.length - 1, activeIndex + direction))
    slides[nextIndex].scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }

  return (
    <section className="section-wrap featured-showcase" aria-labelledby="featured-showcase-title">
      <div className="featured-showcase__heading">
        <p className="eyebrow">Good things from our market</p>
        <h2 className="section-title" id="featured-showcase-title">Explore our products</h2>
        <p className="featured-showcase__description">Fresh picks, selected for your FarmersHaus branch.</p>
      </div>

      {isLoading ? (
        <div className="featured-showcase__track featured-showcase__track--loading" aria-label="Loading featured products">
          {[0, 1, 2].map((item) => <div key={item} className="featured-showcase__skeleton"><div className="skeleton aspect-square" /><div className="skeleton mt-3 h-4 w-2/3" /></div>)}
        </div>
      ) : featured.length ? (
        <>
          <div
            ref={trackRef}
            className="featured-showcase__track"
            role="region"
            aria-roledescription="carousel"
            aria-label="Featured products"
          >
            {featured.map((product, index) => (
              <div
                key={product.id}
                className="featured-showcase__slide"
                data-active={index === activeIndex}
                role="group"
                aria-roledescription="slide"
                aria-label={`${index + 1} of ${featured.length}: ${product.name}`}
              >
                <ProductCard product={product} />
              </div>
            ))}
          </div>
          <div className="featured-showcase__controls">
            <button
              className="featured-showcase__arrow"
              onClick={() => moveToSlide(-1)}
              disabled={activeIndex === 0}
              aria-label="Previous featured product"
            >
              <Icon name="arrow" className="rotate-180" />
            </button>
            <span className="featured-showcase__count" aria-live="polite">
              <span>{String(activeIndex + 1).padStart(2, '0')}</span>
              <span className="featured-showcase__count-divider">/</span>
              {String(featured.length).padStart(2, '0')}
            </span>
            <button
              className="featured-showcase__arrow"
              onClick={() => moveToSlide(1)}
              disabled={activeIndex === featured.length - 1}
              aria-label="Next featured product"
            >
              <Icon name="arrow" />
            </button>
          </div>
        </>
      ) : (
        <div className="rounded-3xl bg-brand-cream px-6 py-12 text-center">
          <p className="font-brand-heading text-xl font-bold text-brand-green">Choose a branch to see what’s fresh.</p>
          <p className="mt-2 text-sm text-brand-ink/60">Availability changes by location.</p>
        </div>
      )}

      <Link className="featured-showcase__shop-link" to="/shop">
        Shop all products <Icon name="arrow" />
      </Link>
    </section>
  )
}
