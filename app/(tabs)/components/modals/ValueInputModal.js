import { Calculator, Edit3, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../../AppStyles';

const ValueInputModal = ({ 
    visible, 
    onClose, 
    currentValue = '', 
    currentUnit = '',
    onValueSet, 
    formules = [],
    onAddFormule,
    propertyName = 'Waarde'
}) => {
    const [inputMode, setInputMode] = useState('choice'); // 'choice', 'manual', 'formule'
    const [manualValue, setManualValue] = useState('');
    const [selectedFormule, setSelectedFormule] = useState(null);
    const [selectedUnit, setSelectedUnit] = useState('');

    // Reset modal state when it becomes visible
    useEffect(() => {
        if (visible) {
            setInputMode('choice');
            setSelectedFormule(null);
            
            // Use currentValue directly (no parsing needed since unit is separate)
            if (currentValue) {
                setManualValue(currentValue);
            } else {
                setManualValue('');
            }
            
            // Use currentUnit if provided, otherwise default to '' (geen)
            if (currentUnit) {
                setSelectedUnit(currentUnit);
            } else {
                setSelectedUnit('');
            }
        }
    }, [visible, currentValue, currentUnit]);

    const handleSave = () => {
        if (inputMode === 'manual') {
            // Pass value and unit separately as an object
            onValueSet(manualValue, { unit: selectedUnit, isManual: true });
        } else if (inputMode === 'formule' && selectedFormule) {
            // Access the correct property name (lowercase 'formule' from database)
            const formuleExpression = selectedFormule.formule || selectedFormule.Formule || '';
            onValueSet(formuleExpression, selectedFormule);
        }
        onClose();
    };

    const handleCancel = () => {
        onClose();
    };

    const renderChoiceScreen = () => (
        <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Waarde Invoeren</Text>
                <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
                    <X color={colors.lightGray700} size={20} />
                </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
                <Text style={styles.modalSubtitle}>
                    Hoe wil je de waarde invoeren?
                </Text>

                <TouchableOpacity 
                    style={styles.compactOptionButton} 
                    onPress={() => setInputMode('manual')}
                >
                    <View style={styles.compactOptionIcon}>
                        <Edit3 color={colors.blue600} size={20} />
                    </View>
                    <View style={styles.compactOptionContent}>
                        <Text style={styles.compactOptionTitle}>Handmatig Invoeren</Text>
                        <Text style={styles.compactOptionDescription}>
                            Typ zelf een waarde in
                        </Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={styles.compactOptionButton} 
                    onPress={() => setInputMode('formule')}
                >
                    <View style={styles.compactOptionIcon}>
                        <Calculator color={colors.green600} size={20} />
                    </View>
                    <View style={styles.compactOptionContent}>
                        <Text style={styles.compactOptionTitle}>Formule Kiezen</Text>
                        <Text style={styles.compactOptionDescription}>
                            Kies een bestaande formule
                        </Text>
                    </View>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderManualScreen = () => (
        <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setInputMode('choice')} style={styles.backButton}>
                    <Text style={styles.backButtonText}>← Terug</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Handmatige Waarde</Text>
                <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
                    <X color={colors.lightGray700} size={20} />
                </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
                <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Waarde</Text>
                    <TextInput
                        placeholder="Bijv. 25 of 10*2+5"
                        value={manualValue}
                        onChangeText={setManualValue}
                        style={styles.textInput}
                        autoFocus={true}
                        keyboardType="default"
                    />
                    <Text style={styles.helpText}>
                        Getal of berekening (bijv. 10*2+5)
                    </Text>
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Eenheid</Text>
                    <View style={styles.unitPickerContainer}>
                        {['Geen', 'm', 'cm', 'mm', 'kg', 'g', 'L', 'mL'].map((unit) => (
                            <TouchableOpacity
                                key={unit}
                                style={[
                                    styles.unitButton,
                                    (selectedUnit === unit || (unit === 'Geen' && !selectedUnit)) && styles.unitButtonSelected
                                ]}
                                onPress={() => setSelectedUnit(unit === 'Geen' ? '' : unit)}
                            >
                                <Text style={[
                                    styles.unitButtonText,
                                    (selectedUnit === unit || (unit === 'Geen' && !selectedUnit)) && styles.unitButtonTextSelected
                                ]}>
                                    {unit}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.expandedButtonContainer}>
                    <TouchableOpacity 
                        style={[styles.expandedButton, styles.secondaryButton]} 
                        onPress={() => setInputMode('choice')}
                    >
                        <Text style={styles.secondaryButtonText}>Annuleren</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.expandedButton, styles.primaryButton]} 
                        onPress={handleSave}
                    >
                        <Text style={styles.primaryButtonText}>Opslaan</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    const renderFormuleScreen = () => (
        <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setInputMode('choice')} style={styles.backButton}>
                    <Text style={styles.backButtonText}>← Terug</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Formule Kiezen</Text>
                <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
                    <X color={colors.lightGray700} size={20} />
                </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
                {formules.length > 0 ? (
                    <>
                        <Text style={styles.modalSubtitle}>Kies een formule:</Text>
                        <FlatList
                            data={formules}
                            keyExtractor={(item) => item.id.toString()}
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
                                        <Text style={styles.compactFormuleExpression}>{item.Formule}</Text>
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

                <View style={styles.modalButtonContainer}>
                    <View style={styles.modalActionButtons}>
                        <TouchableOpacity 
                            style={[styles.modalButton, styles.secondaryButton, styles.halfButton]} 
                            onPress={() => setInputMode('choice')}
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

                {formules.length === 0 && (
                    <View style={styles.compactEmptyState}>
                        <Text style={styles.compactEmptyStateText}>Geen formules beschikbaar</Text>
                        <Text style={styles.compactEmptyStateSubtext}>
                            Ga naar het hoofdscherm om formules toe te voegen
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );

    const renderCurrentScreen = () => {
        switch (inputMode) {
            case 'manual':
                return renderManualScreen();
            case 'formule':
                return renderFormuleScreen();
            default:
                return renderChoiceScreen();
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={handleCancel}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.overlay}
            >
                <View style={styles.overlayBackground}>
                    <TouchableOpacity 
                        style={styles.overlayTouchArea}
                        activeOpacity={1} 
                        onPress={handleCancel}
                    />
                    <View style={styles.modalWrapper}>
                        {renderCurrentScreen()}
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
        maxHeight: 350,
        marginBottom: 24,
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