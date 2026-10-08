// Free limits and paid-feature helpers. The server is the source of truth (server/features.js, server/app.js).
export const FREE_LINK_LIMIT = 3

export const CATEGORIES = [
  ['beauty', 'Beauty & hair'], ['fashion', 'Fashion'], ['food', 'Food & drink'], ['coaching', 'Coaching & consulting'],
  ['creative', 'Creative & media'], ['health', 'Health & fitness'], ['tech', 'Tech & software'], ['retail', 'Shop & retail'],
  ['events', 'Events & hospitality'], ['education', 'Education & training'], ['finance', 'Finance & insurance'],
  ['real_estate', 'Real estate'], ['home_services', 'Home services'], ['nonprofit', 'Nonprofit & community'],
  ['travel', 'Travel & tourism'], ['other', 'Other'],
]

export const CUSTOM_CATEGORY_PREFIX = 'other:'
export const isCustomCategory = (value = '') => String(value).startsWith(CUSTOM_CATEGORY_PREFIX)
export const customCategoryText = (value = '') => (isCustomCategory(value) ? String(value).slice(CUSTOM_CATEGORY_PREFIX.length) : '')
export const makeCustomCategory = (value = '') => `${CUSTOM_CATEGORY_PREFIX}${String(value).trim().slice(0, 60)}`
export const categoryLabel = (value = '') => {
  if (isCustomCategory(value)) return customCategoryText(value) || 'Other'
  return Object.fromEntries(CATEGORIES)[value] || value || 'Not set'
}

// Templates = layout + a suggested theme. `feature` ones must be unlocked; `for` lists the categories they suit.
export const TEMPLATES = [
  { id: 'classic', name: 'Classic', hint: 'Centered stack', theme: 'light', for: ['other', 'tech', 'personal'] },
  { id: 'grid', name: 'Grid', hint: 'Two-column tiles', theme: 'sage', for: ['retail', 'food', 'creative'] },
  { id: 'minimal', name: 'Minimal', hint: 'Clean text list', theme: 'light', for: ['tech', 'personal'] },
  { id: 'cover', name: 'Cover', hint: 'Full photo header', theme: 'light', feature: 'tpl_cover', photo: 'cover', for: ['coaching', 'beauty', 'health', 'events'] },
  { id: 'editorial', name: 'Editorial', hint: 'Paper & serif type', theme: 'light', feature: 'tpl_editorial', photo: 'profile', for: ['fashion', 'coaching', 'creative'] },
  { id: 'search', name: 'Search & solve', hint: 'Problem → your answers', theme: 'light', feature: 'tpl_search', photo: 'cover', for: ['beauty', 'health', 'retail', 'coaching'] },
  { id: 'backdrop', name: 'Photo background', hint: 'Your photo behind everything', theme: 'light', feature: 'tpl_backdrop', photo: 'cover', for: ['beauty', 'fashion', 'food', 'events', 'creative', 'personal'] },
  { id: 'idcard', name: 'Profile card', hint: 'Polaroid + fact sheet', theme: 'light', feature: 'tpl_idcard', photo: 'profile', for: ['fashion', 'beauty', 'creative', 'personal'] },
]

// me.features is { featureKey: 'YYYY-MM-DD' (expiry) | null (no expiry) } for every active feature.
export const has = (me, key) => !!me?.features && key in me.features
export const naira = (n) => `₦${Number(n).toLocaleString('en-NG')}`

// "Visa •••• 4081 · Zenith Bank", "Bank transfer · GTBank", "USSD", …
const CHANNELS = { card: 'Card', bank: 'Bank account', bank_transfer: 'Bank transfer', ussd: 'USSD', qr: 'QR', mobile_money: 'Mobile money', apple_pay: 'Apple Pay', eft: 'EFT' }
export function methodLabel(p) {
  if (!p.channel) return '–'
  const head = p.channel === 'card' && p.last4 ? `${(p.card_type || 'Card').replace(/^\w/, (c) => c.toUpperCase())} •••• ${p.last4}` : CHANNELS[p.channel] || p.channel
  return p.bank ? `${head} · ${p.bank}` : head
}
export const channelName = (c) => CHANNELS[c] || c || 'Unknown'
