import { ArrowRight, Check, Circle, GitBranch, Link as LinkIcon, Plus, Recycle, Trash2, X } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AppStyles, { colors } from '../../AppStyles';
import AttachExistingObjectsModal from './AttachExistingObjectsModal';

// Material flow type options
const MATERIAL_FLOW_TYPES = [
    { key: 'default', label: 'Default', icon: Circle, color: colors.lightGray500, description: 'No specific flow type' },
    { key: 'raw_material', label: 'Raw Material', icon: Recycle, color: colors.blue600, description: 'Basic materials like steel, concrete' },
    { key: 'intermediate', label: 'Intermediate', icon: GitBranch, color: colors.purple600, description: 'Processed materials' },
    { key: 'component', label: 'Component', icon: ArrowRight, color: colors.lightGray600, description: 'Building parts' },
    { key: 'final_product', label: 'Final Product', icon: Plus, color: colors.blue700, description: 'Completed structures' }
];

const AddObjectModal = ({ visible, onClose, onSave, onAttachExisting, objectsHierarchy = [], excludeIds = [], mode = 'multiple' }) => {
    const [names, setNames] = useState(['']); // start with one field
    const inputRefs = useRef([]);
    const [showAttach, setShowAttach] = useState(false);
    const [selectedExistingIds, setSelectedExistingIds] = useState([]); // stage selected existing object ids
    const [selectedFlowType, setSelectedFlowType] = useState('default'); // material flow type

    const updateName = (idx, val) => {
        const next = names.slice();
        next[idx] = val;
        setNames(next);
    };

    const addField = () => {
        const nextIndex = names.length;
        setNames((prev) => [...prev, '']);
        // Focus the newly added input after render
        setTimeout(() => {
            const target = inputRefs.current?.[nextIndex];
            if (target && typeof target.focus === 'function') target.focus();
        }, 0);
    };
    const removeField = (idx) => {
        const next = names.slice();
        next.splice(idx, 1);
        // If all fields are removed, create a fresh empty input
        if (next.length === 0) next.push('');
        setNames(next);
    };

    const handleSave = async () => {
        const cleaned = names.map(n => (n || '').trim()).filter(Boolean);
        if (cleaned.length === 0 && selectedExistingIds.length === 0) {
            Alert.alert('Invoer vereist', mode === 'single' ? 'Voer een naam in of kies bestaande objecten.' : 'Voer minstens één naam in of kies bestaande objecten.');
            return;
        }
        // Deduplicate while preserving order
        const seen = new Set();
        const unique = cleaned.filter(n => (seen.has(n) ? false : (seen.add(n), true)));
        // Skip creating new items if their names match selected existing selections (case-insensitive)
        const existingNameSet = new Set(selectedExisting.map(s => (s.name || '').trim().toLowerCase()));
        const uniqueFiltered = unique.filter(n => !existingNameSet.has(n.trim().toLowerCase()));

        // Close modal immediately
        onClose();
        try {
            console.log('[AddObjectModal] handleSave start', { cleaned, unique, uniqueFiltered, selectedExistingIds });
            const groupKey = (selectedExistingIds.length > 0) ? `g_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` : null;
            if (uniqueFiltered.length > 0) {
                if (mode === 'single') {
                    console.log('[AddObjectModal] Creating new (single):', uniqueFiltered[0], 'groupKey:', groupKey, 'flowType:', selectedFlowType);
                    await Promise.resolve(onSave({ name: uniqueFiltered[0], groupKey, materialFlowType: selectedFlowType }));
                } else {
                    console.log('[AddObjectModal] Creating new (multiple):', uniqueFiltered, 'groupKey:', groupKey, 'flowType:', selectedFlowType);
                    await Promise.resolve(onSave({ names: uniqueFiltered, groupKey, materialFlowType: selectedFlowType }));
                }
            }
            if (selectedExistingIds.length > 0 && onAttachExisting) {
                console.log('[AddObjectModal] Linking existing ids', selectedExistingIds, 'groupKey:', groupKey);
                await Promise.resolve(onAttachExisting({ ids: selectedExistingIds, groupKey, deferClose: true }));
            }
            setNames(['']);
            setSelectedExistingIds([]);
            setSelectedFlowType('default');
        } catch (e) {
            console.error('[AddObjectModal] Save failed', e);
        }
    };

    // Build id->name map once for reliable name lookup
    const idNameMap = useMemo(() => {
        const map = new Map();
        const stack = Array.isArray(objectsHierarchy) ? [...objectsHierarchy] : [];
        while (stack.length) {
            const n = stack.pop();
            if (!n || typeof n.id === 'undefined') continue;
            if (n.naam && !map.has(n.id)) map.set(n.id, n.naam);
            if (Array.isArray(n.children)) stack.push(...n.children);
        }
        return map;
    }, [objectsHierarchy]);
    const selectedExisting = useMemo(() => selectedExistingIds.map((id) => {
        const name = idNameMap.get(id) || `#${id}`;
        return { id, name };
    }), [selectedExistingIds, idNameMap]);

    return (
        <>
            <Modal
                transparent={true}
                visible={visible && !showAttach}
                onRequestClose={onClose}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={AppStyles.modalOverlay}
                >
                    <View style={AppStyles.modalContainer}>
                        {/* Header */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Text style={AppStyles.modalTitle}>
                                {mode === 'single' ? 'Object toevoegen' : 'Meerdere objecten toevoegen'}
                            </Text>
                            <TouchableOpacity onPress={onClose} accessibilityLabel="Sluiten" style={{ padding: 6 }}>
                                <X color={colors.lightGray600} size={20} />
                            </TouchableOpacity>
                        </View>

                        {/* Content */}
                        <ScrollView style={{ maxHeight: '70%' }} contentContainerStyle={{ paddingBottom: 8 }}>
                            <View style={AppStyles.formGroup}>
                                <Text style={AppStyles.formLabel}>{mode === 'single' ? 'Objectnaam' : 'Objectnamen'}</Text>
                                {(mode === 'single' ? [names[0]] : names).map((val, idx) => (
                                    <View key={idx} style={{ marginBottom: 8 }}>
                                        <View style={[AppStyles.formInput, { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 6 }]}> 
                                            <TextInput
                                                ref={(el) => { inputRefs.current[idx] = el; }}
                                                placeholder={mode === 'single' ? 'Naam' : `Naam ${idx + 1}`}
                                                value={val ?? ''}
                                                onChangeText={(t) => updateName(idx, t)}
                                                placeholderTextColor={colors.lightGray400}
                                                underlineColorAndroid="transparent"
                                                style={{
                                                    flex: 1,
                                                    paddingVertical: 0,
                                                    paddingHorizontal: 0,
                                                    fontSize: 16,
                                                    color: colors.lightGray700,
                                                    // Remove focus ring on web
                                                    outlineStyle: 'none',
                                                    outlineWidth: 0,
                                                    outlineColor: 'transparent',
                                                }}
                                                returnKeyType="done"
                                            />
                                            {(names.length > 1 || ((val ?? '').trim().length > 0)) && (
                                                <TouchableOpacity
                                                    onPress={() => removeField(idx)}
                                                    accessibilityLabel="Naam verwijderen"
                                                    style={{ padding: 6 }}
                                                >
                                                    <Trash2 color={colors.lightGray600} size={16} />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                ))}
                                {/* Staged existing selection field - only show when there are selections */}
                                {selectedExisting.length > 0 && (
                                    <View style={{ marginTop: 8 }}>
                                        <View style={{ flex: 1 }}>
                                            <View>
                                                {selectedExisting.map((s) => (
                                                    <View key={s.id} style={{ marginBottom: 8 }}>
                                                        <View style={[AppStyles.formInput, { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingVertical: 10, paddingHorizontal: 12, paddingRight: 6 }]}> 
                                                            <Text style={{ color: colors.lightGray700, flex: 1 }}>{s.name}</Text>
                                                            <TouchableOpacity
                                                                onPress={() => setSelectedExistingIds((prev) => prev.filter((x) => x !== s.id))}
                                                                accessibilityLabel="Verwijder dit object"
                                                                style={{ padding: 6 }}
                                                            >
                                                                <Trash2 color={colors.lightGray600} size={16} />
                                                            </TouchableOpacity>
                                                        </View>
                                                    </View>
                                                ))}
                                            </View>
                                        </View>
                                    </View>
                                )}
                                {mode !== 'single' && (
                                    <View style={{ marginTop: 8 }}>
                                        <TouchableOpacity
                                            onPress={addField}
                                            style={[AppStyles.btnPropertyOutline, { paddingVertical: 10 }]}
                                        >
                                            <View style={AppStyles.btnFlexCenter}>
                                                <Plus color={colors.lightGray600} size={16} />
                                                <Text style={AppStyles.btnPropertyOutlineText}>Object toevoegen</Text>
                                            </View>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>

                            {/* Material Flow Type Selection */}
                            <View style={AppStyles.formGroup}>
                                <Text style={[AppStyles.formLabel, { marginBottom: 8 }]}>Material Flow Type</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                    {MATERIAL_FLOW_TYPES.map((flowType) => {
                                        const isSelected = selectedFlowType === flowType.key;
                                        const FlowIcon = flowType.icon;
                                        
                                        return (
                                            <TouchableOpacity
                                                key={flowType.key}
                                                onPress={() => setSelectedFlowType(flowType.key)}
                                                style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    paddingVertical: 8,
                                                    paddingHorizontal: 12,
                                                    borderRadius: 8,
                                                    borderWidth: 1.5,
                                                    borderColor: isSelected ? flowType.color : colors.lightGray300,
                                                    backgroundColor: isSelected ? `${flowType.color}15` : colors.white,
                                                    minWidth: 100,
                                                }}
                                            >
                                                {FlowIcon && (
                                                    <FlowIcon 
                                                        color={isSelected ? flowType.color : colors.lightGray600} 
                                                        size={16} 
                                                        style={{ marginRight: 6 }} 
                                                    />
                                                )}
                                                <View style={{ flex: 1 }}>
                                                    <Text style={{
                                                        fontSize: 14,
                                                        fontWeight: isSelected ? '600' : '500',
                                                        color: isSelected ? flowType.color : colors.lightGray700,
                                                    }}>
                                                        {flowType.label}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                                <Text style={{ color: colors.lightGray500, fontSize: 12, marginTop: 4 }}>
                                    {MATERIAL_FLOW_TYPES.find(t => t.key === selectedFlowType)?.description || 'Choose the type that best describes this object'}
                                </Text>
                            </View>
                            
                        </ScrollView>

                        {/* Tip moved below inputs */}
                        <Text style={{ color: colors.lightGray600, marginTop: 6, marginBottom: 8, textAlign: 'center' }}>
                            {mode === 'single'
                                ? 'Tip: Voeg één naam toe of kies "Bestaande toevoegen" om een bestaand object te koppelen.'
                                : 'Tip: Voeg meerdere namen toe voor meerdere objecten. Je kunt ook bestaande objecten koppelen.'}
                        </Text>

                        {/* Actions */}
                        <View style={[AppStyles.modalActions, { justifyContent: 'space-between', alignItems: 'center' }]}>
                            <TouchableOpacity
                                onPress={() => setShowAttach(true)}
                                style={AppStyles.btnPropertyOutline}
                            >
                                <View style={AppStyles.btnFlexCenter}>
                                    <LinkIcon color={colors.lightGray600} size={16} />
                                    <Text style={AppStyles.btnPropertyOutlineText}>Bestaande toevoegen</Text>
                                </View>
                            </TouchableOpacity>
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <TouchableOpacity onPress={onClose} style={AppStyles.btnSecondary}>
                                    <Text style={AppStyles.btnSecondaryText}>Annuleren</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleSave} style={[AppStyles.btnPrimary, AppStyles.btnPrimaryModal]}>
                                    <View style={AppStyles.btnFlexCenter}>
                                        <Check color={colors.white} size={16} />
                                        <Text style={AppStyles.btnPrimaryText}>Opslaan</Text>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
            {showAttach && (
                <AttachExistingObjectsModal
                    visible={showAttach}
                    onClose={() => setShowAttach(false)}
                    objectsHierarchy={objectsHierarchy}
                    excludeIds={excludeIds}
                    onAttach={(ids) => {
                        setShowAttach(false);
                        // Stage without linking yet
                        console.log('[AddObjectModal] Staged existing ids', ids);
                        setSelectedExistingIds((prev) => {
                            const set = new Set(prev);
                            ids.forEach((id) => set.add(Number(id)));
                            return Array.from(set);
                        });
                    }}
                />
            )}
        </>
    );
};

export default AddObjectModal;
