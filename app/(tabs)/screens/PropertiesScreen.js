import { ChevronLeft, File, FileImage, FileText, Paperclip, Plus, Tag, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Image, Linking, Modal, RefreshControl, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import AppStyles, { colors } from '../AppStyles';
import { supabase } from '../config/config';

const PropertiesScreen = ({ currentPath, objectsHierarchy, setCurrentScreen, onRefresh, refreshing, fallbackTempItem }) => {
    
    // --- NEW: State for the image modal ---
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedImageUrl, setSelectedImageUrl] = useState(null);

    const findItemByPath = (data, path) => {
        let currentItems = data;
        let foundItem = null;
        for (let i = 0; i < path.length; i++) {
            const idToFind = path[i];
            if (!Array.isArray(currentItems)) return null;
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

    const objectId = currentPath[currentPath.length - 1];
    let item = findItemByPath(objectsHierarchy, currentPath);
    // Allow temp objects to show a minimal properties screen before DB row exists
    if (!item && typeof objectId === 'string' && objectId.startsWith('temp_')) {
        item = {
            id: objectId,
            naam: fallbackTempItem?.naam || 'Nieuw object',
            properties: [],
            children: [],
        };
    }

    if (!item) {
        return <View style={[AppStyles.screen, { justifyContent: 'center', alignItems: 'center' }]}><Text style={AppStyles.emptyStateText}>Item not found...</Text></View>;
    }

    // Auto-refresh when this screen mounts or when objectId changes
    useEffect(() => {
        if (typeof onRefresh === 'function') {
            onRefresh();
        }
    }, [objectId]);

    const renderIcon = (customColor = colors.lightGray500) => {
        return <Tag color={customColor} size={20} />;
    };
    
    const getFileIcon = (fileType) => {
        if (fileType) {
            if (fileType.startsWith('image/')) {
                return <FileImage size={24} color={colors.purple600} />;
            }
            if (fileType === 'application/pdf') {
                return <FileText size={24} color={colors.red600} />;
            }
        }
        return <File size={24} color={colors.lightGray600} />;
    };

    // --- NEW: Function to handle opening a file ---
    const handleOpenFile = (file) => {
        // Get public URL from Supabase Storage
        const { data } = supabase.storage
            .from('property-files')
            .getPublicUrl(file.file_path);
        
        const fileUrl = data.publicUrl;

        if (file.file_type && file.file_type.startsWith('image/')) {
            // If it's an image, open it in the modal
            setSelectedImageUrl(fileUrl);
            setModalVisible(true);
        } else {
            // For other files, open in a new tab/browser
            Linking.openURL(fileUrl);
        }
    };

    // ===== Optimistic property merge (prevents flicker when temp object resolves) =====
    const buildMergedProperties = () => {
        try {
            if (!item) return [];
            const base = Array.isArray(item.properties) ? [...item.properties] : [];
            const g = globalThis;
            const cache = g.__tempPropertiesCache?.map;
            const resolutionMap = g.__tempObjectResolutionMap; // Map(tempId -> dbId)

            // Helper: sorteren op id (numeriek), daarna fallback op naam
            const sortPropsById = (arr) => {
                return [...arr].sort((a, b) => {
                    const parseId = (val) => {
                        if (val === null || val === undefined) return Number.POSITIVE_INFINITY;
                        const n = parseInt(val, 10);
                        return isNaN(n) ? Number.POSITIVE_INFINITY : n;
                    };

                    const aId = parseId(a.id);
                    const bId = parseId(b.id);

                    if (aId !== bId) return aId - bId;

                    // Fallback: sorteer op naam als ids gelijk / geen geldige id
                    return String(a.name || '').localeCompare(
                        String(b.name || ''),
                        undefined,
                        { sensitivity: 'base' }
                    );
                });
            };

            // Geen cache? Dan gewoon DB-properties sorteren op id
            if (!cache || !cache.has(objectId)) {
                return sortPropsById(base);
            }

            const now = Date.now();
            const entry = cache.get(objectId);
            if (!entry || !Array.isArray(entry.props)) return sortPropsById(base);

            // Filter expired optimistic props
            if (entry.expires < now) {
                cache.delete(objectId);
                return sortPropsById(base);
            }

            // Build map keyed by name::formula so we can replace existing items with optimistic edits
            const byKey = new Map();
            base.forEach(p => {
                const key = (p.name || '').toLowerCase() + '::' + (p.Formule_expression || '');
                byKey.set(key, { ...p });
            });

            entry.props.forEach(p => {
                const nameLc = (p.name || '').toLowerCase();
                const key = nameLc + '::' + (p.Formule_expression || '');
                const optimisticVal = { ...p, __optimistic: true, __createdAt: p.__createdAt || now };
                // Remove any existing entries with the same name (regardless of old formula), then insert
                for (const k of Array.from(byKey.keys())) {
                    if (k.startsWith(nameLc + '::')) {
                        byKey.delete(k);
                    }
                }
                byKey.set(key, optimisticVal);
            });

            const merged = Array.from(byKey.values());
            return sortPropsById(merged);
        } catch (e) {
            console.warn('[PropertiesScreen] merge failed', e);
            return Array.isArray(item?.properties) ? item.properties : [];
        }
    };

    const mergedProperties = buildMergedProperties();

    // Cleanup expired cache entries occasionally
    try {
        const g = globalThis;
        if (g.__tempPropertiesCache && g.__tempPropertiesCache.map && Math.random() < 0.02) { // ~2% chance per render
            const now = Date.now();
            for (const [oid, entry] of g.__tempPropertiesCache.map.entries()) {
                if (entry.expires < now) g.__tempPropertiesCache.map.delete(oid);
            }
        }
    } catch (_) {}

    return (
        <View style={[AppStyles.screen, { flex: 1 }]}>
            {/* --- NEW: Image Viewer Modal --- */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={AppStyles.modalBackdrop}>
                    <Image
                        source={{ uri: selectedImageUrl }}
                        style={{ width: '90%', height: '80%', resizeMode: 'contain' }}
                    />
                    <TouchableOpacity
                        style={{ position: 'absolute', top: 50, right: 20, backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 20 }}
                        onPress={() => setModalVisible(false)}
                    >
                        <X size={24} color="white" />
                    </TouchableOpacity>
                </View>
            </Modal>

            <StatusBar barStyle="dark-content" />
            <View style={AppStyles.header}>
                <View style={AppStyles.headerFlex}>
                    <TouchableOpacity onPress={() => setCurrentScreen('objects')} style={AppStyles.headerBackButton}>
                        <ChevronLeft color={colors.lightGray700} size={24} />
                    </TouchableOpacity>
                    <Text style={AppStyles.headerTitleLg}>Eigenschappen</Text>
                    <View style={AppStyles.headerPlaceholder} />
                </View>
            </View>
            <View style={{ backgroundColor: colors.white, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.lightGray200 }}>
                <Text style={AppStyles.detailName}>{item.naam}</Text>
                <Text style={AppStyles.detailSubtitle}>{(mergedProperties || []).length} eigenschap{(mergedProperties || []).length !== 1 ? 'pen' : ''}</Text>
            </View>
            <ScrollView 
                contentContainerStyle={[AppStyles.contentPadding, { paddingBottom: 80 }]} // <-- verhoog paddingBottom
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.blue600]} tintColor={colors.blue600} />}
            >
                <View style={AppStyles.propertyList}>
                    {(mergedProperties && mergedProperties.length > 0) ? (
                        mergedProperties.map((prop) => (
                            <View key={prop.id} style={[AppStyles.propertyItem, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%'}}>
                                    <View style={AppStyles.propertyItemMain}>
                                        {renderIcon()}
                                        <Text style={AppStyles.propertyName}>{prop.name}</Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        {/* Show computed value for formulas to avoid stale or misconverted saved values */}
                                        {(() => {
                                            const expr = (prop.Formule_expression && String(prop.Formule_expression))
                                                || (prop.formule && String(prop.formule))
                                                || (prop.formules && prop.formules.formule && String(prop.formules.formule))
                                                || '';
                                            return expr && /[+\-*/()x×]/.test(expr);
                                        })() ? (
                                            <>
                                                <Text style={{ color: colors.lightGray500, fontSize: 13, fontStyle: 'italic' }}>
                                                    {(() => {
                                                        const expr = (prop.Formule_expression && String(prop.Formule_expression))
                                                            || (prop.formule && String(prop.formule))
                                                            || (prop.formules && prop.formules.formule && String(prop.formules.formule))
                                                            || '';
                                                        return expr;
                                                    })()}
                                                </Text>
                                                {(() => {
                                                    try {
                                                        // Build a properties array for evaluation (use mergedProperties so cross-refs work)
                                                        const allProps = (mergedProperties || []).map(p => ({
                                                            name: p.name,
                                                            value: p.waarde,
                                                            unit: p.eenheid || ''
                                                        }));
                                                        // Local converters to mirror AddPropertyScreen behavior
                                                        const unitConversionTable = {
                                                            m: { m: 1, cm: 0.01, mm: 0.001 },
                                                            cm: { m: 100, cm: 1, mm: 0.1 },
                                                            mm: { m: 1000, cm: 10, mm: 1 },
                                                            'm²': { 'm²': 1, 'cm²': 0.0001, 'mm²': 0.000001 },
                                                            'cm²': { 'm²': 10000, 'cm²': 1, 'mm²': 0.01 },
                                                            'mm²': { 'm²': 1000000, 'cm²': 100, 'mm²': 1 },
                                                            'm³': { 'm³': 1, L: 0.001, mL: 0.000001 },
                                                            L: { 'm³': 1000, L: 1, mL: 0.001 },
                                                            mL: { 'm³': 1000000, L: 1000, mL: 1 },
                                                            kg: { kg: 1, g: 0.001 },
                                                            g: { kg: 1000, g: 1 },
                                                        };
                                                        const sanitizeUnit = (u) => u
                                                            ?.replace(/m\^2/i, 'm²')
                                                            ?.replace(/m\^3/i, 'm³')
                                                            ?.replace(/^l$/i, 'L')
                                                            ?.replace(/^ml$/i, 'mL');
                                                        const convertToUnit = (value, fromUnit, toUnit) => {
                                                            const f = sanitizeUnit(fromUnit);
                                                            const t = sanitizeUnit(toUnit);
                                                            if (!f || !t || !unitConversionTable[t] || !unitConversionTable[t][f]) return value;
                                                            return value * unitConversionTable[t][f];
                                                        };
                                                        const evaluateFormule = (Formule, properties) => {
                                                            if (!Formule || typeof Formule !== 'string') return { value: 0, error: 'Invalid formula' };
                                                            let expression = Formule.replace(/[x×]/g, '*');
                                                            if (Array.isArray(properties)) {
                                                                properties.forEach(pr => {
                                                                    if (pr.name && pr.name.trim() !== '') {
                                                                        const rx = new RegExp(`\\b${pr.name}\\b`, 'gi');
                                                                        let propVal = pr.value || '0';
                                                                        if (pr.unit && pr.unit.trim() !== '') propVal = `${propVal}${pr.unit}`;
                                                                        expression = expression.replace(rx, propVal);
                                                                    }
                                                                });
                                                            }
                                                            expression = expression.replace(/(\d+(?:\.\d+)?)\s*(mm|cm|m)\b/gi, (m, num, u) => convertToUnit(parseFloat(num), u.toLowerCase(), 'm'));
                                                            expression = expression.replace(/(\d+(?:\.\d+)?)\s*(g|kg)\b/gi, (m, num, u) => convertToUnit(parseFloat(num), u.toLowerCase(), 'kg'));
                                                            expression = expression.replace(/(\d+(?:\.\d+)?)\s*(mL|L)\b/gi, (m, num, u) => convertToUnit(parseFloat(num), u, 'L'));
                                                            expression = expression.replace(/(\d+(?:\.\d+)?)\s*(m²|cm²|mm²)\b/gi, (m, num, u) => convertToUnit(parseFloat(num), u, 'm²'));
                                                            expression = expression.replace(/(\d+(?:\.\d+)?)\s*(m³)\b/gi, (m, num, u) => convertToUnit(parseFloat(num), u, 'm³'));
                                                            if (/[^0-9+\-*/().\s]/.test(expression)) return { value: null, error: 'Onbekende variabelen in formule' };
                                                            try {
                                                                const result = new Function(`return ${expression}`)();
                                                                return { value: typeof result === 'number' && !isNaN(result) ? result : null, error: null };
                                                            } catch (_) {
                                                                return { value: null, error: 'Formule kon niet worden berekend' };
                                                            }
                                                        };
                                                        const expr = (prop.Formule_expression && String(prop.Formule_expression))
                                                            || (prop.formule && String(prop.formule))
                                                            || (prop.formules && prop.formules.formule && String(prop.formules.formule))
                                                            || '';
                                                        const normalized = expr.replace(/[x×]/g, '*');
                                                        const { value, error } = evaluateFormule(normalized, allProps);
                                                        if (error || value == null) {
                                                            return (
                                                                <Text style={{ color: colors.red500, fontSize: 12, fontStyle: 'italic' }}>{error || 'Formule fout'}</Text>
                                                            );
                                                        }
                                                        let v = value;
                                                        const u = prop.eenheid || '';
                                                        const isArea = ['m²','cm²','mm²'].includes(u);
                                                        const isVolume = ['m³','L','mL'].includes(u);
                                                        const hasMulDiv = /[*/]/.test(normalized);
                                                        if (!hasMulDiv) {
                                                            if (['cm','mm','g','mL'].includes(u)) {
                                                                const base = (u === 'cm' || u === 'mm') ? 'm' : (u === 'g' ? 'kg' : 'L');
                                                                v = convertToUnit(v, base, u);
                                                            }
                                                        } else {
                                                            if (isArea) v = convertToUnit(v, 'm²', u);
                                                            else if (isVolume && u !== 'L') v = convertToUnit(v, 'm³', u);
                                                        }
                                                        return (
                                                            <Text style={AppStyles.propertyValue}>
                                                                {v}
                                                                {u && ((isArea || (isVolume && hasMulDiv) || (!hasMulDiv)) ? ` ${u}` : '')}
                                                            </Text>
                                                        );
                                                    } catch (e) {
                                                        return (
                                                            <Text style={{ color: colors.red500, fontSize: 12, fontStyle: 'italic' }}>Formule kon niet worden berekend</Text>
                                                        );
                                                    }
                                                })()}
                                            </>
                                        ) : (
                                            <Text style={AppStyles.propertyValue}>
                                                {prop.waarde}
                                                {prop.eenheid ? ` ${prop.eenheid}` : ''}
                                            </Text>
                                        )}
                                    </View>
                                </View>

                                {prop.files && prop.files.length > 0 && (
                                    <View style={{ marginTop: 12, width: '100%', borderTopWidth: 1, borderColor: colors.lightGray100, paddingTop: 12 }}>
                                        {prop.files.map((file, fileIndex) => (
                                            <TouchableOpacity
                                                key={fileIndex}
                                                style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    padding: 12,
                                                    backgroundColor: colors.lightGray50,
                                                    borderRadius: 8,
                                                    borderWidth: 1,
                                                    borderColor: colors.lightGray200,
                                                    marginBottom: 8,
                                                }}
                                                onPress={() => handleOpenFile(file)} // --- Use new handler ---
                                            >
                                                {getFileIcon(file.file_type)}
                                                <View style={{ marginLeft: 12, flex: 1 }}>
                                                    <Text style={{ color: colors.lightGray800, fontWeight: '600', fontSize: 14 }} numberOfLines={1}>
                                                        {file.file_name}
                                                    </Text>
                                                    <Text style={{ color: colors.lightGray500, fontSize: 12 }}>
                                                        {file.file_type || 'Bestand'}
                                                    </Text>
                                                </View>
                                                <Paperclip color={colors.blue600} size={18} />
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
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

export default PropertiesScreen;
