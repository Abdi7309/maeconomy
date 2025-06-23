import { Dimensions, Platform, StyleSheet } from 'react-native'; // Import StatusBar

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
            flexDirection: 'row', // For side-by-side layout (e.g., list on left, detail on right)
        }),
    },
    screen: {
        flex: 1, // Make screen fill available space
        backgroundColor: colors.white, // Default screen background to white
        // Conditional styling for desktop for the main screen container
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
        paddingTop: Platform.OS === 'ios' ? 48 : 40,
        paddingBottom: 16,
        paddingHorizontal: 1 * 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.lightGray200,
    },
    headerFlex: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 40, // Add fixed height for consistent alignment
    },
    headerTitle: {
        fontSize: 1.5 * 16,
        fontWeight: '700',
        color: colors.lightGray900,
        flex: 1,
        textAlign: 'center',
    },
    headerTitleLg: {
        fontSize: 1.125 * 16,
        fontWeight: '600',
        color: colors.lightGray900,
        flex: 1,
        textAlign: 'center', // Center the text
    },
    // Updated style for smaller, left-aligned breadcrumb-like titles
    headerTitleSmall: {
        fontSize: 1 * 16, // Default smaller font size for mobile breadcrumbs
        fontWeight: '600', // Still bold for emphasis
        color: colors.lightGray900, // Always black for "Objecten" and other breadcrumbs
        // No flex: 1 or textAlign: 'center' here, as it's part of a flex row
        ...(IS_DESKTOP && {
            fontSize: 1.7 * 16, // Larger font size for desktop breadcrumbs (was 1.25 * 16)
        }),
    },
    headerBackButton: {
        padding: 0.5 * 16,
        marginLeft: -0.5 * 16,
        marginRight: -0.5 * 16,
        borderRadius: 9999,
    },
    headerPlaceholder: {
        width: 40, // Match the width of headerBackButton
        height: 40, // Match the height of headerBackButton
    },
    contentPadding: {
        paddingVertical: 1.5 * 16,
        paddingHorizontal: 1 * 16,
        // Conditional styling for desktop
        ...(IS_DESKTOP && {
            padding: 2 * 16,
        }),
    },
    screenContentWrapper: {
        paddingBottom: 2 * 16, // Added padding for scrollable content below fixed header
    },
    // Detail Header (specific to property details)
    detailHeader: {
        paddingTop: 1 * 16,
        paddingBottom: 0.5 * 16,
    },
    detailName: {
        fontSize: 1.5 * 16,
        fontWeight: '700',
        color: colors.lightGray700,
        marginBottom: 0.25 * 16,
    },
    detailLocation: {
        fontSize: 1 * 16,
        color: colors.lightGray600,
        marginBottom: 0.25 * 16,
    },
    detailStatus: {
        fontSize: 1 * 16,
        fontWeight: '500',
        color: colors.lightGray600,
        marginBottom: 0.25 * 16,
    },
    detailType: {
        fontSize: 0.875 * 16,
        color: colors.lightGray500,
    },
    detailSubtitle: {
        fontSize: 0.875 * 16,
        color: colors.lightGray500,
        marginTop: 0.25 * 16,
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
        fontSize: 1.125 * 16, // Example size, adjust as needed
    },
    cardSubtitle: {
        fontSize: 0.875 * 16,
        color: colors.lightGray500,
        marginTop: 0.25 * 16,
    },
    cardLocation: {
        fontSize: 0.875 * 16,
        color: colors.lightGray500,
    },
    cardStatus: {
        fontSize: 0.875 * 16,
        color: colors.lightGray600,
        marginTop: 0.25 * 16,
    },
    // Buttons
    btnPrimary: {
        backgroundColor: colors.blue600,
        paddingVertical: 0.75 * 16,
        paddingHorizontal: 1.25 * 16,
        borderRadius: 0.5 * 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnPrimaryText: {
        color: colors.white,
        fontSize: 1 * 16,
        fontWeight: '600',
    },
    btnPrimaryModal: {
        minWidth: 6.25 * 16, // Ensure buttons in modal have a minimum width
    },
    btnSecondary: {
        backgroundColor: colors.lightGray100, // Lighter background
        paddingVertical: 0.75 * 16,
        paddingHorizontal: 1.25 * 16,
        borderRadius: 0.5 * 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.lightGray300,
    },
    btnSecondaryText: {
        color: colors.lightGray700,
        fontSize: 1 * 16,
        fontWeight: '600',
    },
    btnFull: {
        width: '100%',
    },
    btnFlexCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.5 * 16, // Space between icon and text
    },
    btnPurple: {
        backgroundColor: colors.purple600,
    },
    btnPurpleDisabled: {
        opacity: 0.6,
    },
    // Floating Action Button
    fab: {
        position: 'absolute',
        bottom: 1.25 * 16,
        right: 1.25 * 16,
        backgroundColor: colors.blue600,
        width: 3.5 * 16,
        height: 3.5 * 16,
        borderRadius: 1.75 * 16,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.md,
    },
    // Empty State
    emptyState: {
        padding: 1.25 * 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.white,
        borderRadius: 0.75 * 16,
        marginTop: 1 * 16,
        borderWidth: 1,
        borderColor: colors.lightGray200,
        borderStyle: 'dashed',
    },
    emptyStateText: {
        fontSize: 1.125 * 16,
        fontWeight: '600',
        color: colors.lightGray600,
        textAlign: 'center',
        marginBottom: 0.5 * 16,
    },
    emptyStateSubtext: {
        fontSize: 0.875 * 16,
        color: colors.lightGray500,
        textAlign: 'center',
    },
    // Info Boxes (from old details page, repurposed for existing properties)
    infoBox: {
        backgroundColor: colors.white,
        borderRadius: 0.75 * 16,
        padding: 1 * 16,
        marginBottom: 1 * 16,
        ...shadows.sm,
    },
    infoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    infoGridItem: {
        width: '48%', // Approx half minus spacing
        marginBottom: 0.75 * 16,
    },
    infoItemLabel: {
        fontSize: 0.875 * 16,
        color: colors.lightGray500,
        marginBottom: 0.25 * 16,
    },
    infoItemValue: {
        fontSize: 1 * 16,
        fontWeight: '500',
        color: colors.lightGray700,
    },
    // AI Description Section
    aiSection: {
        marginBottom: 1 * 16,
    },
    aiDescriptionBox: {
        backgroundColor: colors.lightGray50, // Very light background
        borderRadius: 0.75 * 16,
        padding: 1 * 16,
        marginBottom: 1 * 16,
        borderWidth: 1,
        borderColor: colors.lightGray200,
    },
    spinnerContainer: {
        paddingVertical: 1.25 * 16,
        alignItems: 'center',
    },
    // Property List (on PropertiesScreen)
    propertyList: {
        // Container for displaying existing properties
    },
    propertyItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.white,
        borderRadius: 0.75 * 16,
        paddingVertical: 0.75 * 16,
        paddingHorizontal: 1 * 16,
        marginBottom: 0.5 * 16,
        borderWidth: 1,
        borderColor: colors.lightGray200,
    },
    propertyItemMain: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 0.625 * 16,
    },
    propertyName: {
        fontSize: 1 * 16,
        fontWeight: '500',
        color: colors.lightGray700,
        marginLeft: 0.5 * 16,
    },
    propertyValue: {
        fontSize: 1 * 16,
        color: colors.lightGray600,
        fontWeight: 'bold',
    },
    // Add Property Screen Specific
    newPropertyItemWrapper: {
        marginBottom: 1.5 * 16,
        borderWidth: 1,
        borderColor: colors.lightGray200,
        borderRadius: 0.75 * 16,
        padding: 1 * 16,
    },
    newPropertyRemoveButton: {
        padding: 0.25 * 16,
    },
    formRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 1 * 16, // Margin for the entire row of inputs
    },
    formGroupHalf: { // For form groups that are half width in a row
        flex: 1,
        // No vertical margin here, it's handled by the parent formRow
    },
    formGroup: { // For full-width form groups
        marginBottom: 1 * 16,
    },
    formLabel: {
        fontSize: 0.875 * 16,
        color: colors.lightGray600,
        marginBottom: 0.375 * 16,
        fontWeight: '500',
    },
    formInput: {
        borderWidth: 1,
        borderColor: colors.lightGray300,
        borderRadius: 0.5 * 16,
        paddingVertical: 0.625 * 16,
        paddingHorizontal: 0.75 * 16,
        fontSize: 1 * 16,
        color: colors.lightGray700,
        backgroundColor: colors.white,
    },
    // Icon Grid (from old AddPropertyScreen, kept styles for completeness if needed)
    iconGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start', // Start icons from left
        marginTop: 0.5 * 16,
        gap: 0.5 * 16, // Space between icons
    },
    iconWrapper: {
        width: 2.5 * 16,
        height: 2.5 * 16,
        borderRadius: 1.25 * 16, // Circular
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 0.625 * 16, // Only vertical margin needed now with gap
    },
    iconWrapperNotSelected: {
        backgroundColor: colors.lightGray100,
        borderWidth: 1,
        borderColor: colors.lightGray300,
    },
    iconWrapperSelected: {
        backgroundColor: colors.blue100, // Light blue
        borderWidth: 2,
        borderColor: colors.blue600, // Blue border
    },
    // Modal Styles
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 16,
        width: IS_DESKTOP ? '20%' : '90%',
        maxHeight: '80%',
    },
    modalTitle: {
        fontSize: 1.25 * 16,
        fontWeight: '600',
        color: colors.lightGray700,
        marginBottom: 1.25 * 16,
        textAlign: 'center',
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginTop: 1.25 * 16,
    },
    // New button styles
    btnPropertyOutline: {
        backgroundColor: 'transparent',
        paddingVertical: 0.5 * 16,
        paddingHorizontal: 0.75 * 16,
        borderRadius: 0.375 * 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.lightGray300,
    },
    btnPropertyOutlineText: {
        color: colors.lightGray600,
        fontSize: 0.875 * 16,
        fontWeight: '500',
    },

    btnPropertyIcon: {
        backgroundColor: colors.lightGray50,
        paddingVertical: 0.5 * 16,
        paddingHorizontal: 0.75 * 16,
        borderRadius: 0.375 * 16,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 0.25 * 16,
    },
    btnPropertyIconText: {
        color: colors.lightGray600,
        fontSize: 0.875 * 16,
        fontWeight: '500',
    },

    btnPropertyText: {
        backgroundColor: 'transparent',
        paddingVertical: 0.5 * 16,
        paddingHorizontal: 0.5 * 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnPropertyTextOnly: {
        color: colors.blue600,
        fontSize: 0.875 * 16,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },

    btnPropertyChip: {
        backgroundColor: colors.lightGray100,
        paddingVertical: 0.375 * 16,
        paddingHorizontal: 0.625 * 16,
        borderRadius: 9999,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnPropertyChipText: {
        color: colors.lightGray700,
        fontSize: 0.75 * 16,
        fontWeight: '500',
    },

    btnPropertyChevron: {
        backgroundColor: 'transparent',
        paddingVertical: 0.5 * 16,
        paddingHorizontal: 0.5 * 16,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 0.25 * 16,
    },
    btnPropertyChevronText: {
        color: colors.lightGray600,
        fontSize: 0.875 * 16,
        fontWeight: '500',
    },
});

export default AppStyles;
