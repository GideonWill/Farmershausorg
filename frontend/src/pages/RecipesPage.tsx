import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api, money, type Cart, type Product } from '../lib/api'
import { useProducts } from '../hooks/useStoreData'
import { useStore } from '../stores/store'
import { notify } from '../lib/notifications'
import { Icon } from '../components/ui'
import { flyToCart } from '../lib/cartFlyEffect'
import { recipeImage, ingredientImage, categoryImage } from '../lib/images'

export type RecipeItem = {
  slug: string
  title: string
  category: string
  prepTime: string
  servings: string
  description: string
  ingredients: string[]
  method: string[]
  tone: string
}

const RECIPES: RecipeItem[] = [
  {
    slug: 'sunshine-fruit-bowl',
    title: 'Sunshine Fruit Bowl',
    category: 'Breakfast & Snacks',
    prepTime: '10 mins',
    servings: '2–4 persons',
    description: 'A bright, refreshing tropical fruit bowl pairing juicy sweet mango chunks, pineapples, sweet bananas, and valencia oranges.',
    ingredients: ['Banana', 'Mango', 'Pineapple', 'Orange'],
    method: [
      'Gently rinse and peel the fresh tropical fruits.',
      'Slice the bananas into coins, dice the mango and pineapple into bite-sized cubes, and section the orange into segments.',
      'Toss together gently in a chilled serving bowl.',
      'Optionally drizzle with pure honey and garnish with fresh mint leaves before serving cold.',
    ],
    tone: 'bg-brand-yellow/15',
  },
  {
    slug: 'garden-crunch-salad',
    title: 'Garden Crunch Salad',
    category: 'Farm Greens & Salads',
    prepTime: '15 mins',
    servings: '4 persons',
    description: 'Crisp hand-harvested greens, ripe roma tomatoes, crunchy cucumbers, and creamy sliced avocado with a lime vinaigrette.',
    ingredients: ['Lettuce', 'Tomatoes', 'Cucumber', 'Avocado'],
    method: [
      'Wash the leafy lettuce leaves thoroughly in cold water, spin dry, and tear into bite-sized pieces.',
      'Slice the fresh tomatoes and crisp cucumbers into half-moons.',
      'Halve the ripe avocado, remove the stone, and dice the buttery flesh.',
      'Arrange in a salad bowl and toss lightly with fresh lime juice, unrefined cold-pressed oil, salt, and black pepper.',
    ],
    tone: 'bg-brand-green/10',
  },
  {
    slug: 'mango-banana-smoothie',
    title: 'Mango & Banana Tropical Smoothie',
    category: 'Chilled Beverages',
    prepTime: '5 mins',
    servings: '2 glasses',
    description: 'A velvety, naturally energizing tropical blend packed with potassium, Vitamin C, and natural fruit sugars.',
    ingredients: ['Mango', 'Banana'],
    method: [
      'Peel and chop 1 ripe sweet mango and 2 ripe sweet bananas.',
      'Place in a blender with chilled water, coconut water, or fresh milk.',
      'Blend on high speed for 60 seconds until creamy, thick, and completely smooth.',
      'Pour into chilled tall glasses and enjoy immediately.',
    ],
    tone: 'bg-amber-500/10',
  },
  {
    slug: 'ghanaian-party-jollof',
    title: 'Authentic Ghanaian Party Jollof',
    category: 'Traditional Entrees',
    prepTime: '45 mins',
    servings: '6 persons',
    description: 'Smoky, deep reddish-orange party-style Jollof rice infused with roasted aromatics, ginger, Ga peppers, and local rice.',
    ingredients: ['Local rice', 'Tomatoes', 'Onions', 'Fresh pepper', 'Ginger', 'Garlic'],
    method: [
      'Blend onions, ginger, garlic, and fresh Ga peppers into a fragrant aromatic base.',
      'Heat oil in a heavy-bottomed pot and fry the aromatic puree and fresh tomato puree until oil separates with an amber sheen.',
      'Add thoroughly washed local rice and stir for 3 minutes to coat every grain in the rich savory stew.',
      'Cover tightly with foil and lid, allowing to steam cook on low heat until tender, fragrant, and fluffy.',
    ],
    tone: 'bg-orange-500/10',
  },
  {
    slug: 'kontomire-stew-ampesi',
    title: 'Kontomire Stew & Boiled Yam (Ampesi)',
    category: 'Traditional Entrees',
    prepTime: '35 mins',
    servings: '4 persons',
    description: 'Nutrient-packed cocoyam greens simmered in unrefined red palm oil with boiled white yam and boiled farm eggs.',
    ingredients: ['Kontomire', 'White yam', 'Red palm oil', 'Onions', 'Tomatoes', 'Farm eggs'],
    method: [
      'Gently wash tender kontomire leaves with warm salted water, drain thoroughly, and shred finely.',
      'Heat pure red palm oil in a saucepan and gently saute sliced onions and crushed fresh tomatoes.',
      'Stir in the shredded kontomire greens and simmer on low heat for 12 minutes until tender.',
      'Peel and slice Ghanaian white yam into chunks, boil in lightly salted water until fork-tender, and serve with boiled farm eggs.',
    ],
    tone: 'bg-emerald-500/10',
  },
  {
    slug: 'accra-waakye',
    title: 'Accra Street-Style Waakye',
    category: 'Street Classics',
    prepTime: '50 mins',
    servings: '4–6 persons',
    description: 'Nutritious local rice and black-eyed cowpeas simmered together, served with crunchy fresh cabbage salad and boiled eggs.',
    ingredients: ['Local rice', 'Black-eyed peas', 'Cabbage', 'Carrots', 'Cucumber', 'Farm eggs'],
    method: [
      'Rinse black-eyed peas and boil in water until tender and soft.',
      'Add washed local rice with a pinch of salt, cooking until water is fully absorbed and grains separate smoothly.',
      'Finely shred fresh cabbage, sweet carrots, and cucumber for the refreshing crunchy salad garnish.',
      'Serve steaming hot with hard-boiled farm eggs, shito, and moist gari.',
    ],
    tone: 'bg-rose-500/10',
  },
]

const emptyProducts: Product[] = []

export function RecipesPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const branch = useStore((state) => state.branch)
  const cartSessionKey = useStore((state) => state.cartSessionKey)
  const queryClient = useQueryClient()
  const productsQuery = useProducts()
  const [isAdding, setIsAdding] = useState(false)

  const recipe = RECIPES.find((item) => item.slug === slug)
  const products = productsQuery.data ?? emptyProducts

  // Robust ingredient matching
  const matchedIngredients = useMemo(() => {
    if (!recipe) return []
    return recipe.ingredients.map((name) => {
      const target = name.toLowerCase().trim()
      const product = products.find((candidate) => {
        const cName = candidate.name.toLowerCase()
        const cSlug = candidate.slug.toLowerCase()
        return (
          cName === target ||
          cSlug === target ||
          cName.includes(target) ||
          target.includes(cName) ||
          cSlug.includes(target) ||
          target.includes(cSlug)
        )
      })
      return { name, product: product ?? null }
    })
  }, [products, recipe])

  // Sequential addition ensures zero database lockouts and adds ALL available ingredients
  async function addIngredients(event?: React.MouseEvent) {
    if (!branch) {
      notify('Choose a branch before adding recipe ingredients.', 'info')
      return
    }
    const available = matchedIngredients.filter(
      (item): item is { name: string; product: Product } =>
        Boolean(item.product?.branch_availability.is_available),
    )
    if (!available.length) {
      notify('None of this recipe’s ingredients are currently available at the selected branch.', 'info')
      return
    }

    setIsAdding(true)
    const targetElement =
      (event?.currentTarget as HTMLElement) || document.getElementById('add-recipe-ingredients-btn')

    try {
      // 1. Add each available ingredient sequentially to ensure complete cart integrity
      for (let i = 0; i < available.length; i++) {
        const { product } = available[i]

        // 2. Staggered flying item arc animation straight into the header cart icon
        setTimeout(() => {
          flyToCart(
            targetElement,
            product.image_url || ingredientImage(product.slug) || categoryImage(product.category),
          )
        }, i * 160)

        await api<Cart>('/cart/items/', {
          method: 'POST',
          cartSessionKey,
          body: JSON.stringify({ branch_id: branch.id, product_id: product.id, quantity: 1 }),
        })
      }

      await queryClient.invalidateQueries({ queryKey: ['cart'] })
      const unavailable = matchedIngredients
        .filter(({ product }) => !product?.branch_availability.is_available)
        .map(({ name }) => name)

      notify(
        unavailable.length
          ? `Added ${available.length} recipe ingredients to your cart! (${unavailable.join(', ')} currently out of stock).`
          : `All ${available.length} recipe ingredients (${available.map((i) => i.name).join(', ')}) added to your cart!`,
        'success',
      )
    } catch (error) {
      await queryClient.invalidateQueries({ queryKey: ['cart'] })
      notify(error instanceof Error ? error.message : 'Some ingredients could not be added.', 'error')
    } finally {
      setIsAdding(false)
    }
  }

  if (productsQuery.isError) {
    return (
      <div className="section-wrap">
        <h1 className="section-title">Recipes</h1>
        <p className="mt-4 bg-red-50 p-4 text-brand-tomato">{productsQuery.error.message}</p>
        <Link className="button button-outline mt-4" to="/shop">
          Browse the shop
        </Link>
      </div>
    )
  }

  if (slug && !recipe) {
    return (
      <div className="section-wrap">
        <h1 className="section-title">Recipe not found</h1>
        <Link to="/recipes" className="button button-primary mt-5">
          Browse recipes
        </Link>
      </div>
    )
  }

  // --- RECIPE GALLERY / INDEX PAGE ---
  if (!slug) {
    return (
      <div className="section-wrap min-h-[65vh]">
        <div className="max-w-2xl">
          <p className="eyebrow">From the FarmersHaus Kitchen</p>
          <h1 className="section-title mt-1">Farm-Fresh Recipes & Ideas</h1>
          <p className="mt-3 text-sm sm:text-base leading-relaxed text-brand-ink/70">
            Inspiring ways to cook with our local Ghanaian harvest. Click on any recipe to see verified produce availability and add all fresh ingredients directly to your basket.
          </p>
        </div>

        {productsQuery.isLoading ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {RECIPES.map((item) => (
              <div key={item.slug} className="skeleton aspect-[16/11] rounded-3xl" />
            ))}
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {RECIPES.map((item) => {
              const coverImg = recipeImage(item.slug)
              return (
                <Link
                  to={`/recipes/${item.slug}`}
                  className="group flex flex-col overflow-hidden rounded-3xl bg-white border border-brand-green/15 shadow-xs hover:shadow-xl hover:border-brand-green/35 transition duration-300"
                  key={item.slug}
                >
                  {/* Classy Recipe Photography Cover */}
                  <div className="aspect-[16/10] overflow-hidden relative bg-brand-cream/60">
                    <img
                      src={coverImg}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-80 group-hover:opacity-60 transition-opacity" />

                    {/* Category Pill Over Image */}
                    <span className="absolute top-3 left-3 rounded-full bg-white/95 backdrop-blur-md px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-green shadow-xs">
                      {item.category}
                    </span>

                    {/* Prep Time Pill */}
                    <span className="absolute bottom-3 left-3 rounded-full bg-black/60 backdrop-blur-md px-2.5 py-0.5 text-[11px] font-medium text-white shadow-xs">
                      ⏱ {item.prepTime}
                    </span>
                  </div>

                  {/* Recipe Card Body */}
                  <div className="flex flex-col justify-between flex-1 p-5 sm:p-6">
                    <div>
                      <h2 className="font-brand-heading text-xl sm:text-2xl font-bold text-brand-green group-hover:text-brand-ink transition">
                        {item.title}
                      </h2>
                      <p className="mt-2 text-xs sm:text-sm leading-relaxed text-brand-ink/70 line-clamp-2">
                        {item.description}
                      </p>

                      {/* Ingredients Preview */}
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {item.ingredients.map((ing) => (
                          <span
                            key={ing}
                            className="rounded-lg bg-brand-cream/70 border border-brand-green/10 px-2 py-0.5 text-[11px] font-semibold text-brand-ink/75"
                          >
                            {ing}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="mt-5 pt-4 border-t border-brand-green/10 flex items-center justify-between text-xs font-bold text-brand-green group-hover:underline">
                      <span>View Recipe & Ingredients</span>
                      <Icon name="arrow" className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        <div className="mt-10 rounded-2xl bg-brand-cream/60 border border-brand-green/10 p-5 text-xs leading-relaxed text-brand-ink/65 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            Each FarmersHaus recipe uses fresh, pesticide-monitored produce sourced directly from partner farms in Ghana.
          </p>
          <Link to="/shop" className="button button-small button-outline shrink-0">
            Browse All Fresh Produce &rarr;
          </Link>
        </div>
      </div>
    )
  }

  if (!recipe) return null

  const unavailable = matchedIngredients
    .filter(({ product }) => !product?.branch_availability.is_available)
    .map(({ name }) => name)

  const coverImg = recipeImage(recipe.slug)

  // --- RECIPE DETAIL PAGE ---
  return (
    <div className="section-wrap min-h-[65vh]">
      {/* Back button */}
      <button
        className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-brand-green hover:underline"
        onClick={() => navigate('/recipes')}
      >
        <Icon name="arrow" className="rotate-180" /> All Recipes
      </button>

      {/* Recipe Header Card */}
      <div className="overflow-hidden rounded-3xl bg-white border border-brand-green/15 shadow-sm">
        {/* Hero Top Grid */}
        <div className="grid gap-6 lg:grid-cols-2 p-6 sm:p-8 items-center bg-gradient-to-br from-brand-cream/40 via-white to-brand-cream/20">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-green">
                {recipe.category}
              </span>
              <span className="rounded-full bg-brand-yellow/30 px-3 py-1 text-xs font-bold text-brand-green">
                ⏱ {recipe.prepTime}
              </span>
              <span className="rounded-full bg-brand-cream px-3 py-1 text-xs font-bold text-brand-ink/70">
                {recipe.servings}
              </span>
            </div>

            <h1 className="font-brand-heading text-3xl sm:text-4xl lg:text-5xl font-bold text-brand-green mt-3">
              {recipe.title}
            </h1>
            <p className="mt-3 text-sm sm:text-base leading-relaxed text-brand-ink/75 max-w-xl">
              {recipe.description}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                id="add-recipe-ingredients-btn"
                type="button"
                className="button button-primary"
                disabled={productsQuery.isLoading || isAdding}
                onClick={(e) => void addIngredients(e)}
              >
                {isAdding ? (
                  <>Adding items...</>
                ) : (
                  <>
                    Add Available Ingredients ({matchedIngredients.filter((i) => i.product?.branch_availability.is_available).length})
                    <Icon name="cart" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Classy Dish Image */}
          <div className="aspect-[16/11] overflow-hidden rounded-2xl bg-brand-cream shadow-md border border-brand-green/15">
            <img
              src={coverImg}
              alt={recipe.title}
              className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
            />
          </div>
        </div>

        {/* Ingredients & Method Section */}
        <div className="border-t border-brand-green/10 p-6 sm:p-8 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
          {/* Left Column: Ingredients */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-brand-heading text-2xl font-bold text-brand-green">
                You’ll Need ({matchedIngredients.length} Fresh Ingredients)
              </h2>
              {branch && (
                <span className="text-xs text-brand-ink/60">
                  Stock for <span className="font-semibold text-brand-green">{branch.name}</span>
                </span>
              )}
            </div>

            {productsQuery.isLoading ? (
              <div className="skeleton h-48 rounded-2xl" />
            ) : (
              <div className="space-y-2.5">
                {matchedIngredients.map(({ name, product }) => {
                  const isAvailable = product?.branch_availability.is_available
                  const prodImg = product?.image_url || ingredientImage(product?.slug || name)

                  return (
                    <article
                      key={name}
                      className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-brand-cream/35 border border-brand-green/10 hover:border-brand-green/25 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* High quality produce photo (no leaf placeholders!) */}
                        <div className="h-14 w-14 rounded-xl overflow-hidden bg-white border border-brand-green/15 shrink-0 shadow-2xs">
                          <img src={prodImg} alt={name} className="h-full w-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          {product ? (
                            <Link
                              to={`/product/${product.slug}`}
                              className="font-bold text-brand-ink hover:text-brand-green hover:underline text-sm truncate block"
                            >
                              {product.name}
                            </Link>
                          ) : (
                            <span className="font-bold text-brand-ink text-sm block">{name}</span>
                          )}
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-brand-ink/65">
                            <span>{product?.unit || 'Market portion'}</span>
                            {product && (
                              <>
                                <span>•</span>
                                <span className="font-semibold text-brand-green">
                                  {money(product.branch_availability?.price_minor ?? product.base_price_minor)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Stock availability pill */}
                      <div className="shrink-0 text-right">
                        <span
                          className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            isAvailable
                              ? 'bg-brand-green/10 text-brand-green'
                              : 'bg-brand-tomato/10 text-brand-tomato'
                          }`}
                        >
                          {isAvailable ? 'Available' : 'Out of stock'}
                        </span>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}

            <div className="mt-5">
              <button
                type="button"
                className="button button-primary w-full justify-center"
                disabled={productsQuery.isLoading || isAdding}
                onClick={(e) => void addIngredients(e)}
              >
                {isAdding ? 'Adding ingredients...' : 'Add Available Ingredients to Cart'}
                <Icon name="cart" />
              </button>
              {unavailable.length > 0 && (
                <p className="mt-2.5 text-xs leading-relaxed text-brand-ink/60">
                  {unavailable.join(', ')} currently out of stock at {branch?.name ?? 'selected branch'}. You can switch branch from the top header to check nearby branches.
                </p>
              )}
            </div>
          </section>

          {/* Right Column: Step-by-Step Cooking Method */}
          <section>
            <h2 className="font-brand-heading text-2xl font-bold text-brand-green mb-4">
              Let’s Make It
            </h2>
            <ol className="space-y-3.5">
              {recipe.method.map((step, index) => (
                <li
                  key={step}
                  className="flex gap-3.5 p-4 rounded-2xl bg-white border border-brand-green/10 shadow-2xs"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-green text-xs font-bold text-white shadow-xs">
                    {index + 1}
                  </span>
                  <span className="pt-0.5 text-xs sm:text-sm leading-relaxed text-brand-ink/85">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  )
}
