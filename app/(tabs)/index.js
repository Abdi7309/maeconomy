import { Box, ChevronLeft, ChevronRight, FileText, KeyRound, Paintbrush, Palette, Plus, Ruler, Tag, Wrench, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View, StyleSheet, Dimensions } from 'react-native';
import { Picker } from '@react-native-picker/picker';

// Re-integrating AppStyles and colors directly into this file
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


// Use a single default icon since it's no longer stored per property
const DEFAULT_PROPERTY_ICON = 'Tag'; // You can change this to any icon key from IconMap

const IconMap = { Palette, Ruler, Box, Wrench, Tag, KeyRound, FileText, Paintbrush };

const App = () => {
    const [currentScreen, setCurrentScreen] = useState('objects');
    const [selectedProperty, setSelectedProperty] = useState(null);
    const [showAddObjectModal, setShowAddObjectModal] = useState(false);
    const [currentPath, setCurrentPath] = useState([]);
    const [objectsHierarchy, setObjectsHierarchy] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    // New state for fetched templates
    const [fetchedTemplates, setFetchedTemplates] = useState({}); // Changed to an object for direct lookup by name

    // IMPORTANT: Replace with your actual API base URL.
    // Ensure your device running the app can reach this IP address.
    // For local development, this usually means your computer's local IP.
    const API_BASE_URL = 'http://10.3.1.25/Maeconomy/app/(tabs)/api.php';

    // Helper to find an item by path (e.g., [1, 101] finds item with id 101 inside item with id 1)
    const findItemByPath = (data, path) => {
        let currentItems = data;
        let foundItem = null;

        for (let i = 0; i < path.length; i++) {
            const idToFind = path[i];

            if (!Array.isArray(currentItems)) {
                console.error("findItemByPath: currentItems is not an array at iteration", i, "path segment:", idToFind, "Value:", currentItems);
                return null;
            }

            const item = currentItems.find(item => item.id === idToFind);

            if (!item) {
                foundItem = null;
                break;
            }

            foundItem = item;
            currentItems = Array.isArray(item.children) ? item.children : [];
        }
        return foundItem;
    };

    // Function to fetch the entire hierarchy from the root and update state
    const fetchAndSetAllObjects = async (isRefreshing = false) => {
        console.log('Fetching all objects hierarchy...');
        if (isRefreshing) {
            setRefreshing(true);
        }

        try {
            // 1. Fetch all top-level objects (parent_id IS NULL)
            const topLevelResponse = await fetch(`${API_BASE_URL}?entity=objects`);
            if (!topLevelResponse.ok) {
                throw new Error(`HTTP error! status: ${topLevelResponse.status} for top-level objects`);
            }
            const topLevelObjects = await topLevelResponse.json();

            // 2. For each top-level object, recursively fetch its full hierarchy
            const hydrationPromises = topLevelObjects.map(async (obj) => {
                try {
                    const fullObjectResponse = await fetch(`${API_BASE_URL}?entity=objects&id=${obj.id}`);
                    if (!fullObjectResponse.ok) {
                        console.warn(`Failed to fetch full hierarchy for object ID ${obj.id}. Skipping. Status: ${fullObjectResponse.status}`);
                        return null; // Return null for this object if fetching fails
                    }
                    return await fullObjectResponse.json();
                } catch (innerError) {
                    console.error(`Error fetching full hierarchy for object ID ${obj.id}:`, innerError);
                    return null; // Return null if any error occurs during fetch
                }
            });

            const fullyHydratedObjects = (await Promise.all(hydrationPromises)).filter(Boolean);

            setObjectsHierarchy(fullyHydratedObjects.filter(Boolean)); // Ensure only valid objects are set

        } catch (error) {
            console.error('Failed to fetch and set all objects (overall error):', error);
            Alert.alert(
                'Error',
                'Failed to load data. Please check your network connection and ensure the PHP API is running correctly and accessible.'
            );
        } finally {
            if (isRefreshing) {
                setRefreshing(false);
            }
        }
    };

    // Function to fetch templates from the API
    const fetchTemplates = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}?entity=templates`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} for templates`);
            }
            const templatesData = await response.json();
            // Format templates into an object where keys are template names
            const formattedTemplates = {};
            // Use Promise.all to fetch all template properties concurrently
            await Promise.all(templatesData.map(async (template) => {
                try {
                    const propertiesResponse = await fetch(`${API_BASE_URL}?entity=templates&id=${template.id}`);
                    if (!propertiesResponse.ok) {
                        console.warn(`Failed to fetch properties for template ID ${template.id}. Skipping.`);
                        return; // Skip this template if properties cannot be fetched
                    }
                    const templateWithProperties = await propertiesResponse.json();
                    if (templateWithProperties && templateWithProperties.properties) {
                        formattedTemplates[template.name] = templateWithProperties.properties;
                    }
                } catch (innerError) {
                    console.error(`Error fetching properties for template ID ${template.id}:`, innerError);
                }
            }));
            setFetchedTemplates(formattedTemplates);
        } catch (error) {
            console.error('Failed to fetch templates:', error);
            Alert.alert(
                'Error',
                'Failed to load templates. Please check your network connection and API.'
            );
        }
    };


    // Handle pull-to-refresh
    const onRefresh = () => {
        fetchAndSetAllObjects(true);
        fetchTemplates(); // Also refresh templates on pull-to-refresh
    };

    // Initial fetch for top-level objects and templates when component mounts
    useEffect(() => {
        fetchAndSetAllObjects();
        fetchTemplates(); // Fetch templates on initial mount
    }, []); // Empty dependency array means this runs once on component mount

    const handleAddObject = async (parentPath, newObject) => {
        try {
            const parentId = parentPath.length > 0 ? parentPath[parentPath.length - 1] : null;

            const response = await fetch(`${API_BASE_URL}?entity=objects`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: newObject.name, // Use 'name' as expected by PHP API's POST endpoint
                    parent_id: parentId,
                }),
            });

            const result = await response.json();

            if (response.ok) {
                Alert.alert('Success', result.message);
                // After adding, re-fetch the entire hierarchy to ensure UI updates
                await fetchAndSetAllObjects();
            } else {
                Alert.alert('Error', result.message || 'Failed to add object.');
            }
        } catch (error) {
            console.error('Error adding object:', error);
            Alert.alert('Error', 'An unexpected error occurred while adding the object.');
        } finally {
            setShowAddObjectModal(false);
        }
    };

    // Update the PropertyButton component
    const PropertyButton = ({ onClick }) => (
        <TouchableOpacity onPress={onClick} style={AppStyles.btnPropertyChevron}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={AppStyles.btnPropertyChevronText}>Eigenschappen</Text>
                <ChevronRight color={colors.lightGray400} size={16} />
            </View>
        </TouchableOpacity>
    );

    const HierarchicalObjectsScreen = ({ items, currentLevelPath }) => {
        const isRootLevel = currentLevelPath.length === 0;

        // --- Breadcrumb Logic Start ---
        const getBreadcrumbs = () => {
            let breadcrumbs = [{ id: 'root', name: 'Objecten', path: [] }]; // Always start with "Objecten"
            let currentItems = objectsHierarchy;

            currentLevelPath.forEach((id, index) => {
                const item = currentItems.find(obj => obj.id === id);
                if (item) {
                    breadcrumbs.push({
                        id: item.id,
                        name: item.naam,
                        path: currentLevelPath.slice(0, index + 1)
                    });
                    currentItems = item.children || [];
                }
            });
            return breadcrumbs;
        };

        const breadcrumbs = getBreadcrumbs();
        // --- Breadcrumb Logic End ---

        return (
            <View style={AppStyles.screen}>
                <View style={AppStyles.header}>
                    <View style={AppStyles.headerFlex}>
                        {/* No back button here as per user request */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 1 }}>
                            {breadcrumbs.map((crumb, index) => (
                                <View key={crumb.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    {/* Don't show chevron for the first breadcrumb or if it's the only one */}
                                    {index > 0 && (
                                        <ChevronRight color={colors.lightGray700} size={16} style={{ marginHorizontal: 4 }} />
                                    )}
                                    <TouchableOpacity
                                        // Only make the crumb clickable if it's not the current active one
                                        onPress={() => {
                                            if (index !== breadcrumbs.length - 1) {
                                                setCurrentPath(crumb.path);
                                                setCurrentScreen('objects');
                                                setSelectedProperty(null);
                                            }
                                        }}
                                    >
                                        <Text style={[
                                            AppStyles.headerTitleSmall, // Applying the new smaller, left-aligned style
                                            // Always use lightGray900 for color, make bold only for the active crumb
                                            { color: colors.lightGray900 },
                                            index === breadcrumbs.length - 1 && { fontWeight: 'bold' }
                                        ]}>
                                            {crumb.name}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>
                        {/* Placeholder is also removed as there is no back button to balance */}
                    </View>
                </View>
                <ScrollView
                    style={AppStyles.contentPadding}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[colors.blue600]} // Android
                            tintColor={colors.blue600} // iOS
                            title="Vernieuwen..." // iOS
                            titleColor={colors.lightGray600} // iOS
                        />
                    }
                >
                    <View style={AppStyles.cardList}>
                        {items.length > 0 ? (
                            items.map((item) => (
                                <TouchableOpacity
                                    key={item.id} // Key is essential for React list rendering
                                    style={AppStyles.card}
                                    onPress={() => {
                                        setSelectedProperty(null);
                                        setCurrentPath(currentLevelPath.concat(item.id));
                                        setCurrentScreen('objects');
                                    }}
                                >
                                    <View style={AppStyles.cardFlex}>
                                        <View style={AppStyles.cardContent}>
                                            <Text style={AppStyles.cardTitle}>{item.naam}</Text>
                                            <Text style={AppStyles.cardSubtitle}>
                                                {(item.properties || []).length} eigenschap{(item.properties || []).length !== 1 ? 'pen' : ''}
                                                {/* children.length is now accurate as the hierarchy is fully loaded */}
                                                {(item.children || []).length > 0 ? ` - ${(item.children || []).length} sub-item(s)` : ''}
                                            </Text>
                                        </View>
                                        <PropertyButton onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedProperty(item.id);
                                            setCurrentScreen('properties');
                                        }} />
                                    </View>
                                </TouchableOpacity>
                            ))
                        ) : (
                            <View style={AppStyles.emptyState}>
                                <Text style={AppStyles.emptyStateText}>Geen items gevonden.</Text>
                                <Text style={AppStyles.emptyStateSubtext}>
                                    Klik op de '+' knop om een nieuw item toe te voegen aan deze {isRootLevel ? 'lijst' : 'locatie'}.
                                </Text>
                            </View>
                        )}
                    </View>
                </ScrollView>
                <TouchableOpacity onPress={() => setShowAddObjectModal(true)} style={AppStyles.fab}>
                    <Plus color="white" size={24} />
                </TouchableOpacity>
            </View>
        );
    };

    // Update the property item rendering in PropertiesScreen
    const PropertiesScreen = ({ currentPath }) => {
        const item = findItemByPath(objectsHierarchy, currentPath);
        if (!item) return null;

        // Always render the default icon
        const renderIcon = (customColor = colors.lightGray500) => {
            const Icon = IconMap[DEFAULT_PROPERTY_ICON] || Tag;
            return <Icon color={customColor} size={20} />;
        };

        return (
            <View style={[AppStyles.screen, { flex: 1 }]}>
                <View style={AppStyles.header}>
                    <View style={AppStyles.headerFlex}>
                        <TouchableOpacity onPress={() => setCurrentScreen('objects')} style={AppStyles.headerBackButton}>
                            <ChevronLeft color={colors.lightGray700} size={24} />
                        </TouchableOpacity>
                        <Text style={AppStyles.headerTitleLg}>Eigenschappen</Text>
                        <View style={AppStyles.headerPlaceholder} />
                    </View>
                </View>
                <View style={{ backgroundColor: colors.white, padding: 1 * 16, borderBottomWidth: 1, borderBottomColor: colors.lightGray200 }}>
                    <Text style={AppStyles.detailName}>{item.naam}</Text>
                    <Text style={AppStyles.detailSubtitle}>
                        {(item.properties || []).length} eigenschap{(item.properties || []).length !== 1 ? 'pen' : ''}
                    </Text>
                </View>
                <ScrollView
                    style={AppStyles.contentPadding}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[colors.blue600]} // Android
                            tintColor={colors.blue600} // iOS
                            title="Vernieuwen..." // iOS
                            titleColor={colors.lightGray600} // iOS
                        />
                    }
                >
                    <View style={AppStyles.propertyList}>
                        {(item.properties && item.properties.length > 0) ? (
                            item.properties.map((prop, index) => (
                                <View key={index} style={AppStyles.propertyItem}>
                                    <View style={AppStyles.propertyItemMain}>
                                        {renderIcon()}
                                        <Text style={AppStyles.propertyName}>{prop.name}</Text>
                                    </View>
                                    <Text style={AppStyles.propertyValue}>{prop.waarde}</Text>
                                </View>
                            ))
                        ) : (
                            <View style={AppStyles.emptyState}>
                                <Text style={AppStyles.emptyStateText}>Nog geen eigenschappen toegevoegd.</Text>
                                <Text style={AppStyles.emptyStateSubtext}>Klik op de '+' knop om te beginnen.</Text>
                            </View>
                        )}
                    </View>
                </ScrollView>
                <TouchableOpacity onPress={() => setCurrentScreen('addProperty')} style={AppStyles.fab}>
                    <Plus color="white" size={24} />
                </TouchableOpacity>
            </View>
        );
    };

    const AddPropertyScreen = ({ currentPath }) => {
        const item = findItemByPath(objectsHierarchy, currentPath);
        if (!item) return null;

        const [newPropertiesList, setNewPropertiesList] = useState([]);
        const [nextNewPropertyId, setNextNewPropertyId] = useState(0);
        const [selectedTemplate, setSelectedTemplate] = useState(null); // New state for selected template

        // Effect to ensure there's always at least one empty field for input
        useEffect(() => {
            // Only add an empty field if newPropertiesList.length is 0 AND no template is selected
            if (newPropertiesList.length === 0 && selectedTemplate === null) {
                addNewPropertyField();
            }
        }, [newPropertiesList, selectedTemplate]); // Add selectedTemplate to dependencies

        // Always render the default icon
        const renderIcon = (customColor = colors.lightGray500) => {
            const Icon = IconMap[DEFAULT_PROPERTY_ICON] || Tag;
            return <Icon color={customColor} size={20} />;
        };

        const addNewPropertyField = () => {
            setNewPropertiesList(prevList => {
                const newField = { id: nextNewPropertyId, name: '', value: '' };
                setNextNewPropertyId(prevId => prevId + 1);
                return [...prevList, newField];
            });
        };

        const removePropertyField = (idToRemove) => {
            setNewPropertiesList(prevList => prevList.filter(prop => prop.id !== idToRemove));
        };

        const handlePropertyFieldChange = (idToUpdate, field, value) => {
            setNewPropertiesList(prevList => {
                const updatedList = prevList.map(prop =>
                    prop.id === idToUpdate ? { ...prop, [field]: value } : prop
                );
                return updatedList;
            });
        };

        // Function to handle saving unsaved properties on back navigation
        const handleSaveOnBack = async () => {
            const validPropertiesToSave = [];
            newPropertiesList.forEach(prop => {
                if (prop.name.trim() !== '' && prop.value.trim() !== '') {
                    validPropertiesToSave.push({ name: prop.name.trim(), waarde: prop.value.trim() });
                }
            });

            if (validPropertiesToSave.length > 0) {
                try {
                    for (const prop of validPropertiesToSave) {
                        const response = await fetch(`${API_BASE_URL}?entity=properties`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                object_id: item.id,
                                name: prop.name,
                                waarde: prop.waarde,
                            }),
                        });

                        const result = await response.json();
                        if (!response.ok) {
                            console.error('Failed to add property:', result.message);
                            // Optionally, break here or collect failed ones
                        }
                    }
                    Alert.alert('Success', 'Eigenschappen succesvol toegevoegd!');
                    // After adding, re-fetch the entire hierarchy to ensure UI updates
                    await fetchAndSetAllObjects();
                } catch (error) {
                    console.error('Error adding properties:', error);
                    Alert.alert('Error', 'Er is een onverwachte fout opgetreden bij het toevoegen van eigenschappen.');
                }
            } else {
                // If no valid properties to save, just navigate back
                console.log("No valid properties to save.");
            }

            // Reset state and navigate back regardless of save success
            setNewPropertiesList([]);
            setNextNewPropertyId(0);
            setSelectedTemplate(null); // Reset selected template
            setCurrentScreen('properties');
        };

        return (
            <View style={[AppStyles.screen, { backgroundColor: colors.white }]}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{ flex: 1 }} // KAV now handles the entire screen content area below the status bar
                >
                    {/* Header is part of the content KeyboardAvoidingView manages */}
                    <View style={AppStyles.header}>
                        <View style={AppStyles.headerFlex}>
                            <TouchableOpacity
                                onPress={handleSaveOnBack}
                                style={AppStyles.headerBackButton}
                            >
                                <ChevronLeft color={colors.lightGray700} size={24} />
                            </TouchableOpacity>
                            <Text style={AppStyles.headerTitleLg}>Eigenschap Toevoegen</Text>
                            <View style={AppStyles.headerPlaceholder} />
                        </View>
                    </View>

                    {/* Main content directly inside KeyboardAvoidingView, wrapped in a ScrollView for scrollability and padding */}
                    <ScrollView
                        style={{ flex: 1 }} // Allow ScrollView to take remaining vertical space
                        contentContainerStyle={AppStyles.contentPadding} // Apply padding here
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Existing Properties Card */}
                        <View style={[AppStyles.card, { marginTop: 0, marginBottom: 1.5 * 16, padding: 1 * 16 }]}>
                            <Text style={[AppStyles.infoItemValue, { marginBottom: 1 * 16, fontSize: 1 * 16, fontWeight: '600' }]}>
                                Bestaande Eigenschappen
                            </Text>
                            <View style={AppStyles.propertyList}>
                                {(item.properties || []).length > 0 ? (
                                    (item.properties || []).map((prop, index) => (
                                        <View key={index} style={AppStyles.propertyItem}>
                                            <View style={AppStyles.propertyItemMain}>
                                                {renderIcon()}
                                                <Text style={AppStyles.propertyName}>{prop.name}</Text>
                                            </View>
                                            <Text style={AppStyles.propertyValue}>{prop.waarde}</Text>
                                        </View>
                                    ))
                                ) : (
                                    <View style={AppStyles.emptyState}>
                                        <Text style={AppStyles.emptyStateText}>Geen bestaande eigenschappen.</Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* New Properties Card */}
                        <View style={[AppStyles.card, { marginBottom: 1.5 * 16, padding: 1 * 16 }]}>
                            <Text style={[AppStyles.infoItemValue, { marginBottom: 1 * 16, fontSize: 1 * 16, fontWeight: '600' }]}>
                                Nieuwe Eigenschappen Toevoegen
                            </Text>

                            {/* Template Selector */}
                            <View style={AppStyles.formGroup}>
                                <Text style={AppStyles.formLabel}>Kies een sjabloon (optioneel)</Text>
                                <View style={AppStyles.pickerContainer}>
                                    <Picker
                                        selectedValue={selectedTemplate}
                                        onValueChange={(itemValue) => {
                                            setSelectedTemplate(itemValue);
                                            if (itemValue && fetchedTemplates[itemValue]) { // Use fetchedTemplates
                                                // When a template is selected, populate newPropertiesList
                                                const templateProps = fetchedTemplates[itemValue].map((prop, index) => ({
                                                    id: nextNewPropertyId + index, // Ensure unique IDs
                                                    name: prop.name,
                                                    value: ''
                                                }));
                                                setNewPropertiesList(templateProps);
                                                // Ensure nextNewPropertyId is incremented by the number of template items
                                                setNextNewPropertyId(prevId => prevId + templateProps.length);
                                            } else {
                                                // Clear if "Geen sjabloon" or no template selected
                                                setNewPropertiesList([]);
                                                setNextNewPropertyId(0); // Reset ID counter
                                                addNewPropertyField(); // Add an empty field if no template selected
                                            }
                                        }}
                                        style={AppStyles.formInput} // Re-use formInput style for picker on Android
                                        itemStyle={Platform.OS === 'ios' ? AppStyles.pickerItem : null} // iOS specific item style
                                    >
                                        <Picker.Item label="Geen sjabloon" value={null} />
                                        {Object.keys(fetchedTemplates).map((templateName) => ( // Use fetchedTemplates
                                            <Picker.Item key={templateName} label={templateName} value={templateName} />
                                        ))}
                                    </Picker>
                                </View>
                            </View>

                            {newPropertiesList.map(prop => (
                                <View key={prop.id} style={{ marginBottom: 1 * 16, borderWidth: 1, borderColor: colors.lightGray200, borderRadius: 8, padding: 1 * 16 }}>
                                    <View style={AppStyles.formRow}>
                                        <View style={[AppStyles.formGroupHalf, { marginRight: 8 }]}>
                                            <Text style={AppStyles.formLabel}>Eigenschap Naam</Text>
                                            <TextInput
                                                placeholder="Bijv. Gewicht"
                                                value={prop.name}
                                                onChangeText={(text) => handlePropertyFieldChange(prop.id, 'name', text)}
                                                style={AppStyles.formInput}
                                                placeholderTextColor={colors.lightGray400}
                                                returnKeyType="next"
                                            />
                                        </View>

                                        <View style={[AppStyles.formGroupHalf, { marginLeft: 8 }]}>
                                            <Text style={AppStyles.formLabel}>Waarde</Text>
                                            <TextInput
                                                placeholder="Bijv. 2kg"
                                                value={prop.value}
                                                onChangeText={(text) => handlePropertyFieldChange(prop.id, 'value', text)}
                                                style={AppStyles.formInput}
                                                placeholderTextColor={colors.lightGray400}
                                                returnKeyType="done"
                                                onSubmitEditing={addNewPropertyField}
                                            />
                                        </View>
                                        {/* Show remove button only if there's more than one field OR if the current field has content */}
                                        {newPropertiesList.length > 1 || (newPropertiesList.length === 1 && (prop.name.trim() !== '' || prop.value.trim() !== '')) ? (
                                            <TouchableOpacity
                                                onPress={() => removePropertyField(prop.id)}
                                                style={{ padding: 4, alignSelf: 'flex-start', marginTop: 30, left: 5 }}
                                            >
                                                <X color={colors.red600} size={20} />
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>
                                </View>
                            ))}

                            {/* Save Button */}
                            <TouchableOpacity
                                onPress={handleSaveOnBack}
                                style={[
                                    AppStyles.btnPrimary,
                                    AppStyles.btnFull,
                                    AppStyles.btnFlexCenter,
                                    { marginTop: 0.5 * 16 }
                                ]}
                            >
                                <Text style={AppStyles.btnPrimaryText}>Opslaan</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>

                    {/* Add Property FAB */}
                    <TouchableOpacity
                        onPress={addNewPropertyField}
                        style={AppStyles.fab}
                    >
                        <Plus color="white" size={24} />
                    </TouchableOpacity>
                </KeyboardAvoidingView>
            </View>
        );
    };

    const AddObjectModal = () => {
        const [name, setName] = useState('');

        const handleSaveObject = () => {
            if (name.trim()) {
                handleAddObject(currentPath, { name });
            } else {
                Alert.alert("Invoer vereist", "Vul alstublieft de naam in.");
            }
        };

        return (
            <Modal
                transparent={true}
                visible={showAddObjectModal}
                onRequestClose={() => setShowAddObjectModal(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={AppStyles.modalBackdrop}
                >
                    <View style={[AppStyles.modalContent, { backgroundColor: 'white' }]}>
                        <Text style={AppStyles.modalTitle}>Item Toevoegen</Text>
                        <View style={AppStyles.formGroup}>
                            <Text style={AppStyles.formLabel}>Naam</Text>
                            <TextInput
                                placeholder="Bijvoorbeeld: Nieuwe Kamer"
                                value={name}
                                onChangeText={setName}
                                style={AppStyles.formInput}
                                placeholderTextColor={colors.lightGray400}
                                returnKeyType="done"
                            />
                        </View>
                        <View style={AppStyles.modalActions}>
                            <TouchableOpacity
                                onPress={() => setShowAddObjectModal(false)}
                                style={AppStyles.btnSecondary}
                            >
                                <Text style={AppStyles.btnSecondaryText}>Annuleren</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleSaveObject}
                                style={[AppStyles.btnPrimary, AppStyles.btnPrimaryModal]}
                            >
                                <Text style={AppStyles.btnPrimaryText}>Opslaan</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        );
    };

    // currentLevelItems now directly references the nested children from the fully loaded objectsHierarchy
    const currentLevelItems = currentPath.length === 0 ? objectsHierarchy : findItemByPath(objectsHierarchy, currentPath)?.children || [];

    return (
        <>
            {/* Set status bar style for iOS */}
            <StatusBar
                barStyle={Platform.OS === 'ios' ? 'dark-content' : 'dark-content'}
                backgroundColor="white" // Set your desired background color
            />
            <View style={AppStyles.appContainer}>
                {(() => {
                    switch (currentScreen) {
                        case 'objects':
                            return (
                                <HierarchicalObjectsScreen
                                    key={objectsHierarchy.length} // Force remount when top-level hierarchy size changes
                                    items={currentLevelItems}
                                    currentLevelPath={currentPath}
                                />
                            );
                        case 'properties':
                            return <PropertiesScreen currentPath={currentPath.concat(selectedProperty)} />;
                        case 'addProperty':
                            return <AddPropertyScreen currentPath={currentPath.concat(selectedProperty)} />;
                        default:
                            return (
                                <HierarchicalObjectsScreen
                                    key={objectsHierarchy.length}
                                    items={currentLevelItems}
                                    currentLevelPath={currentPath}
                                />
                            );
                    }
                })()}
                {showAddObjectModal && <AddObjectModal />}
            </View>
        </>
    );
};

export default App;
