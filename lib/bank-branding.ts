export type BankLogoOption = {
  key: string
  name: string
  logoUrl: string
}

export const BANK_LOGO_OPTIONS: BankLogoOption[] = [
  { key: "none", name: "Ninguno", logoUrl: "" },
  { key: "banreservas", name: "Banreservas", logoUrl: "/bank-logos/banreservas.png" },
  { key: "banco-santa-cruz", name: "Banco Santa Cruz", logoUrl: "/bank-logos/banco-santa-cruz.png" },
  { key: "scotiabank", name: "Scotiabank", logoUrl: "/bank-logos/scotiabank.png" },
  { key: "banco-ademi", name: "Banco Ademi", logoUrl: "/bank-logos/banco-ademi.png" },
  { key: "banco-caribe", name: "Banco Caribe", logoUrl: "/bank-logos/banco-caribe.png" },
  { key: "banco-bhd", name: "Banco BHD", logoUrl: "/bank-logos/banco-bhd.png" },
  { key: "banco-popular", name: "Banco Popular", logoUrl: "/bank-logos/banco-popular.png" },
  { key: "banco-promerica", name: "Banco Promerica", logoUrl: "/bank-logos/banco-promerica.png" },
  { key: "banco-bdi", name: "Banco BDI", logoUrl: "/bank-logos/banco-bdi.png" },
  { key: "banco-vimenca", name: "Banco Vimenca", logoUrl: "/bank-logos/banco-vimenca.png" },
  { key: "qik", name: "Qik Banco Digital", logoUrl: "/bank-logos/qik.png" },
  { key: "citibank", name: "Citibank", logoUrl: "/bank-logos/citibank.png" },
  { key: "banesco", name: "Banesco", logoUrl: "/bank-logos/banesco.png" },
]

export function getBankLogoByKey(key?: string | null) {
  if (!key) return null
  return BANK_LOGO_OPTIONS.find((item) => item.key === key) || null
}
