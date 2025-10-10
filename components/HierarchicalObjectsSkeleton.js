import { ActivityIndicator, Platform, ScrollView, StatusBar, View } from 'react-native';
import AppStyles, { colors } from '../app/(tabs)/AppStyles';
// Conditionally require to avoid web import issues
let SkeletonPlaceholder = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    SkeletonPlaceholder = require('react-native-skeleton-placeholder').default;
  } catch (e) {
    SkeletonPlaceholder = null;
  }
}

const HierarchicalObjectsSkeleton = () => {
  // Fallback for web or if the native module isn't available
  if (!SkeletonPlaceholder) {
    return (
      <View style={[AppStyles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color={colors.blue600} />
      </View>
    );
  }

  return (
    <View style={AppStyles.screen}>
      <StatusBar barStyle="dark-content" />
      {/* Header Skeleton */}
      <View style={[AppStyles.header, { paddingHorizontal: 16, paddingVertical: 10 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Breadcrumbs */}
          <SkeletonPlaceholder borderRadius={6} backgroundColor={colors.lightGray200} highlightColor={colors.lightGray100}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 90, height: 16, borderRadius: 6, marginRight: 6 }} />
              <View style={{ width: 16, height: 16, borderRadius: 8, marginHorizontal: 4 }} />
              <View style={{ width: 70, height: 16, borderRadius: 6 }} />
            </View>
          </SkeletonPlaceholder>

          {/* Logout Button */}
          <SkeletonPlaceholder backgroundColor={colors.lightGray200} highlightColor={colors.lightGray100}>
            <View style={{ width: 36, height: 36, borderRadius: 8 }} />
          </SkeletonPlaceholder>
        </View>
      </View>

      {/* Cards List */}
      <ScrollView style={AppStyles.contentPadding}>
        <SkeletonPlaceholder borderRadius={10} backgroundColor={colors.lightGray200} highlightColor={colors.lightGray100}>
          {Array.from({ length: 5 }).map((_, index) => (
            <View
              key={index}
              style={{
                marginBottom: 16,
                padding: 16,
                borderRadius: 10,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              {/* Left Side (text content) */}
              <View style={{ flex: 1 }}>
                <View style={{ width: '70%', height: 18, borderRadius: 6, marginBottom: 8 }} />
                <View style={{ width: '50%', height: 14, borderRadius: 6, marginBottom: 6 }} />
                <View style={{ width: '60%', height: 14, borderRadius: 6 }} />
              </View>

              {/* Divider */}
              <View
                style={{
                  width: 1,
                  height: 50,
                  backgroundColor: colors.lightGray300,
                  marginHorizontal: 10,
                }}
              />

              {/* Property Button */}
              <View style={{ width: 90, height: 26, borderRadius: 6 }} />
            </View>
          ))}
        </SkeletonPlaceholder>
      </ScrollView>
    </View>
  );
};

export default HierarchicalObjectsSkeleton;