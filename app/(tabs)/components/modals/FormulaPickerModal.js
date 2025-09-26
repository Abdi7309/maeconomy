import { Calculator, X } from 'lucide-react-native';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import AppStyles, { colors } from '../../AppStyles';

const FormulaPickerModal = ({ visible, onClose, formulas = [], onSelectFormula }) => {
    // Extra safety check to ensure formulas is always an array
    const formulasList = Array.isArray(formulas) ? formulas : [];
    
    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={AppStyles.modalOverlay}>
                <View style={AppStyles.modalContainer}>
                    <View style={AppStyles.modalHeader}>
                        <Text style={AppStyles.modalTitle}>Selecteer Formule</Text>
                        <TouchableOpacity onPress={onClose} style={AppStyles.modalCloseButton}>
                            <X size={24} color={colors.lightGray600} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={AppStyles.modalContent}>
                        {formulasList.length === 0 ? (
                            <View style={{ padding: 20, alignItems: 'center' }}>
                                <Calculator size={48} color={colors.lightGray400} />
                                <Text style={[AppStyles.infoText, { marginTop: 12 }]}>
                                    Geen formules beschikbaar
                                </Text>
                                <Text style={[AppStyles.infoText, { marginTop: 4, fontSize: 14, color: colors.lightGray500 }]}>
                                    Maak eerst eigenschappen met formules aan
                                </Text>
                            </View>
                        ) : (
                            <View>
                                <Text style={[AppStyles.formLabel, { marginBottom: 12, fontSize: 16 }]}>
                                    Beschikbare Formules ({formulasList.length})
                                </Text>
                                {formulasList.map((formula) => (
                                    <TouchableOpacity
                                        key={formula.id}
                                        style={[
                                            AppStyles.filterOption,
                                            {
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                padding: 16,
                                                marginBottom: 8,
                                                backgroundColor: colors.white,
                                                borderRadius: 8,
                                                borderWidth: 1,
                                                borderColor: colors.lightGray200,
                                            }
                                        ]}
                                        onPress={() => {
                                            onSelectFormula(formula);
                                            onClose();
                                        }}
                                    >
                                        <Calculator size={20} color={colors.blue600} />
                                        <View style={{ marginLeft: 12, flex: 1 }}>
                                            <Text style={[AppStyles.propertyName, { fontSize: 16, fontWeight: '600' }]}>
                                                {formula.name}
                                            </Text>
                                            <Text style={[AppStyles.infoText, { marginTop: 4, color: colors.lightGray600, fontSize: 14 }]}>
                                                {formula.formula}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </ScrollView>

                    <View style={AppStyles.modalFooter}>
                        <TouchableOpacity
                            style={[AppStyles.btnSecondary, { flex: 1 }]}
                            onPress={onClose}
                        >
                            <Text style={AppStyles.btnSecondaryText}>Sluiten</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

export default FormulaPickerModal;