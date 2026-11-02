import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../stores/store'
import { Icon } from './ui'
import { categoryImage } from '../lib/images'
import type { AgronomyInfo, BranchInfo, ProductSearchResult, RecipeSuggestion } from '../lib/agent/types'

const QUICK_PROMPTS = [
  { label: 'How to select and store sweet mangoes', prompt: 'Tell me about mangoes: harvest seasons in Ghana, how to tell when it is sweet and ripe, tropical storage, and nutritional benefits.' },
  { label: 'Pona Yam vs. Plantain nutrition', prompt: 'Compare Pona yam and plantains: their nutritional profiles, glycemic impact, how to store them in Accra heat, and best cooking methods.' },
  { label: 'Kontomire stew and ampesi recipe', prompt: 'Give me the complete traditional recipe for Kontomire stew with boiled yam and plantain (Ampesi), including tips and fresh ingredients.' },
  { label: 'Branches, hours and contacts', prompt: 'What are the addresses, phone numbers, and operating hours for all 4 Farmershaus branches in Accra?' },
  { label: 'Delivery zones and MoMo payments', prompt: 'Which areas in Accra do you deliver to, what are your delivery fees, and which Mobile Money networks are accepted?' },
  { label: 'Curated Food Baskets and gifts', prompt: 'Tell me about the Farmershaus gift food baskets, fruit hampers, and custom produce tote options.' },
]

function renderCleanText(rawText: string, isUser = false) {
  // Requirement 1: User message must be white text on green background
  if (isUser) {
    return (
      <p className="text-xs sm:text-[13px] leading-relaxed text-white font-medium whitespace-pre-wrap">
        {rawText.trim()}
      </p>
    )
  }

  // Requirement 2: Assistant text must be properly spaced, elegant, and NOT crowded or clumsy
  let cleaned = rawText
    // Remove all markdown hashtags and inject clean spacing
    .replace(/#{1,6}\s*/g, '\n\n')
    // Remove all emojis and decorative symbols
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA70}-\u{1FAFF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/\uFE0F/g, '')
    // Fix glued words where lowercase touches uppercase (e.g. GhanaMajor -> Ghana Major)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    // Fix glued words after punctuation (e.g. Guide)Look -> Guide) Look)
    .replace(/([).!?:])([A-Za-z])/g, '$1 $2')
    // Separate glued bullet items (e.g. fruits.- Mangoes -> fruits.\n- Mangoes)
    .replace(/([^\n])\s*([•\-*]\s+)/g, '$1\n$2')
    .trim()

  const lines = cleaned.split(/\n+/).map((l) => l.trim()).filter(Boolean)

  return (
    <div className="space-y-2.5 text-brand-ink">
      {lines.map((line, idx) => {
        // Bullet list item
        if (line.startsWith('- ') || line.startsWith('• ') || line.startsWith('* ')) {
          const content = line.replace(/^[-•*]\s*/, '')
          return (
            <div key={idx} className="flex items-start gap-2 pl-2 text-xs sm:text-[13px] leading-relaxed my-1">
              <span className="text-brand-green font-bold text-sm leading-none mt-0.5 shrink-0">•</span>
              <span className="flex-1 text-brand-ink/90">{formatInline(content, false)}</span>
            </div>
          )
        }

        // Section header or title (ends with colon or is the first title line)
        const isHeader = line.endsWith(':') || (idx === 0 && line.length < 55)
        if (isHeader) {
          return (
            <h5 key={idx} className="font-bold text-brand-green text-xs sm:text-[13px] pt-2 pb-0.5 tracking-tight">
              {formatInline(line, false)}
            </h5>
          )
        }

        // Standard body paragraph with comfortable line height and spacing
        return (
          <p key={idx} className="text-xs sm:text-[13px] leading-relaxed text-brand-ink/90 my-1.5">
            {formatInline(line, false)}
          </p>
        )
      })}
    </div>
  )
}

function formatInline(str: string, isUser = false) {
  const parts = str.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong
          key={index}
          className={`font-semibold ${isUser ? 'text-white' : 'text-brand-ink'}`}
        >
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em
          key={index}
          className={`italic ${isUser ? 'text-white/90' : 'text-brand-ink/80'}`}
        >
          {part.slice(1, -1)}
        </em>
      )
    }
    return part
  })
}

export function ShoppingAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const branch = useStore((state) => state.branch)

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
  })

  const isThinking = status === 'streaming' || status === 'submitted'

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen])

  function handleSend(textToSend?: string) {
    const text = textToSend ?? input
    if (!text.trim() || isThinking) return
    sendMessage({ text: text.trim() })
    setInput('')
  }

  return (
    <>
      {/* Floating Action Button with Company Logo only */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40">
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label={isOpen ? 'Close Assistant' : 'Open Farmershaus Assistant'}
          title="Farmershaus Assistant"
          className={`group relative flex h-14 w-14 items-center justify-center rounded-full shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 ${
            isOpen
              ? 'bg-brand-ink text-white shadow-brand-ink/30'
              : 'bg-white p-2.5 ring-4 ring-brand-green/20 shadow-brand-green/30 border border-brand-green/10'
          }`}
        >
          {isOpen ? (
            <span className="text-white font-bold text-lg leading-none">✕</span>
          ) : (
            <img
              src="/brand/farmershaus-logo.png"
              alt="FarmersHaus"
              className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
            />
          )}
          {!isOpen && (
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-green opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-brand-green border-2 border-white" />
            </span>
          )}
        </button>
      </div>

      {/* Interactive Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="fixed inset-x-2 bottom-18 sm:inset-auto sm:bottom-20 sm:right-6 z-50 flex flex-col w-auto sm:w-[480px] max-w-full sm:max-w-[calc(100vw-2rem)] h-[580px] sm:h-[650px] max-h-[82vh] rounded-3xl bg-white shadow-2xl border border-brand-green/15 overflow-hidden"
          >
            {/* Header with Company Logo */}
            <div className="flex items-center justify-between border-b border-brand-green/10 bg-brand-green px-5 py-4 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-12 items-center justify-center rounded-xl bg-white p-1.5 shadow-xs">
                  <img
                    src="/brand/farmershaus-logo.png"
                    alt="FarmersHaus"
                    className="h-full w-auto object-contain"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base leading-tight">Farmershaus Assistant</h3>
                    <span className="rounded-full bg-brand-yellow/90 px-2 py-0.5 text-[10px] font-bold text-brand-green uppercase tracking-wider">
                      Online
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-brand-cream/85 mt-0.5">
                    <span className="h-2 w-2 rounded-full bg-brand-yellow" />
                    <span>{branch ? `Active: ${branch.name}` : 'All Accra Branches'}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1.5 text-white/80 hover:bg-white/10 hover:text-white transition"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-brand-cream/15 text-sm">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-3">
                  <img
                    src="/brand/farmershaus-logo.png"
                    alt="FarmersHaus"
                    className="h-12 w-auto object-contain mb-3"
                  />
                  <h4 className="font-bold text-brand-ink text-base">Welcome to Farmershaus</h4>
                  <p className="text-xs text-brand-ink/65 mt-1 max-w-sm">
                    Ask any question regarding our fresh produce, fruits, vegetables, yams, ripening guides, storage, recipes, Accra branches, delivery, or food baskets.
                  </p>
                  <div className="mt-4 w-full space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-brand-green text-left px-1">
                      Suggested Inquiries:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {QUICK_PROMPTS.map((item, index) => (
                        <button
                          key={index}
                          onClick={() => handleSend(item.prompt)}
                          className="w-full text-left text-xs rounded-xl border border-brand-green/15 bg-white p-2.5 font-medium text-brand-ink hover:border-brand-green hover:bg-brand-green/5 transition shadow-2xs"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                messages.map((message) => {
                  const isUser = message.role === 'user'
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isUser ? 'justify-end' : 'justify-start'} items-start gap-2.5`}
                    >
                      {!isUser && (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white border border-brand-green/20 p-1 shrink-0 mt-0.5 shadow-2xs">
                          <img
                            src="/brand/farmershaus-logo.png"
                            alt="FarmersHaus"
                            className="h-full w-auto object-contain"
                          />
                        </div>
                      )}

                      {/* Message Bubble: White on green for User, White box for Assistant */}
                      <div
                        className={`max-w-[88%] rounded-2xl px-4 py-3.5 leading-relaxed shadow-2xs ${
                          isUser
                            ? 'bg-brand-green text-white rounded-br-xs'
                            : 'bg-white text-brand-ink border border-brand-green/10 rounded-bl-xs'
                        }`}
                      >
                        {message.parts.map((part, index) => {
                          if (part.type === 'text') {
                            return (
                              <div key={index}>
                                {renderCleanText(part.text, isUser)}
                              </div>
                            )
                          }

                          // Requirement 3: Product Cards with dedicated page links (No in-chat add button)
                          if (part.type === 'tool-searchProducts') {
                            if (part.state === 'output-available') {
                              const products = (part.output as ProductSearchResult[]) || []
                              if (!products.length) return null
                              return (
                                <div key={index} className="mt-3 space-y-2 pt-2 border-t border-brand-green/10">
                                  <p className="text-xs font-bold text-brand-green">
                                    Available on Farmershaus shelves:
                                  </p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {products.map((prod) => (
                                      <div
                                        key={prod.id}
                                        className="flex flex-col justify-between p-2.5 rounded-xl bg-brand-cream/40 border border-brand-green/15 text-xs shadow-2xs hover:border-brand-green/40 transition"
                                      >
                                        <Link
                                          to={`/product/${prod.slug}`}
                                          onClick={() => setIsOpen(false)}
                                          className="flex gap-2 group"
                                        >
                                          <img
                                            src={prod.imageUrl || categoryImage(prod.category)}
                                            alt={prod.name}
                                            className="h-14 w-14 rounded-lg object-cover shrink-0 border border-brand-green/10 group-hover:scale-105 transition"
                                          />
                                          <div className="flex-1 min-w-0">
                                            <p className="font-bold text-brand-ink truncate group-hover:text-brand-green transition">
                                              {prod.name}
                                            </p>
                                            <p className="text-[11px] text-brand-ink/60 truncate">{prod.unit}</p>
                                            <p className="font-bold text-brand-green mt-1">{prod.priceFormatted}</p>
                                          </div>
                                        </Link>

                                        {/* Requirement 3: Direct link to product page to add & checkout */}
                                        <Link
                                          to={`/product/${prod.slug}`}
                                          onClick={() => setIsOpen(false)}
                                          className="mt-2.5 flex items-center justify-between rounded-xl bg-brand-green text-white hover:bg-brand-green/90 transition py-2 px-3 font-semibold text-[11px] shadow-xs group"
                                        >
                                          <span>View & Add to Cart</span>
                                          <span className="transition-transform group-hover:translate-x-1">&rarr;</span>
                                        </Link>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Dedicated checkout & shop link footer */}
                                  <div className="mt-3 p-3 rounded-xl bg-brand-green/5 border border-brand-green/15 flex flex-col gap-2">
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="font-medium text-brand-ink/80">Ready to complete your order?</span>
                                      <Link
                                        to="/cart"
                                        onClick={() => setIsOpen(false)}
                                        className="font-bold text-brand-green hover:underline flex items-center gap-1"
                                      >
                                        Go to Cart & Checkout &rarr;
                                      </Link>
                                    </div>
                                    <Link
                                      to="/shop"
                                      onClick={() => setIsOpen(false)}
                                      className="button button-primary w-full text-center justify-center text-xs py-2"
                                    >
                                      Browse All Store Shelves &rarr;
                                    </Link>
                                  </div>
                                </div>
                              )
                            }
                            return (
                              <div key={index} className="text-xs text-brand-green/80 italic animate-pulse mt-1">
                                Checking catalogue inventory...
                              </div>
                            )
                          }

                          // Agronomy Crop Card
                          if (part.type === 'tool-getCropAgronomy') {
                            if (part.state === 'output-available') {
                              const agronomy = part.output as AgronomyInfo
                              return (
                                <div key={index} className="mt-3 p-3.5 rounded-xl bg-brand-cream/50 border border-brand-green/20 text-xs space-y-2">
                                  <div className="flex items-center justify-between">
                                    <h5 className="font-bold text-brand-green text-sm">
                                      {agronomy.cropName} {agronomy.localName ? `(${agronomy.localName})` : ''}
                                    </h5>
                                    <span className="text-[10px] bg-brand-green/10 px-2 py-0.5 rounded-full font-bold uppercase text-brand-green">
                                      {agronomy.category}
                                    </span>
                                  </div>
                                  <div className="space-y-1.5 pt-1">
                                    <p><strong>Harvest Season in Ghana:</strong> {agronomy.seasons}</p>
                                    <p><strong>Selection & Ripeness:</strong> {agronomy.ripenessGuide}</p>
                                    <p><strong>Storage Guidelines:</strong> {agronomy.storageGuide}</p>
                                    <p><strong>Nutrition:</strong> {agronomy.nutrition}</p>
                                    <p><strong>Culinary Preparation:</strong> {agronomy.culinaryUses}</p>
                                  </div>
                                </div>
                              )
                            }
                            return (
                              <div key={index} className="text-xs text-brand-green/80 italic animate-pulse mt-1">
                                Consulting agricultural and botanical database...
                              </div>
                            )
                          }

                          // Recipe Card
                          if (part.type === 'tool-getGhanaianRecipe') {
                            if (part.state === 'output-available') {
                              const recipe = part.output as RecipeSuggestion
                              return (
                                <div key={index} className="mt-3 p-3.5 rounded-xl bg-brand-cream/50 border border-brand-yellow/40 text-xs space-y-2">
                                  <div className="flex items-center justify-between">
                                    <h5 className="font-bold text-brand-ink text-sm">{recipe.dish}</h5>
                                    <span className="text-[10px] bg-brand-yellow/50 px-2 py-0.5 rounded-full font-bold text-brand-green">
                                      {recipe.servings}
                                    </span>
                                  </div>
                                  <p className="text-brand-ink/75">{recipe.description}</p>
                                  <div className="pt-1">
                                    <p className="font-bold text-brand-green text-[11px]">Fresh Ingredients:</p>
                                    <ul className="list-disc list-inside space-y-0.5 mt-1 text-brand-ink/80">
                                      {recipe.ingredients.map((ing, i) => (
                                        <li key={i}>
                                          <strong>{ing.name}</strong> ({ing.amount})
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                  {recipe.cookingTips && recipe.cookingTips.length > 0 && (
                                    <div className="pt-1">
                                      <p className="font-bold text-brand-ink text-[11px]">Preparation Advice:</p>
                                      <ul className="list-disc list-inside space-y-0.5 mt-0.5 text-brand-ink/70">
                                        {recipe.cookingTips.map((tip, i) => (
                                          <li key={i}>{tip}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  <div className="pt-2">
                                    <Link
                                      to="/recipes"
                                      onClick={() => setIsOpen(false)}
                                      className="text-xs font-bold text-brand-green hover:underline flex items-center gap-1"
                                    >
                                      View All Recipes & Ingredients in Store &rarr;
                                    </Link>
                                  </div>
                                </div>
                              )
                            }
                            return (
                              <div key={index} className="text-xs text-brand-green/80 italic animate-pulse mt-1">
                                Consulting recipe database...
                              </div>
                            )
                          }

                          // Store Branches Card
                          if (part.type === 'tool-getStoreWebsiteInfo') {
                            if (part.state === 'output-available') {
                              const info = part.output
                              if (Array.isArray(info)) {
                                return (
                                  <div key={index} className="mt-3 space-y-2 text-xs">
                                    <p className="font-bold text-brand-green">Farmershaus Branches:</p>
                                    <div className="grid grid-cols-1 gap-2">
                                      {info.map((b: BranchInfo) => (
                                        <div key={b.id} className="p-2.5 rounded-xl bg-brand-cream/50 border border-brand-green/10">
                                          <p className="font-bold text-brand-ink text-[13px]">{b.name}</p>
                                          <p className="text-[11px] text-brand-ink/70 mt-0.5">{b.address}</p>
                                          <p className="text-[11px] text-brand-ink/60">{b.hours}</p>
                                          <p className="text-[11px] text-brand-green font-semibold mt-1">Phone: {b.phone}</p>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="pt-1">
                                      <Link
                                        to="/find-us"
                                        onClick={() => setIsOpen(false)}
                                        className="text-xs font-bold text-brand-green hover:underline flex items-center gap-1"
                                      >
                                        Open Interactive Map & Directions &rarr;
                                      </Link>
                                    </div>
                                  </div>
                                )
                              }
                            }
                            return (
                              <div key={index} className="text-xs text-brand-green/80 italic animate-pulse mt-1">
                                Fetching branch and operational data...
                              </div>
                            )
                          }

                          return null
                        })}
                      </div>
                    </div>
                  )
                })
              )}

              {isThinking && (
                <div className="flex items-center gap-2 text-xs text-brand-green font-medium p-2 bg-brand-green/5 rounded-xl w-fit">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-green opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-green" />
                  </span>
                  <span>Consulting knowledge base...</span>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-xl bg-brand-tomato/10 text-brand-tomato text-xs border border-brand-tomato/20">
                  {error.message || 'Something went wrong. Please try again.'}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <div className="border-t border-brand-green/10 bg-white p-3">
              <form
                onSubmit={(e: FormEvent) => {
                  e.preventDefault()
                  handleSend()
                }}
                className="flex items-center gap-2"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about any fruit, vegetable, crop, recipe, branch, or order..."
                  disabled={isThinking}
                  className="flex-1 rounded-xl border border-brand-green/20 px-3.5 py-2.5 text-xs text-brand-ink placeholder:text-brand-ink/40 focus:border-brand-green focus:outline-hidden disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={isThinking || !input.trim()}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-green text-white hover:bg-brand-green/90 disabled:opacity-40 transition shrink-0"
                  aria-label="Send message"
                >
                  <Icon name="arrow" className="h-4 w-4 rotate-180" />
                </button>
              </form>
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-brand-ink/45 px-1">
                <span>Farmershaus Accra Operations</span>
                <span>Customer Assistant</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
