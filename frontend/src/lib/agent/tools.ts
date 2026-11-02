import { tool } from 'ai'
import { z } from 'zod'
import type { AgronomyInfo, BranchInfo, ProductSearchResult, RecipeSuggestion } from './types.ts'
import { CROPS_DATABASE, WEBSITE_KNOWLEDGE } from './knowledgeBase.ts'
import { REAL_DATABASE_PRODUCTS, type RealProduct } from './databaseProducts.ts'

export const LAUNCH_BRANCHES: BranchInfo[] = WEBSITE_KNOWLEDGE.branches.map((b) => ({
  id: b.id,
  slug: b.slug,
  name: b.name,
  address: b.address,
  phone: b.phone,
  hours: b.hours,
  isOpen: true,
  coverage: b.coverage,
}))

export const EXTENSIVE_CATALOGUE: ProductSearchResult[] = REAL_DATABASE_PRODUCTS

/**
 * Pre-checks stock and availability against real store database before answering enquiries.
 */
export function checkProductStockAndAvailability(query: string, branchSlug?: string) {
  const q = query.toLowerCase().trim()
  const matching = REAL_DATABASE_PRODUCTS.filter((p) => {
    return (
      p.slug === q ||
      p.name.toLowerCase() === q ||
      p.slug.includes(q) ||
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q))
    )
  })

  if (matching.length === 0) {
    return {
      found: false,
      isAvailable: false,
      product: null,
      matching: [] as RealProduct[],
      message: `"${query}" is not currently in the Farmershaus store catalogue.`,
    }
  }

  const primary = matching[0]
  const targetBranch = (branchSlug ? branchSlug.toLowerCase() : 'dome')
  const branchStock = primary.branchStocks[targetBranch] ?? 0
  const totalStock = primary.availableQuantity ?? 0

  return {
    found: true,
    isAvailable: totalStock > 0,
    isAvailableAtSelectedBranch: branchStock > 0,
    selectedBranchStock: branchStock,
    totalStock,
    product: primary,
    matching,
    priceFormatted: primary.priceFormatted,
    unit: primary.unit,
    message: totalStock > 0
      ? `Available at Farmershaus: ${primary.priceFormatted} (${primary.unit}) — In stock (${branchStock > 0 ? `${branchStock} at your branch, ` : ''}${totalStock} total across Accra branches).`
      : `${primary.name} is currently out of stock across Accra branches.`,
  }
}

export const searchProductsTool = tool({
  description: 'Search Farmershaus live inventory by produce name, category, or dietary tag. Returns real products currently stocked on store shelves.',
  inputSchema: z.object({
    query: z.string().optional().describe('Search keyword e.g. "mango", "yam", "kontomire", "avocado", "rice", "fruit", "vegetable"'),
    category: z.string().optional().describe('Product category: "fruits", "vegetables", "roots", "herbs", "grains", "pantry", "dairy-eggs", "beverages"'),
    tag: z.string().optional().describe('Filter tag e.g. "in-season", "organic"'),
    maxPriceGhs: z.number().optional().describe('Maximum price in GHS'),
  }),
  execute: async ({ query, category, tag, maxPriceGhs }): Promise<ProductSearchResult[]> => {
    return REAL_DATABASE_PRODUCTS.filter((prod) => {
      if (query) {
        const q = query.toLowerCase().trim()
        const matchesName = prod.name.toLowerCase().includes(q)
        const matchesSlug = prod.slug.toLowerCase().includes(q)
        const matchesCat = prod.category.toLowerCase().includes(q)
        const matchesTag = prod.tags.some((t) => t.toLowerCase().includes(q))
        if (!matchesName && !matchesSlug && !matchesCat && !matchesTag) return false
      }
      if (category && !prod.category.toLowerCase().includes(category.toLowerCase())) {
        return false
      }
      if (tag && !prod.tags.includes(tag.toLowerCase())) {
        return false
      }
      if (maxPriceGhs && prod.priceMinor > maxPriceGhs * 100) {
        return false
      }
      return true
    }).slice(0, 4)
  },
})

export const getCropAgronomyTool = tool({
  description: 'Get deep agricultural, nutritional, ripening, and tropical storage knowledge about any farm crop (fruit, vegetable, tuber, grain).',
  inputSchema: z.object({
    cropName: z.string().describe('The name of the crop or produce item (e.g. "mango", "yam", "pineapple", "kontomire", "tomato", "avocado", "plantain")'),
  }),
  execute: async ({ cropName }): Promise<AgronomyInfo> => {
    const q = cropName.toLowerCase()
    const key = Object.keys(CROPS_DATABASE).find((k) => q.includes(k) || CROPS_DATABASE[k].name.toLowerCase().includes(q))
    const crop = key ? CROPS_DATABASE[key] : null

    if (crop) {
      return {
        cropName: crop.name,
        localName: crop.localName,
        category: crop.category,
        seasons: crop.seasons,
        ripenessGuide: crop.ripenessGuide,
        storageGuide: crop.storageGuide,
        nutrition: crop.nutrition,
        healthBenefits: crop.healthBenefits,
        culinaryUses: crop.culinaryUses,
      }
    }

    return {
      cropName,
      category: 'farm produce',
      seasons: 'Grown during Ghana’s primary agricultural cycles (major rainy season May to July, minor season September to November, or year-round irrigated valleys).',
      ripenessGuide: 'Check for natural fragrance, uniform skin density, vibrant natural pigmentation, and firm texture with slight resilience to thumb pressure.',
      storageGuide: 'Keep in an aerated, shaded basket at room temperature for roots and tropical fruits. Leafy greens should have stems wrapped in damp cloth and stored in the refrigerator crisper.',
      nutrition: 'High in bioavailable antioxidants, dietary fiber, trace minerals, and essential vitamins.',
      healthBenefits: ['Supports immune defense', 'Promotes digestive equilibrium', 'Hydrating and nutrient-dense'],
      culinaryUses: 'Suitable for authentic Ghanaian soups, stews, ampesi, salads, or cold-pressed juices.',
    }
  },
})

export const getStoreWebsiteInfoTool = tool({
  description: 'Answer questions about the Farmershaus website, delivery policies, branches, payments, food baskets, tracking, and refund terms.',
  inputSchema: z.object({
    topic: z.enum(['branches', 'delivery', 'baskets', 'payment', 'refunds', 'about', 'contact']).describe('The website area to query'),
  }),
  execute: async ({ topic }) => {
    switch (topic) {
      case 'branches':
        return WEBSITE_KNOWLEDGE.branches
      case 'delivery':
        return WEBSITE_KNOWLEDGE.deliveryPolicy
      case 'baskets':
        return WEBSITE_KNOWLEDGE.baskets
      case 'payment':
        return WEBSITE_KNOWLEDGE.paymentMethods
      case 'refunds':
        return WEBSITE_KNOWLEDGE.cancellationAndRefunds
      case 'contact':
        return WEBSITE_KNOWLEDGE.contact
      case 'about':
      default:
        return WEBSITE_KNOWLEDGE.about
    }
  },
})

export const checkBranchStockTool = tool({
  description: 'Check whether a specific produce or grocery product is in stock at the customer\'s selected branch or other Accra branches.',
  inputSchema: z.object({
    productSlug: z.string().describe('The product slug or name (e.g. "mango", "tomatoes", "white-yam", "pineapple")'),
    branchSlug: z.string().optional().describe('Branch slug: "dome", "westland", "north-legon", "east-legon"'),
  }),
  execute: async ({ productSlug, branchSlug }) => {
    const targetBranch = LAUNCH_BRANCHES.find((b) =>
      branchSlug ? b.slug.includes(branchSlug.toLowerCase()) || b.name.toLowerCase().includes(branchSlug.toLowerCase()) : false,
    ) || LAUNCH_BRANCHES[0]

    const product = REAL_DATABASE_PRODUCTS.find(
      (p) => p.slug === productSlug || p.name.toLowerCase().includes(productSlug.toLowerCase()),
    )

    if (!product) {
      return {
        product: productSlug,
        requestedBranch: targetBranch.name,
        isAvailableAtBranch: false,
        availableQuantity: 0,
        unitPrice: 'N/A',
        message: `Product "${productSlug}" is not currently in the Farmershaus store catalogue.`,
        otherBranchesWithStock: [],
      }
    }

    const branchKey = targetBranch.slug
    const stockAtBranch = product.branchStocks[branchKey] ?? 0

    return {
      product: product.name,
      requestedBranch: targetBranch.name,
      isAvailableAtBranch: stockAtBranch > 0,
      availableQuantity: stockAtBranch,
      unitPrice: product.priceFormatted,
      otherBranchesWithStock: LAUNCH_BRANCHES.filter((b) => b.id !== targetBranch.id).map((b) => ({
        branchName: b.name,
        address: b.address,
        hasStock: (product.branchStocks[b.slug] ?? 0) > 0,
        quantity: product.branchStocks[b.slug] ?? 0,
      })),
    }
  },
})

export const getGhanaianRecipeTool = tool({
  description: 'Get culinary guidance, authentic ingredient checklists, and cooking tips for Ghanaian and continental dishes.',
  inputSchema: z.object({
    dishName: z.string().describe('The recipe or dish name (e.g. Jollof, Waakye, Red Red, Kontomire, Groundnut Soup, Light Soup, Salad, Smoothie)'),
    servings: z.number().optional().default(4).describe('Number of servings'),
  }),
  execute: async ({ dishName, servings }): Promise<RecipeSuggestion> => {
    const d = dishName.toLowerCase()

    if (d.includes('jollof')) {
      return {
        dish: 'Authentic Ghanaian Party Jollof Rice',
        description: 'Smoky, deep reddish-orange party-style Jollof rice infused with roasted aromatics, ginger, fresh pepper, and local rice.',
        servings: `${servings} persons`,
        ingredients: [
          { name: 'Local Ghanaian Rice', amount: '1 kg', category: 'grains', suggestedProductSlug: 'local-rice', inStock: true },
          { name: 'Fresh Roma Tomatoes', amount: '1 kg', category: 'vegetables', suggestedProductSlug: 'tomatoes', inStock: true },
          { name: 'Fresh Onions', amount: '500g', category: 'vegetables', suggestedProductSlug: 'onions', inStock: true },
          { name: 'Fresh Pepper (Kpakpo Shito)', amount: '200g', category: 'vegetables', suggestedProductSlug: 'fresh-pepper', inStock: true },
          { name: 'Fresh Ginger Root and Garlic', amount: '150g', category: 'herbs', suggestedProductSlug: 'ginger', inStock: true },
          { name: 'Pure Red Palm Oil or Groundnut Oil', amount: '250ml', category: 'groceries', suggestedProductSlug: 'red-palm-oil', inStock: true },
        ],
        cookingTips: [
          'Fry your tomato stew until oil surfaces and separates with a deep amber-red sheen before adding rice.',
          'Seal the top of the pot with foil or parchment under the lid to cook the rice evenly by steam without burning.',
        ],
        nutritionalHighlights: ['Rich in lycopene from cooked tomatoes', 'Energizing complex carbohydrates', 'Digestive warmth from fresh ginger'],
      }
    }

    if (d.includes('kontomire') || d.includes('palava') || d.includes('ampesi')) {
      return {
        dish: 'Traditional Kontomire Stew with Boiled Yam (Ampesi)',
        description: 'Rich, iron-packed green stew prepared with tender cocoyam leaves, pure palm oil, melon seeds, and served with Ghanaian white yam.',
        servings: `${servings} persons`,
        ingredients: [
          { name: 'Fresh Kontomire Leaves', amount: '3 bunches', category: 'vegetables', suggestedProductSlug: 'kontomire', inStock: true },
          { name: 'Ghanaian White Yam', amount: '1 kg', category: 'roots', suggestedProductSlug: 'white-yam', inStock: true },
          { name: 'Pure Red Palm Oil', amount: '200ml', category: 'groceries', suggestedProductSlug: 'red-palm-oil', inStock: true },
          { name: 'Fresh Onions and Tomatoes', amount: '400g', category: 'vegetables', suggestedProductSlug: 'onions', inStock: true },
          { name: 'Fresh Farm Eggs', amount: '4 eggs', category: 'groceries', suggestedProductSlug: 'farm-eggs', inStock: true },
        ],
        cookingTips: [
          'Rub kontomire leaves with salt and warm water before gentle chopping to reduce itchiness.',
          'Add boiled eggs right at the end to absorb the savory palm oil aromatics.',
        ],
        nutritionalHighlights: ['Super-high natural iron and folate', 'Provitamin A from unrefined red palm oil', 'Steady low-glycemic satiety from white yam'],
      }
    }

    if (d.includes('waakye')) {
      return {
        dish: 'Accra Street-Style Waakye with Shito and Salad',
        description: 'Nutritious local rice and black-eyed peas simmered together with sorghum leaves giving its signature mahogany color.',
        servings: `${servings} persons`,
        ingredients: [
          { name: 'Local Rice', amount: '1 kg', category: 'grains', suggestedProductSlug: 'local-rice', inStock: true },
          { name: 'Black-Eyed Peas (Beans)', amount: '500g', category: 'grains', suggestedProductSlug: 'black-eyed-peas', inStock: true },
          { name: 'Sorghum Grains / Leaves', amount: '200g', category: 'grains', suggestedProductSlug: 'sorghum', inStock: true },
          { name: 'Crisp Cabbage', amount: '1 head', category: 'vegetables', suggestedProductSlug: 'cabbage', inStock: true },
          { name: 'Fresh Carrots and Cucumber', amount: '300g', category: 'vegetables', suggestedProductSlug: 'carrots', inStock: true },
          { name: 'Fresh Farm Eggs', amount: '4 eggs', category: 'groceries', suggestedProductSlug: 'farm-eggs', inStock: true },
        ],
        cookingTips: [
          'Boil beans until tender before adding rice so both achieve soft grain separation.',
          'Pair with fresh crisp shredded cabbage and sliced cucumber for cooling crunch and fiber.',
        ],
        nutritionalHighlights: ['Complete plant protein from rice and legume complementary amino acids', 'High soluble prebiotic fiber', 'Slow glycemic release'],
      }
    }

    // Default Fresh Farm Salad or Stew
    return {
      dish: `Farm-Fresh Wellness Meal (${dishName})`,
      description: 'Nourishing, whole-food recipe curated with fresh organic produce directly sourced from Farmershaus Accra branches.',
      servings: `${servings} persons`,
      ingredients: [
        { name: 'Fresh Farm Tomatoes', amount: '500g', category: 'vegetables', suggestedProductSlug: 'tomatoes', inStock: true },
        { name: 'Fresh Onions', amount: '300g', category: 'vegetables', suggestedProductSlug: 'onions', inStock: true },
        { name: 'Fresh Ginger Root', amount: '100g', category: 'herbs', suggestedProductSlug: 'ginger', inStock: true },
        { name: 'Creamy Avocado', amount: '2 fruits', category: 'fruits', suggestedProductSlug: 'avocado', inStock: true },
      ],
      cookingTips: ['Cook lightly to preserve volatile micronutrients and crisp cellular texture.'],
      nutritionalHighlights: ['Loaded with vitamins A, C, and E', 'High dietary fiber', 'Anti-inflammatory flavonoids'],
    }
  },
})
