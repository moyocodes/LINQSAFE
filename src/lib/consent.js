// Analytics-cookie consent. 'yes' | 'no' | null (not asked yet). Stored per browser.
const KEY = 'lh_consent'
export const getConsent = () => { try { return localStorage.getItem(KEY) } catch { return null } }
export const setConsent = (v) => { try { localStorage.setItem(KEY, v) } catch { /* storage blocked */ } }
export const hasConsent = () => getConsent() === 'yes'
