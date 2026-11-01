import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useBaskets, useCategories, useProducts } from '../hooks/useStoreData'
import { imageMap, categoryImage } from '../lib/images'
import { Icon, LazyImage } from '../components/ui'
import { FarmToBasketExperience } from '../components/FarmToBasketExperience'
import { FeaturedProductShowcase } from '../components/FeaturedProductShowcase'

const reveal = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: 'easeOut' as const } },
}

export function HomePage() {
  const { data: categories = [] } = useCategories()
  const { data: products = [], isLoading: productsLoading } = useProducts()
  const { data: baskets = [] } = useBaskets()
  return (
    <div>
      <FarmToBasketExperience />

      <section className="section-wrap">
        <div className="section-heading">
          <div><p className="eyebrow">Good things grow here</p><h2 className="section-title">Shop by what you love</h2></div>
          <Link className="text-link hidden sm:inline-flex" to="/shop">Browse everything <Icon name="arrow" /></Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-5">
          {categories.map((category, index) => (
            <motion.div key={category.id} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} transition={{ delay: index * 0.05 }}>
              <Link to={`/shop/category/${category.slug}`} className="category-tile group">
                <LazyImage src={categoryImage(category.slug)} alt={category.name} className="aspect-[0.9] transition-transform duration-700 group-hover:scale-105" />
                <span className="absolute inset-0 bg-gradient-to-t from-brand-ink/70 via-transparent to-transparent" />
                <span className="absolute bottom-4 left-4 right-4 font-brand-heading text-xl font-bold text-white sm:bottom-5 sm:left-5 sm:text-2xl">{category.name}</span>
                <span className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-brand-green opacity-0 transition group-hover:opacity-100"><Icon name="arrow" /></span>
              </Link>
            </motion.div>
          ))}
          {!categories.length && ['Seasonal fruit', 'Fresh greens', 'Pantry staples', 'Herbs & spices'].map((name, index) => (
            <Link to="/shop" className="category-tile group" key={name}>
              <LazyImage src={[imageMap.categories.fruits, imageMap.categories.vegetables, imageMap.categories.groceries, imageMap.categories.herbs][index]} alt={name} className="aspect-[0.9] transition-transform duration-700 group-hover:scale-105" />
              <span className="absolute inset-0 bg-gradient-to-t from-brand-ink/70 to-transparent" />
              <span className="absolute bottom-4 left-4 font-brand-heading text-xl font-bold text-white">{name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-brand-cream py-16 sm:py-24" id="our-story">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 lg:grid-cols-2 lg:gap-20">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={reveal}>
            <p className="eyebrow">A brighter kind of everyday</p>
            <h2 className="section-title max-w-xl">Good food.<br />Beautifully simple.</h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-brand-ink/70">Discover vibrant, carefully chosen fruit and vegetables for the meals, moments, and people you love.</p>
            <Link to="/shop" className="button button-primary mt-7">Find your fresh <Icon name="arrow" /></Link>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.98 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="story-visual">
            <img
              src="/brand/farmershaus-healthy-life-poster.png"
              alt="Healthy life, live it well: a colorful composition of fresh fruit and vegetables"
              className="story-visual__poster"
              loading="lazy"
              decoding="async"
            />
          </motion.div>
        </div>
      </section>

      <FeaturedProductShowcase products={products} isLoading={productsLoading} />

      <section className="overflow-hidden bg-brand-green text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-6 py-14 sm:py-20 lg:grid-cols-[1fr_0.85fr] lg:px-10">
          <div>
            <p className="eyebrow text-brand-yellow">Made for sharing</p>
            <h2 className="font-brand-heading text-4xl font-bold leading-tight sm:text-6xl">A basket full of<br />good surprises.</h2>
            <p className="mt-4 max-w-lg leading-7 text-white/75">Thoughtful bundles for family meals, gifting, and all the in-between moments.</p>
            <Link to="/baskets" className="button button-yellow mt-7">Explore food baskets <Icon name="arrow" /></Link>
          </div>
          <div className="relative">
            <LazyImage src="/brand/farmershaus-home-basket.png" alt="A basket filled with fresh FarmersHaus vegetables" className="home-basket-image aspect-square rounded-[2rem] shadow-2xl" />
            <span className="absolute -right-3 -top-3 rounded-full bg-brand-yellow px-4 py-2 text-xs font-bold uppercase tracking-wider text-brand-green">{baskets.length ? `${baskets.length} bundles` : 'Freshly curated'}</span>
          </div>
        </div>
      </section>

      <section className="bg-brand-yellow/20 px-6 py-8">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-5 sm:grid-cols-4">
          {[
            ['Fresh picks', 'Chosen for your branch'],
            ['Easy ordering', 'A few taps to your table'],
            ['Local branches', 'Serving neighborhoods in Accra'],
            ['Here to help', 'Talk to a real person'],
          ].map(([title, text]) => <div key={title} className="text-center"><p className="font-brand-heading text-lg font-bold text-brand-green sm:text-xl">{title}</p><p className="mt-1 text-xs text-brand-ink/60 sm:text-sm">{text}</p></div>)}
        </div>
      </section>

      <section className="section-wrap text-center">
        <p className="eyebrow">A note from our market</p>
        <h2 className="section-title">Freshness belongs in every home.</h2>
        <div className="mx-auto mt-8 max-w-3xl rounded-[2rem] border border-brand-green/10 bg-white p-8 shadow-card sm:p-12">
          <span className="text-4xl text-brand-yellow" aria-hidden="true">“</span>
          <p className="font-brand-heading text-2xl font-semibold leading-snug text-brand-ink sm:text-3xl">We’re making it easier to bring good food to your table, one neighborhood at a time.</p>
          <p className="mt-5 text-sm font-bold uppercase tracking-widest text-brand-green">The FarmersHaus promise</p>
          <p className="mt-2 text-xs text-brand-ink/45">Customer stories coming soon</p>
        </div>
      </section>
    </div>
  )
}
