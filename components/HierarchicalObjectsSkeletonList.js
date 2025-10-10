// components/HierarchicalObjectsSkeletonList.js
import { Platform, View } from 'react-native';
import { colors } from '../app/(tabs)/AppStyles';

let SkeletonPlaceholder = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    SkeletonPlaceholder = require('react-native-skeleton-placeholder').default;
  } catch (e) {
    SkeletonPlaceholder = null;
  }
}

const FallbackBlock = ({ style }) => (
  <View style={[{ backgroundColor: colors.lightGray200, borderRadius: 10 }, style]} />
);

const CardContainer = ({ children }) => (
  <View
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 22,
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
  // Web or missing native lib -> fallback blocks
  if (!SkeletonPlaceholder) {
    return (
      <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
        {Array.from({ length: count }).map((_, index) => (
          <CardContainer key={index}>
            {/* Left text-only section (exactly 3 lines) */}
            <View style={{ flex: 1, marginRight: 14 }}>
              <FallbackBlock style={{ width: '36%', height: 16, borderRadius: 6, marginBottom: 8 }} />
              <FallbackBlock style={{ width: '28%', height: 14, borderRadius: 6, marginBottom: 8 }} />
              <FallbackBlock style={{ width: '21%', height: 14, borderRadius: 6 }} />
            </View>
            {/* Divider */}
            <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: colors.lightGray300, marginHorizontal: 10 }} />
            {/* Eigenschappen button placeholder */}
            <FallbackBlock style={{ width: 100, height: 28, borderRadius: 6 }} />
          </CardContainer>
        ))}
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
      {Array.from({ length: count }).map((_, index) => (
        <CardContainer key={index}>
          <SkeletonPlaceholder backgroundColor={colors.lightGray200} highlightColor={colors.lightGray100} borderRadius={10}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              {/* Left text-only section (exactly 3 lines) */}
              <View style={{ flex: 1, marginRight: 14 }}>
                <View style={{ width: '36%', height: 16, borderRadius: 6, marginBottom: 8 }} />
                <View style={{ width: '28%', height: 14, borderRadius: 6, marginBottom: 8 }} />
                <View style={{ width: '21%', height: 14, borderRadius: 6 }} />
              </View>
              {/* Divider */}
              <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: colors.lightGray300, marginHorizontal: 10 }} />
              {/* Eigenschappen button placeholder */}
              <View style={{ width: 100, height: 28, borderRadius: 6 }} />
            </View>
          </SkeletonPlaceholder>
        </CardContainer>
      ))}
    </View>
  );
};

export default HierarchicalObjectsSkeletonList;
