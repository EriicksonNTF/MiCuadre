// Backward-compatible bridge.
// Prefer importing from `@/lib/financial-subscriptions`.

export {
  FINANCIAL_SUBSCRIPTION_PROVIDERS as SUBSCRIPTION_PROVIDERS,
  getFinancialSubscriptionProvider as getSubscriptionProvider,
  getNextFinancialBillingDateFrom as getNextBillingDateFrom,
} from "@/lib/financial-subscriptions"
