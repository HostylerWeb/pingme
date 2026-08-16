import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

export function PresencePulse({
  active,
  color,
  size = 8,
}: {
  active: boolean;
  color: string;
  size?: number;
}) {
  const pulse = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    if (active) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 0,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }

    const hide = Animated.timing(pulse, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    });
    hide.start();
    return () => hide.stop();
  }, [active, pulse]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          transform: [
            {
              scale: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.45],
              }),
            },
          ],
          opacity: pulse.interpolate({
            inputRange: [0, 1],
            outputRange: [0.35, 1],
          }),
        }}
      />
    </View>
  );
}
