"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useSwipe } from "@/hooks/use-swipe"
import dynamic from "next/dynamic"

const DashboardPage = dynamic(() => import("@/app/dashboard/page"), {
  ssr: false,
  loading: () => null,
})
import { AccountsScreen } from "@/components/accounts/accounts-screen"
import { HistoryScreen } from "@/components/history/history-screen"
import { PlanningShell } from "@/components/planning/planning-shell"

const TAB_ROUTES = ["/dashboard", "/accounts", "/history", "/planning"]
const TAB_PAGES = [
  { route: "/dashboard", page: <DashboardPage /> },
  { route: "/accounts", page: <AccountsScreen /> },
  { route: "/history", page: <HistoryScreen /> },
  { route: "/planning", page: <PlanningShell /> },
]

function getTabIndex(pathname: string): number {
  return TAB_ROUTES.indexOf(pathname)
}

export function SwipeNavigation({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const currentIndex = getTabIndex(pathname)
  const isTab = currentIndex !== -1
  const [activeIndex, setActiveIndex] = useState(isTab ? currentIndex : 0)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const viewportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isTab) {
      setActiveIndex(currentIndex)
      setIsDragging(false)
      setDragOffset(0)
    }
  }, [currentIndex, isTab])

  useEffect(() => {
    if (!isTab) return
    TAB_ROUTES.forEach((route) => router.prefetch(route))
  }, [isTab, router])

  const snapTo = useCallback((targetIndex: number) => {
    const clamped = Math.max(0, Math.min(targetIndex, TAB_ROUTES.length - 1))
    setIsDragging(false)
    if (clamped !== currentIndex) {
      setActiveIndex(clamped)
      router.push(TAB_ROUTES[clamped])
    } else {
      setDragOffset(0)
    }
  }, [currentIndex, router])

  const onDrag = useCallback((dx: number) => {
    if (!isTab || !viewportRef.current) return
    setIsDragging(true)
    setDragOffset(dx)
  }, [isTab])

  const onRelease = useCallback(() => {
    setIsDragging(false)
    setDragOffset(0)
  }, [])

  const onSwipeLeft = useCallback(() => {
    if (isTab) snapTo(currentIndex + 1)
  }, [isTab, currentIndex, snapTo])

  const onSwipeRight = useCallback(() => {
    if (isTab) snapTo(currentIndex - 1)
  }, [isTab, currentIndex, snapTo])

  useSwipe(viewportRef, {
    threshold: 55,
    onSwipeLeft,
    onSwipeRight,
    onDrag,
    onRelease,
  })

  if (!isTab) return <>{children}</>

  const vw = viewportRef.current?.clientWidth || 1
  const offsetPercent = -(activeIndex * 100) + (isDragging ? (dragOffset / vw) * 100 : 0)

  return (
    <div
      ref={viewportRef}
      style={{
        overflow: "hidden",
        width: "100%",
        height: "100dvh",
      }}
    >
      <div
        style={{
          display: "flex",
          height: "100%",
          transform: `translateX(${offsetPercent}%)`,
          transition: isDragging
            ? "none"
            : "transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)",
          willChange: "transform",
        }}
      >
        {TAB_PAGES.map((tabPage, index) => {
          const isActive = index === activeIndex
          const isAdjacent = index === activeIndex - 1 || index === activeIndex + 1
          const shouldMount = isActive || isAdjacent
          return (
            <div
              key={tabPage.route}
              aria-hidden={!isActive}
              style={{
                minWidth: "100%",
                height: "100%",
                flexShrink: 0,
                overflow: "hidden",
                pointerEvents: isActive ? "auto" : "none",
              }}
            >
              {shouldMount ? tabPage.page : <div style={{ width: "100%", height: "100%" }} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
