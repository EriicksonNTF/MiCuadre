export type BankLogoOption = {
  key: string
  name: string
  logoUrl: string
  primaryColor: string
  secondaryColor: string
}

export const BANK_LOGO_OPTIONS: BankLogoOption[] = [
  { key: "banreservas", name: "Banreservas", logoUrl: "/bank-logos/collection-data/banreservas.svg", primaryColor: "#274d72", secondaryColor: "#02aef2" },
  { key: "banco-popular", name: "Banco Popular", logoUrl: "/bank-logos/collection-data/banco_popular-01.svg", primaryColor: "#e30613", secondaryColor: "#004990" },
  { key: "banco-bhd", name: "Banco BHD", logoUrl: "/bank-logos/collection-data/banco%20bhd.svg", primaryColor: "#1D3B6F", secondaryColor: "#5BAE46" },
  { key: "qik", name: "Qik Banco Digital", logoUrl: "/bank-logos/collection-data/qik.svg", primaryColor: "#7c3aed", secondaryColor: "#a78bfa" },
  { key: "banesco", name: "Banesco", logoUrl: "/bank-logos/collection-data/logo-g-0.svg", primaryColor: "#065f46", secondaryColor: "#6ee7b7" },
  { key: "scotiabank", name: "Scotiabank", logoUrl: "/bank-logos/collection-data/scotiabank.svg", primaryColor: "#EC111A", secondaryColor: "#ED0722" },
  { key: "banco-santa-cruz", name: "Banco Santa Cruz", logoUrl: "/bank-logos/collection-data/banco-santa-cruz.svg", primaryColor: "#1d4ed8", secondaryColor: "#93c5fd" },
  { key: "banco-ademi", name: "Banco Ademi", logoUrl: "/bank-logos/collection-data/ademi.svg", primaryColor: "#1e3a5f", secondaryColor: "#7dd3fc" },
  { key: "banco-caribe", name: "Banco Caribe", logoUrl: "/bank-logos/collection-data/banco-caribe.svg", primaryColor: "#0c4a6e", secondaryColor: "#38bdf8" },
  { key: "banco-promerica", name: "Banco Promerica", logoUrl: "/bank-logos/collection-data/banco-promerica.svg", primaryColor: "#0f766e", secondaryColor: "#5eead4" },
  { key: "banco-bdi", name: "Banco BDI", logoUrl: "/bank-logos/collection-data/banco%20bdi.svg", primaryColor: "#991b1b", secondaryColor: "#fca5a5" },
  { key: "banco-vimenca", name: "Banco Vimenca", logoUrl: "/bank-logos/collection-data/banco-vimenca.svg", primaryColor: "#831843", secondaryColor: "#f9a8d4" },
  { key: "citibank", name: "Citibank", logoUrl: "/bank-logos/collection-data/citibank.svg", primaryColor: "#003B70", secondaryColor: "#D9261C" },
]

export function getBankLogoByKey(key?: string | null) {
  if (!key) return null
  return BANK_LOGO_OPTIONS.find((item) => item.key === key) || null
}

export function getBankNameByKey(key?: string | null) {
  if (!key) return null
  return BANK_LOGO_OPTIONS.find((item) => item.key === key)?.name || null
}
