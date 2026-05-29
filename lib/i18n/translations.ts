export const translations = {
  es: {
    common: {
      all: "Todos",
      daily: "Diario",
      weekly: "Semanal",
      monthly: "Mensual",
      income: "Ingresos",
      expense: "Gastos",
    },
    reports: {
      title: "Reportes",
      allAccounts: "Todas las cuentas",
      allCategories: "Todas las categorías",
      allCurrencies: "Todas las monedas",
      netBalance: "Balance neto",
      subscriptions: "Suscripciones",
      noData: "No hay datos para este rango.",
      moneyFlow: "Flujo de dinero",
      incomeVsExpense: "Ingresos vs gastos",
      topExpenseCategories: "Top categorías de gasto",
      accountFlow: "Flujo por cuenta",
      topSubscriptions: "Top suscripciones",
      noSubscriptions: "Aún no hay cargos de suscripciones en este rango.",
    },
  },
  en: {
    common: {
      all: "All",
      daily: "Daily",
      weekly: "Weekly",
      monthly: "Monthly",
      income: "Income",
      expense: "Expenses",
    },
    reports: {
      title: "Reports",
      allAccounts: "All accounts",
      allCategories: "All categories",
      allCurrencies: "All currencies",
      netBalance: "Net balance",
      subscriptions: "Subscriptions",
      noData: "No data for this range.",
      moneyFlow: "Money flow",
      incomeVsExpense: "Income vs expenses",
      topExpenseCategories: "Top expense categories",
      accountFlow: "Account flow",
      topSubscriptions: "Top subscriptions",
      noSubscriptions: "No subscription charges in this range yet.",
    },
  },
} as const

export type Locale = keyof typeof translations
export type TranslationTree = typeof translations.es
