import { Calculator, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../AppStyles';

const ValueInputModal = ({ 
    visible, 
    onClose, 
    onValueSet, 
    formules = [],
}) => {
    const [selectedFormule, setSelectedFormule] = useState(null);

    // Reset modal state when it becomes visible
    useEffect(() => {
        if (visible) {
            setSelectedFormule(null);
        }
    }, [visible]);

    const handleSave = () => {
        if (selectedFormule) {
            // Access the correct property name (lowercase 'formule' from database)
            const formuleExpression = selectedFormule.formule || selectedFormule.Formule || '';
            onValueSet(formuleExpression, selectedFormule);
        }
        onClose();
    };

    const handleCancel = () => {
        onClose();
    };

    const renderFormuleScreen = () => (
        <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Formule Kiezen</Text>
                <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
                    <X color={colors.lightGray700} size={20} />
                </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
                <View style={styles.contentBody}>
                    {formules.length > 0 ? (
                        <>
                            <Text style={styles.modalSubtitle}>Kies een formule:</Text>
                            <FlatList
                                data={formules}
                                keyExtractor={(item, index) => (item?.id != null ? String(item.id) : `${item?.name || 'item'}-${index}`)}
                                style={styles.compactFormuleList}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={[
                                            styles.compactFormuleItem,
                                            selectedFormule?.id === item.id && styles.compactFormuleItemSelected
                                        ]}
                                        onPress={() => setSelectedFormule(item)}
                                    >
                                        <View style={styles.compactFormuleItemContent}>
                                            <Text style={styles.compactFormuleName}>{item.name}</Text>
                                            <Text style={styles.compactFormuleExpression}>{item.formule || item.Formule || ''}</Text>
                                        </View>
                                        {selectedFormule?.id === item.id && (
                                            <View style={styles.compactSelectedIndicator} />
                                        )}
                                    </TouchableOpacity>
                                )}
                            />
                        </>
                    ) : (
                        <View style={styles.compactEmptyState}>
                            <Calculator color={colors.lightGray400} size={32} />
                            <Text style={styles.compactEmptyStateText}>Geen formules</Text>
                            <Text style={styles.compactEmptyStateSubtext}>
                                Voeg eerst een formule toe
                            </Text>
                        </View>
                    )}
                </View>

                <View style={styles.modalButtonContainer}>
                    <View style={styles.modalActionButtons}>
                        <TouchableOpacity 
                            style={[styles.modalButton, styles.secondaryButton, styles.halfButton]} 
                            onPress={handleCancel}
                        >
                            <Text style={styles.secondaryButtonText}>Annuleren</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[
                                styles.modalButton, 
                                styles.primaryButton,
                                styles.halfButton,
                                !selectedFormule && styles.disabledButton
                            ]} 
                            onPress={handleSave}
                            disabled={!selectedFormule}
                        >
                            <Text style={[
                                styles.primaryButtonText,
                                !selectedFormule && styles.disabledButtonText
                            ]}>
                                Selecteren
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Removed extra empty-state texts per request */}
            </View>
        </View>
    );

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={handleCancel}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.overlay}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
            >
                <View style={styles.overlayBackground}>
                    <TouchableOpacity 
                        style={styles.overlayTouchArea}
                        activeOpacity={1} 
                        onPress={handleCancel}
                    />
                    <View style={styles.modalWrapper}>
                        {renderFormuleScreen()}
                    </View>
                    <TouchableOpacity 
                        style={styles.overlayTouchArea}
                        activeOpacity={1} 
                        onPress={handleCancel}
                    />
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = {
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'stretch',
        width: '100%',
    },
    modalWrapper: {
        width: '100%',
        alignSelf: 'stretch',
    },
    overlayBackground: {
        flex: 1,
        width: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'stretch',
        paddingHorizontal: Platform.OS === 'web' ? 55 : 5,
    },
    overlayTouchArea: {
        flex: 1,
        minHeight: 20,
    },
    modalContainer: {
        backgroundColor: colors.white,
        borderRadius: 20,
        width: '100%',
        maxHeight: '95%',
        minHeight: 500,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
        marginHorizontal: 0,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 32,
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderBottomColor: colors.lightGray200,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.lightGray900,
        flex: 1,
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    closeButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: colors.lightGray50,
    },
    backButton: {
        padding: 4,
    },
    backButtonText: {
        color: colors.blue600,
        fontSize: 14,
        fontWeight: '500',
    },
    modalContent: {
        padding: 32,
        flex: 1,
        justifyContent: 'space-between',
    },
    contentBody: {
        flex: 1,
        minHeight: 0,
    },
    modalSubtitle: {
        fontSize: 16,
        color: colors.lightGray600,
        marginBottom: 24,
        textAlign: 'center',
        lineHeight: 22,
        fontWeight: '400',
    },
    // Compact option buttons for choice screen
    compactOptionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        backgroundColor: colors.white,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.lightGray200,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
    },
    compactOptionIcon: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: colors.lightGray50,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
        borderWidth: 1,
        borderColor: colors.lightGray100,
    },
    compactOptionContent: {
        flex: 1,
    },
    compactOptionTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: colors.lightGray900,
        marginBottom: 6,
        letterSpacing: 0.3,
    },
    compactOptionDescription: {
        fontSize: 14,
        color: colors.lightGray600,
        lineHeight: 20,
        fontWeight: '400',
    },
    // Form elements
    formGroup: {
        marginBottom: 20,
    },
    formLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.lightGray800,
        marginBottom: 12,
        letterSpacing: 0.2,
    },
    textInput: {
        borderWidth: 2,
        borderColor: colors.lightGray300,
        borderRadius: 12,
        paddingHorizontal: 18,
        paddingVertical: 16,
        fontSize: 16,
        backgroundColor: colors.white,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
    },
    helpText: {
        fontSize: 13,
        color: colors.lightGray500,
        marginTop: 10,
        fontStyle: 'italic',
        lineHeight: 18,
        textAlign: 'center',
    },
    // Unit picker styles
    unitPickerContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 4,
    },
    unitButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: colors.lightGray300,
        backgroundColor: colors.white,
        minWidth: 50,
        alignItems: 'center',
    },
    unitButtonSelected: {
        borderColor: colors.blue600,
        backgroundColor: colors.blue50,
    },
    unitButtonText: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.lightGray700,
    },
    unitButtonTextSelected: {
        color: colors.blue700,
        fontWeight: '600',
    },
    // Button containers
    modalButtonContainer: {
        marginTop: 16,
    },
    modalActionButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    expandedButtonContainer: {
        marginTop: 32,
        flexDirection: 'row',
        gap: 16,
    },
    expandedButton: {
        flex: 1,
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
    },
    modalButton: {
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
    },
    primaryButton: {
        backgroundColor: colors.blue600,
    },
    secondaryButton: {
        backgroundColor: colors.white,
        borderWidth: 1.5,
        borderColor: colors.lightGray300,
    },
    primaryButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    secondaryButtonText: {
        color: colors.lightGray700,
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    halfButton: {
        flex: 1,
    },
    fullButton: {
        width: '100%',
    },
    addFormuleButton: {
        marginBottom: 12,
    },
    // Compact formule list
    compactFormuleList: {
        flexGrow: 1,
        marginBottom: 24,
        minHeight: 0,
    },
    compactFormuleItem: {
        padding: 16,
        backgroundColor: colors.white,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.lightGray200,
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
    },
    compactFormuleItemSelected: {
        borderColor: colors.blue600,
        backgroundColor: colors.blue50,
    },
    compactFormuleItemContent: {
        flex: 1,
    },
    compactFormuleName: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.lightGray900,
        marginBottom: 4,
    },
    compactFormuleExpression: {
        fontSize: 14,
        color: colors.lightGray600,
        fontFamily: 'monospace',
    },
    compactSelectedIndicator: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: colors.blue600,
        marginLeft: 12,
    },
    // Compact empty state
    compactEmptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 32,
    },
    compactEmptyStateText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.lightGray700,
        marginTop: 12,
        marginBottom: 6,
    },
    compactEmptyStateSubtext: {
        fontSize: 14,
        color: colors.lightGray500,
        textAlign: 'center',
        lineHeight: 18,
    },
    disabledButton: {
        backgroundColor: colors.lightGray200,
    },
    disabledButtonText: {
        color: colors.lightGray500,
    },
};

export default ValueInputModal;