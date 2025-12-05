import { getDownloadURL, ref } from 'firebase/storage';
import { ChevronLeft, File, FileImage, FileText, Paperclip, Plus, Tag, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Image, Linking, Modal, RefreshControl, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import AppStyles, { colors } from '../AppStyles';
import { storage } from '../config/firebase';

const PropertiesScreen = ({ currentPath, objectsHierarchy, setCurrentScreen, onRefresh, refreshing, fallbackTempItem, activeTempObjects }) => {
    
    // --- NEW: State for the image modal ---
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedImageUrl, setSelectedImageUrl] = useState(null);
    // State to trigger rebuild when properties are deleted from other screens
    const [deletionNotifier, setDeletionNotifier] = useState(0);
    // Local state copy of properties for reactive updates
    const [displayPropertiesLocal, setDisplayPropertiesLocal] = useState(null);

    const objectId = currentPath[currentPath.length - 1];

    // Auto-refresh when this screen mounts or when objectId changes
    useEffect(() => {
        if (typeof onRefresh === 'function') {
            onRefresh();
        }
    }, [objectId]);

    // Listen to deletion AND update events
    useEffect(() => {
        const handleChange = () => {
            console.log('[PropertiesScreen] Property change detected, triggering rebuild');
            setDeletionNotifier(n => n + 1); // Trigger a rebuild
        };
        
        try {
            const g = globalThis;
            // Listen to deletions
            g.__propertyDeletionListeners = g.__propertyDeletionListeners || [];
            g.__propertyDeletionListeners.push(handleChange);

            // Listen to general updates
            g.__propertyChangeListeners = g.__propertyChangeListeners || [];
            g.__propertyChangeListeners.push(handleChange);
            
            return () => {
                // Cleanup listeners
                if (g.__propertyDeletionListeners) g.__propertyDeletionListeners = g.__propertyDeletionListeners.filter(l => l !== handleChange);
                if (g.__propertyChangeListeners) g.__propertyChangeListeners = g.__propertyChangeListeners.filter(l => l !== handleChange);
            };
        } catch (_) {}
    }, []);

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

    let item = findItemByPath(objectsHierarchy, currentPath);
    
    // Fallback: check activeTempObjects (for items that are saved but not yet in hierarchy, or still temp)
    if (!item && activeTempObjects && Array.isArray(activeTempObjects)) {
        const tempMatch = activeTempObjects.find(t => t.id === objectId);
        if (tempMatch) {
            item = tempMatch;
        }
    }

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

    // Initialize global cache for this item so deletions can be tracked locally
    useEffect(() => {
        if (item?.id) {
            const g = globalThis;
            g.__currentObjectItems = g.__currentObjectItems || {};
            // Only initialize if not present to avoid overwriting deletions with stale props
            if (!g.__currentObjectItems[item.id]) {
                g.__currentObjectItems[item.id] = { ...item };
                console.log('[PropertiesScreen] Initialized global cache for:', item.id);
            }
        }
    }, [item?.id]);

    // Combined effect to initialize and sync properties
    useEffect(() => {
        if (!item) {
            setDisplayPropertiesLocal([]);
            return;
        }

        let propsToUse = Array.isArray(item.properties) ? item.properties : [];

        // Check global cache for updates (e.g. after deletion)
        try {
            const g = globalThis;
            if (g.__currentObjectItems && g.__currentObjectItems[item.id]) {
                const cachedItem = g.__currentObjectItems[item.id];
                if (Array.isArray(cachedItem.properties)) {
                    propsToUse = cachedItem.properties;
                    console.log('[PropertiesScreen] Using cached properties for object:', item.id, 'count:', propsToUse.length);
                }
            }
        } catch (_) {}

        setDisplayPropertiesLocal(propsToUse);
    }, [item, deletionNotifier]);

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
    const handleOpenFile = async (file) => {
        try {
            // Get download URL from Firebase Storage
            const fileRef = ref(storage, file.url || file.file_path);
            const fileUrl = await getDownloadURL(fileRef);

            if (file.file_type && file.file_type.startsWith('image/')) {
                // If it's an image, open it in the modal
                setSelectedImageUrl(fileUrl);
                setModalVisible(true);
            } else {
                // For other files, open in a new tab/browser
                Linking.openURL(fileUrl);
            }
        } catch (error) {
            console.error('[PropertiesScreen] Error opening file:', error);
            // Fallback: try direct URL if available
            if (file.url) {
                Linking.openURL(file.url);
            }
        }
    };

    // ===== Optimistic property merge (prevents flicker when temp object resolves) =====
    const buildMergedProperties = () => {
        try {
            if (!item) return [];
            
            const base = displayPropertiesLocal !== null
                ? [...displayPropertiesLocal] 
                : (Array.isArray(item.properties) ? [...item.properties] : []);
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

            // Build map keyed by ID first, then fallback to name for matching
            const byId = new Map();
            const byName = new Map();

            // 1. Index base properties
            base.forEach(p => {
                if (p.id && !String(p.id).startsWith('temp_')) {
                    byId.set(p.id, { ...p });
                }
                // Also index by name for fallback matching if ID is missing or temp
                const nameKey = (p.name || '').toLowerCase();
                if (!byName.has(nameKey)) byName.set(nameKey, []);
                byName.get(nameKey).push(p);
            });

            // 2. Apply optimistic updates
            entry.props.forEach(p => {
                const optimisticVal = { ...p, __optimistic: true, __createdAt: p.__createdAt || now };
                
                // Case A: Optimistic update has a real ID (it was an edit of an existing property)
                if (p.id && !String(p.id).startsWith('temp_')) {
                    byId.set(p.id, optimisticVal);
                    // Also update name index to prevent duplicates if we iterate by name later
                    const nameKey = (p.name || '').toLowerCase();
                    // Remove old entry from name index if it exists
                    if (byName.has(nameKey)) {
                        byName.set(nameKey, byName.get(nameKey).filter(existing => existing.id !== p.id));
                    }
                } 
                // Case B: Optimistic update has a temp ID (newly created) OR we are editing a property that only had a temp ID locally
                else {
                    // Try to match by name if ID is temp
                    const nameKey = (p.name || '').toLowerCase();
                    if (byName.has(nameKey) && byName.get(nameKey).length > 0) {
                        // We found existing properties with this name.
                        // Assume this optimistic update replaces ONE of them.
                        // Ideally we'd know which one, but without ID it's a guess.
                        // Strategy: Replace the first one found to avoid duplicates.
                        const existingMatches = byName.get(nameKey);
                        const match = existingMatches[0];
                        
                        // If the match has a real ID, use that ID for the optimistic value so it overrides correctly
                        if (match.id && !String(match.id).startsWith('temp_')) {
                            byId.set(match.id, { ...optimisticVal, id: match.id });
                        } else {
                            // Both are temp or missing ID, just use the optimistic one
                            // We can't easily put it in byId if it has no real ID, so we'll handle "leftovers" later.
                        }
                        
                        // Remove this match from the available pool so we don't match it again
                        existingMatches.shift();
                        if (existingMatches.length === 0) byName.delete(nameKey);
                    }
                    
                    // Always add the optimistic value to a "new/temp" list? 
                    // Actually, let's just collect everything into a final list.
                }
            });

            // Reconstruct the list
            // Start with everything in byId (real IDs, including optimistic overrides)
            let finalList = Array.from(byId.values());

            // Add remaining base items that weren't overridden by ID (and thus are still in byName)
            // Wait, byId contains ALL base items with real IDs.
            // We need to handle items that ONLY exist in byName (no real ID yet) AND optimistic items that didn't match a real ID.
            
            // Let's simplify:
            // We want to merge `base` and `entry.props`.
            // Priority: Optimistic > Base.
            // Match criteria: ID > Name.
            
            const mergedMap = new Map();
            
            // 1. Put all base items in map
            base.forEach(p => {
                // Prefer real ID as key
                const key = (p.id && !String(p.id).startsWith('temp_')) ? p.id : `NAME:${(p.name||'').toLowerCase()}`;
                mergedMap.set(key, p);
            });

            // 2. Overlay optimistic items
            entry.props.forEach(p => {
                // If p has a real ID, it definitely overrides the base item with that ID.
                if (p.id && !String(p.id).startsWith('temp_')) {
                    mergedMap.set(p.id, { ...p, __optimistic: true });
                    // Ensure we don't have a duplicate by name in the map (e.g. if base had it keyed by name because it lacked ID - unlikely but possible)
                    const nameKey = `NAME:${(p.name||'').toLowerCase()}`;
                    if (mergedMap.has(nameKey)) {
                        const existing = mergedMap.get(nameKey);
                        // If the existing item by name is actually the same item (conceptually), remove it.
                        // But if it's a different item that just happens to have the same name, we might keep it?
                        // For now, assume name uniqueness per object is desired or at least a strong hint.
                        // If we are editing "Length", we want to replace the old "Length".
                        mergedMap.delete(nameKey); 
                    }
                } else {
                    // Optimistic item has temp ID.
                    // Try to find a match by Name in the existing map.
                    const nameKey = `NAME:${(p.name||'').toLowerCase()}`;
                    
                    // Check if we have a base item with this name (keyed by ID or Name)
                    let foundMatchKey = null;
                    for (const [k, v] of mergedMap.entries()) {
                        if ((v.name || '').toLowerCase() === (p.name || '').toLowerCase()) {
                            foundMatchKey = k;
                            break;
                        }
                    }

                    if (foundMatchKey) {
                        // We found a base item with the same name.
                        // Replace it with our optimistic version.
                        // Preserve the ID of the base item if it's real, so future updates work.
                        const baseItem = mergedMap.get(foundMatchKey);
                        const realId = (baseItem.id && !String(baseItem.id).startsWith('temp_')) ? baseItem.id : p.id;
                        
                        mergedMap.set(foundMatchKey, { ...p, id: realId, __optimistic: true });
                    } else {
                        // No match found, it's a new property
                        mergedMap.set(p.id || nameKey, { ...p, __optimistic: true });
                    }
                }
            });

            const merged = Array.from(mergedMap.values());
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
