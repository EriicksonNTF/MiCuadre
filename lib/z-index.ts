export const Z_INDEX = {
  base: 0,
  stickyHeader: 100,
  navigation: 500,
  backdrop: 1000,
  modal: 1100,
  fab: 1200,
  receipt: 1500,
  toast: 2000,
} as const

export type ZIndexKey = keyof typeof Z_INDEX
