
import * as DocumentPicker from 'expo-document-picker';import * as ImagePicker from 'expo-image-picker';
import { Calculator, ChevronLeft, FileText, Paperclip, Plus, Tag, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { fetchFormules as fetchFormulesApi } from '../api';
import AppStyles, { colors } from '../AppStyles';
import AddTemplateModal from '../components/modals/AddTemplateModal';
import EditPropertyModal from '../components/modals/EditPropertyModal';
import TemplatePickerModal from '../components/modals/TemplatePickerModal';
import ValueInputModal from '../components/modals/ValueInputModal';

// Format numbers using Dutch-style separators: thousands '.' and decimals ','
function formatNumber(value, maxDecimals = 6) {
  try {
    if (typeof Intl !== 'undefined' && Intl.NumberFormat) {
      return new Intl.NumberFormat('nl-NL', {
        maximumFractionDigits: maxDecimals,
      }).format(value);
    }
  } catch (_) {}
  // Fallback: manual formatting
  if (typeof value !== 'number' || !isFinite(value)) return String(value);
  let str = value.toFixed(maxDecimals);
  // trim trailing zeros and optional decimal point
  str = str.replace(/\.0+$/, '').replace(/(\.[0-9]*?[1-9])0+$/, '$1').replace(/\.$/, '');
  const [intPart, decPart] = str.split('.');
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decPart ? `${withThousands},${decPart}` : withThousands;
}

function WaardeInput({ value, onChange, onAddFormule, isFormula = false, computedValue = null, unit = '', error = null, onFocus, onBlur }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.lightGray300,
        borderRadius: 8,
        backgroundColor: 'white',
      }}
    >
      <View style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 12 }}>
        <TextInput
          style={[
            { fontSize: 16, color: isFormula ? colors.lightGray600 : colors.lightGray900, padding: 0 },
            Platform.OS === 'web' && { outline: 'none' }
          ]}
          placeholder="Waarde of formule"
          value={value}
          onChangeText={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          blurOnSubmit={false}
          // Improve usability: allow submitting with enter on web
          onSubmitEditing={() => {
            // If user presses enter in a formula context, open picker for refinement
            if (isFormula && typeof onAddFormule === 'function') {
              console.log('[WaardeInput] onSubmitEditing -> opening formule modal');
              onAddFormule();
            }
          }}
        />
        {isFormula && (
          <View style={{ marginTop: 4 }}>
            {error ? (
              <Text style={{ color: colors.red500, fontSize: 12, fontStyle: 'italic' }}>{error}</Text>
            ) : (
              typeof computedValue === 'number' && (
                <Text style={{ color: colors.lightGray700, fontSize: 12 }}>
                  = {formatNumber(computedValue)}
                  {unit ? ` ${unit}` : ''}
                </Text>
              )
            )}
          </View>
        )}
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Formule kiezen"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        onPress={() => {
          if (typeof onAddFormule === 'function') {
            onAddFormule();
          }
        }}
        style={{ padding: 8, borderLeftWidth: 1, borderLeftColor: colors.lightGray200 }}
      >
        <Calculator color={colors.blue600} size={20} />
      </TouchableOpacity>
    </View>
  );
}

const buildPropertiesMap = (properties, outputUnit) => {
    const map = {};

    // Helper to get a property's calculated value
    function getCalculatedValue(prop, visited = {}) {
        // Prevent infinite recursion (circular reference)
        if (visited[prop.name]) return 0;
        visited[prop.name] = true;

        let val = prop.value;
        // If it's a Formule, replace referenced properties with their calculated values
        if (typeof val === 'string' && /[+\-*/]/.test(val)) {
            let Formule = val;
            properties.forEach(refProp => {
                if (refProp.name.trim() !== '') {
                    // Recursively get the calculated value for referenced property
                    const refValue = getCalculatedValue(refProp, { ...visited });
                    const regex = new RegExp(`\\b${refProp.name}\\b`, "gi");
                    Formule = Formule.replace(regex, refValue);
                }
            });
            try {
                // Reject if unknown identifiers remain
                if (/[^0-9+\-*/().\s]/.test(Formule)) {
                    return 'Error';
                }
                val = eval(Formule);
            } catch (e) {
                val = 'Error';
            }
        }
        // Convert to output unit if needed
        if (prop.unit && outputUnit) {
            val = convertToUnit(Number(val), prop.unit, outputUnit);
        }
        return val;
    }

    // Calculate and store all property values
    properties.forEach(prop => {
        if (prop.name.trim() !== '') {
            map[prop.name.toLowerCase()] = getCalculatedValue(prop);
        }
    });

    return map;
};

const evaluateFormule = (Formule, properties) => {
    // Check if Formule is valid
    if (!Formule || typeof Formule !== 'string') {
        return { value: 0, error: 'Invalid formula' };
    }
    
    let expression = Formule;
    
    // Handle both array of properties and properties map
    if (Array.isArray(properties)) {
        // Replace property references with their values (including units)
        properties.forEach(prop => {
            if (prop.name && prop.name.trim() !== '') {
                const regex = new RegExp(`\\b${prop.name}\\b`, 'gi');
                if (expression.match(regex)) {
                    // Combine value and unit if both exist
                    let propValue = prop.value || '0';
                    if (prop.unit && prop.unit.trim() !== '') {
                        propValue = `${propValue}${prop.unit}`;
                    }
                    expression = expression.replace(regex, propValue);
                }
            }
        });
    } else if (properties && typeof properties === 'object') {
        // Handle properties map (legacy format)
        Object.keys(properties).forEach(key => {
            const regex = new RegExp(`\\b${key}\\b`, 'gi');
            expression = expression.replace(regex, properties[key]);
        });
    }

    // Handle inline numeric+unit tokens (e.g., 10cm, 1m, 25mm)
    // We'll normalize length units to meters (base) for calculation.
    expression = expression.replace(/(\d+(?:\.\d+)?)\s*(mm|cm|m)\b/gi, (match, num, unit) => {
        const valueInMeters = convertToUnit(parseFloat(num), unit.toLowerCase(), 'm');
        return valueInMeters.toString();
    });

    // Handle weight units (normalize to kg)
    expression = expression.replace(/(\d+(?:\.\d+)?)\s*(g|kg)\b/gi, (match, num, unit) => {
        const valueInKg = convertToUnit(parseFloat(num), unit.toLowerCase(), 'kg');
        return valueInKg.toString();
    });

    // Handle volume units (normalize to L)
    expression = expression.replace(/(\d+(?:\.\d+)?)\s*(mL|L)\b/gi, (match, num, unit) => {
        const valueInL = convertToUnit(parseFloat(num), unit.toLowerCase(), 'L');
        return valueInL.toString();
    });

    // Handle area units (normalize to m²)
    expression = expression.replace(/(\d+(?:\.\d+)?)\s*(m²|cm²|mm²)\b/gi, (match, num, unit) => {
        const valueInM2 = convertToUnit(parseFloat(num), unit, 'm²');
        return valueInM2.toString();
    });

    // Handle cubic meters units (normalize to m³) if explicitly used
    expression = expression.replace(/(\d+(?:\.\d+)?)\s*(m³)\b/gi, (match, num, unit) => {
        const valueInM3 = convertToUnit(parseFloat(num), unit, 'm³');
        return valueInM3.toString();
    });

    try {
        if (/[^0-9+\-*/().\s]/.test(expression)) {
            return { value: null, error: 'Onbekende variabelen in formule' };
        }
        // Use Function constructor for safer evaluation
        const result = new Function(`return ${expression}`)();
        if (typeof result === 'number' && !isNaN(result)) {
            return { value: result, error: null };
        }
        return { value: null, error: 'Formule kon niet worden berekend' };
    } catch (e) {
        return { value: null, error: 'Formule kon niet worden berekend' };
    }
};

const unitConversionTable = {
    // Length (linear)
    m:    { m: 1, cm: 0.01, mm: 0.001 },
    cm:   { m: 100, cm: 1, mm: 0.1 },
    mm:   { m: 1000, cm: 10, mm: 1 },
    // Area (squared)
    'm²': { 'm²': 1, 'cm²': 0.0001, 'mm²': 0.000001 }, // cm² = (0.01 m)^2, mm² = (0.001 m)^2
    'cm²': { 'm²': 10000, 'cm²': 1, 'mm²': 0.01 },     // 1 cm² = 100 mm²
    'mm²': { 'm²': 1000000, 'cm²': 100, 'mm²': 1 },
    // Volume (cubic + metric liquid)
    'm³': { 'm³': 1, L: 0.001, mL: 0.000001 },         // 1 L = 0.001 m³, 1 mL = 1e-6 m³
    L:    { 'm³': 1000, L: 1, mL: 0.001 },             // 1 m³ = 1000 L
    mL:   { 'm³': 1000000, L: 1000, mL: 1 },
    // Mass
    kg:   { kg: 1, g: 0.001 },
    g:    { kg: 1000, g: 1 }
};

// Normalize units to match keys (handle superscripts and L/mL casing)
const sanitizeUnit = (u) => u
    ?.replace(/m\^2/i, 'm²')
    ?.replace(/m\^3/i, 'm³')
    ?.replace(/^l$/i, 'L')
    ?.replace(/^ml$/i, 'mL')
    ?.replace('²', '²')
    ?.replace('³', '³');

const convertToUnit = (value, fromUnit, toUnit) => {
    const f = sanitizeUnit(fromUnit);
    const t = sanitizeUnit(toUnit);
    if (!f || !t || !unitConversionTable[t] || !unitConversionTable[t][f]) return value;
    return value * unitConversionTable[t][f];
};

// ===== Optimistic Property Cache (shared globally) =====
// Structure: globalThis.__tempPropertiesCache = { map: Map<objectId, { props: [], expires: number }>, expiryMs }
const ensureOptimisticPropCache = () => {
    try {
        const g = globalThis;
        if (!g.__tempPropertiesCache) {
            g.__tempPropertiesCache = { map: new Map(), expiryMs: 60000 }; // 60s default retention
        } else {
            if (!g.__tempPropertiesCache.map) g.__tempPropertiesCache.map = new Map();
            if (!g.__tempPropertiesCache.expiryMs) g.__tempPropertiesCache.expiryMs = 60000;
        }
        return g.__tempPropertiesCache;
    } catch (_) {
        return { map: new Map(), expiryMs: 60000 };
    }
};

const addOptimisticProperties = (objectId, props) => {
    if (!objectId || !props || !props.length) return;
    const cache = ensureOptimisticPropCache();
    const now = Date.now();
    const existing = cache.map.get(objectId) || { props: [], expires: now + cache.expiryMs };
    const mergedMap = new Map();
    // Keep existing first
    existing.props.forEach(p => {
        const key = (p.id !== undefined && p.id !== null) ? p.id : `name:${(p.name||'').toLowerCase()}`;
        mergedMap.set(key, p);
    });
    // Add new optimistic ones
    props.forEach(p => {
        const key = (p.id !== undefined && p.id !== null) ? p.id : `name:${(p.name||'').toLowerCase()}`;
        mergedMap.set(key, { ...p, __optimistic: true, __createdAt: now });
    });
    cache.map.set(objectId, { props: Array.from(mergedMap.values()), expires: now + cache.expiryMs });
};

const getOptimisticProperties = (objectId) => {
    if (!objectId) return [];
    const cache = ensureOptimisticPropCache();
    const entry = cache.map.get(objectId);
    if (!entry) return [];
    if (Date.now() > entry.expires) {
        cache.map.delete(objectId);
        return [];
    }
    return entry.props || [];
};

const AddPropertyScreen = ({ ...props }) => {
    const [newPropertiesList, setNewPropertiesList] = useState([]);
    const [nextNewPropertyId, setNextNewPropertyId] = useState(0);
    const [selectedTemplateForPropertyAdd, setSelectedTemplateForPropertyAdd] = useState(null);
    const [showTemplatePickerModal, setShowTemplatePickerModal] = useState(false);
    const [showAddTemplateModal, setShowAddTemplateModal] = useState(false);
    const [outputUnit, setOutputUnit] = useState('m'); // default to meters
    const [editingProperty, setEditingProperty] = useState(null);
    const [editedValue, setEditedValue] = useState('');
    const [editedFormule, setEditedFormule] = useState('');
    const [existingPropertiesDraft, setExistingPropertiesDraft] = useState([]);
    const [editedUnit, setEditedUnit] = useState('');
    const [editedName, setEditedName] = useState('');
    const [showEditModal, setShowEditModal] = useState(false);
    const [modalPropertyIndex, setModalPropertyIndex] = useState(null);
    const [selectedFormule, setSelectedFormule] = useState(null);
    const [Formules, setFormules] = useState([]); // For ValueInputModal only
    // Track which waarde input was last focused so we can insert a picked Formule
    const [lastFocusedValuePropertyId, setLastFocusedValuePropertyId] = useState(null);
    // ValueInputModal state
    const [showValueInputModal, setShowValueInputModal] = useState(false);
    const [valueInputPropertyId, setValueInputPropertyId] = useState(null);
    // State to trigger rebuild when properties are deleted from other screens
    const [deletionNotifier, setDeletionNotifier] = useState(0);
    // Local state copy of properties for reactive updates
    const [displayPropertiesLocalAdd, setDisplayPropertiesLocalAdd] = useState(null);

    const webInputRef = useRef(null);

    const objectIdForProperties = props.currentPath[props.currentPath.length - 1];
    let item = props.findItemByPath(props.objectsHierarchy, props.currentPath);

    // Fallback: check activeTempObjects if not found in hierarchy
    if (!item && props.activeTempObjects && Array.isArray(props.activeTempObjects)) {
        const tempMatch = props.activeTempObjects.find(t => t.id === objectIdForProperties);
        if (tempMatch) {
            item = tempMatch;
        }
    }

    // Allow working on a temporary object before it exists in DB
    if (!item && typeof objectIdForProperties === 'string' && objectIdForProperties.startsWith('temp_')) {
        item = {
            id: objectIdForProperties,
            naam: props.fallbackTempItem?.naam || 'Nieuw object',
            properties: [],
            children: [],
        };
    }

    if (!item) return null;

    // Initialize global cache for this item so deletions can be tracked locally
    useEffect(() => {
        if (item?.id) {
            const g = globalThis;
            g.__currentObjectItems = g.__currentObjectItems || {};
            // Only initialize if not present to avoid overwriting deletions with stale props
            if (!g.__currentObjectItems[item.id]) {
                g.__currentObjectItems[item.id] = { ...item };
                console.log('[AddPropertyScreen] Initialized global cache for:', item.id);
            }
        }
    }, [item?.id]);

    // Merge optimistic properties from global cache to ensure they are visible even if DB sync lags.
    // We use existingPropertiesDraft as the primary source so edits are reflected immediately without refresh.
    const displayProperties = useMemo(() => {
        const baseProps = (existingPropertiesDraft && existingPropertiesDraft.length)
            ? existingPropertiesDraft
            : (displayPropertiesLocalAdd !== null ? displayPropertiesLocalAdd : (item.properties || []));
        const optimistic = getOptimisticProperties(objectIdForProperties);
        
        if (!optimistic || optimistic.length === 0) return baseProps;
        
        // Merge optimistic updates into base props
        const mergedBase = baseProps.map(p => {
            const opt = optimistic.find(op => op.id === p.id || (op.name === p.name && String(p.id).startsWith('temp_')));
            return opt ? { ...p, ...opt } : p;
        });

        const existingIds = new Set(mergedBase.map(p => p.id));
        // We only filter by name if the optimistic prop has NO ID (which shouldn't happen often)
        // If it has an ID, we trust the ID check.
        
        // Add purely new optimistic props
        const propsToAdd = optimistic.filter(op => {
             if (existingIds.has(op.id)) return false;
             // Allow duplicates to ensure new properties are shown
             return true;
        });
        
        const combined = [...mergedBase, ...propsToAdd];
        // Ensure everything is sorted by index
        return combined.sort((a, b) => (a.index || 0) - (b.index || 0));
    }, [item, objectIdForProperties, existingPropertiesDraft, displayPropertiesLocalAdd]);

    const allUnits = ['m', 'cm', 'mm', 'm²', 'cm²', 'mm²', 'm³', 'kg', 'g', 'L', 'mL'];

    // Consistent rounding with modal
    const DECIMAL_PLACES = 6;
    const roundToDecimals = (value, decimals = DECIMAL_PLACES) => {
        if (typeof value !== 'number' || !isFinite(value)) return value;
        const factor = Math.pow(10, decimals);
        return Math.round(value * factor) / factor;
    };

    // Fetch Formules for ValueInputModal
    useEffect(() => {
        (async () => {
            try {
                const FormulesData = await fetchFormulesApi();
                setFormules(Array.isArray(FormulesData) ? FormulesData : []);
            } catch (error) {
                console.error('Error fetching Formules for ValueInputModal:', error);
                setFormules([]);
            }
        })();
    }, []);

    // Listen to deletion events from EditPropertyModal
    useEffect(() => {
        const handleDeletion = () => {
            console.log('[AddPropertyScreen] Deletion detected, triggering rebuild');
            setDeletionNotifier(n => n + 1); // Trigger a rebuild
        };
        
        try {
            const g = globalThis;
            g.__propertyDeletionListeners = g.__propertyDeletionListeners || [];
            g.__propertyDeletionListeners.push(handleDeletion);
            
            return () => {
                // Cleanup listener
                g.__propertyDeletionListeners = g.__propertyDeletionListeners.filter(l => l !== handleDeletion);
            };
        } catch (_) {}
    }, []);

    // Initialize or refresh the draft when the underlying item changes (e.g. navigating to another object).
    // We intentionally do NOT depend on displayProperties here to avoid overriding local edits.
    useEffect(() => {
        if (!item) {
            setExistingPropertiesDraft([]);
            setDisplayPropertiesLocalAdd([]);
            return;
        }
        
        let propsToUse = Array.isArray(item.properties) ? item.properties : [];

        // Sync from global cache when a deletion occurs
        try {
            const g = globalThis;
            if (g.__currentObjectItems && g.__currentObjectItems[item.id]) {
                const cachedItem = g.__currentObjectItems[item.id];
                if (Array.isArray(cachedItem.properties)) {
                    propsToUse = cachedItem.properties;
                    console.log('[AddPropertyScreen] Using cached properties for object:', item.id, 'count:', propsToUse.length);
                }
            }
        } catch (_) {}
        
        // Apply optimistic updates immediately to the draft to prevent reversion
        const optimistic = getOptimisticProperties(item.id);
        
        const draft = propsToUse.map(p => {
            // Check for optimistic override
            const opt = optimistic.find(op => op.id === p.id || (op.name === p.name && String(p.id).startsWith('temp_')));
            const source = opt ? { ...p, ...opt } : p;
            
            return {
                id: source.id,
                name: source.name,
                waarde: source.waarde,
                Formule_id: source.Formule_id || source.formule_id || null,
                Formule_name: source.Formule_name || (source.formules?.name) || '',
                Formule_expression: source.Formule_expression || source.formule || source.formules?.formule || '',
                eenheid: source.eenheid || '',
                index: source.index !== undefined ? source.index : 9999
            };
        });
        
        // Also append new optimistic properties that are not in propsToUse
        const existingIds = new Set(draft.map(p => p.id));
        
        optimistic.forEach(op => {
            // If ID exists, skip
            if (existingIds.has(op.id)) return;
            
            // We allow duplicates now to prevent hiding valid new properties
            // The risk of temporary duplicates is better than hiding data

            draft.push({
                id: op.id,
                name: op.name,
                waarde: op.waarde,
                Formule_id: op.Formule_id || null,
                Formule_name: '',
                Formule_expression: op.Formule_expression || '',
                eenheid: op.eenheid || '',
                index: op.index !== undefined ? op.index : 9999
            });
        });

        // Sort by index to maintain order
        draft.sort((a, b) => (a.index || 0) - (b.index || 0));

        setExistingPropertiesDraft(draft);
        setDisplayPropertiesLocalAdd(propsToUse);
    }, [item, deletionNotifier]);

    const addNewPropertyField = () => {
        setNewPropertiesList(prevList => {
            const newField = {
                id: nextNewPropertyId,
                name: '',
                value: '',
                unit: '', 
                Formule_id: null,
                files: []
            };
            setNextNewPropertyId(prevId => prevId + 1);
            return [...prevList, newField];
        });
    };

    const handleOpenValueInput = async (propertyId) => {
        setValueInputPropertyId(propertyId);
        // Refresh formulas right before opening to avoid stale/empty lists
        try {
            const fresh = await fetchFormulesApi();
            setFormules(Array.isArray(fresh) ? fresh : []);
        } catch (e) {
            console.warn('Failed to refresh formules before opening modal:', e);
        }
        setShowValueInputModal(true);
    };

    const handleValueInputSet = (value, formule) => {
        if (valueInputPropertyId !== null) {
            if (formule && !formule.isManual) {
                // Always store the chosen formula expression and metadata first
                handlePropertyFieldChange(valueInputPropertyId, 'Formule_expression', value);
                handlePropertyFieldChange(valueInputPropertyId, 'Formule_id', formule.id);
                handlePropertyFieldChange(valueInputPropertyId, 'unit', ''); // Predefined formulas don't have units by default

                // Try to evaluate the formula; if it fails, keep the expression visible
                const evaluation = evaluateFormule(value, newPropertiesList);
                if (!evaluation?.error && typeof evaluation.value === 'number') {
                    handlePropertyFieldChange(
                        valueInputPropertyId,
                        'value',
                        roundToDecimals(evaluation.value, 6).toString()
                    );
                } else {
                    // Inform the user but do NOT clear the expression
                    Alert.alert('Formule Fout', evaluation?.error || 'Formule kon niet worden berekend');
                }
            } else if (formule && formule.isManual) {
                // Manual input with separate value and unit
                const selectedUnit = formule.unit || '';
                
                // Check if the input looks like a formula
                const hasFormulaPattern = /[+\-*/()]/.test(value) && !/^\d+\.?\d*$/.test(value.trim());
                
                if (hasFormulaPattern) {
                    // Try to evaluate the formula
                    const evaluation = evaluateFormule(value, newPropertiesList);
                    
                    if (evaluation.error) {
                        // Show error message to user
                        Alert.alert('Formule Fout', evaluation.error);
                        return;
                    } else {
                        // Convert the result to the selected unit if needed
                        let finalValue = evaluation.value;
                        if (selectedUnit && ['cm', 'mm', 'g', 'mL'].includes(selectedUnit)) {
                            // Convert from base unit (m, kg, L) to selected unit
                            const baseUnit = selectedUnit === 'cm' || selectedUnit === 'mm' ? 'm' : 
                                            selectedUnit === 'g' ? 'kg' : 'L';
                            finalValue = convertToUnit(evaluation.value, baseUnit, selectedUnit);
                        }
                        
                        // Store the calculated result and the formula expression
                        handlePropertyFieldChange(valueInputPropertyId, 'value', roundToDecimals(finalValue, 6).toString());
                        handlePropertyFieldChange(valueInputPropertyId, 'Formule_expression', value);
                        handlePropertyFieldChange(valueInputPropertyId, 'unit', selectedUnit);
                    }
                } else {
                    // Regular value with unit
                    handlePropertyFieldChange(valueInputPropertyId, 'value', value);
                    handlePropertyFieldChange(valueInputPropertyId, 'unit', selectedUnit);
                    handlePropertyFieldChange(valueInputPropertyId, 'Formule_expression', '');
                }
            } else {
                // Legacy: Parse combined value+unit only when the left part is numeric and unit recognized; otherwise store as value text
                const unitRegex = /(.*?)([a-zA-Z²³]+)$/;
                const match = value.match(unitRegex);
                if (match) {
                    const numericValue = (match[1] || '').trim();
                    const unitRaw = (match[2] || '').trim();
                    const num = parseFloat(numericValue.replace(',', '.'));
                    const unitOk = allUnits.includes(sanitizeUnit(unitRaw));
                    if (isFinite(num) && unitOk) {
                        handlePropertyFieldChange(valueInputPropertyId, 'value', numericValue);
                        handlePropertyFieldChange(valueInputPropertyId, 'unit', sanitizeUnit(unitRaw));
                    } else {
                        handlePropertyFieldChange(valueInputPropertyId, 'value', value);
                        handlePropertyFieldChange(valueInputPropertyId, 'unit', '');
                    }
                } else {
                    // No trailing letters (or not matching), store as plain value
                    handlePropertyFieldChange(valueInputPropertyId, 'value', value);
                    handlePropertyFieldChange(valueInputPropertyId, 'unit', '');
                }
                handlePropertyFieldChange(valueInputPropertyId, 'Formule_expression', '');
            }
        }
        setShowValueInputModal(false);
        setValueInputPropertyId(null);
    };

    const handleAddFormuleFromValueInput = () => {
        setShowValueInputModal(false);
        // Note: Formula creation is now handled from HierarchicalObjectsScreen
        console.log('Formula creation should be done from main objects screen');
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
        setNewPropertiesList(prevList =>
            prevList.map(prop =>
                prop.id === idToUpdate
                    ? { ...prop, [field]: value }
                    : prop
            )
        );
    };

    // Convert value when unit chip changes (for non-formula values). For formulas, only set display unit.
    const handleUnitChange = (idToUpdate, newUnitRaw) => {
        const newUnit = newUnitRaw || '';
        setNewPropertiesList(prevList => prevList.map(p => {
            if (p.id !== idToUpdate) return p;
            const hasFormula = !!(p.Formule_expression && /[+\-*/()]/.test(p.Formule_expression) && !/^\d+\.?\d*[a-zA-Z]*$/.test(p.Formule_expression.trim()));
            // For formulas, keep numeric value as-is (base) and just update unit for display
            if (hasFormula) {
                return { ...p, unit: newUnit };
            }
            const oldUnit = p.unit || '';
            // If value isn't numeric or either unit missing, just set the unit without conversion
            const num = parseFloat(String(p.value).replace(',', '.'));
            if (!isFinite(num) || !oldUnit || !newUnit) {
                return { ...p, unit: newUnit };
            }
            // If conversion path missing, just set unit
            if (!unitConversionTable[newUnit] || !unitConversionTable[newUnit][oldUnit]) {
                return { ...p, unit: newUnit };
            }
            const converted = convertToUnit(num, oldUnit, newUnit);
            return { ...p, value: String(roundToDecimals(converted, 6)), unit: newUnit };
        }));
    };

    const handleSaveOnBack = async () => {
        // Calculate starting index based on existing properties
        const existingCount = (existingPropertiesDraft && existingPropertiesDraft.length) 
            ? existingPropertiesDraft.length 
            : (item.properties ? item.properties.length : 0);

        // Build properties to save (same logic as before)
        const propertiesToSave = newPropertiesList
            .filter(prop => prop.name.trim() !== '')
            .map((prop, i) => {
                const isFormule = prop.Formule_expression && prop.Formule_expression.trim() !== '';
                let finalValue = prop.value;
                let rawFormule = '';

                if (isFormule) {
                    rawFormule = prop.Formule_expression;
                    finalValue = prop.value;
                } else {
                    finalValue = prop.value;
                }

                return {
                    ...prop,
                    waarde: String(roundToDecimals(finalValue || 0)),
                    index: existingCount + i // Add index here
                };
            });

        if (propertiesToSave.length === 0) {
            props.setCurrentScreen('properties');
            return;
        }

        // -- Optimistic UI update: inject temporary props immediately --
        const tempNow = Date.now();
        const tempProps = propertiesToSave.map((p, idx) => ({
            ...p,
            id: `temp_prop_${tempNow}_${idx}`,
        }));

        // Persist in global optimistic cache BEFORE any navigation to avoid initial 0-count flash
        try { addOptimisticProperties(objectIdForProperties, tempProps); } catch (e) { console.warn('[AddPropertyScreen] failed to cache optimistic props', e); }

        // Add to the live item.properties for immediate visibility
        if (item) {
            item.properties = Array.isArray(item.properties) ? [...item.properties, ...tempProps] : [...tempProps];
        }

        // Mirror into existingPropertiesDraft so PropertiesScreen shows them
        setExistingPropertiesDraft(prev => [
            ...prev,
            ...tempProps.map(tp => ({
                id: tp.id,
                name: tp.name,
                waarde: tp.waarde,
                Formule_id: tp.Formule_id || null,
                Formule_name: tp.Formule_name || '',
                Formule_expression: tp.Formule_expression || '',
                eenheid: tp.eenheid || ''
            }))
        ]);

        // Clear new form fields and navigate back instantly
        setNewPropertiesList([]);
        props.setCurrentScreen('properties');

        // Save with retries and fallback
        const MAX_ATTEMPTS = 3;
        const saveLabel = 'save-properties';

        const fallbackFetchSave = async () => {
            try {
                const resp = await fetch('/api/properties/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
                    body: JSON.stringify({ objectId: objectIdForProperties, properties: propertiesToSave })
                });
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const json = await resp.json();
                return json;
            } catch (err) {
                throw err;
            }
        };

        const doSaveOnce = async () => {
            // prefer provided onSave, else fallback to direct fetch
            if (typeof props.onSave === 'function') {
                return props.onSave(objectIdForProperties, propertiesToSave);
            }
            return fallbackFetchSave();
        };

        const delay = (ms) => new Promise(res => setTimeout(res, ms));

        let lastError = null;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                // longer timeout wrapper
                const withTimeout = (promiseLike, ms = 20000, label = saveLabel) => new Promise((resolve, reject) => {
                    const timeoutId = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
                    Promise.resolve(promiseLike).then(
                        (val) => { clearTimeout(timeoutId); resolve(val); },
                        (err) => { clearTimeout(timeoutId); reject(err); }
                    );
                });

                const res = await withTimeout(doSaveOnce(), 20000, saveLabel);

                // If backend returned ids for the saved properties, replace temp ids with real ids
                if (res && Array.isArray(res.ids) && res.ids.length) {
                    const ids = res.ids;
                    if (item && Array.isArray(item.properties)) {
                        item.properties = item.properties.map((ip) => {
                            const matchIdx = tempProps.findIndex(tp => tp.id === ip.id);
                            if (matchIdx !== -1 && ids[matchIdx]) {
                                return { ...ip, id: ids[matchIdx] };
                            }
                            return ip;
                        });
                    }
                    setExistingPropertiesDraft(prev => prev.map(p => {
                        const matchIdx = tempProps.findIndex(tp => tp.id === p.id);
                        if (matchIdx !== -1 && ids[matchIdx]) {
                            return { ...p, id: ids[matchIdx] };
                        }
                        return p;
                    }));
                } else if (res === false || (res && res.success === false)) {
                    throw new Error(res?.message || 'Opslaan mislukt');
                } else {
                    // Generic success without ids: trigger refresh so DB state shown
                    if (typeof props.onRefresh === 'function') {
                        try { await props.onRefresh(); } catch (_) { /* ignore refresh errors */ }
                    }
                }

                // successful save: if provided, trigger a refresh to be safe
                if (typeof props.onRefresh === 'function') {
                    try { await props.onRefresh(); } catch (_) { /* ignore */ }
                }
                return; // done
            } catch (err) {
                lastError = err;
                console.warn(`[handleSaveOnBack] save attempt ${attempt} failed:`, err);
                if (attempt < MAX_ATTEMPTS) {
                    // wait with exponential backoff
                    await delay(500 * Math.pow(2, attempt - 1));
                    continue;
                }
            }
        }

        // All attempts failed -> ask user what to do
        Alert.alert(
            'Opslaan mislukt',
            'Kon de eigenschappen niet naar de server sturen. Wat wil je doen?',
            [
                {
                    text: 'Probeer opnieuw',
                    onPress: async () => {
                        // leave temp items in UI and try again
                        try {
                            const res = await doSaveOnce();
                            if (res && Array.isArray(res.ids) && res.ids.length) {
                                const ids = res.ids;
                                if (item && Array.isArray(item.properties)) {
                                    item.properties = item.properties.map((ip) => {
                                        const matchIdx = tempProps.findIndex(tp => tp.id === ip.id);
                                        if (matchIdx !== -1 && ids[matchIdx]) {
                                            return { ...ip, id: ids[matchIdx] };
                                        }
                                        return ip;
                                    });
                                }
                                setExistingPropertiesDraft(prev => prev.map(p => {
                                    const matchIdx = tempProps.findIndex(tp => tp.id === p.id);
                                    if (matchIdx !== -1 && ids[matchIdx]) {
                                        return { ...p, id: ids[matchIdx] };
                                    }
                                    return p;
                                }));
                            }
                            if (typeof props.onRefresh === 'function') {
                                try { await props.onRefresh(); } catch (_) {}
                            }
                        } catch (e) {
                            Alert.alert('Nog steeds mislukt', 'Probeer later opnieuw of controleer je netwerk.');
                        }
                    }
                },
                {
                    text: 'Verwijder tijdelijk',
                    style: 'destructive',
                    onPress: () => {
                        // rollback optimistic items
                        if (item && Array.isArray(item.properties)) {
                            item.properties = item.properties.filter(ip => !String(ip.id).startsWith('temp_prop_'));
                        }
                        setExistingPropertiesDraft(prev => prev.filter(p => !String(p.id).startsWith('temp_prop_')));
                    }
                },
                { text: 'Laat staan', style: 'cancel' } // keep in UI for later retry
            ],
            { cancelable: true }
        );

        console.error('Final save error:', lastError);
    };

    useEffect(() => {
        if (newPropertiesList.length === 0 && selectedTemplateForPropertyAdd === null) {
            addNewPropertyField();
        }
    }, [newPropertiesList, selectedTemplateForPropertyAdd]);

    const handleClearTemplate = () => {
        setSelectedTemplateForPropertyAdd(null);
        setNewPropertiesList([]);
        setNextNewPropertyId(0); // Reset the ID counter
        setTimeout(() => {
            setNewPropertiesList([{
                id: 0,
                name: '',
                value: '',
                files: []
            }]);
            setNextNewPropertyId(1);
        }, 0);
    };

    // Helper to build a map from existing properties (for edit preview)
    const buildExistingPropertiesMap = (outputUnit) => {
        const source = (existingPropertiesDraft && existingPropertiesDraft.length)
            ? existingPropertiesDraft
            : (displayPropertiesLocalAdd !== null ? displayPropertiesLocalAdd : (item.properties || []));

        const propsList = (source || []).map(p => ({
            name: p.name,
            value: p.formule && /[+\-*/]/.test(p.formule)
                ? (() => {
                    // Evaluate nested Formules within the draft first
                    const innerMap = buildPropertiesMap(source.map(x => ({ name: x.name, value: x.waarde, unit: x.eenheid || '' })), p.eenheid || outputUnit);
                    const { value: innerVal, error: innerErr } = evaluateFormule(p.formule, innerMap);
                    return innerErr ? 'Error' : String(innerVal);
                })()
                : p.waarde,
            unit: p.eenheid || ''
        }));
        return buildPropertiesMap(propsList, outputUnit);
    };

    // Draft-parameterized variant for recomputation after modal save
    const buildExistingPropertiesMapFromDraft = (draft, outputUnit) => {
        const propsList = (draft || []).map(p => ({
            name: p.name,
            value: p.formule && /[+\-*/]/.test(p.formule)
                ? (() => {
                    const innerMap = buildPropertiesMap(draft.map(x => ({ name: x.name, value: x.waarde, unit: x.eenheid || '' })), p.eenheid || outputUnit);
                    const { value: innerVal, error: innerErr } = evaluateFormule(p.formule, innerMap);
                    return innerErr ? 'Error' : String(innerVal);
                })()
                : p.waarde,
            unit: p.eenheid || ''
        }));
        return buildPropertiesMap(propsList, outputUnit);
    };

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
                templates={props.fetchedTemplates}
                onSelect={(templateId) => {
                    if (templateId && props.fetchedTemplates[templateId]) {
                        const templateProps = props.fetchedTemplates[templateId].properties.map((prop, index) => ({
                            id: index,
                            name: prop.property_name || prop.name,
                            value: prop.property_value || prop.value || '',
                            unit: prop.unit || '', 
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
                onTemplateSaved={props.onTemplateAdded}
            />}

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <View style={AppStyles.header}>
                    <View style={AppStyles.headerFlex}>
                        <TouchableOpacity onPress={() => props.setCurrentScreen('properties')} style={AppStyles.headerBackButton}>
                            <ChevronLeft color={colors.lightGray700} size={24} />
                        </TouchableOpacity>
                        <Text style={AppStyles.headerTitleLg}>Eigenschap Toevoegen</Text>
                    </View>
                </View>
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={[AppStyles.contentPadding, { paddingBottom: 70 }]} 
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={[AppStyles.card, { marginTop: 0, marginBottom: 24, padding: 16 }]}>
                        <Text style={[AppStyles.infoItemValue, { marginBottom: 16, fontSize: 16, fontWeight: '600' }]}>
                            Bestaande Eigenschappen
                        </Text>
                        <View style={AppStyles.propertyList}>
                            {displayProperties.length > 0 ? (
                                displayProperties.map((prop, index) => (
                                    <View key={index} style={[AppStyles.propertyItem, { marginBottom: 12 }]}>
                                        <View style={{ width: '100%' }}>
                                            <View
                                                style={{
                                                    flexDirection: 'row',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                }}
                                            >
                                                {/* Left Side */}
                                                <View
                                                    style={[
                                                        AppStyles.propertyItemMain,
                                                        { flexDirection: 'row', alignItems: 'center' },
                                                    ]}
                                                >
                                                    <Tag color={colors.lightGray500} size={20} />
                                                    <Text style={[AppStyles.propertyName, { marginLeft: 8 }]}>{prop.name}</Text>
                                                </View>

                                                {/* Right Side */}
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <View style={{ alignItems: 'flex-end' }}>
                                                        {(() => {
                                                            const formulaExpr = (prop.Formule_expression && String(prop.Formule_expression))
                                                                || (prop.formule && String(prop.formule))
                                                                || (prop.formules && prop.formules.formule && String(prop.formules.formule))
                                                                || '';
                                                            const isFormula = formulaExpr.trim() !== '' && /[+\-*/()x×]/.test(formulaExpr) && !/^\d+\.?\d*[a-zA-Z]*$/.test(formulaExpr.trim());
                                                            return isFormula;
                                                        })() && (
                                                            <>
                                                                <Text
                                                                    style={{
                                                                        color: colors.lightGray500,
                                                                        fontSize: 13,
                                                                        fontStyle: 'italic',
                                                                    }}
                                                                >
                                                                    {(() => {
                                                                        const formulaExpr = (prop.Formule_expression && String(prop.Formule_expression))
                                                                            || (prop.formule && String(prop.formule))
                                                                            || (prop.formules && prop.formules.formule && String(prop.formules.formule))
                                                                            || '';
                                                                        return formulaExpr;
                                                                    })()}
                                                                </Text>
                                                                {(() => {
                                                                    // Create combined properties list for formula evaluation
                                                                    const allProperties = [
                                                                        ...displayProperties.map((p) => ({
                                                                            name: p.name,
                                                                            value: p.waarde,
                                                                            unit: p.eenheid || '',
                                                                        })),
                                                                        ...newPropertiesList.map((p) => ({
                                                                            name: p.name,
                                                                            value: p.value,
                                                                            unit: p.unit || '',
                                                                        })),
                                                                    ];
                                                                    const formulaExpr = (prop.Formule_expression && String(prop.Formule_expression))
                                                                        || (prop.formule && String(prop.formule))
                                                                        || (prop.formules && prop.formules.formule && String(prop.formules.formule))
                                                                        || '';
                                                                    const normalizedExpr = formulaExpr.replace(/[x×]/g, '*');
                                                                    const evaluation = evaluateFormule(normalizedExpr, allProperties);
                                                                    if (evaluation.error) {
                                                                        return (
                                                                            <Text style={{
                                                                                color: colors.red500,
                                                                                fontSize: 12,
                                                                                fontStyle: 'italic',
                                                                            }}>
                                                                                {evaluation.error}
                                                                            </Text>
                                                                        );
                                                                    } else {
                                                                        // Align display logic with new property preview: convert only when appropriate
                                                                        const hasMulDiv = /[*/]/.test(normalizedExpr);
                                                                        let v = evaluation.value;
                                                                        const u = prop.eenheid || '';
                                                                        const isLength = ['m','cm','mm'].includes(u);
                                                                        const isMass = ['kg','g'].includes(u);
                                                                        const isVolume = ['m³','L','mL'].includes(u);
                                                                        const isArea = ['m²','cm²','mm²'].includes(u);
                                                                        let displayUnit = '';

                                                                        if (!hasMulDiv) {
                                                                            // Linear/additive: allow linear conversions and show unit
                                                                            if (u && ['cm','mm','g','mL'].includes(u)) {
                                                                                const base = (u === 'cm' || u === 'mm') ? 'm' : (u === 'g' ? 'kg' : 'L');
                                                                                v = convertToUnit(v, base, u);
                                                                            }
                                                                            displayUnit = u;
                                                                        } else {
                                                                            // Multiplicative/divisive: allow area/volume if explicitly chosen
                                                                            if (isArea) {
                                                                                v = convertToUnit(v, 'm²', u);
                                                                                displayUnit = u;
                                                                            } else if (isVolume && u !== 'L') {
                                                                                v = convertToUnit(v, 'm³', u);
                                                                                displayUnit = u;
                                                                            } else {
                                                                                displayUnit = '';
                                                                            }
                                                                        }

                                                                        const displayVal = roundToDecimals(v, 6);
                                                                        return (
                                                                            <Text style={[AppStyles.propertyValue, { marginTop: 2 }]}>
                                                                                {displayVal}
                                                                                {displayUnit ? ` ${displayUnit}` : ''}
                                                                            </Text>
                                                                        );
                                                                    }
                                                                })()}
                                                            </>
                                                        )}
                                                        {(() => {
                                                            const formulaExpr = (prop.Formule_expression && String(prop.Formule_expression))
                                                                || (prop.formule && String(prop.formule))
                                                                || (prop.formules && prop.formules.formule && String(prop.formules.formule))
                                                                || '';
                                                            const isFormula = formulaExpr.trim() !== '' && /[+\-*/()x×]/.test(formulaExpr) && !/^\d+\.?\d*[a-zA-Z]*$/.test(formulaExpr.trim());
                                                            return !isFormula;
                                                        })() && (
                                                            <Text style={[AppStyles.propertyValue, { marginTop: 4 }]}>
                                                                {prop.waarde}
                                                                {prop.eenheid ? ` ${prop.eenheid}` : ''}
                                                            </Text>
                                                        )}
                                                    </View>

                                                    {/* Divider */}
                                                    <View
                                                        style={{
                                                            width: 1,
                                                            backgroundColor: colors.lightGray500,
                                                            marginHorizontal: 10,
                                                            alignSelf: 'stretch', 
                                                        }}
                                                    />

                                                    {/* Bewerken */}
                                                    <TouchableOpacity
                                                        onPress={() => {
                                                            setModalPropertyIndex(index);
                                                            setShowEditModal(true);
                                                        }}
                                                    >
                                                        <Text style={{ color: colors.primary, fontWeight: '600' }}>Bewerken</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                ))
                            ) : (
                                <View style={AppStyles.emptyState}>
                                    <Text style={AppStyles.emptyStateText}>Geen bestaande eigenschappen.</Text>
                                </View>
                            )}
                        </View>
                    </View>
                    {showEditModal && modalPropertyIndex !== null && (
                        <EditPropertyModal
                            visible={showEditModal}
                            onClose={() => setShowEditModal(false)}
                            objectId={item.id}
                            property={displayProperties[modalPropertyIndex]}
                            existingPropertiesDraft={(existingPropertiesDraft && existingPropertiesDraft.length) 
                                ? existingPropertiesDraft 
                                : (displayPropertiesLocalAdd !== null ? displayPropertiesLocalAdd : (item.properties || []))}
                            onSaved={async (updated) => {
                                const idx = modalPropertyIndex;
                                // Fix: Ensure we edit the list that is actually displayed (fallback to item.properties if draft is empty)
                                const currentBase = (existingPropertiesDraft && existingPropertiesDraft.length)
                                    ? existingPropertiesDraft
                                    : (displayPropertiesLocalAdd !== null ? displayPropertiesLocalAdd : (item.properties || []));
                                const originalDraft = [...currentBase]; // Capture state before changes

                                if (updated && updated.__deleted) {
                                    // Immediate UI removal of the deleted property
                                    const deletedId = updated.id;
                                    // Remove from existing draft list - this triggers the displayProperties useMemo
                                    const newDraft = originalDraft.filter(p => p.id !== deletedId);
                                    console.log('[AddPropertyScreen] Deleted property, new draft length:', newDraft.length);
                                    setExistingPropertiesDraft(newDraft);
                                    // Close modal and clear selection
                                    setShowEditModal(false);
                                    setModalPropertyIndex(null);
                                    // Feedback message
                                    Alert.alert('Verwijderd', 'Eigenschap is succesvol verwijderd.');
                                    return;
                                }

                                // 1. Create a new baseline draft with the single edited property updated (preserve expressions)
                                const baselineDraft = originalDraft.map((p, i) => {
                                    if (i !== idx) return p;
                                    return {
                                        ...p,
                                        ...updated,
                                        Formule_expression: updated.Formule_expression || updated.formule || p.Formule_expression || p.formule || p.formules?.formule || ''
                                    };
                                });

                                // 2. Re-compute all properties that have a Formule
                                const recomputedDraft = baselineDraft.map(p => {
                                    if (p.Formule_expression && /[+\-*/]/.test(p.Formule_expression)) {
                                        const outputUnit = p.eenheid || 'm';
                                        const map = buildExistingPropertiesMapFromDraft(baselineDraft, outputUnit);
                                        const { value, error } = evaluateFormule(p.Formule_expression, map);

                                        if (error || value === null) {
                                            return { ...p, waarde: 'Error' };
                                        }
                                        
                                        const finalValue = convertToUnit(value, 'm', outputUnit);
                                        const rounded = roundToDecimals(finalValue);
                                        return { ...p, waarde: String(rounded) };
                                    }
                                    return p;
                                });

                                // 4. Merge recomputed values back into full property objects preserving original relation data (formules, files)
                                if (Array.isArray(item.properties)) {
                                    const fullMerged = item.properties.map(orig => {
                                        // Match by ID if possible, otherwise by name (for temp props)
                                        const match = recomputedDraft.find(r => {
                                            if (r.id && orig.id && r.id === orig.id) return true;
                                            if ((!r.id || String(r.id).startsWith('temp_')) && (!orig.id || String(orig.id).startsWith('temp_'))) {
                                                return r.name === orig.name;
                                            }
                                            return false;
                                        });
                                        
                                        if (!match) return orig;
                                        return {
                                            ...orig,
                                            ...match, // Apply all updates from the draft
                                            waarde: match.waarde,
                                            eenheid: match.eenheid,
                                            Formule_id: match.Formule_id,
                                            Formule_expression: match.Formule_expression || orig.Formule_expression || orig.formule || orig.formules?.formule || ''
                                        };
                                    });
                                    item.properties = fullMerged;
                                }
                                setExistingPropertiesDraft(recomputedDraft);

                                // 4b. Optimistic overlay in Properties screen: cache the edited property
                                try {
                                    // Find the edited property in the recomputed draft
                                    // We use the index 'idx' but we should be careful if the draft order changed (it shouldn't have)
                                    const editedProp = recomputedDraft[idx];
                                    
                                    if (editedProp && editedProp.name) {
                                        // Build a minimal optimistic payload mirroring PropertiesScreen expectations
                                        const optimistic = [{
                                            id: editedProp.id || `temp_edit_${Date.now()}`,
                                            name: editedProp.name,
                                            waarde: editedProp.waarde,
                                            eenheid: editedProp.eenheid || '',
                                            Formule_expression: editedProp.Formule_expression || (editedProp.formule || ''),
                                            Formule_id: editedProp.Formule_id || null,
                                        }];
                                        addOptimisticProperties(objectIdForProperties, optimistic);
                                        
                                        // Also update the global cache immediately so other screens see it
                                        const g = globalThis;
                                        if (g.__currentObjectItems && g.__currentObjectItems[item.id]) {
                                            const cachedItem = g.__currentObjectItems[item.id];
                                            if (Array.isArray(cachedItem.properties)) {
                                                // Update the property in the global cache
                                                cachedItem.properties = cachedItem.properties.map(p => {
                                                    if (p.id === editedProp.id || (p.name === editedProp.name && String(p.id).startsWith('temp_'))) {
                                                        return { ...p, ...editedProp };
                                                    }
                                                    return p;
                                                });
                                                console.log('[AddPropertyScreen] Updated global cache for property:', editedProp.name);
                                            }
                                        }

                                        // Trigger global listeners to notify other screens (like PropertiesScreen)
                                        if (Array.isArray(g.__propertyChangeListeners)) {
                                            g.__propertyChangeListeners.forEach(l => {
                                                try { l(); } catch (e) { console.warn(e); }
                                            });
                                        }

                                        // Also update local state in index.js if callback provided
                                        if (typeof props.onLocalUpdate === 'function') {
                                            props.onLocalUpdate(item.id, editedProp);
                                        }
                                    }
                                } catch (e) { console.warn('[AddPropertyScreen] Optimistic update error:', e); }

                                // 5. Close the modal
                                setShowEditModal(false);
                                setModalPropertyIndex(null);
                            }}
                        />
                    )}
                    <View style={[AppStyles.card, { marginBottom: 24, padding: 16 }]}>
                        <Text style={[AppStyles.infoItemValue, { marginBottom: 16, fontSize: 16, fontWeight: '600' }]}>
                            Nieuwe Eigenschappen
                        </Text>

                        <View style={AppStyles.formGroup}>
                            <Text style={AppStyles.formLabel}>Kies een sjabloon (optioneel)</Text>
                            <TouchableOpacity onPress={() => setShowTemplatePickerModal(true)} style={[AppStyles.formInput, { justifyContent: 'center' }]}>
                                <Text style={{ color: selectedTemplateForPropertyAdd ? colors.lightGray800 : colors.lightGray400 }}>
                                    {selectedTemplateForPropertyAdd ? props.fetchedTemplates[selectedTemplateForPropertyAdd]?.name : 'Kies een sjabloon...'}
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
                            <View
                                key={prop.id}
                                style={{
                                    marginBottom: 16,
                                    borderTopWidth: index > 0 ? 1 : 0,
                                    borderColor: colors.lightGray100,
                                    paddingTop: index > 0 ? 40 : 0,
                                    position: 'relative',
                                }}
                            >
                                {(newPropertiesList.length > 1) && (
                                    <TouchableOpacity
                                        onPress={() => removePropertyField(prop.id)}
                                        style={{
                                            position: 'absolute',
                                            top: index === 0 ? -10 :30,
                                            right: -2, // Move left a bit for better alignment
                                            zIndex: 10,
                                            padding: 8,
                                        }}
                                    >
                                        <X color={colors.red600} size={20} />
                                    </TouchableOpacity>
                                )}
                                <View>
                                {Platform.OS === 'web' ? (
                                    <View style={{ flexDirection: 'row', gap: 12 }}>
                                        <View style={[AppStyles.formGroup, { flex: 1 }]}> 
                                            <Text style={AppStyles.formLabel}>Eigenschap Naam</Text>
                                            <TextInput
                                                placeholder="Bijv. Gewicht"
                                                value={prop.name}
                                                onChangeText={(text) => handlePropertyFieldChange(prop.id, 'name', text)}
                                                style={AppStyles.formInput}
                                            />
                                            {/* Eenheid selectie */}
                                            <View style={{ marginTop: 10 }}>
                                                <Text style={[AppStyles.formLabel, { marginBottom: 8 }]}>Eenheid</Text>
                                                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                                                    {[ 'Geen', ...allUnits ].map((unit) => {
                                                        const isSelected = (unit === 'Geen' && !prop.unit) || prop.unit === unit;
                                                        return (
                                                            <TouchableOpacity
                                                                key={unit}
                                                                onPress={() => handleUnitChange(prop.id, unit === 'Geen' ? '' : unit)}
                                                                style={{
                                                                    paddingVertical: 8,
                                                                    paddingHorizontal: 12,
                                                                    borderRadius: 20,
                                                                    borderWidth: 1,
                                                                    borderColor: isSelected ? colors.blue600 : colors.lightGray300,
                                                                    backgroundColor: isSelected ? colors.blue50 : colors.white,
                                                                    marginRight: 8,
                                                                    marginBottom: 8,
                                                                }}
                                                            >
                                                                <Text style={{
                                                                    color: isSelected ? colors.blue700 : colors.lightGray700,
                                                                    fontWeight: isSelected ? '700' : '500'
                                                                }}>
                                                                    {unit}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        );
                                                    })}
                                                </View>
                                            </View>
                                        </View>
                                        <View style={[AppStyles.formGroup, { flex: 1 }]}>
                                            <Text style={AppStyles.formLabel}>Waarde</Text>
                                            {(() => {
                                                const isFormula = !!(prop.Formule_expression && /[+\-*/()]/.test(prop.Formule_expression) && !/^\d+\.?\d*[a-zA-Z]*$/.test(prop.Formule_expression.trim()));
                                                let evalResult = null;
                                                let evalError = null;
                                                let displayUnit = '';
                                                if (isFormula) {
                                                    const allProperties = [
                                                        ...(item.properties || []).map(p => ({ name: p.name, value: p.waarde, unit: p.eenheid || '' })),
                                                        ...newPropertiesList.map(p => ({ name: p.name, value: p.value, unit: p.unit || '' }))
                                                    ];
                                                    const evaluation = evaluateFormule(prop.Formule_expression, allProperties);
                                                    if (evaluation.error) {
                                                        evalError = evaluation.error;
                                                    } else {
                                                        const hasMulDiv = /[*/]/.test(prop.Formule_expression);
                                                        let v = evaluation.value;
                                                        const isLinearUnit = ['m','cm','mm','kg','g','L','mL'].includes(prop.unit);
                                                        const isAreaUnit = ['m²','cm²','mm²'].includes(prop.unit);
                                                        const isVolumeUnit = ['m³','L','mL'].includes(prop.unit);

                                                        if (!hasMulDiv) {
                                                            // Linear/additive: allow linear conversions and show linear unit
                                                            if (prop.unit && ['cm','mm','g','mL'].includes(prop.unit)) {
                                                                const base = (prop.unit === 'cm' || prop.unit === 'mm') ? 'm' : (prop.unit === 'g' ? 'kg' : 'L');
                                                                v = convertToUnit(v, base, prop.unit);
                                                            }
                                                            displayUnit = prop.unit || '';
                                                        } else {
                                                            // Multiplicative/divisive: don't show linear units; only allow area/volume units if explicitly selected
                                                            if (isAreaUnit) {
                                                                v = convertToUnit(v, 'm²', prop.unit);
                                                                displayUnit = prop.unit;
                                                            } else if (isVolumeUnit && prop.unit !== 'L') {
                                                                // If user selects m³ or mL, convert from m³; if L is selected here with mul/div, we suppress unit to avoid confusion
                                                                v = convertToUnit(v, 'm³', prop.unit);
                                                                displayUnit = prop.unit;
                                                            } else {
                                                                displayUnit = '';
                                                            }
                                                        }
                                                        evalResult = roundToDecimals(v, 6);
                                                    }
                                                }
                                                return (
                                                    <WaardeInput
                                                        value={prop.Formule_expression ? prop.Formule_expression : (prop.value || '') + (prop.unit || '')}
                                                        isFormula={isFormula}
                                                        computedValue={isFormula ? evalResult : null}
                                                        unit={isFormula ? (displayUnit || '') : ''}
                                                        error={isFormula ? evalError : null}
                                                        onChange={(text) => {
                                                            const hasFormulaPattern = /[+\-*/()]/.test(text) && !/^\d+\.?\d*$/.test(text.trim());
                                                            if (hasFormulaPattern) {
                                                                handlePropertyFieldChange(prop.id, 'Formule_expression', text);
                                                                const evaluation = evaluateFormule(text, newPropertiesList);
                                                                if (!evaluation.error) {
                                                                    handlePropertyFieldChange(prop.id, 'value', roundToDecimals(evaluation.value, 6).toString());
                                                                    handlePropertyFieldChange(prop.id, 'unit', '');
                                                                }
                                                            } else {
                                                                // Only treat trailing letters as a unit if the left part is numeric AND the unit is recognized
                                                                const unitRegex = /(.*?)([a-zA-Z²³]+)$/;
                                                                const match = text.match(unitRegex);
                                                                if (match) {
                                                                    const rawVal = (match[1] || '').trim();
                                                                    const rawUnit = (match[2] || '').trim();
                                                                    const num = parseFloat(rawVal.replace(',', '.'));
                                                                    const unitOk = allUnits.includes(sanitizeUnit(rawUnit));
                                                                    if (isFinite(num) && unitOk) {
                                                                        handlePropertyFieldChange(prop.id, 'value', match[1]);
                                                                        handlePropertyFieldChange(prop.id, 'unit', sanitizeUnit(rawUnit));
                                                                    } else {
                                                                        // Treat full text as value (textual value), clear unit
                                                                        handlePropertyFieldChange(prop.id, 'value', text);
                                                                        handlePropertyFieldChange(prop.id, 'unit', '');
                                                                    }
                                                                } else {
                                                                    handlePropertyFieldChange(prop.id, 'value', text);
                                                                    handlePropertyFieldChange(prop.id, 'unit', '');
                                                                }
                                                                handlePropertyFieldChange(prop.id, 'Formule_expression', '');
                                                            }
                                                        }}
                                                        onAddFormule={() => handleOpenValueInput(prop.id)}
                                                    />
                                                );
                                            })()}
                                        </View>
                                    </View>
                                ) : (
                                    <>
                                        <View style={AppStyles.formGroup}>
                                            <Text style={AppStyles.formLabel}>Eigenschap Naam</Text>
                                            <TextInput
                                                placeholder="Bijv. Gewicht"
                                                value={prop.name}
                                                onChangeText={(text) => handlePropertyFieldChange(prop.id, 'name', text)}
                                                style={AppStyles.formInput}
                                            />
                                            {/* Eenheid selectie */}
                                            <View style={{ marginTop: 10 }}>
                                                <Text style={[AppStyles.formLabel, { marginBottom: 8 }]}>Eenheid</Text>
                                                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                                                    {[ 'Geen', ...allUnits ].map((unit) => {
                                                        const isSelected = (unit === 'Geen' && !prop.unit) || prop.unit === unit;
                                                        return (
                                                            <TouchableOpacity
                                                                key={unit}
                                                                onPress={() => handleUnitChange(prop.id, unit === 'Geen' ? '' : unit)}
                                                                style={{
                                                                    paddingVertical: 8,
                                                                    paddingHorizontal: 12,
                                                                    borderRadius: 20,
                                                                    borderWidth: 1,
                                                                    borderColor: isSelected ? colors.blue600 : colors.lightGray300,
                                                                    backgroundColor: isSelected ? colors.blue50 : colors.white,
                                                                    marginRight: 8,
                                                                    marginBottom: 8,
                                                                }}
                                                            >
                                                                <Text style={{
                                                                    color: isSelected ? colors.blue700 : colors.lightGray700,
                                                                    fontWeight: isSelected ? '700' : '500'
                                                                }}>
                                                                    {unit}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        );
                                                    })}
                                                </View>
                                            </View>
                                        </View>
                                        <View style={AppStyles.formGroup}>
                                            <Text style={AppStyles.formLabel}>Waarde</Text>
                                            {(() => {
                                                const isFormula = !!(prop.Formule_expression && /[+\-*/()]/.test(prop.Formule_expression) && !/^\d+\.?\d*[a-zA-Z]*$/.test(prop.Formule_expression.trim()));
                                                let evalResult = null;
                                                let evalError = null;
                                                let displayUnit = '';
                                                if (isFormula) {
                                                    const allProperties = [
                                                        ...(item.properties || []).map(p => ({ name: p.name, value: p.waarde, unit: p.eenheid || '' })),
                                                        ...newPropertiesList.map(p => ({ name: p.name, value: p.value, unit: p.unit || '' }))
                                                    ];
                                                    const evaluation = evaluateFormule(prop.Formule_expression, allProperties);
                                                    if (evaluation.error) {
                                                        evalError = evaluation.error;
                                                    } else {
                                                        const hasMulDiv = /[*/]/.test(prop.Formule_expression);
                                                        let v = evaluation.value;
                                                        const isLinearUnit = ['m','cm','mm','kg','g','L','mL'].includes(prop.unit);
                                                        const isAreaUnit = ['m²','cm²','mm²'].includes(prop.unit);
                                                        const isVolumeUnit = ['m³','L','mL'].includes(prop.unit);

                                                        if (!hasMulDiv) {
                                                            // Linear/additive: allow linear conversions and show linear unit
                                                            if (prop.unit && ['cm','mm','g','mL'].includes(prop.unit)) {
                                                                const base = (prop.unit === 'cm' || prop.unit === 'mm') ? 'm' : (prop.unit === 'g' ? 'kg' : 'L');
                                                                v = convertToUnit(v, base, prop.unit);
                                                            }
                                                            displayUnit = prop.unit || '';
                                                        } else {
                                                            // Multiplicative/divisive: don't show linear units; only allow area/volume units if explicitly selected
                                                            if (isAreaUnit) {
                                                                v = convertToUnit(v, 'm²', prop.unit);
                                                                displayUnit = prop.unit;
                                                            } else if (isVolumeUnit && prop.unit !== 'L') {
                                                                // If user selects m³ or mL, convert from m³; if L is selected here with mul/div, we suppress unit to avoid confusion
                                                                v = convertToUnit(v, 'm³', prop.unit);
                                                                displayUnit = prop.unit;
                                                            } else {
                                                                displayUnit = '';
                                                            }
                                                        }
                                                        evalResult = roundToDecimals(v, 6);
                                                    }
                                                }
                                                return (
                                                    <WaardeInput
                                                        value={prop.Formule_expression ? prop.Formule_expression : (prop.value || '') + (prop.unit || '')}
                                                        isFormula={isFormula}
                                                        computedValue={isFormula ? evalResult : null}
                                                        unit={isFormula ? (displayUnit || '') : ''}
                                                        error={isFormula ? evalError : null}
                                                        onChange={(text) => {
                                                            const hasFormulaPattern = /[+\-*/()]/.test(text) && !/^\d+\.?\d*$/.test(text.trim());
                                                            if (hasFormulaPattern) {
                                                                handlePropertyFieldChange(prop.id, 'Formule_expression', text);
                                                                const evaluation = evaluateFormule(text, newPropertiesList);
                                                                if (!evaluation.error) {
                                                                    handlePropertyFieldChange(prop.id, 'value', roundToDecimals(evaluation.value, 6).toString());
                                                                    handlePropertyFieldChange(prop.id, 'unit', '');
                                                                }
                                                            } else {
                                                                // Only treat trailing letters as a unit if the left part is numeric AND the unit is recognized
                                                                const unitRegex = /(.*?)([a-zA-Z²³]+)$/;
                                                                const match = text.match(unitRegex);
                                                                if (match) {
                                                                    const rawVal = (match[1] || '').trim();
                                                                    const rawUnit = (match[2] || '').trim();
                                                                    const num = parseFloat(rawVal.replace(',', '.'));
                                                                    const unitOk = allUnits.includes(sanitizeUnit(rawUnit));
                                                                    if (isFinite(num) && unitOk) {
                                                                        handlePropertyFieldChange(prop.id, 'value', match[1]);
                                                                        handlePropertyFieldChange(prop.id, 'unit', sanitizeUnit(rawUnit));
                                                                    } else {
                                                                        // Treat full text as value (textual value), clear unit
                                                                        handlePropertyFieldChange(prop.id, 'value', text);
                                                                        handlePropertyFieldChange(prop.id, 'unit', '');
                                                                    }
                                                                } else {
                                                                    handlePropertyFieldChange(prop.id, 'value', text);
                                                                    handlePropertyFieldChange(prop.id, 'unit', '');
                                                                }
                                                                handlePropertyFieldChange(prop.id, 'Formule_expression', '');
                                                            }
                                                        }}
                                                        onAddFormule={() => handleOpenValueInput(prop.id)}
                                                    />
                                                );
                                            })()}
                                        </View>
                                    </>
                                )}
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                                        <TouchableOpacity onPress={() => handleSelectFile(prop.id)} style={{ flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: colors.lightGray100, borderRadius: 8, alignSelf: 'flex-start' }}>
                                            <Paperclip color={colors.blue600} size={18} />
                                            <Text style={{ marginLeft: 8, color: colors.lightGray700, fontWeight: '500' }}>Bestand bijvoegen</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

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
                
                {/* Add Property FAB */}
                <TouchableOpacity onPress={addNewPropertyField} style={AppStyles.fab}>
                    <Plus color="white" size={24} />
                </TouchableOpacity>
            </KeyboardAvoidingView>

            {/* Modals */}
            <ValueInputModal
                visible={showValueInputModal}
                onClose={() => {
                    setShowValueInputModal(false);
                    setValueInputPropertyId(null);
                }}
                currentValue={valueInputPropertyId !== null ? 
                    (() => {
                        const prop = newPropertiesList.find(p => p.id === valueInputPropertyId);
                        if (!prop) return '';
                        // If it's a formula, show the formula expression (don't concatenate unit)
                        if (prop.Formule_expression && prop.Formule_expression.trim() !== '') {
                            return prop.Formule_expression;
                        }
                        // Otherwise show the regular value with unit
                        return (prop.value || '') + (prop.unit || '');
                    })() : ''
                }
                currentUnit={valueInputPropertyId !== null ? 
                    (() => {
                        const prop = newPropertiesList.find(p => p.id === valueInputPropertyId);
                        return prop?.unit || '';
                    })() : ''
                }
                onValueSet={handleValueInputSet}
                formules={Formules}
                onAddFormule={handleAddFormuleFromValueInput}
                propertyName={valueInputPropertyId !== null ? 
                    newPropertiesList.find(p => p.id === valueInputPropertyId)?.name || 'Eigenschap' : 'Eigenschap'
                }
            />
        </View>
    );
};

export default AddPropertyScreen;


