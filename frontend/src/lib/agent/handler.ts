import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  toUIMessageStream,
  type UIMessage,
} from 'ai'
import { getLanguageModel, runAgentStream } from './farmbot.ts'
import { CROPS_DATABASE, WEBSITE_KNOWLEDGE } from './knowledgeBase.ts'
import { checkProductStockAndAvailability, EXTENSIVE_CATALOGUE } from './tools.ts'
import type { ProductSearchResult } from './types.ts'

export async function handleAgentChat(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: { messages?: UIMessage[]; branch?: string } = {}
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { messages = [], branch } = body
  const model = getLanguageModel()

  // 1. If a Live LLM is configured (Anthropic Claude / OpenAI / Gemini)
  if (model) {
    try {
      const agentResult = await runAgentStream(messages)
      if (agentResult) {
        return createUIMessageStreamResponse({
          stream: toUIMessageStream({ stream: agentResult.stream }),
        })
      }
    } catch (err: unknown) {
      console.error('Live Agent stream error:', err)
      // Fall through to comprehensive knowledge engine
    }
  }

  // 2. Intelligent Comprehensive Knowledge Engine (clean, no # tags, no emojis, verified inventory)
  return generateIntelligentKnowledgeStream(messages, branch)
}

function generateIntelligentKnowledgeStream(messages: UIMessage[], activeBranch?: string) {
  const lastMessage = messages[messages.length - 1]
  const lastUserText =
    lastMessage?.parts
      ?.filter((p: any) => p.type === 'text')
      ?.map((p: any) => p.text)
      ?.join(' ')
      ?.toLowerCase() || ''

  const responseChunks: string[] = []
  let matchingProductQuery: string | undefined
  let targetProducts: ProductSearchResult[] = []

  // Check 1: Specific crop or farm produce inquiry
  const matchedCropKey = Object.keys(CROPS_DATABASE).find((key) => {
    const crop = CROPS_DATABASE[key]
    return (
      lastUserText.includes(key) ||
      lastUserText.includes(crop.name.toLowerCase()) ||
      (crop.localName && lastUserText.includes(crop.localName.toLowerCase()))
    )
  })

  if (matchedCropKey) {
    const crop = CROPS_DATABASE[matchedCropKey]
    matchingProductQuery = crop.suggestedProductSlug || matchedCropKey

    // Pre-check shop availability first against the database
    const stockInfo = checkProductStockAndAvailability(crop.suggestedProductSlug, activeBranch)
    if (stockInfo.found && stockInfo.product) {
      targetProducts = [stockInfo.product]
    }

    responseChunks.push(`${crop.name} (${crop.localName || 'Fresh Farm Harvest'})`)
    responseChunks.push(`Category: ${crop.category.toUpperCase()} | Sourced fresh from local partner farms`)
    responseChunks.push(`Seasonal Availability and Harvesting in Ghana:`)
    responseChunks.push(crop.seasons)
    responseChunks.push(`How to Select the Best Quality:`)
    responseChunks.push(crop.ripenessGuide)
    responseChunks.push(`Storage and Preservation:`)
    responseChunks.push(crop.storageGuide)
    responseChunks.push(`Nutritional Value and Health Benefits:`)
    responseChunks.push(crop.nutrition)
    responseChunks.push(`Key benefits: ${crop.healthBenefits.join(', ')}`)
    responseChunks.push(`Culinary Uses and Preparation:`)
    responseChunks.push(crop.culinaryUses)

    // Accurate verified inventory check
    if (stockInfo.found) {
      if (stockInfo.isAvailable) {
        responseChunks.push(`Stock Verification: ${stockInfo.message}`)
      } else {
        responseChunks.push(`Stock Verification: ${stockInfo.product?.name || crop.name} is currently out of stock at your selected branch, but fresh shipments arrive regularly from partner farms.`)
      }
    }
  }
  // Check 2: Category overviews (fruits, vegetables, roots, grains, groceries)
  else if (lastUserText.includes('fruit')) {
    matchingProductQuery = 'fruits'
    targetProducts = EXTENSIVE_CATALOGUE.filter((p) => p.category === 'fruits' && p.isAvailable).slice(0, 4)

    responseChunks.push(`Farm-Fresh Fruits at Farmershaus`)
    responseChunks.push(`We work directly with fruit orchards across Greater Accra, Eastern, Central, and Volta Regions to deliver pesticide-monitored, tree-ripened tropical fruits.`)
    responseChunks.push(`Available fruit varieties in store:`)
    responseChunks.push(`- Mangoes: Tree-ripened, rich in beta-carotene and Vitamin C.`)
    responseChunks.push(`- Pineapples: Sweet, rich in digestive bromelain enzymes.`)
    responseChunks.push(`- Solo Pawpaw (Papaya): Loaded with papain enzymes for optimal gut health.`)
    responseChunks.push(`- Tropical Butter Avocado: Creamy monounsaturated heart-healthy fats.`)
    responseChunks.push(`- Crimson Sweet Watermelons: 92% hydration and high lycopene from Ada Foah.`)
    responseChunks.push(`- Sweet Cavendish Bananas: Nutrient-dense potassium and sustained energy.`)
    responseChunks.push(`Storage Advice:`)
    responseChunks.push(`For tropical fruits like mangoes, bananas, and avocados, never refrigerate until fully ripe. Keep whole pineapples at cool room temperature and consume within 3 days.`)
  } else if (lastUserText.includes('vegetable') || lastUserText.includes('green') || lastUserText.includes('produce')) {
    matchingProductQuery = 'vegetables'
    targetProducts = EXTENSIVE_CATALOGUE.filter((p) => (p.category === 'vegetables' || p.category === 'herbs') && p.isAvailable).slice(0, 4)

    responseChunks.push(`Fresh Farm Vegetables and Indigenous Greens`)
    responseChunks.push(`Our vegetables are harvested daily at dawn from partner farms in Ada, Suhum, Aburi, and the Kpong basin:`)
    responseChunks.push(`Available vegetable varieties in store:`)
    responseChunks.push(`- Tender Kontomire (Cocoyam leaves): Deep emerald greens packed with iron, folate, and Vitamin A.`)
    responseChunks.push(`- Farm Tomatoes: Plump, high lycopene, ideal for rich stews and light soups.`)
    responseChunks.push(`- Fresh Onions: Quercetin antioxidants and savory culinary foundation.`)
    responseChunks.push(`- Fresh Pepper (Kpakpo Shito): Distinct Ga chili aroma and metabolic capsaicin.`)
    responseChunks.push(`- Garden Eggs and Okra: Soluble mucilage fiber for digestive wellness.`)
    responseChunks.push(`- Crisp Cabbage, Carrots and Cucumbers: Fresh crunch for salads and coleslaws.`)
    responseChunks.push(`Storage Advice:`)
    responseChunks.push(`Keep leafy greens unwashed with stems wrapped in a damp cloth in your refrigerator crisper drawer. Store whole tomatoes at room temperature stem-down to preserve flavor volatiles.`)
  } else if (lastUserText.includes('root') || lastUserText.includes('tuber') || lastUserText.includes('yam') || lastUserText.includes('plantain')) {
    matchingProductQuery = 'roots'
    targetProducts = EXTENSIVE_CATALOGUE.filter((p) => p.category === 'roots' && p.isAvailable).slice(0, 4)

    responseChunks.push(`Premium Ghanaian Roots and Tubers`)
    responseChunks.push(`Tubers are the foundation of Ghanaian home cooking. Farmershaus inspects every tuber for density and quality:`)
    responseChunks.push(`Available varieties in store:`)
    responseChunks.push(`- White Yam: Fluffy, white, slightly sweet, and non-slimy when boiled.`)
    responseChunks.push(`- Sweet Potato: High beta-carotene, roasted or fried.`)
    responseChunks.push(`- Fresh Cassava: Chalk-white interior, ideal for ampesi, fufu, and banku.`)
    responseChunks.push(`- Fresh Cocoyam: Firm texture for ampesi and soups.`)
    responseChunks.push(`- Fresh Ginger and Garlic: Pungent aromatics with natural anti-inflammatory benefits.`)
    responseChunks.push(`Storage Advice:`)
    responseChunks.push(`Never refrigerate raw whole yams or cassava. Store in an elevated, well-ventilated dry crate away from moisture and direct sunlight.`)
  }
  // Check 3: Recipes and culinary guidance
  else if (lastUserText.includes('waakye')) {
    matchingProductQuery = 'rice'
    targetProducts = EXTENSIVE_CATALOGUE.filter((p) => ['local-rice', 'black-eyed-peas', 'sorghum', 'cabbage'].includes(p.slug))

    responseChunks.push(`Authentic Accra Street-Style Waakye`)
    responseChunks.push(`Waakye is a complete protein source pairing local rice and black-eyed cowpeas with dried sorghum leaves which infuse its classic deep burgundy color and antioxidants.`)
    responseChunks.push(`Essential Fresh Ingredients Available in Store:`)
    responseChunks.push(`- Local Rice (1 kg)`)
    responseChunks.push(`- Clean Black-Eyed Peas (500g)`)
    responseChunks.push(`- Sorghum Grains / Leaves`)
    responseChunks.push(`- Fresh Cabbage, Carrots and Cucumber for the crunchy salad`)
    responseChunks.push(`- Farm Table Eggs for hard-boiled topping`)
    responseChunks.push(`- Tomatoes, Ginger, Garlic and Fresh Pepper for tomato gravy and shito.`)
    responseChunks.push(`Cooking Tip:`)
    responseChunks.push(`Soak your cowpeas for at least 2 hours with the sorghum stalks before boiling. Add a pinch of baking soda or kanwu (limestone) to soften the beans rapidly while preserving grain separation.`)
  } else if (lastUserText.includes('jollof')) {
    matchingProductQuery = 'jollof'
    targetProducts = EXTENSIVE_CATALOGUE.filter((p) => ['local-rice', 'tomatoes', 'onions', 'fresh-pepper'].includes(p.slug))

    responseChunks.push(`Authentic Ghanaian Party Jollof Rice`)
    responseChunks.push(`Party-style Ghanaian Jollof relies on a deeply fried tomato base, roasted aromatics, and long-grain local rice steamed gently to absorb rich savory flavor.`)
    responseChunks.push(`Essential Fresh Ingredients Available in Store:`)
    responseChunks.push(`- Local Rice (1 kg)`)
    responseChunks.push(`- Fresh Roma Tomatoes (1 kg)`)
    responseChunks.push(`- Fresh Onions (500g)`)
    responseChunks.push(`- Fresh Pepper / Kpakpo Shito (200g)`)
    responseChunks.push(`- Fresh Ginger Root and Garlic`)
    responseChunks.push(`- Pure Cooking Oil (Red Palm Oil or Groundnut Oil)`)
    responseChunks.push(`Cooking Tip:`)
    responseChunks.push(`Fry your tomato stew until oil surfaces and separates with a deep amber-red sheen before adding rice. Seal the pot with parchment paper under the lid to cook by steam.`)
  } else if (lastUserText.includes('soup') || lastUserText.includes('light soup') || lastUserText.includes('groundnut')) {
    matchingProductQuery = 'soup'
    targetProducts = EXTENSIVE_CATALOGUE.filter((p) => ['tomatoes', 'onions', 'fresh-pepper', 'ginger'].includes(p.slug))

    responseChunks.push(`Traditional Ghanaian Soups (Light Soup and Groundnut Soup)`)
    responseChunks.push(`Ghanaian soups are celebrated for their aromatic herb bases and comforting flavors:`)
    responseChunks.push(`Aromatic Foundation Ingredients Available in Store:`)
    responseChunks.push(`- Fresh Ginger Root, Garlic and Onions (steamed with meat or fish)`)
    responseChunks.push(`- Fresh Roma Tomatoes and Fresh Pepper`)
    responseChunks.push(`- Garden Eggs and Okra (simmered whole in the broth)`)
    responseChunks.push(`Health Benefits:`)
    responseChunks.push(`High in bone broth collagen, capsaicin for clear airways, and natural anti-inflammatory gingerol bioactives.`)
  } else if (lastUserText.includes('salad') || lastUserText.includes('smoothie') || lastUserText.includes('healthy') || lastUserText.includes('diet') || lastUserText.includes('diabet')) {
    matchingProductQuery = 'wellness'
    targetProducts = EXTENSIVE_CATALOGUE.filter((p) => ['avocado', 'cucumber', 'carrots', 'lettuce'].includes(p.slug))

    responseChunks.push(`Farm-To-Table Wellness and Healthy Diets`)
    responseChunks.push(`Fresh farm produce is foundational to personal wellness:`)
    responseChunks.push(`- For Blood Sugar Balance: Focus on fresh okra, garden eggs, and kontomire greens. Their high soluble fiber slows glucose absorption.`)
    responseChunks.push(`- For Heart Health: Tropical butter avocado (monounsaturated fats) and unrefined red palm oil (tocotrienols).`)
    responseChunks.push(`- Morning Energy Smoothie: Blend 1 sweet banana, fresh pineapple, and peeled ginger with water or coconut water.`)
    responseChunks.push(`- Farmhouse Salad: Shredded crisp cabbage, sweet carrots, sliced cucumbers, ripe roma tomatoes, and creamy avocado cubes with lime dressing.`)
  }
  // Check 4: Website Operations (Branches, Delivery, Baskets, Payments, Refunds)
  else if (lastUserText.includes('branch') || lastUserText.includes('location') || lastUserText.includes('where') || lastUserText.includes('dome') || lastUserText.includes('westland') || lastUserText.includes('legon') || lastUserText.includes('hour') || lastUserText.includes('time') || lastUserText.includes('open')) {
    responseChunks.push(`Farmershaus Accra Branch Directory and Operating Hours`)
    responseChunks.push(`Farmershaus operates 4 physical walk-in and online fulfillment branches across Greater Accra:`)
    WEBSITE_KNOWLEDGE.branches.forEach((b, i) => {
      responseChunks.push(`${i + 1}. ${b.name}`)
      responseChunks.push(`Address: ${b.address}`)
      responseChunks.push(`Telephone: ${b.phone}`)
      responseChunks.push(`Hours: ${b.hours}`)
      responseChunks.push(`Delivery Zones Served: ${b.coverage}`)
    })
    responseChunks.push(`Note: You can switch your active shopping branch anytime from the header to view live inventory at your nearest branch.`)
  } else if (lastUserText.includes('delivery') || lastUserText.includes('zone') || lastUserText.includes('shipping') || lastUserText.includes('pickup') || lastUserText.includes('fee')) {
    responseChunks.push(`Accra Delivery Zones and Fulfillment Information`)
    responseChunks.push(`Farmershaus offers doorstep delivery and branch pickup across Greater Accra:`)
    responseChunks.push(`- Same-Day Delivery Cutoff: Orders placed before 2:00 PM are eligible for same-day delivery slots.`)
    responseChunks.push(`- Fulfillment Options: Choose between doorstep delivery or free Click and Collect pickup at your selected branch.`)
    responseChunks.push(`- Delivery Zones: We deliver to Dome, Westland, Achimota, North Legon, East Legon, Agbogba, Haatso, Kwabenya, Airport Residential, Dzorwulu, Cantonments, Spintex, and surrounding areas.`)
    responseChunks.push(`- Delivery Fees: Fees typically range from GH₵ 15 to GH₵ 45 based on distance from your selected branch, and are calculated transparently at checkout before payment.`)
  } else if (lastUserText.includes('basket') || lastUserText.includes('gift') || lastUserText.includes('hamper') || lastUserText.includes('tote')) {
    matchingProductQuery = 'basket'
    targetProducts = EXTENSIVE_CATALOGUE.filter((p) => p.category === 'fruits' && p.isAvailable).slice(0, 4)

    responseChunks.push(`Farmershaus Artisanal Food Baskets and Gift Hampers`)
    responseChunks.push(`Our food baskets are designed for corporate gifting, celebrations, hospital visits, or monthly pantry provisioning:`)
    WEBSITE_KNOWLEDGE.baskets.offerings.forEach((offering) => {
      responseChunks.push(`- ${offering}`)
    })
    responseChunks.push(`Personalization:`)
    responseChunks.push(`Every gift basket includes a free handwritten card where you can specify the recipient's name and your personal message. You can also build a custom basket using our reusable produce tote directly from the Baskets page.`)
  } else if (lastUserText.includes('payment') || lastUserText.includes('momo') || lastUserText.includes('mtn') || lastUserText.includes('card') || lastUserText.includes('pay')) {
    responseChunks.push(`Payment Methods and Checkout Security`)
    responseChunks.push(`Farmershaus accepts standard Ghanaian digital payment methods for secure checkout:`)
    responseChunks.push(`- Mobile Money: MTN MoMo, Telecel Cash, and AT Money.`)
    responseChunks.push(`- Bank Cards: Visa and Mastercard debit and credit cards.`)
    responseChunks.push(`- Security: Payment prompts are authenticated securely with instant callback verification.`)
  } else if (lastUserText.includes('refund') || lastUserText.includes('cancel') || lastUserText.includes('return') || lastUserText.includes('policy')) {
    responseChunks.push(`Cancellations and Refund Policy`)
    responseChunks.push(`We want you to order with complete confidence:`)
    responseChunks.push(`- Before Payment: Unpaid orders can be cancelled immediately online directly from your account orders view.`)
    responseChunks.push(`- After Payment: Once paid, our branch team begins picking fresh inventory. To modify or cancel a paid order, contact customer support by call or WhatsApp at +233 55 420 8446 or +233 55 048 8906.`)
    responseChunks.push(`- Refund Processing: Any approved refund is processed by our administration directly back to your Mobile Money wallet or bank card.`)
  } else if (lastUserText.includes('contact') || lastUserText.includes('phone') || lastUserText.includes('email') || lastUserText.includes('whatsapp') || lastUserText.includes('help')) {
    responseChunks.push(`Farmershaus Customer Support and Inquiries`)
    responseChunks.push(`Our customer care team is available to help you:`)
    responseChunks.push(`- Primary Phone: +233 55 420 8446`)
    responseChunks.push(`- Secondary Phone: +233 55 048 8906`)
    responseChunks.push(`- WhatsApp: +233 55 420 8446 or +233 55 048 8906`)
    responseChunks.push(`- Email: info@farmershausgh.com`)
    responseChunks.push(`- Contact Page: Visit /contact on the site to submit an online message.`)
  }
  // Default comprehensive overview
  else {
    matchingProductQuery = 'produce'
    targetProducts = EXTENSIVE_CATALOGUE.filter((p) => p.isAvailable).slice(0, 4)

    responseChunks.push(`Welcome to Farmershaus`)
    responseChunks.push(`I can provide complete information regarding our farm crops, agricultural produce, Ghanaian culinary traditions, and the Farmershaus platform. You can ask about:`)
    responseChunks.push(`- Farm Crops, Fruits and Vegetables: Ripeness indicators, harvest seasons in Ghana, tropical storage methods, or nutritional profiles for any crop.`)
    responseChunks.push(`- Culinary Guidance and Recipes: Ingredient checklists and cooking tips for Jollof, Waakye, Kontomire stew, Groundnut soup, and fresh salads.`)
    responseChunks.push(`- Branches and Locations: Addresses, operating hours, and contact details for our 4 Accra branches (Dome, Westland, North Legon, East Legon).`)
    responseChunks.push(`- Delivery and Payments: Accra delivery zones, fees, same-day fulfillment, Mobile Money (MTN MoMo, Telecel), and cancellation rules.`)
    responseChunks.push(`- Food Baskets: Curated fruit hampers, pantry bundles, and custom gift totes.`)
    responseChunks.push(`How may I help with your order today?`)
  }

  // Join every chunk with a clean double-newline separator so every section is distinct!
  const replyText = responseChunks.join('\n\n')

  // Final selection of real products
  const matchingProducts = targetProducts.length > 0
    ? targetProducts
    : matchingProductQuery
      ? EXTENSIVE_CATALOGUE.filter((p) => {
          const q = matchingProductQuery!.toLowerCase()
          return (
            p.slug === q ||
            p.name.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q) ||
            p.tags.some((t) => t.toLowerCase().includes(q))
          )
        }).slice(0, 4)
      : []

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.write({ type: 'start' })
      writer.write({ type: 'text-start', id: 'farmbot-reply' })

      const textChunks = replyText.match(/[\s\S]{1,16}/g) || [replyText]
      for (const chunk of textChunks) {
        writer.write({ type: 'text-delta', id: 'farmbot-reply', delta: chunk })
        await new Promise((resolve) => setTimeout(resolve, 8))
      }
      writer.write({ type: 'text-end', id: 'farmbot-reply' })

      if (matchingProducts.length > 0) {
        const toolCallId = `call_${Date.now()}`
        writer.write({
          type: 'tool-input-available',
          toolCallId,
          toolName: 'searchProducts',
          input: { query: matchingProductQuery },
        })
        writer.write({
          type: 'tool-output-available',
          toolCallId,
          output: matchingProducts,
        })
      }

      writer.write({ type: 'finish' })
    },
  })

  return createUIMessageStreamResponse({ stream })
}
