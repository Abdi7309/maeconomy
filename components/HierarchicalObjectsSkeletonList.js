// components/HierarchicalObjectsSkeletonList.js
import { Square } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Animated, Platform, View } from 'react-native';
import { colors } from '../app/(tabs)/AppStyles';

const FallbackBlock = ({ style }) => (
  <View style={[{ backgroundColor: colors.lightGray200, borderRadius: 10 }, style]} />
);

const CardContainer = ({ children }) => (
  <View
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      top: -10,
      height: 109,
      width: '101.8%',
      left: -15 ,
      marginBottom: 15,
      borderRadius: 10,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.lightGray300,
      backgroundColor: colors.white,
      padding: 12,
    }}
  >
    {children}
  </View>
);

/**
 * YouTube-style skeleton list for object cards.
 * - count: number of fake cards to show
 */
const HierarchicalObjectsSkeletonList = ({ count = 6 }) => {
  // Flash/pulse animation for skeleton content (web only)
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const loop = Animated.loop(
      Animated.sequence([
        // Stronger pulse contrast and 1s total cycle (0.5s up, 0.5s down)
        Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const animatedStyle = {
    // Make flashing more visible
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.95] })
  };

  // Do not render skeleton on Android/iOS
  if (Platform.OS !== 'web') {
    return null;
  }
  // Web-only fallback skeleton blocks (no native dependency fack
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
      {Array.from({ length: count }).map((_, index) => (
        <Animated.View key={index} style={animatedStyle}>
          <CardContainer>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}> 
              {/* Icon loading placeholder */}
              <View style={{ alignItems: 'center', justifyContent: 'center', left: 5, marginRight: 15, minWidth: 40 }}>
                <Square color={colors.lightGray400} size={24} />
                <FallbackBlock style={{ width: 60, height: 6, borderRadius: 3, left: 0, marginTop: 4 }} />
              </View>
              {/* Left text-only section (exactly 3 lines) */}
              <View style={{ flex: 1, marginRight: 14 }}>
                <FallbackBlock style={{ width: '21%', height: 16, borderRadius: 6, marginBottom: 13 }} />
                <FallbackBlock style={{ width: '28%', height: 14, borderRadius: 6, marginBottom: 8 }} />
                <FallbackBlock style={{ width: '36%', height: 14, borderRadius: 6 }} />
              </View>
              {/* Divider */}
              <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: colors.lightGray300, marginHorizontal: 25 }} />
              {/* Eigenschappen button placeholder */}
              <FallbackBlock style={{ width: 100, left: -8, height: 25, borderRadius: 6 }} />
            </View>
          </CardContainer>
        </Animated.View>
      ))}
    </View>
  );
};

export default HierarchicalObjectsSkeletonList;

