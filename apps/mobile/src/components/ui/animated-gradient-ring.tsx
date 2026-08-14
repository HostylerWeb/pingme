import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, View, type ViewStyle } from 'react-native';

type AnimatedGradientRingProps = {
  colors: string[];
  size: number;
  borderWidth?: number;
  innerBackgroundColor?: string;
  style?: ViewStyle;
  children: React.ReactNode;
};

export function AnimatedGradientRing({
  colors,
  size,
  borderWidth = 4,
  innerBackgroundColor = '#fff',
  style,
  children,
}: AnimatedGradientRingProps) {
  const spin = useRef(new Animated.Value(0)).current;
  const innerSize = size - borderWidth * 2;
  const gradientSize = size * 1.45;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 4200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View
      style={[
        { width: size, height: size, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: size / 2 },
        style,
      ]}
    >
      <Animated.View
        style={{
          position: 'absolute',
          width: gradientSize,
          height: gradientSize,
          transform: [{ rotate }],
        }}
      >
        <LinearGradient
          colors={[colors[0], colors[1], colors[2] ?? colors[0], colors[0]] as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: gradientSize, height: gradientSize, borderRadius: gradientSize / 2 }}
        />
      </Animated.View>
      <View
        style={{
          width: innerSize,
          height: innerSize,
          borderRadius: innerSize / 2,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: innerBackgroundColor,
        }}
      >
        {children}
      </View>
    </View>
  );
}
