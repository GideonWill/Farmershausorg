import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api, type Cart, type Product } from '../lib/api'
import { useProducts } from '../hooks/useStoreData'
import { useStore } from '../stores/store'
import { notify } from '../lib/notifications'
import { Icon, LazyImage } from '../components/ui'

const recipes = [
  {
    slug: 'sunshine-fruit-bowl',
    title: 'Sunshine fruit bowl',
    description: 'A bright, no-cook bowl for breakfast or an easy afternoon snack.',
    ingredients: ['Banana', 'Mango', 'Pineapple', 'Orange'],
    method: ['Wash and prepare the fruit.', 'Cut into bite-sized pieces.', 'Toss gently and serve chilled.'],
    tone: 'bg-brand-yellow/20',
  },
  {
    slug: 'garden-crunch-salad',
    title: 'Garden crunch salad',
    description: 'Crisp greens and fresh produce, brought together with a simple dressing.',
    ingredients: ['Lettuce', 'Tomato', 'Cucumber', 'Avocado'],
    method: ['Rinse and dry the vegetables.', 'Slice the tomato, cucumber and avocado.', 'Toss with your favorite dressing just before serving.'],
    tone: 'bg-brand-green/10',
  },
  {
    slug: 'mango-banana-smoothie',
    title: 'Mango & banana smoothie',
    description: 'A quick, naturally sweet blend to start a busy morning.',
    ingredients: ['Mango', 'Banana'],
    method: ['Peel and chop the fruit.', 'Blend with cold water, milk or yogurt until smooth.', 'Serve right away.'],
    tone: 'bg-brand-cream',
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
  const recipe = recipes.find((item) => item.slug === slug)
  const products = productsQuery.data ?? emptyProducts

  const matchedIngredients = useMemo(() => {
    if (!recipe) return []
    return recipe.ingredients.map((name) => {
      const product = products.find((candidate) => candidate.name.toLowerCase() === name.toLowerCase())
      return { name, product: product ?? null }
    })
  }, [products, recipe])

  async function addIngredients() {
    if (!branch) {
      notify('Choose a branch before adding recipe ingredients.', 'info')
      return
    }
    const available = matchedIngredients.filter((item): item is { name: string; product: Product } =>
      Boolean(item.product?.branch_availability.is_available),
    )
    if (!available.length) {
      notify('None of this recipe’s ingredients are available at the selected branch.', 'info')
      return
    }
    try {
      await Promise.all(available.map(({ product }) => api<Cart>('/cart/items/', {
        method: 'POST',
        cartSessionKey,
        body: JSON.stringify({ branch_id: branch.id, product_id: product.id, quantity: 1 }),
      })))
      await queryClient.invalidateQueries({ queryKey: ['cart'] })
      const unavailable = matchedIngredients.filter(({ product }) => !product?.branch_availability.is_available).map(({ name }) => name)
      notify(unavailable.length ? `Available ingredients added. Not available here: ${unavailable.join(', ')}.` : 'Recipe ingredients added to your cart.', unavailable.length ? 'info' : 'success')
    } catch (error) {
      await queryClient.invalidateQueries({ queryKey: ['cart'] })
      notify(error instanceof Error ? error.message : 'Some ingredients could not be added.', 'error')
    }
  }

  if (productsQuery.isError) return <div className="section-wrap"><h1 className="section-title">Recipes</h1><p className="mt-4 bg-red-50 p-4 text-brand-tomato">{productsQuery.error.message}</p><Link className="button button-outline mt-4" to="/shop">Browse the shop</Link></div>
  if (slug && !recipe) return <div className="section-wrap"><h1 className="section-title">Recipe not found</h1><Link to="/recipes" className="button button-primary mt-5">Browse recipes</Link></div>
  if (!slug) {
    return (
      <div className="section-wrap min-h-[65vh]">
        <p className="eyebrow">From the FarmersHaus kitchen</p><h1 className="section-title">Fresh ideas for your table</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-brand-ink/65">Simple ways to enjoy seasonal produce. Ingredient matches and availability are checked against your selected branch.</p>
        {productsQuery.isLoading ? <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{recipes.map((item) => <div key={item.slug} className="skeleton h-64" />)}</div> : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {recipes.map((item) => (
              <Link to={`/recipes/${item.slug}`} className={`recipe-card ${item.tone}`} key={item.slug}>
                <span className="recipe-card__mark">FH · FRESH IDEAS</span><h2 className="font-brand-heading text-3xl font-bold text-brand-green">{item.title}</h2><p className="mt-3 text-sm leading-6 text-brand-ink/65">{item.description}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-brand-green">View recipe <Icon name="arrow" /></span>
              </Link>
            ))}
          </div>
        )}
        <p className="mt-7 text-xs leading-5 text-brand-ink/50">Recipes are editorial suggestions. Product matches depend on the catalogue and availability at the branch you selected.</p>
      </div>
    )
  }

  if (!recipe) return null
  const unavailable = matchedIngredients.filter(({ product }) => !product?.branch_availability.is_available).map(({ name }) => name)
  return (
    <div className="section-wrap min-h-[65vh]">
      <button className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-brand-green" onClick={() => navigate('/recipes')}><Icon name="arrow" className="rotate-180" /> All recipes</button>
      <div className={`recipe-detail ${recipe.tone}`}>
        <p className="eyebrow">A FarmersHaus recipe</p><h1 className="section-title">{recipe.title}</h1><p className="mt-3 max-w-2xl leading-7 text-brand-ink/65">{recipe.description}</p>
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_0.85fr]">
          <section><h2 className="font-brand-heading text-2xl font-bold text-brand-green">You’ll need</h2>
            {productsQuery.isLoading ? <div className="skeleton mt-4 h-40" /> : <ul className="mt-3 divide-y divide-brand-green/10 bg-white/70">
              {matchedIngredients.map(({ name, product }) => <li className="flex items-center justify-between gap-3 p-3" key={name}>
                <span className="flex items-center gap-3">{product && <span className="h-12 w-12 overflow-hidden"><LazyImage src={product.image_url} alt="" className="h-full w-full" /></span>}<span><strong>{name}</strong>{product && <small className="block text-brand-ink/55">{product.unit}</small>}</span></span>
                <span className={`text-xs font-bold ${product?.branch_availability.is_available ? 'text-brand-green' : 'text-brand-tomato'}`}>{product?.branch_availability.is_available ? 'Available' : `Not available${branch ? ` at ${branch.name}` : ''}`}</span>
              </li>)}
            </ul>}
            <button type="button" className="button button-primary mt-4" disabled={productsQuery.isLoading} onClick={() => void addIngredients()}>Add available ingredients <Icon name="cart" /></button>
            {unavailable.length > 0 && <p className="mt-3 text-xs leading-5 text-brand-ink/55">Unavailable items are left out; you can check another branch from the header.</p>}
          </section>
          <section><h2 className="font-brand-heading text-2xl font-bold text-brand-green">Let’s make it</h2><ol className="mt-3 space-y-3">{recipe.method.map((step, index) => <li key={step} className="flex gap-3 bg-white/70 p-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-green text-xs font-bold text-white">{index + 1}</span><span className="pt-1 text-sm leading-6">{step}</span></li>)}</ol></section>
        </div>
      </div>
    </div>
  )
}
