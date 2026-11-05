const foodPhoto = (id: string, width = 600) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=75`

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
  recipes: {
    'sunshine-fruit-bowl': foodPhoto('photo-1519996529931-28324d5a630e', 1000),
    'garden-crunch-salad': foodPhoto('photo-1512621776951-a57141f2eefd', 1000),
    'mango-banana-smoothie': foodPhoto('photo-1553530666-ba11a7da3888', 1000),
    'ghanaian-party-jollof': foodPhoto('photo-1563379091339-03b21ab4a4f8', 1000),
    'kontomire-stew-ampesi': foodPhoto('photo-1546069901-d5bfd2cbfb1f', 1000),
    'accra-waakye': foodPhoto('photo-1543339308-43e59d6b73a6', 1000),
    default: foodPhoto('photo-1540420773420-3366772f4999', 1000),
  },
  ingredients: {
    banana: foodPhoto('photo-1571771894821-ce9b6c11b08e', 240),
    mango: foodPhoto('photo-1553279768-865429fa0078', 240),
    pineapple: foodPhoto('photo-1550258987-190a2d41a8ba', 240),
    orange: foodPhoto('photo-1582979512210-99b6a53386f9', 240),
    lettuce: '/products/lettuce.jpg',
    tomato: '/products/tomatoes.jpg',
    tomatoes: '/products/tomatoes.jpg',
    cucumber: '/products/cucumber.jpg',
    broccoli: '/products/broccoli.jpg',
    cauliflower: '/products/cauliflower.jpg',
    okra: '/products/okra.jpg',
    'garden-eggs': '/products/garden-eggs.jpg',
    avocado: foodPhoto('photo-1523049673857-eb18f1d7b578', 240),
    yam: foodPhoto('photo-1518977676601-b53f82aba655', 240),
    'white-yam': foodPhoto('photo-1518977676601-b53f82aba655', 240),
    kontomire: foodPhoto('photo-1576045057995-568f588f82fb', 240),
    rice: foodPhoto('photo-1586201375761-83865001e31c', 240),
    'local-rice': foodPhoto('photo-1586201375761-83865001e31c', 240),
    'brown-rice': foodPhoto('photo-1586201375761-83865001e31c', 240),
    beans: foodPhoto('photo-1551462147-37885acc36f1', 240),
    'black-eyed-peas': foodPhoto('photo-1551462147-37885acc36f1', 240),
    egg: foodPhoto('photo-1506976785307-8732e854ad03', 240),
    eggs: foodPhoto('photo-1506976785307-8732e854ad03', 240),
    'farm-eggs': foodPhoto('photo-1506976785307-8732e854ad03', 240),
    pepper: '/products/fresh-pepper.jpg',
    'fresh-pepper': '/products/fresh-pepper.jpg',
    onion: '/products/onions.jpg',
    onions: '/products/onions.jpg',
    ginger: foodPhoto('photo-1615485290382-441e4d049cb5', 240),
    garlic: foodPhoto('photo-1540148426945-6cf22a6b2383', 240),
    cabbage: '/products/cabbage.jpg',
    carrots: '/products/carrots.jpg',
    carrot: '/products/carrots.jpg',
    oil: foodPhoto('photo-1474979266404-7eaacbcd87c5', 240),
    'red-palm-oil': foodPhoto('photo-1474979266404-7eaacbcd87c5', 240),
    'sweet-potato': foodPhoto('photo-1596560548464-f010549b84d7', 240),
    cassava: '/products/cassava.jpg',
    cocoyam: '/products/cocoyam.jpg',
    corn: '/products/sweet-corn.jpg',
    'sweet-corn': '/products/sweet-corn.jpg',
    watermelon: foodPhoto('photo-1587049352846-4a222e784d38', 240),
    strawberry: foodPhoto('photo-1464965911861-746a04b4bca6', 240),
    apple: foodPhoto('photo-1560806887-1e4cd0b6cbd6', 240),
    honey: foodPhoto('photo-1587049352846-4a222e784d38', 240),
    milk: foodPhoto('photo-1550583724-b2692b85b150', 240),
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

export function recipeImage(slug?: string): string {
  if (!slug) return imageMap.recipes.default
  const map = imageMap.recipes as Record<string, string>
  return map[slug] || imageMap.recipes.default
}

export function ingredientImage(nameOrSlug?: string): string {
  if (!nameOrSlug) return imageMap.categories.vegetables
  const clean = nameOrSlug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '')
  const map = imageMap.ingredients as Record<string, string>

  if (map[clean]) return map[clean]

  for (const key of Object.keys(map)) {
    if (clean.includes(key) || key.includes(clean)) {
      return map[key]
    }
  }

  return categoryImage(nameOrSlug)
}


export const PRODUCE_ICONS: Record<string, string> = {
  // Fruits
  banana: '🍌',
  mango: '🥭',
  apple: '🍎',
  pineapple: '🍍',
  orange: '🍊',
  pawpaw: '🥭',
  papaya: '🥭',
  watermelon: '🍉',
  avocado: '🥑',
  pear: '🥑',
  coconut: '🥥',
  grapes: '🍇',
  grape: '🍇',
  strawberry: '🍓',
  lemon: '🍋',
  lime: '🍋',
  corn: '🌽',
  'sweet-corn': '🌽',

  // Vegetables & Greens
  tomato: '🍅',
  tomatoes: '🍅',
  onion: '🧅',
  onions: '🧅',
  pepper: '🌶️',
  'fresh-pepper': '🌶️',
  shito: '🌶️',
  carrot: '🥕',
  carrots: '🥕',
  cabbage: '🥬',
  lettuce: '🥬',
  cucumber: '🥒',
  'garden-eggs': '🍆',
  eggplant: '🍆',
  okra: '🫛',
  broccoli: '🥦',
  cauliflower: '🥦',

  // Roots & Tubers
  yam: '🥔',
  'white-yam': '🥔',
  cassava: '🥔',
  cocoyam: '🥔',
  'sweet-potato': '🍠',
  'irish-potato': '🥔',
  potato: '🥔',
  ginger: '🫚',
  garlic: '🧄',
  turmeric: '🫚',

  // Greens & Herbs
  kontomire: '🌿',
  spinach: '🥬',
  'spring-onion': '🧅',
  parsley: '🌿',
  coriander: '🌿',
  mint: '🍃',
  herb: '🌿',

  // Grains & Legumes
  rice: '🍚',
  'local-rice': '🍚',
  'brown-rice': '🍚',
  beans: '🫘',
  'black-eyed-peas': '🫘',
  'brown-beans': '🫘',
  'red-kidney-beans': '🫘',
  'kidney-beans': '🫘',
  peas: '🫘',
  lentils: '🫘',
  maize: '🌽',
  millet: '🌾',
  sorghum: '🌾',
  flour: '🌾',
  'cassava-flour': '🌾',

  // Dairy, Eggs & Pantry
  egg: '🥚',
  eggs: '🥚',
  'farm-eggs': '🥚',
  milk: '🥛',
  'fresh-milk': '🥛',
  cheese: '🧀',
  'cheddar-cheese': '🧀',
  yoghurt: '🥣',
  'plain-yoghurt': '🥣',
  butter: '🧈',
  'salted-butter': '🧈',
  honey: '🍯',
  'natural-honey': '🍯',
  sugar: '🧂',
  'cane-sugar': '🧂',
  oil: '🫒',
  'red-palm-oil': '🫒',
  'groundnut-oil': '🫒',
  'peanut-butter': '🥜',
  'tomato-paste': '🥫',
  mierikswortel: '🥫',
  horseradish: '🥫',
  'remia-salad-dressing': '🥗',
  'salad-dressing': '🥗',
  dressing: '🥗',
  'spanish-black-olives': '🫒',
  'spanish-green-olives': '🫒',
  'black-olives': '🫒',
  'green-olives': '🫒',
  olives: '🫒',
  olive: '🫒',

  // Beverages
  water: '💧',
  'bottled-water': '💧',
  'coconut-water': '🥥',
  juice: '🧃',
  'fresh-orange-juice': '🧃',
  sobolo: '🌺',
  'sobolo-drink': '🌺',
  cocoa: '☕',
  'cocoa-drink': '☕',

  // Food Baskets
  basket: '🧺',
  hamper: '🧺',
  tote: '🧺',
  bundle: '🧺',
}

export function getProduceIcon(nameOrSlug?: string): string {
  if (!nameOrSlug) return '🌿'
  const clean = nameOrSlug.toLowerCase().trim().replace(/[^a-z0-9-]/g, ' ')
  const hyphenated = clean.replace(/\s+/g, '-')

  if (PRODUCE_ICONS[hyphenated]) return PRODUCE_ICONS[hyphenated]
  if (PRODUCE_ICONS[clean]) return PRODUCE_ICONS[clean]

  for (const [key, icon] of Object.entries(PRODUCE_ICONS)) {
    if (clean.includes(key) || hyphenated.includes(key)) {
      return icon
    }
  }

  if (clean.includes('fruit')) return '🍎'
  if (clean.includes('veg') || clean.includes('green') || clean.includes('leaf')) return '🥬'
  if (clean.includes('root') || clean.includes('tuber')) return '🥔'
  if (clean.includes('grain') || clean.includes('cereal')) return '🍚'
  if (clean.includes('drink') || clean.includes('beverage')) return '🧃'
  if (clean.includes('gift') || clean.includes('pack')) return '🧺'

  return '🌿'
}
