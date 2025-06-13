// AppStyles.js
import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const IS_DESKTOP = width >= 768; // Define your breakpoint for responsive behavior

export const colors = {
  // New White Theme Colors
  blue600: '#2563eb',
  blue700: '#1d4ed8',
  purple600: '#9333ea',
  purple700: '#7e22ce',
  // Lighter gray shades for backgrounds and borders
  lightGray50: '#F9FAFB', // Very light background
  lightGray100: '#F3F4F6', // Slightly darker background
  lightGray200: '#E5E7EB', // Border color
  lightGray300: '#D1D5DB', // Input border, subtle
  lightGray400: '#9CA3AF', // Lighter text/placeholder
  lightGray500: '#6B7280', // Default text
  lightGray600: '#4B5563', // Slightly darker text
  lightGray700: '#374151', // Darker text/label
  lightGray800: '#1F2937', // Even darker text
  lightGray900: '#111827', // Almost black text
  white: '#ffffff',
  black: '#000000',
  red500: '#EF4444', // Example for error states if needed
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1, // For Android
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4, // For Android
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 10, // For Android
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.1,
    shadowRadius: 25,
    elevation: 15, // For Android
  },
};

const AppStyles = StyleSheet.create({
  appContainer: {
    flex: 1, // Make it fill the screen
    backgroundColor: colors.lightGray100, // Overall background
    // Conditional styling for desktop
    ...(IS_DESKTOP && {
      flexDirection: 'row', // For side-by-side layout
    }),
  },
  screen: {
    flex: 1, // Make screen fill available space
    backgroundColor: colors.white, // Default screen background to white
    // Conditional styling for desktop
    ...(IS_DESKTOP && {
      borderRightWidth: 1,
      borderRightColor: colors.lightGray200,
    }),
  },
  screenWhite: {
    backgroundColor: colors.white,
  },
  header: {
    backgroundColor: colors.white,
    paddingVertical: 1.5 * 16,
    paddingHorizontal: 1 * 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray200,
  },
  headerFlex: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 1.5 * 16,
    fontWeight: '700',
    color: colors.lightGray900, // Darker text
  },
  headerTitleLg: {
    fontSize: 1.125 * 16,
    fontWeight: '600',
    color: colors.lightGray900, // Darker text
  },
  headerBackButton: {
    padding: 0.5 * 16,
    marginLeft: -0.5 * 16,
    borderRadius: 9999, // High value for circle
  },
  headerPlaceholder: {
    width: 2.5 * 16,
    height: 2.5 * 16,
    // Conditional styling for desktop
    ...(IS_DESKTOP && {
      width: 'auto',
      flexGrow: 1,
    }),
  },
  contentPadding: {
    paddingVertical: 1.5 * 16,
    paddingHorizontal: 1 * 16,
    // Conditional styling for desktop
    ...(IS_DESKTOP && {
      padding: 2 * 16,
    }),
  },
  cardList: {
    flexDirection: 'column',
    gap: 1 * 16,
  },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.lightGray200,
    borderRadius: 0.75 * 16,
    padding: 1 * 16,
    ...shadows.sm,
  },
  cardFlex: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontWeight: '600',
    color: colors.lightGray900,
    marginBottom: 0.25 * 16,
  },
  cardSubtitle: {
    color: colors.lightGray500,
    fontSize: 0.875 * 16,
  },
  btnPrimary: {
    backgroundColor: colors.blue600,
    borderRadius: 0.5 * 16,
    paddingVertical: 0.5 * 16,
    paddingHorizontal: 1 * 16,
  },
  btnPrimaryText: {
    color: colors.white,
    fontSize: 0.875 * 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  btnFull: {
    width: '100%',
    paddingVertical: 1 * 16,
    paddingHorizontal: 1.5 * 16,
    borderRadius: 0.75 * 16,
  },
  btnPurple: {
    backgroundColor: colors.purple600,
  },
  btnPurpleDisabled: {
    backgroundColor: '#c084fc', // A lighter purple for disabled state
  },
  btnFlexCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0.5 * 16,
  },
  fab: {
    position: 'absolute',
    bottom: 1.5 * 16,
    right: 1.5 * 16,
    width: 3.5 * 16,
    height: 3.5 * 16,
    backgroundColor: colors.purple600, // Changed FAB to purple to match the image
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  detailHeader: {
    marginTop: 0.5 * 16,
  },
  detailName: {
    fontSize: 1.25 * 16,
    fontWeight: '700',
    color: colors.lightGray900,
  },
  detailLocation: {
    color: colors.lightGray500,
  },
  infoBox: {
    backgroundColor: colors.lightGray50, // Lighter background for info box
    borderRadius: 0.75 * 16,
    padding: 1 * 16,
    marginBottom: 1.5 * 16,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 1 * 16,
  },
  infoGridItem: {
    width: '48%',
  },
  infoItemLabel: {
    fontSize: 0.875 * 16,
    color: colors.lightGray500,
  },
  infoItemValue: {
    fontWeight: '500',
    color: colors.lightGray900,
  },
  stickyHeader: {
    position: 'absolute',
    top: 0,
    zIndex: 10,
    width: '100%',
  },
  propertyList: {
    flexDirection: 'column',
    gap: 0.5 * 16,
  },
  propertyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 1 * 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.lightGray200,
    borderRadius: 0.5 * 16,
  },
  propertyItemMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1 * 16,
  },
  propertyName: {
    fontWeight: '500',
    color: colors.lightGray900,
  },
  propertyValue: {
    color: colors.lightGray600,
  },
  emptyState: {
    textAlign: 'center',
    paddingVertical: 2.5 * 16,
    paddingHorizontal: 1 * 16,
    backgroundColor: colors.white,
    borderRadius: 0.5 * 16,
    borderWidth: 1,
    borderColor: colors.lightGray200,
  },
  emptyStateText: {
    color: colors.lightGray500,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 0.875 * 16,
    color: colors.lightGray400,
    marginTop: 0.25 * 16,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1, // Occupy full screen
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 1 * 16,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: 1 * 16,
    padding: 1.5 * 16,
    width: '90%', // Adjust width for smaller screens
    maxWidth: 24 * 16,
    ...shadows.lg, // Add shadow to modal
  },
  modalTitle: {
    fontSize: 1.25 * 16,
    fontWeight: '700',
    color: colors.lightGray900,
    marginBottom: 1.5 * 16,
  },
  formGroup: {
    marginBottom: 1 * 16,
  },
  formLabel: {
    fontSize: 0.875 * 16,
    fontWeight: '500',
    color: colors.lightGray700,
    marginBottom: 0.5 * 16,
  },
  formInput: {
    width: '100%',
    paddingVertical: 0.75 * 16,
    paddingHorizontal: 0.75 * 16,
    borderWidth: 1,
    borderColor: colors.lightGray300,
    borderRadius: 0.5 * 16,
    color: colors.lightGray900,
    backgroundColor: colors.white, // Ensure input background is white
  },
  formSelect: {
    width: '100%',
    // In React Native, Picker styling is a bit different. You style the container
    // and potentially the individual items if the component supports it.
    // The main style here applies to the Picker container.
    height: 3.5 * 16, // Standard height for input fields
    borderWidth: 1,
    borderColor: colors.lightGray300,
    borderRadius: 0.5 * 16,
    backgroundColor: colors.white,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 0.75 * 16,
    marginTop: 1.5 * 16,
  },
  btnSecondary: {
    flex: 1,
    paddingVertical: 0.75 * 16,
    paddingHorizontal: 1 * 16,
    borderWidth: 1,
    borderColor: colors.lightGray300,
    borderRadius: 0.5 * 16,
    backgroundColor: colors.white,
  },
  btnSecondaryText: {
    color: colors.lightGray700,
    textAlign: 'center',
  },
  btnPrimaryModal: {
    flex: 1,
  },
  pageContainer: {
    flexDirection: 'column',
    minHeight: '100%',
    backgroundColor: colors.lightGray50,
  },
  pageContent: {
    flexGrow: 1,
    paddingVertical: 1.5 * 16,
    paddingHorizontal: 1 * 16,
  },
  pageFooter: {
    backgroundColor: colors.white,
    padding: 1 * 16,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray200,
    marginTop: 'auto',
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 0.75 * 16,
    justifyContent: 'space-between',
  },
  iconWrapper: {
    width: (width - (1 * 16 * 2) - (0.75 * 16 * 5)) / 6, // Calculate width for 6 columns approx
    aspectRatio: 1, // Keep it square
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0.75 * 16,
    borderRadius: 0.5 * 16,
  },
  iconWrapperSelected: {
    backgroundColor: '#dbeafe', // light blue
    borderWidth: 2,
    borderColor: colors.blue600,
  },
  iconWrapperNotSelected: {
    backgroundColor: colors.lightGray100, // Light gray for not selected
    borderWidth: 2,
    borderColor: 'transparent',
  },
  aiSection: {
    marginTop: 1.5 * 16,
  },
  aiDescriptionBox: {
    backgroundColor: colors.lightGray50,
    borderRadius: 0.75 * 16,
    padding: 1 * 16,
    marginTop: 1.5 * 16,
  },
  spinner: {
    borderRadius: 9999,
    width: 2 * 16,
    height: 2 * 16,
    borderTopWidth: 2,
    borderTopColor: colors.purple600,
    borderRightWidth: 2,
    borderRightColor: 'transparent',
  },
  spinnerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 1 * 16,
  },
  propertyDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 0.75 * 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray100,
  },
  propertyDetailLabel: {
    fontWeight: '600',
    color: colors.lightGray700,
  },
  propertyDetailValue: {
    color: colors.lightGray900,
  },
  // Desktop specific styles
  twoPanelLayout: {
    flexDirection: 'row',
    flex: 1, // Make it fill the available space
    backgroundColor: colors.lightGray100,
  },
  objectsScreenDesktop: {
    maxWidth: 22 * 16,
    flexShrink: 0,
    borderRightWidth: 1,
    borderRightColor: colors.lightGray200,
    ...shadows.sm,
  },
  mainContentPanel: {
    flexGrow: 1,
    backgroundColor: colors.white,
    flexDirection: 'column',
    ...shadows.sm,
  },
  screenContentWrapper: {
    flexGrow: 1,
  },
  selectedCard: {
    backgroundColor: '#dbeafe', // var(--blue-50)
    borderColor: colors.blue600,
    borderWidth: 1,
    ...shadows.md,
  },
  fabHiddenDesktop: {
    display: 'none',
  },
});

export default AppStyles;