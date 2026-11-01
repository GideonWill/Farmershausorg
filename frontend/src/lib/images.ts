const foodPhoto = (id: string, width = 900) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=82`

export const imageMap = {
  hero: foodPhoto('photo-1542838132-92c53300491e', 1800),
  story: foodPhoto('photo-1540420773420-3366772f4999', 1200),
  basket: foodPhoto('photo-1547592180-85f173990554', 900),
  categories: {
    fruits: foodPhoto('photo-1610832958506-aa56368176cf'),
    vegetables: foodPhoto('photo-1566385101042-1a0aa0c1268c'),
    groceries: foodPhoto('photo-1542838132-92c53300491e'),
    herbs: foodPhoto('photo-1615485290382-441e4d049cb5'),
    roots: foodPhoto('photo-1518977676601-b53f82aba655'),
    beverages: foodPhoto('photo-1551024709-8f23befc6f87'),
    default: foodPhoto('photo-1542838132-92c53300491e'),
  },
  product: foodPhoto('photo-1542838132-92c53300491e'),
} as const

export function categoryImage(slug?: string): string {
  if (!slug) return imageMap.categories.default
  const lower = slug.toLowerCase()
  if (lower.includes('fruit')) return imageMap.categories.fruits
  if (lower.includes('vegetable')) return imageMap.categories.vegetables
  if (lower.includes('herb')) return imageMap.categories.herbs
  if (lower.includes('root')) return imageMap.categories.roots
  if (lower.includes('beverage') || lower.includes('drink')) return imageMap.categories.beverages
  if (lower.includes('grocery') || lower.includes('pantry') || lower.includes('grain') || lower.includes('dairy')) {
    return imageMap.categories.groceries
  }
  return imageMap.categories.default
}
