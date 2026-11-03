import { CROPS_DATABASE, WEBSITE_KNOWLEDGE } from './knowledgeBase'
import { REAL_DATABASE_PRODUCTS } from './databaseProducts'
import type { AgronomyInfo, BranchInfo, ProductSearchResult, RecipeSuggestion } from './types'

export type ChatPart =
  | { type: 'text'; text: string }
  | { type: 'tool-searchProducts'; state: 'output-available'; output: ProductSearchResult[] }
  | { type: 'tool-getCropAgronomy'; state: 'output-available'; output: AgronomyInfo }
  | { type: 'tool-getGhanaianRecipe'; state: 'output-available'; output: RecipeSuggestion }
  | { type: 'tool-getStoreWebsiteInfo'; state: 'output-available'; output: BranchInfo[] }

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  parts: ChatPart[]
}

const LAUNCH_BRANCHES: BranchInfo[] = WEBSITE_KNOWLEDGE.branches.map((b) => ({
  id: b.id,
  slug: b.slug,
  name: b.name,
  address: b.address,
  phone: b.phone,
  hours: b.hours,
  isOpen: true,
  coverage: b.coverage,
}))

function findMatchingProducts(query: string, limit = 4): ProductSearchResult[] {
  const q = query.toLowerCase().trim()
  const matches = REAL_DATABASE_PRODUCTS.filter((p) => {
    return (
      p.slug === q ||
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q))
    )
  })
  return matches.slice(0, limit)
}

const RECIPES: Record<string, RecipeSuggestion> = {
  kontomire: {
    dish: 'Traditional Kontomire Stew with Boiled Yam (Ampesi)',
    description: 'Rich, iron-packed green stew prepared with tender cocoyam leaves, pure palm oil, melon seeds, and served with Ghanaian white yam.',
    servings: '4 persons',
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
      'Pair with boiled green plantains (apem) or white yam for classic ampesi.',
    ],
    nutritionalHighlights: [
      'Super-high natural iron and folate for blood cell vitality',
      'Provitamin A from unrefined red palm oil',
      'Steady low-glycemic satiety from white yam',
    ],
  },
  jollof: {
    dish: 'Authentic Ghanaian Party Jollof Rice',
    description: 'Smoky, deep reddish-orange party-style Jollof rice infused with roasted aromatics, ginger, fresh pepper, and local rice.',
    servings: '6 persons',
    ingredients: [
      { name: 'Local Ghanaian Rice', amount: '1 kg', category: 'grains', suggestedProductSlug: 'local-rice', inStock: true },
      { name: 'Fresh Roma Tomatoes', amount: '1 kg', category: 'vegetables', suggestedProductSlug: 'tomatoes', inStock: true },
      { name: 'Fresh Onions', amount: '500g', category: 'vegetables', suggestedProductSlug: 'onions', inStock: true },
      { name: 'Fresh Pepper (Kpakpo Shito)', amount: '200g', category: 'vegetables', suggestedProductSlug: 'fresh-pepper', inStock: true },
      { name: 'Fresh Ginger Root and Garlic', amount: '150g', category: 'herbs', suggestedProductSlug: 'ginger', inStock: true },
      { name: 'Pure Cooking Oil', amount: '250ml', category: 'groceries', suggestedProductSlug: 'red-palm-oil', inStock: true },
    ],
    cookingTips: [
      'Fry your tomato stew until oil surfaces and separates with a deep amber-red sheen before adding rice.',
      'Seal the pot with foil or baking paper under the lid to steam the grains evenly without scorching.',
    ],
    nutritionalHighlights: [
      'High lycopene from cooked stewed tomatoes',
      'Clean energy from unpolished local rice',
      'Digestive warmth from fresh ginger and garlic',
    ],
  },
  waakye: {
    dish: 'Accra Street-Style Waakye with Shito and Salad',
    description: 'Nutritious local rice and black-eyed peas simmered together with sorghum leaves giving its signature mahogany color.',
    servings: '4 persons',
    ingredients: [
      { name: 'Local Rice', amount: '1 kg', category: 'grains', suggestedProductSlug: 'local-rice', inStock: true },
      { name: 'Black-Eyed Peas (Beans)', amount: '500g', category: 'grains', suggestedProductSlug: 'black-eyed-peas', inStock: true },
      { name: 'Sorghum Grains / Leaves', amount: '200g', category: 'grains', suggestedProductSlug: 'sorghum', inStock: true },
      { name: 'Crisp Cabbage', amount: '1 head', category: 'vegetables', suggestedProductSlug: 'cabbage', inStock: true },
      { name: 'Fresh Carrots and Cucumber', amount: '300g', category: 'vegetables', suggestedProductSlug: 'carrots', inStock: true },
      { name: 'Fresh Farm Eggs', amount: '4 eggs', category: 'groceries', suggestedProductSlug: 'farm-eggs', inStock: true },
    ],
    cookingTips: [
      'Soak cowpeas with sorghum stalks for 2 hours before boiling.',
      'Boil beans until tender before adding rice so both achieve soft grain separation.',
    ],
    nutritionalHighlights: [
      'Complete plant-based protein from rice and legume amino acid pairing',
      'High soluble prebiotic fiber for metabolic health',
      'Antioxidants from natural sorghum leaves',
    ],
  },
  'red-red': {
    dish: 'Red Red (Savory Cowpea Stew with Fried Plantains)',
    description: 'Tender black-eyed cowpeas simmered in spiced red palm oil, served with golden-fried sweet ripe plantains (kelewele or dodo) and gari.',
    servings: '4 persons',
    ingredients: [
      { name: 'Ripe Sweet Plantains', amount: '4 fingers', category: 'roots', suggestedProductSlug: 'plantain', inStock: true },
      { name: 'Black-Eyed Peas', amount: '500g', category: 'grains', suggestedProductSlug: 'black-eyed-peas', inStock: true },
      { name: 'Pure Red Palm Oil', amount: '150ml', category: 'groceries', suggestedProductSlug: 'red-palm-oil', inStock: true },
      { name: 'Fresh Onions and Tomatoes', amount: '400g', category: 'vegetables', suggestedProductSlug: 'onions', inStock: true },
    ],
    cookingTips: [
      'Choose soft ripe plantains with black speckled skins for maximum natural caramelization.',
      'Sprinkle coarse gari over the hot bean stew just before serving for authentic texture.',
    ],
    nutritionalHighlights: [
      'Potassium and natural energy from plantains',
      'Lean protein and complex dietary fiber from cowpeas',
      'Vitamin A from pure red palm oil',
    ],
  },
}

export async function generateClientAssistantResponse(
  prompt: string,
  _branchSlug?: string
): Promise<ChatPart[]> {
  // Natural realistic small delay (350ms) to simulate intelligent analysis
  await new Promise((resolve) => setTimeout(resolve, 350))

  const clean = prompt.toLowerCase().trim()
  const parts: ChatPart[] = []
  const textChunks: string[] = []

  // Case 1: Mangoes
  if (clean.includes('mango')) {
    const crop = CROPS_DATABASE.mango
    textChunks.push('**Mango Selection, Harvest Seasons & Storage in Ghana**')
    textChunks.push(
      'Ghanaian mangoes (primarily Keitt and Kent varieties) have two harvest peaks: the **Major Season** from May to July and the **Minor Season** from December to February, sourced largely from the Somanya and Shai Hills farming belts.'
    )
    textChunks.push(
      '**Ripeness Indicator:** Do not rely solely on skin color, as ripe Keitt mangoes can remain green with a gentle yellow or reddish blush. Test with gentle palm pressure near the stem shoulder; a sweet floral aroma at the stem confirms peak sweetness.'
    )
    textChunks.push(
      '**Tropical Storage:** Store unripe mangoes at room temperature (24°C–26°C) stem-down in an open fruit bowl or paper bag. Only refrigerate once soft and fragrant, which preserves sweetness for up to 5 days.'
    )
    textChunks.push(
      '**Nutritional Profile:** One cup provides over 60% of your daily Vitamin C, Vitamin A (beta-carotene for vision and skin), folate, and digestive amylase enzymes.'
    )

    parts.push({ type: 'text', text: textChunks.join('\n\n') })
    parts.push({
      type: 'tool-getCropAgronomy',
      state: 'output-available',
      output: {
        cropName: crop.name,
        localName: crop.localName,
        category: crop.category,
        seasons: crop.seasons,
        ripenessGuide: crop.ripenessGuide,
        storageGuide: crop.storageGuide,
        nutrition: crop.nutrition,
        healthBenefits: crop.healthBenefits,
        culinaryUses: crop.culinaryUses,
      },
    })

    const prods = findMatchingProducts('mango')
    if (prods.length) {
      parts.push({ type: 'tool-searchProducts', state: 'output-available', output: prods })
    }
    return parts
  }

  // Case 2: Pona Yam vs Plantain
  if (clean.includes('pona') || (clean.includes('yam') && clean.includes('plantain'))) {
    textChunks.push('**Pona Yam vs. Plantain: Nutrition, Storage & Culinary Uses**')
    textChunks.push(
      'Both Pona yam and plantains are staples of Ghanaian household gastronomy, yet their nutritional and metabolic profiles offer distinct benefits:'
    )
    textChunks.push(
      '- **Pona Yam (Bono East Harvest):** Renowned as the king of Ghanaian yams from Atebubu and Ejura. Features slow-digesting complex carbohydrates, high dietary potassium, and zero slimy residue. Excellent for sustained energy and boiling into tender ampesi.'
    )
    textChunks.push(
      '- **Green vs. Ripe Plantain:** Green plantain (Apem) is rich in prebiotic resistant starch, which supports gut microbiota and maintains a low glycemic index. Ripe yellow plantain (Apantu) converts starches into natural fructose and glucose, ideal for sweeter dishes like kelewele, tatale, and red red.'
    )
    textChunks.push(
      '**Accra Storage Advice:** Never refrigerate whole raw yams; chilling causes moisture condensation and internal rot. Keep yams in an elevated, well-ventilated dry basket. Store plantains at room temperature away from direct sunlight.'
    )

    parts.push({ type: 'text', text: textChunks.join('\n\n') })
    const prods = REAL_DATABASE_PRODUCTS.filter((p) => p.slug === 'white-yam' || p.slug === 'plantain' || p.category === 'roots').slice(0, 4)
    if (prods.length) {
      parts.push({ type: 'tool-searchProducts', state: 'output-available', output: prods })
    }
    return parts
  }

  // Case 3: Kontomire stew & Ampesi recipe
  if (clean.includes('kontomire') || clean.includes('ampesi') || clean.includes('palava')) {
    const recipe = RECIPES.kontomire
    textChunks.push('**Traditional Kontomire Stew & Ampesi Recipe**')
    textChunks.push(
      'Kontomire stew is one of Ghana’s most celebrated culinary masterpieces, spotlighting tender cocoyam leaves simmered in unrefined red palm oil with aromatics and boiled eggs.'
    )
    textChunks.push(
      '**Preparation Secret:** Wash kontomire leaves thoroughly with warm water and sea salt to reduce itchiness from microscopic calcium oxalate crystals before chopping gently.'
    )
    textChunks.push(
      '**Ampesi Pairing:** Peel your white yam or green plantains, cut into cylindrical rounds, boil in salted water with a few drops of palm oil, and drain when fork-tender.'
    )

    parts.push({ type: 'text', text: textChunks.join('\n\n') })
    parts.push({ type: 'tool-getGhanaianRecipe', state: 'output-available', output: recipe })

    const prods = REAL_DATABASE_PRODUCTS.filter((p) => ['kontomire', 'white-yam', 'red-palm-oil', 'farm-eggs'].includes(p.slug))
    if (prods.length) {
      parts.push({ type: 'tool-searchProducts', state: 'output-available', output: prods })
    }
    return parts
  }

  // Case 4: Recipes (Waakye, Jollof, Red Red, Soup)
  if (clean.includes('waakye')) {
    const recipe = RECIPES.waakye
    textChunks.push('**Authentic Accra Street-Style Waakye**')
    textChunks.push(
      'Waakye combines local rice and black-eyed peas with natural red sorghum stalks, which infuse its signature rich mahogany tint and powerful polyphenols.'
    )
    parts.push({ type: 'text', text: textChunks.join('\n\n') })
    parts.push({ type: 'tool-getGhanaianRecipe', state: 'output-available', output: recipe })
    const prods = REAL_DATABASE_PRODUCTS.filter((p) => ['local-rice', 'black-eyed-peas', 'sorghum', 'cabbage'].includes(p.slug))
    if (prods.length) parts.push({ type: 'tool-searchProducts', state: 'output-available', output: prods })
    return parts
  }

  if (clean.includes('jollof')) {
    const recipe = RECIPES.jollof
    textChunks.push('**Authentic Ghanaian Party Jollof Rice**')
    textChunks.push(
      'Ghanaian party jollof achieves its legendary aroma through a deeply roasted tomato-onion-pepper foundation, balanced with fresh ginger root and gentle steaming.'
    )
    parts.push({ type: 'text', text: textChunks.join('\n\n') })
    parts.push({ type: 'tool-getGhanaianRecipe', state: 'output-available', output: recipe })
    const prods = REAL_DATABASE_PRODUCTS.filter((p) => ['local-rice', 'tomatoes', 'onions', 'fresh-pepper'].includes(p.slug))
    if (prods.length) parts.push({ type: 'tool-searchProducts', state: 'output-available', output: prods })
    return parts
  }

  // Case 5: Branches, hours, contacts, and locations
  if (
    clean.includes('branch') ||
    clean.includes('location') ||
    clean.includes('where') ||
    clean.includes('dome') ||
    clean.includes('westland') ||
    clean.includes('legon') ||
    clean.includes('hour') ||
    clean.includes('open') ||
    clean.includes('address') ||
    clean.includes('phone') ||
    clean.includes('contact')
  ) {
    textChunks.push('**Farmershaus Accra Branch Directory & Operating Hours**')
    textChunks.push(
      'Farmershaus operates 4 physical walk-in stores and fulfillment centers across Greater Accra, ensuring fresh harvest produce is dispatched locally:'
    )
    LAUNCH_BRANCHES.forEach((b, i) => {
      textChunks.push(
        `${i + 1}. **${b.name}**\n- Address: ${b.address}\n- Phone: ${b.phone}\n- Hours: ${b.hours}\n- Coverage: ${b.coverage}`
      )
    })
    textChunks.push(
      '**Switching Branches:** You can click the branch selector in the top navigation bar at any time to browse shelf inventory and prices for your preferred branch.'
    )

    parts.push({ type: 'text', text: textChunks.join('\n\n') })
    parts.push({ type: 'tool-getStoreWebsiteInfo', state: 'output-available', output: LAUNCH_BRANCHES })
    return parts
  }

  // Case 6: Delivery zones, shipping, and Mobile Money payments
  if (
    clean.includes('delivery') ||
    clean.includes('zone') ||
    clean.includes('shipping') ||
    clean.includes('pickup') ||
    clean.includes('fee') ||
    clean.includes('momo') ||
    clean.includes('payment') ||
    clean.includes('mtn') ||
    clean.includes('card')
  ) {
    textChunks.push('**Accra Delivery Zones, Fulfillment & Mobile Money Payments**')
    textChunks.push(
      '**Delivery Coverage:** We deliver across Dome, Westland, Achimota, North Legon, East Legon, Agbogba, Haatso, Kwabenya, Airport Residential, Dzorwulu, Cantonments, Spintex, and adjacent neighborhoods.'
    )
    textChunks.push(
      '**Same-Day Delivery Cutoff:** Orders placed before 2:00 PM are dispatched same-day in your selected time slot. Orders placed after 2:00 PM are delivered the following morning.'
    )
    textChunks.push(
      '**Delivery Fees:** Transparent delivery fees typically range between GH₵ 15 and GH₵ 45, computed based on exact road distance from your fulfilling branch.'
    )
    textChunks.push(
      '**Payment Methods:** We accept instant Mobile Money (**MTN MoMo**, **Telecel Cash**, **AT Money**) and Debit/Credit Cards (**Visa**, **Mastercard**) through our secure checkout.'
    )

    parts.push({ type: 'text', text: textChunks.join('\n\n') })
    return parts
  }

  // Case 7: Food Baskets & Gifts
  if (clean.includes('basket') || clean.includes('gift') || clean.includes('hamper') || clean.includes('tote')) {
    textChunks.push('**Farmershaus Curated Food Baskets & Gift Hampers**')
    textChunks.push(
      'Our artisanal Food Baskets are crafted for holidays, corporate appreciation, family wellness, or convalescent gifts:'
    )
    textChunks.push(
      '- **Sunshine Fruit Basket:** Hand-selected seasonal fruits (mango, pineapple, sweet pawpaw, citrus, grapes).'
    )
    textChunks.push(
      '- **Harvest Pantry Bundle:** Premium staple provisions (local rice, beans, Bono yams, unrefined oil, and aromatics).'
    )
    textChunks.push(
      '- **Wellness & Greens Hamper:** Fresh organic leafy greens, ginger, garlic, citrus, and natural immune-boosting produce.'
    )
    textChunks.push(
      '- **Custom Produce Tote Builder:** Select your own items with our reusable organic tote and include a complimentary handwritten gift card.'
    )

    parts.push({ type: 'text', text: textChunks.join('\n\n') })
    const prods = REAL_DATABASE_PRODUCTS.filter((p) => p.category === 'fruits' || p.category === 'groceries').slice(0, 4)
    if (prods.length) {
      parts.push({ type: 'tool-searchProducts', state: 'output-available', output: prods })
    }
    return parts
  }

  // Case 8: Individual crop lookup (Pineapple, Pawpaw, Avocado, Watermelon, Tomatoes, Pepper, Okra, etc.)
  const matchedCropKey = Object.keys(CROPS_DATABASE).find((key) => {
    const crop = CROPS_DATABASE[key]
    return (
      clean.includes(key) ||
      clean.includes(crop.name.toLowerCase()) ||
      (crop.localName && clean.includes(crop.localName.toLowerCase()))
    )
  })

  if (matchedCropKey) {
    const crop = CROPS_DATABASE[matchedCropKey]
    textChunks.push(`**${crop.name} (${crop.localName || 'Fresh Farm Harvest'})**`)
    textChunks.push(`**Harvest Seasons in Ghana:** ${crop.seasons}`)
    textChunks.push(`**Selection & Ripeness:** ${crop.ripenessGuide}`)
    textChunks.push(`**Storage Guidelines:** ${crop.storageGuide}`)
    textChunks.push(`**Nutrition & Health:** ${crop.nutrition}`)
    textChunks.push(`**Culinary Uses:** ${crop.culinaryUses}`)

    parts.push({ type: 'text', text: textChunks.join('\n\n') })
    parts.push({
      type: 'tool-getCropAgronomy',
      state: 'output-available',
      output: {
        cropName: crop.name,
        localName: crop.localName,
        category: crop.category,
        seasons: crop.seasons,
        ripenessGuide: crop.ripenessGuide,
        storageGuide: crop.storageGuide,
        nutrition: crop.nutrition,
        healthBenefits: crop.healthBenefits,
        culinaryUses: crop.culinaryUses,
      },
    })

    const prods = findMatchingProducts(crop.suggestedProductSlug || matchedCropKey)
    if (prods.length) {
      parts.push({ type: 'tool-searchProducts', state: 'output-available', output: prods })
    }
    return parts
  }

  // Case 9: Generic produce / search lookup
  const searchResults = REAL_DATABASE_PRODUCTS.filter((p) => {
    return (
      clean.includes(p.slug) ||
      clean.includes(p.name.toLowerCase()) ||
      clean.includes(p.category.toLowerCase()) ||
      p.tags.some((t) => clean.includes(t.toLowerCase()))
    )
  }).slice(0, 4)

  if (searchResults.length > 0) {
    textChunks.push('**Farmershaus Fresh Catalogue Results**')
    textChunks.push(
      'Here are fresh items currently available on our store shelves matching your inquiry. You can click on any product card below to view branch stock and add directly to your cart:'
    )
    parts.push({ type: 'text', text: textChunks.join('\n\n') })
    parts.push({ type: 'tool-searchProducts', state: 'output-available', output: searchResults })
    return parts
  }

  // Default Fallback
  textChunks.push('**Welcome to Farmershaus Assistant**')
  textChunks.push(
    'I can provide accurate information regarding our fresh farm produce, Ghanaian culinary traditions, and the Farmershaus platform:'
  )
  textChunks.push(
    '- **Farm Produce & Crops:** Seasonal harvest times, sweetness tests, room-temperature vs. fridge storage, and micronutrient profiles.'
  )
  textChunks.push(
    '- **Authentic Ghanaian Recipes:** Ingredient checklists and cooking advice for Jollof, Waakye, Kontomire stew, and ampesi.'
  )
  textChunks.push(
    '- **Accra Branches & Fulfillment:** Operating hours, physical addresses for Dome, Westland, North Legon, and East Legon, and same-day delivery slots.'
  )
  textChunks.push(
    '- **Gift Baskets:** Curated fruit hampers, pantry bundles, and custom gift totes.'
  )
  textChunks.push('What fresh produce or grocery items can I help you with today?')

  parts.push({ type: 'text', text: textChunks.join('\n\n') })
  const defaultProds = REAL_DATABASE_PRODUCTS.filter((p) => p.isAvailable).slice(0, 4)
  parts.push({ type: 'tool-searchProducts', state: 'output-available', output: defaultProds })
  return parts
}
