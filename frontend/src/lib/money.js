export function formatCents(cents) { return Number.isSafeInteger(cents) && cents >= 0 ? new Intl.NumberFormat('en-ZA', {style:'currency', currency:'ZAR'}).format(cents / 100) : 'Price unavailable'; }
