import { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert, StatusBar } from 'react-native';
import { ChevronLeft, Plus, X, Tag, Paperclip, FileText, Calculator } from 'lucide-react-native';
import AppStyles, { colors } from '../AppStyles';
import AddTemplateModal from '../components/modals/AddTemplateModal';
import TemplatePickerModal from '../components/modals/TemplatePickerModal';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

const AddPropertyScreen = ({ currentPath, objectsHierarchy, fetchedTemplates, setCurrentScreen, onSave, onTemplateAdded, findItemByPath }) => {

    const objectIdForProperties = currentPath[currentPath.length - 1];
    const item = findItemByPath(objectsHierarchy, currentPath);
    
    const webInputRef = useRef(null);

    if (!item) return null;

    const [newPropertiesList, setNewPropertiesList] = useState([]);
    const [nextNewPropertyId, setNextNewPropertyId] = useState(0);
    const [selectedTemplateForPropertyAdd, setSelectedTemplateForPropertyAdd] = useState(null);
    const [showTemplatePickerModal, setShowTemplatePickerModal] = useState(false);
    const [showAddTemplateModal, setShowAddTemplateModal] = useState(false);

    // Functie om beschikbare eigenschappen te verkrijgen voor formules
    const getAvailableProperties = () => {
        const existingProps = (item.properties || []).map(prop => prop.name);
        const newProps = newPropertiesList
            .filter(prop => prop.name.trim() !== '' && prop.type !== 'formula')
            .map(prop => prop.name);
        return [...existingProps, ...newProps];
    };

    // Functie om formules te evalueren
    const evaluateFormula = (formula, availableProps) => {
        try {
            // Vervang eigenschapnamen door hun waarden
            let expression = formula;
            
            // Verkrijg waarden van bestaande eigenschappen
            const existingValues = {};
            (item.properties || []).forEach(prop => {
                existingValues[prop.name] = parseFloat(prop.waarde) || 0;
            });

            // Verkrijg waarden van nieuwe eigenschappen
            const newValues = {};
            newPropertiesList.forEach(prop => {
                if (prop.type !== 'formula' && prop.name.trim() !== '') {
                    newValues[prop.name] = parseFloat(prop.value) || 0;
                }
            });

            const allValues = { ...existingValues, ...newValues };

            // Vervang eigenschapnamen in de formule
            Object.keys(allValues).forEach(propName => {
                const regex = new RegExp(`\\b${propName}\\b`, 'g');
                expression = expression.replace(regex, allValues[propName]);
            });

            // Evalueer de wiskundige expressie (simpele implementatie)
            // In productie zou je een veiligere math evaluator gebruiken
            const result = Function('"use strict"; return (' + expression + ')')();
            
            return isNaN(result) ? 0 : result;
        } catch (error) {
            return 0;
        }
    };

    const addNewPropertyField = (type = 'regular') => {
        setNewPropertiesList(prevList => {
            const newField = { 
                id: nextNewPropertyId, 
                name: '', 
                value: '', 
                type: type,
                formula: type === 'formula' ? '' : undefined,
                files: [] 
            };
            setNextNewPropertyId(prevId => prevId + 1);
            return [...prevList, newField];
        });
    };

    const addFileToProperty = (propertyId, fileObject) => {
        setNewPropertiesList(prevList =>
            prevList.map(prop =>
                prop.id === propertyId
                    ? { ...prop, files: [...prop.files, fileObject] }
                    : prop
            )
        );
    };

    const removeFileFromProperty = (propertyId, fileIndexToRemove) => {
         setNewPropertiesList(prevList =>
            prevList.map(prop =>
                prop.id === propertyId
                    ? { ...prop, files: prop.files.filter((_, index) => index !== fileIndexToRemove) }
                    : prop
            )
        );
    };
    
    const pickDocument = async (propertyId) => {
        try {
            const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true });
            if (!result.canceled) {
                result.assets.forEach(file => {
                    addFileToProperty(propertyId, file);
                });
            }
        } catch (err) {
            Alert.alert('Error', 'An error occurred while picking files.');
            console.error('Document Picker Error:', err);
        }
    };

    const takePhoto = async (propertyId) => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Camera access is required to take photos.');
            return;
        }
        try {
            const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.7 });
            if (!result.canceled) {
                const asset = result.assets[0];
                const fileObject = {
                    name: asset.fileName || `photo_${Date.now()}.jpg`,
                    uri: asset.uri,
                    mimeType: asset.mimeType,
                    size: asset.fileSize,
                };
                addFileToProperty(propertyId, fileObject);
            }
        } catch (err) {
            Alert.alert('Error', 'An error occurred while opening the camera.');
            console.error('Image Picker Error:', err);
        }
    };
    
    const handleSelectFile = async (propertyId) => {
        if (Platform.OS === 'web') {
            webInputRef.current.setAttribute('data-property-id', propertyId);
            webInputRef.current.click();
        } else {
            Alert.alert(
                'Add Attachment',
                'Choose a source for your file:',
                [
                    { text: 'Take Photo...', onPress: () => takePhoto(propertyId) },
                    { text: 'Choose from Library...', onPress: () => pickDocument(propertyId) },
                    { text: 'Cancel', style: 'cancel' },
                ],
                { cancelable: true }
            );
        }
    };

    const handleWebFileSelect = (event) => {
        if (event.target.files && event.target.files.length > 0) {
            const propertyId = parseInt(webInputRef.current.getAttribute('data-property-id'), 10);
            
            for (const webFile of event.target.files) {
                const fileObject = {
                    name: webFile.name,
                    size: webFile.size,
                    type: webFile.type,
                    uri: URL.createObjectURL(webFile),
                    _webFile: webFile
                };
                addFileToProperty(propertyId, fileObject);
            }
        }
    };

    const removePropertyField = (idToRemove) => {
        setNewPropertiesList(prevList => prevList.filter(prop => prop.id !== idToRemove));
    };

    const handlePropertyFieldChange = (idToUpdate, field, value) => {
        setNewPropertiesList(prevList => {
            return prevList.map(prop => {
                if (prop.id === idToUpdate) {
                    const updatedProp = { ...prop, [field]: value };
                    
                    // Als het een formule eigenschap is en de formule is gewijzigd, herbereken de waarde
                    if (prop.type === 'formula' && field === 'formula') {
                        updatedProp.value = evaluateFormula(value, getAvailableProperties()).toString();
                    }
                    
                    return updatedProp;
                } else {
                    return prop;
                }
            });
        });
    };

    // Herbereken alle formule eigenschappen wanneer andere waarden wijzigen
    useEffect(() => {
        setNewPropertiesList(prevList => {
            return prevList.map(prop => {
                if (prop.type === 'formula' && prop.formula) {
                    return {
                        ...prop,
                        value: evaluateFormula(prop.formula, getAvailableProperties()).toString()
                    };
                }
                return prop;
            });
        });
    }, [newPropertiesList.filter(p => p.type !== 'formula').map(p => p.value).join(',')]);

    const handleSaveOnBack = async () => {
        const validPropertiesToSave = newPropertiesList.filter(prop =>
            prop.name.trim() !== ''
        );

        if (validPropertiesToSave.length === 0) {
            setCurrentScreen('properties');
            return;
        }
        
        // Converteer formule eigenschappen naar reguliere eigenschappen voor opslag
        const propertiesToSave = validPropertiesToSave.map(prop => {
            if (prop.type === 'formula') {
                return {
                    ...prop,
                    value: prop.value, // De berekende waarde
                    formula: prop.formula, // Behoud de originele formule voor toekomstige berekeningen
                    type: 'formula'
                };
            }
            return prop;
        });

        const success = await onSave(objectIdForProperties, propertiesToSave);

        if (success) {
            setCurrentScreen('properties');
        }
    };

    useEffect(() => {
        if (newPropertiesList.length === 0) {
            addNewPropertyField();
        }
    }, [newPropertiesList]);

    const renderIcon = (type = 'regular', customColor = colors.lightGray500) => {
        if (type === 'formula') {
            return <Calculator color={customColor} size={20} />;
        }
        return <Tag color={customColor} size={20} />;
    };

    const handleClearTemplate = () => {
        setSelectedTemplateForPropertyAdd(null);
        setNewPropertiesList([]);
        setTimeout(() => addNewPropertyField(), 0);
    }

    const renderFormulaHelp = () => (
        <View style={{ backgroundColor: colors.blue50, padding: 12, borderRadius: 8, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: colors.blue500 }}>
            <Text style={{ fontSize: 14, color: colors.blue800, fontWeight: '600', marginBottom: 4 }}>Formule Help</Text>
            <Text style={{ fontSize: 13, color: colors.blue700, marginBottom: 4 }}>
                Gebruik eigenschapnamen in je formule. Bijvoorbeeld:
            </Text>
            <Text style={{ fontSize: 12, color: colors.blue600, fontFamily: 'monospace', marginBottom: 2 }}>
                • lengte * breedte
            </Text>
            <Text style={{ fontSize: 12, color: colors.blue600, fontFamily: 'monospace', marginBottom: 2 }}>
                • (gewicht + 5) / 2
            </Text>
            <Text style={{ fontSize: 12, color: colors.blue600, fontFamily: 'monospace' }}>
                • prijs * 1.21
            </Text>
            <Text style={{ fontSize: 12, color: colors.blue600, marginTop: 4 }}>
                Beschikbare eigenschappen: {getAvailableProperties().join(', ') || 'Geen'}
            </Text>
        </View>
    );

    return (
        <View style={[AppStyles.screen, { backgroundColor: colors.white, flex: 1 }]}>
            {Platform.OS === 'web' && (
                <input
                    type="file"
                    ref={webInputRef}
                    style={{ display: 'none' }}
                    onChange={handleWebFileSelect}
                    multiple
                />
            )}
            <StatusBar barStyle="dark-content" />

            {showTemplatePickerModal && <TemplatePickerModal
                visible={showTemplatePickerModal}
                onClose={() => setShowTemplatePickerModal(false)}
                templates={fetchedTemplates}
                onSelect={(templateId) => {
                    if (templateId && fetchedTemplates[templateId]) {
                        const templateProps = fetchedTemplates[templateId].properties.map((prop, index) => ({
                            id: index, 
                            name: prop.name, 
                            value: prop.value || '', 
                            type: prop.type || 'regular',
                            formula: prop.formula,
                            files: []
                        }));
                        setNewPropertiesList(templateProps);
                        setNextNewPropertyId(templateProps.length);
                        setSelectedTemplateForPropertyAdd(templateId);
                    } else {
                        handleClearTemplate();
                    }
                    setShowTemplatePickerModal(false);
                }}
                onAddNewTemplate={() => {
                    setShowTemplatePickerModal(false);
                    setShowAddTemplateModal(true);
                }}
            />}

            {showAddTemplateModal && <AddTemplateModal
                visible={showAddTemplateModal}
                onClose={() => setShowAddTemplateModal(false)}
                onTemplateSaved={onTemplateAdded}
            />}

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <View style={AppStyles.header}>
                    <View style={AppStyles.headerFlex}>
                        <TouchableOpacity onPress={() => setCurrentScreen('properties')} style={AppStyles.headerBackButton}>
                            <ChevronLeft color={colors.lightGray700} size={24} />
                        </TouchableOpacity>
                        <Text style={AppStyles.headerTitleLg}>Eigenschap Toevoegen</Text>
                    </View>
                </View>
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={AppStyles.contentPadding}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={[AppStyles.card, { marginTop: 0, marginBottom: 24, padding: 16 }]}>
                        <Text style={[AppStyles.infoItemValue, { marginBottom: 16, fontSize: 16, fontWeight: '600' }]}>
                            Bestaande Eigenschappen
                        </Text>
                        <View style={AppStyles.propertyList}>
                            {(item.properties || []).length > 0 ? (
                                (item.properties || []).map((prop, index) => (
                                    <View key={index} style={AppStyles.propertyItem}>
                                        <View style={AppStyles.propertyItemMain}>
                                            {renderIcon(prop.type)}
                                            <Text style={AppStyles.propertyName}>{prop.name}</Text>
                                            {prop.type === 'formula' && (
                                                <Text style={[AppStyles.propertyName, { fontSize: 12, color: colors.blue600, marginLeft: 8 }]}>
                                                    (formule)
                                                </Text>
                                            )}
                                        </View>
                                        <Text style={AppStyles.propertyValue}>{prop.waarde}</Text>
                                    </View>
                                ))
                            ) : (
                                <View style={AppStyles.emptyState}><Text style={AppStyles.emptyStateText}>Geen bestaande eigenschappen.</Text></View>
                            )}
                        </View>
                    </View>
                    <View style={[AppStyles.card, { marginBottom: 24, padding: 16 }]}>
                        <Text style={[AppStyles.infoItemValue, { marginBottom: 16, fontSize: 16, fontWeight: '600' }]}>
                            Nieuwe Eigenschappen
                        </Text>
                        
                        <View style={AppStyles.formGroup}>
                            <Text style={AppStyles.formLabel}>Kies een sjabloon (optioneel)</Text>
                            <TouchableOpacity onPress={() => setShowTemplatePickerModal(true)} style={[AppStyles.formInput, { justifyContent: 'center' }]}>
                                <Text style={{ color: selectedTemplateForPropertyAdd ? colors.lightGray800 : colors.lightGray400 }}>
                                    {selectedTemplateForPropertyAdd ? fetchedTemplates[selectedTemplateForPropertyAdd]?.name : 'Kies een sjabloon...'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={{flexDirection: 'row', alignItems: 'center', marginVertical: 16}}>
                          <View style={{flex: 1, height: 1, backgroundColor: colors.lightGray200}} />
                          <View>
                            <Text style={{width: 150, textAlign: 'center', color: colors.lightGray400}}>Handmatig Toevoegen</Text>
                          </View>
                          <View style={{flex: 1, height: 1, backgroundColor: colors.lightGray200}} />
                        </View>

                        {newPropertiesList.map((prop, index) => (
                            <View key={prop.id} style={{ marginBottom: 16, borderTopWidth: index > 0 ? 1 : 0, borderColor: colors.lightGray100, paddingTop: index > 0 ? 16 : 0 }}>
                                
                                {/* Property Type Selector */}
                                <View style={{ flexDirection: 'row', marginBottom: 16 }}>
                                    <TouchableOpacity 
                                        onPress={() => handlePropertyFieldChange(prop.id, 'type', 'regular')}
                                        style={[
                                            { flex: 1, padding: 12, borderRadius: 8, marginRight: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
                                            prop.type === 'regular' ? { backgroundColor: colors.blue100, borderWidth: 2, borderColor: colors.blue500 } : { backgroundColor: colors.lightGray100, borderWidth: 1, borderColor: colors.lightGray300 }
                                        ]}
                                    >
                                        <Tag size={18} color={prop.type === 'regular' ? colors.blue600 : colors.lightGray600} />
                                        <Text style={[{ marginLeft: 8, fontWeight: '500' }, prop.type === 'regular' ? { color: colors.blue700 } : { color: colors.lightGray600 }]}>Waarde</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        onPress={() => handlePropertyFieldChange(prop.id, 'type', 'formula')}
                                        style={[
                                            { flex: 1, padding: 12, borderRadius: 8, marginLeft: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
                                            prop.type === 'formula' ? { backgroundColor: colors.green100, borderWidth: 2, borderColor: colors.green500 } : { backgroundColor: colors.lightGray100, borderWidth: 1, borderColor: colors.lightGray300 }
                                        ]}
                                    >
                                        <Calculator size={18} color={prop.type === 'formula' ? colors.green600 : colors.lightGray600} />
                                        <Text style={[{ marginLeft: 8, fontWeight: '500' }, prop.type === 'formula' ? { color: colors.green700 } : { color: colors.lightGray600 }]}>Formule</Text>
                                    </TouchableOpacity>
                                </View>

                                {prop.type === 'formula' && renderFormulaHelp()}

                                {Platform.OS === 'web' ? (
                                    // WEB LAYOUT: SIDE-BY-SIDE
                                    <View>
                                        {index === 0 && (
                                            <View style={{ flexDirection: 'row', marginBottom: 4 }}>
                                                <View style={{ flex: 1, marginRight: 8 }}><Text style={AppStyles.formLabel}>Eigenschap Naam</Text></View>
                                                <View style={{ flex: 1, marginLeft: 8 }}><Text style={AppStyles.formLabel}>{prop.type === 'formula' ? 'Formule' : 'Waarde'}</Text></View>
                                            </View>
                                        )}
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <TextInput
                                                placeholder="Bijv. Oppervlakte"
                                                value={prop.name}
                                                onChangeText={(text) => handlePropertyFieldChange(prop.id, 'name', text)}
                                                style={[AppStyles.formInput, { flex: 1, marginRight: 8 }]}
                                            />
                                            {prop.type === 'formula' ? (
                                                <TextInput
                                                    placeholder="Bijv. lengte * breedte"
                                                    value={prop.formula || ''}
                                                    onChangeText={(text) => handlePropertyFieldChange(prop.id, 'formula', text)}
                                                    style={[AppStyles.formInput, { flex: 1, marginLeft: 8, fontFamily: 'monospace' }]}
                                                />
                                            ) : (
                                                <TextInput
                                                    placeholder="Bijv. 2kg"
                                                    value={prop.value}
                                                    onChangeText={(text) => handlePropertyFieldChange(prop.id, 'value', text)}
                                                    style={[AppStyles.formInput, { flex: 1, marginLeft: 8 }]}
                                                />
                                            )}
                                        </View>
                                        
                                        {prop.type === 'formula' && (
                                            <View style={{ marginTop: 8, padding: 8, backgroundColor: colors.green50, borderRadius: 6 }}>
                                                <Text style={{ fontSize: 12, color: colors.green700, fontWeight: '500' }}>Berekende waarde: {prop.value || '0'}</Text>
                                            </View>
                                        )}

                                        {prop.type !== 'formula' && (
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                                                <TouchableOpacity onPress={() => handleSelectFile(prop.id)} style={{ flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: colors.lightGray100, borderRadius: 8, alignSelf: 'flex-start' }}>
                                                    <Paperclip color={colors.blue600} size={18} />
                                                    <Text style={{ marginLeft: 8, color: colors.lightGray700, fontWeight: '500' }}>Bestand bijvoegen</Text>
                                                </TouchableOpacity>
                                                {(newPropertiesList.length > 1) && (<TouchableOpacity onPress={() => removePropertyField(prop.id)} style={{ padding: 8 }}><X color={colors.red600} size={20} /></TouchableOpacity>)}
                                            </View>
                                        )}
                                        
                                        {prop.type === 'formula' && (newPropertiesList.length > 1) && (
                                            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                                                <TouchableOpacity onPress={() => removePropertyField(prop.id)} style={{ padding: 8 }}>
                                                    <X color={colors.red600} size={20} />
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                ) : (
                                    // NATIVE LAYOUT: STACKED
                                    <View>
                                        <View style={AppStyles.formGroup}>
                                            <Text style={AppStyles.formLabel}>Eigenschap Naam</Text>
                                            <TextInput placeholder="Bijv. Oppervlakte" value={prop.name} onChangeText={(text) => handlePropertyFieldChange(prop.id, 'name', text)} style={AppStyles.formInput} />
                                        </View>
                                        <View style={AppStyles.formGroup}>
                                            <Text style={AppStyles.formLabel}>{prop.type === 'formula' ? 'Formule' : 'Waarde'}</Text>
                                            {prop.type === 'formula' ? (
                                                <TextInput 
                                                    placeholder="Bijv. lengte * breedte" 
                                                    value={prop.formula || ''} 
                                                    onChangeText={(text) => handlePropertyFieldChange(prop.id, 'formula', text)} 
                                                    style={[AppStyles.formInput, { fontFamily: 'monospace' }]} 
                                                />
                                            ) : (
                                                <TextInput placeholder="Bijv. 2kg" value={prop.value} onChangeText={(text) => handlePropertyFieldChange(prop.id, 'value', text)} style={AppStyles.formInput} />
                                            )}
                                        </View>

                                        {prop.type === 'formula' && (
                                            <View style={{ marginBottom: 16, padding: 8, backgroundColor: colors.green50, borderRadius: 6 }}>
                                                <Text style={{ fontSize: 12, color: colors.green700, fontWeight: '500' }}>Berekende waarde: {prop.value || '0'}</Text>
                                            </View>
                                        )}

                                        {prop.type !== 'formula' && (
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                                                <TouchableOpacity onPress={() => handleSelectFile(prop.id)} style={{ flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: colors.lightGray100, borderRadius: 8, alignSelf: 'flex-start' }}>
                                                    <Paperclip color={colors.blue600} size={18} />
                                                    <Text style={{ marginLeft: 8, color: colors.lightGray700, fontWeight: '500' }}>Bestand bijvoegen</Text>
                                                </TouchableOpacity>
                                                {(newPropertiesList.length > 1) && (<TouchableOpacity onPress={() => removePropertyField(prop.id)} style={{ padding: 8 }}><X color={colors.red600} size={20} /></TouchableOpacity>)}
                                            </View>
                                        )}
                                        
                                        {prop.type === 'formula' && (newPropertiesList.length > 1) && (
                                            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                                                <TouchableOpacity onPress={() => removePropertyField(prop.id)} style={{ padding: 8 }}>
                                                    <X color={colors.red600} size={20} />
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                )}

                                {prop.files && prop.files.length > 0 && (
                                    <View style={{marginTop: 12}}>
                                        <Text style={[AppStyles.formLabel, {marginBottom: 4}]}>Bijlagen</Text>
                                        {prop.files.map((file, fileIndex) => (
                                            <View key={fileIndex} style={{flexDirection: 'row', alignItems: 'center', backgroundColor: colors.lightGray50, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: colors.lightGray200, marginBottom: 8}}>
                                                <FileText size={18} color={colors.lightGray600} />
                                                <Text style={{flex: 1, marginLeft: 12, color: colors.lightGray700}} numberOfLines={1}>{file.name}</Text>
                                                <TouchableOpacity onPress={() => removeFileFromProperty(prop.id, fileIndex)} style={{padding: 4, marginLeft: 8}}>
                                                    <X size={16} color={colors.red500} />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                        ))}
                        
                        <TouchableOpacity onPress={handleSaveOnBack} style={[AppStyles.btnPrimary, AppStyles.btnFull, AppStyles.btnFlexCenter, { marginTop: 16 }]}>
                            <Text style={AppStyles.btnPrimaryText}>Opslaan</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
                <View style={{ flexDirection: 'row', position: 'absolute', bottom: 20, right: 20 }}>
                    <TouchableOpacity onPress={() => addNewPropertyField('formula')} style={[AppStyles.fab, { marginRight: 12, backgroundColor: colors.green600 }]}>
                        <Calculator color="white" size={24} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => addNewPropertyField('regular')} style={AppStyles.fab}>
                        <Plus color="white" size={24} />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
};

export default AddPropertyScreen;