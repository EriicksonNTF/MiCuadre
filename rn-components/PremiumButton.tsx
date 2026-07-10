import { useCallback } from "react"
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
  Platform,
} from "react-native"
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  type WithSpringConfig,
  runOnJS,
  useReducedMotion,
} from "react-native-reanimated"
import * as Haptics from "expo-haptics"

export type PremiumButtonVariant = "primary" | "secondary" | "ghost" | "destructive"

export interface PremiumButtonProps extends Omit<PressableProps, "onPressIn" | "onPressOut" | "style"> {
  variant?: PremiumButtonVariant
  hapticStyle?: Haptics.ImpactFeedbackStyle
  springConfig?: Partial<WithSpringConfig>
  scaleIn?: number
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  onPressIn?: () => void
  onPressOut?: () => void
}

const PRESS_SPRING: WithSpringConfig = {
  damping: 16,
  stiffness: 220,
  mass: 0.5,
}

const RELEASE_SPRING: WithSpringConfig = {
  damping: 18,
  stiffness: 320,
  mass: 0.4,
}

const SCALE_IN = 0.965
const SCALE_OUT = 1

const VARIANT_STYLES: Record<PremiumButtonVariant, ViewStyle> = {
  primary: {
    backgroundColor: "#059669",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  secondary: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  ghost: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  destructive: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
}

function triggerHaptic(style: Haptics.ImpactFeedbackStyle) {
  if (Platform.OS === "ios") {
    Haptics.impactAsync(style).catch(() => {})
  } else {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
  }
}

export function PremiumButton({
  variant = "primary",
  hapticStyle = Haptics.ImpactFeedbackStyle.Light,
  springConfig,
  scaleIn = SCALE_IN,
  children,
  style,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: PremiumButtonProps) {
  const scale = useSharedValue(SCALE_OUT)
  const reduceMotion = useReducedMotion()
  const pressConfig = { ...PRESS_SPRING, ...springConfig }
  const releaseConfig = { ...RELEASE_SPRING, ...springConfig }

  const handlePressIn = useCallback(() => {
    "worklet"
    if (reduceMotion) {
      scale.value = 0.98
    } else {
      scale.value = withSpring(scaleIn, pressConfig)
    }
    runOnJS(triggerHaptic)(hapticStyle)
    if (onPressIn) runOnJS(onPressIn)()
  }, [scaleIn, pressConfig, hapticStyle, onPressIn, reduceMotion])

  const handlePressOut = useCallback(() => {
    "worklet"
    if (reduceMotion) {
      scale.value = 1
    } else {
      scale.value = withSpring(SCALE_OUT, releaseConfig)
    }
    if (onPressOut) runOnJS(onPressOut)()
  }, [releaseConfig, onPressOut, reduceMotion])

  const animatedStyle = useAnimatedStyle((): ViewStyle => {
    return {
      transform: [{ scale: scale.value }],
    }
  }, [scale])

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        role="button"
        accessibilityRole="button"
        {...rest}
      >
        <Animated.View
          style={[
            VARIANT_STYLES[variant],
            disabled && { opacity: 0.4 },
            style as ViewStyle,
          ]}
        >
          {children}
        </Animated.View>
      </Pressable>
    </Animated.View>
  )
}
