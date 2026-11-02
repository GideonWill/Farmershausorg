export type ProductSearchResult = {
  id: string
  slug: string
  name: string
  category: string
  priceMinor: number
  priceFormatted: string
  unit: string
  unitType: string
  origin: string
  isAvailable: boolean
  availableQuantity?: number
  imageUrl: string
  tags: string[]
}

export type BranchInfo = {
  id: string
  slug: string
  name: string
  address: string
  phone: string
  hours: string
  isOpen: boolean
  coverage?: string
}

export type RecipeIngredient = {
  name: string
  amount: string
  category: string
  suggestedProductSlug?: string
  inStock?: boolean
}

export type RecipeSuggestion = {
  dish: string
  description: string
  servings: string
  ingredients: RecipeIngredient[]
  cookingTips: string[]
  nutritionalHighlights?: string[]
}

export type AgronomyInfo = {
  cropName: string
  localName?: string
  category: string
  seasons: string
  ripenessGuide: string
  storageGuide: string
  nutrition: string
  healthBenefits: string[]
  culinaryUses: string
}
