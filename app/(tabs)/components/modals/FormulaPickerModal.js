import { Calculator } from 'lucide-react-native';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import AppStyles, { colors } from '../../AppStyles';

const FormulaPickerModal = ({ visible, onClose, formulas = [], onSelectFormula, onEditFormula }) => {
    // Extra safety check to ensure formulas is always an array
    const formulasList = Array.isArray(formulas) ? formulas : [];
    
    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={AppStyles.modalOverlay}>
                <View style={AppStyles.modalContainer}>
                    <View style={[AppStyles.modalHeader, { justifyContent:'center' }]}> 
                        <Text style={[AppStyles.modalTitle, { textAlign:'center', flex:1 }]}>Selecteer Formule</Text>
                    </View>

                    <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingBottom: 12 }}>
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
                                    <View
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
                                    >
                                        <TouchableOpacity
                                            onPress={() => { onSelectFormula(formula); onClose(); }}
                                            style={{ flexDirection: 'row', flex: 1, alignItems: 'center' }}
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
                                        {onEditFormula && (
                                            <TouchableOpacity onPress={() => onEditFormula(formula)} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
                                                <Text style={{ color: colors.blue600, fontWeight: '600' }}>Bewerk</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ))}
                            </View>
                        )}
                    </ScrollView>
                    <TouchableOpacity
                        style={[AppStyles.btnSecondary, { marginTop: 8 }]}
                        onPress={onClose}
                    >
                        <Text style={AppStyles.btnSecondaryText}>Sluiten</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

export default FormulaPickerModal;