import {
  type ReactNode,
  useCallback,
} from "react"
import {
  Dimensions,
  StyleSheet,
  type LayoutChangeEvent,
  type ViewStyle,
} from "react-native"
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  type WithSpringConfig,
  interpolate,
  Extrapolation,
  runOnJS,
  useAnimatedReaction,
  useReducedMotion,
} from "react-native-reanimated"
import {
  Gesture,
  GestureDetector,
  type PanGestureHandlerEventPayload,
} from "react-native-gesture-handler"

const { height: SCREEN_HEIGHT } = Dimensions.get("window")

const SNAP_SPRING: WithSpringConfig = {
  damping: 24,
  stiffness: 260,
  mass: 0.6,
}

const CLOSE_THRESHOLD = 0.35
const VELOCITY_THRESHOLD = 350
const EXPANDED_FALLBACK = SCREEN_HEIGHT * 0.65

export type SheetSnapPoint = "collapsed" | "expanded"

interface ExpandableSheetProps {
  children: ReactNode
  peekContent?: ReactNode
  expandedContent?: ReactNode
  snapPoint?: SheetSnapPoint
  onSnap?: (point: SheetSnapPoint) => void
  peekHeight?: number
  springConfig?: Partial<WithSpringConfig>
}

export function ExpandableSheet({
  peekContent,
  expandedContent,
  snapPoint: controlledSnap,
  onSnap,
  peekHeight = 160,
  springConfig,
}: ExpandableSheetProps) {
  const translateY = useSharedValue(0)
  const isExpanded = useSharedValue(false)
  const contextY = useSharedValue(0)
  const expandedOffset = useSharedValue(-EXPANDED_FALLBACK)
  const reduceMotion = useReducedMotion()

  const snapSpring = { ...SNAP_SPRING, ...springConfig }

  const snapTo = useCallback(
    (point: SheetSnapPoint) => {
      "worklet"
      const targetY = point === "expanded" ? expandedOffset.value : 0
      const wasExpanded = isExpanded.value
      isExpanded.value = point === "expanded"
      if (reduceMotion) {
        translateY.value = targetY
      } else {
        translateY.value = withSpring(targetY, snapSpring)
      }
      if (onSnap && wasExpanded !== (point === "expanded")) runOnJS(onSnap)(point)
    },
    [snapSpring, reduceMotion, isExpanded, translateY, onSnap]
  )

  useAnimatedReaction(
    () => controlledSnap,
    (current, previous) => {
      if (current && current !== previous) {
        snapTo(current)
      }
    },
    [controlledSnap]
  )

  const handleCardTap = useCallback(() => {
    "worklet"
    snapTo("expanded")
  }, [snapTo])

  const panGesture = Gesture.Pan()
    .onStart(() => {
      contextY.value = translateY.value
    })
    .onUpdate((e: PanGestureHandlerEventPayload) => {
      const raw = contextY.value + e.translationY
      if (raw < 0) {
        translateY.value = reduceMotion ? 0 : raw * 0.35
      } else {
        translateY.value = raw
      }
    })
    .onEnd((e: PanGestureHandlerEventPayload) => {
      if (reduceMotion) return

      const velocity = e.velocityY
      const currentY = translateY.value

      if (Math.abs(velocity) > VELOCITY_THRESHOLD) {
        if (velocity < 0) {
          snapTo("expanded")
        } else {
          snapTo("collapsed")
        }
        return
      }

      const progress = Math.abs(currentY) / Math.abs(expandedOffset.value || EXPANDED_FALLBACK)
      if (progress > CLOSE_THRESHOLD) {
        snapTo("expanded")
      } else {
        snapTo("collapsed")
      }
    })
    .minDistance(10)
    .activeOffsetY([-10, 10])
    .failOffsetX([-15, 15])

  const tapGesture = Gesture.Tap()
    .onEnd(() => {
      if (!isExpanded.value && !reduceMotion) {
        handleCardTap()
      }
    })
    .maxDuration(300)

  const composed = Gesture.Simultaneous(panGesture, tapGesture)

  const backdropStyle = useAnimatedStyle((): ViewStyle => {
    const progress = interpolate(
      translateY.value,
      [0, Math.abs(expandedOffset.value || EXPANDED_FALLBACK)],
      [0, 1],
      Extrapolation.CLAMP
    )
    return {
      opacity: reduceMotion
        ? (isExpanded.value ? 1 : 0)
        : interpolate(progress, [0, 0.6], [0, 1], Extrapolation.CLAMP),
    }
  })

  const containerStyle = useAnimatedStyle((): ViewStyle => {
    const progress = interpolate(
      translateY.value,
      [0, Math.abs(expandedOffset.value || EXPANDED_FALLBACK)],
      [0, 1],
      Extrapolation.CLAMP
    )
    const scale = reduceMotion ? 1 : interpolate(progress, [0, 1], [1, 0.92], Extrapolation.CLAMP)
    return {
      transform: [
        { translateY: translateY.value },
        { scale },
      ],
    }
  })

  const onPeekLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const peekH = e.nativeEvent.layout.height
      if (peekH > 0) {
        expandedOffset.value = -(SCREEN_HEIGHT - peekH - 40)
      }
    },
    []
  )

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={styles.wrapper}>
        <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents="none" />

        <Animated.View style={[styles.sheet, containerStyle]}>
          <Animated.View onLayout={onPeekLayout}>
            {peekContent}
          </Animated.View>
          {expandedContent}
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    backgroundColor: "#0F172A",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
    paddingBottom: 34,
  },
})
