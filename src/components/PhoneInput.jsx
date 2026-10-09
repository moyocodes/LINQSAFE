import { useEffect, useMemo, useRef, useState } from 'react'
import { AsYouType, getCountries, getCountryCallingCode, isValidPhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js/min'
import { Check, ChevronDown, Search } from 'lucide-react'

const flag = (cc) => cc.replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
const names = (() => { try { return new Intl.DisplayNames(['en'], { type: 'region' }) } catch { return null } })()
// Every country with its dial code, Nigeria first, then A–Z.
const COUNTRIES = getCountries()
  .map((cc) => ({ cc, name: names?.of(cc) || cc, code: getCountryCallingCode(cc) }))
  .sort((a, b) => (a.cc === 'NG' ? -1 : b.cc === 'NG' ? 1 : a.name.localeCompare(b.name)))

// Phone number as stored: digits with the country code, no "+" (e.g. 2348012345678), as wa.me expects.
const toStored = (national, cc) => {
  const parsed = parsePhoneNumberFromString(national, cc)
  if (parsed) return parsed.number.slice(1)
  const digits = national.replace(/\D/g, '').replace(/^0+/, '')
  return digits ? `${getCountryCallingCode(cc)}${digits}` : ''
}

// WhatsApp / phone field: searchable country picker (flag, name, dial code) + the number, formatted as you
// type in that country's style. A leading 0 is fine ("0801…" in Nigeria saves as 234801…).
export default function PhoneInput({ id, value, onChange, defaultCountry = 'NG', describedBy }) {
  const initial = useMemo(() => {
    const p = value ? parsePhoneNumberFromString(`+${value}`) : null
    return { cc: p?.country || defaultCountry, national: p ? p.formatNational() : '' }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [cc, setCc] = useState(initial.cc)
  const [national, setNational] = useState(initial.national)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const box = useRef(null)

  // Close the list on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (!box.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const type = (text) => {
    const formatted = new AsYouType(cc).input(text)
    setNational(formatted)
    onChange(toStored(formatted, cc))
  }
  const pick = (next) => {
    setCc(next); setOpen(false); setQuery('')
    onChange(toStored(national, next))
  }

  const q = query.trim().toLowerCase().replace(/^\+/, '')
  const list = q ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.code.startsWith(q) || c.cc.toLowerCase() === q) : COUNTRIES
  const full = national.replace(/\D/g, '') ? `+${toStored(national, cc)}` : ''
  const valid = full && isValidPhoneNumber(full)

  return (
    <div ref={box} className="relative space-y-1.5">
      <div className="flex h-11 overflow-hidden rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} aria-label={`Country: ${COUNTRIES.find((c) => c.cc === cc)?.name}, +${getCountryCallingCode(cc)}`}
          className="flex shrink-0 items-center gap-1.5 border-r bg-muted/40 px-2.5 text-sm hover:bg-muted">
          <span aria-hidden="true" className="text-lg leading-none">{flag(cc)}</span>
          <span className="tabular-nums text-muted-foreground">+{getCountryCallingCode(cc)}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
        </button>
        <input id={id} type="tel" inputMode="tel" autoComplete="tel-national" value={national} onChange={(e) => type(e.target.value)}
          placeholder={new AsYouType(cc).input(cc === 'NG' ? '08012345678' : '') || 'Phone number'} aria-describedby={describedBy}
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" />
      </div>
      {national && (
        <p className={`flex items-center gap-1 text-xs ${valid ? 'text-emerald-700' : 'text-amber-700'}`}>
          {valid ? <><Check className="size-3.5" aria-hidden="true" /> Valid · saved as {full}</> : 'Check the number for the country you picked'}
        </p>
      )}
      {open && (
        <div className="absolute left-0 top-12 z-50 w-full max-w-sm overflow-hidden rounded-xl border bg-card shadow-2xl">
          <label className="flex items-center gap-2 border-b px-3">
            <Search className="size-4 text-muted-foreground" aria-hidden="true" />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search country or code" aria-label="Search country or code"
              className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>
          <ul role="listbox" aria-label="Country" className="max-h-64 overflow-y-auto py-1">
            {list.map((c) => (
              <li key={c.cc} role="option" aria-selected={c.cc === cc}>
                <button type="button" onClick={() => pick(c.cc)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-muted ${c.cc === cc ? 'bg-muted font-semibold' : ''}`}>
                  <span aria-hidden="true" className="text-lg leading-none">{flag(c.cc)}</span>
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span className="tabular-nums text-muted-foreground">+{c.code}</span>
                </button>
              </li>
            ))}
            {!list.length && <li className="px-3 py-3 text-sm text-muted-foreground">No country matches “{query}”.</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
