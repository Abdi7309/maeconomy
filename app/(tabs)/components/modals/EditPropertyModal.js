import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Calculator } from 'lucide-react-native';
import {
    createFormule,
    deleteProperty,
    fetchFormuleByExpression,
    fetchFormules,
    fetchFormulesSafe,
    updateProperty,
    findPropertyIdByName
} from '../../api';
import AppStyles, { colors } from '../../AppStyles';
import AddFormuleModal from './AddFormuleModal';
import FormulePickerModal from './FormulePickerModal';

// Extended unit table (length, mass, volume, area, cubic)
const unitConversionTable = {
    // Length
    m: { m: 1, cm: 0.01, mm: 0.001 },
    cm: { m: 100, cm: 1, mm: 0.1 },
    mm: { m: 1000, cm: 10, mm: 1 },
    // Mass
    kg: { kg: 1, g: 0.001 },
    g: { kg: 1000, g: 1 },
    // Volume (liquid metric)
    L: { L: 1, mL: 0.001, 'm³': 0.001 }, // include m³ mapping (1 L = 0.001 m³)
    mL: { L: 1000, mL: 1, 'm³': 0.000001 },
    'm³': { 'm³': 1, L: 0.001, mL: 0.000001 },
    // Area
    'm²': { 'm²': 1, 'cm²': 0.0001, 'mm²': 0.000001 },
    'cm²': { 'm²': 10000, 'cm²': 1, 'mm²': 0.01 },
    'mm²': { 'm²': 1000000, 'cm²': 100, 'mm²': 1 }
};

const sanitizeUnit = (u) => u
    ?.replace(/m\^2/i, 'm²')
    ?.replace(/m\^3/i, 'm³')
    ?.replace(/^l$/i, 'L')
    ?.replace(/^ml$/i, 'mL')
    ?.replace('²', '²')
    ?.replace('³', '³');

// Global precision control for numeric outputs
const DECIMAL_PLACES = 6;
const roundToDecimals = (value, decimals = DECIMAL_PLACES) => {
    if (typeof value !== 'number' || !isFinite(value)) return value;
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
};

const convertToUnit = (value, fromUnit, toUnit) => {
    const f = sanitizeUnit(fromUnit);
    const t = sanitizeUnit(toUnit);
    if (!f || !t || !unitConversionTable[t] || !unitConversionTable[t][f]) return value;
    const factor = unitConversionTable[t][f];
    return roundToDecimals(value * factor);
};

const buildPropertiesMap = (properties, outputUnit) => {
    const map = {};
    const toBaseUnitFor = (unit) => {
        const u = sanitizeUnit(unit);
        if (!u) return null;
        if (['m', 'cm', 'mm'].includes(u)) return 'm';
        if (['kg', 'g'].includes(u)) return 'kg';
        if (['L', 'mL'].includes(u)) return 'L';
        if (['m³'].includes(u)) return 'm³';
        if (['m²', 'cm²', 'mm²'].includes(u)) return 'm²';
        return null;
    };
    function getCalculatedValue(prop, visited = {}) {
        if (visited[prop.name]) return 0;
        visited[prop.name] = true;
        let val = prop.value;
        let fromExpression = false;
        if (typeof val === 'string' && /[+\-*/]/.test(val)) {
            let Formule = val;
            properties.forEach(refProp => {
                if (refProp.name.trim() !== '') {
                    const refValue = getCalculatedValue(refProp, { ...visited });
                    const regex = new RegExp(`\\b${refProp.name}\\b`, 'gi');
                    Formule = Formule.replace(regex, refValue);
                }
            });
            try {
                // reject unsafe characters
                if (/[^0-9+\-*/().\s]/.test(Formule)) {
                    return 'Error';
                }
                // Normalize common multiply symbols
                Formule = Formule.replace(/[x×]/g, '*');
                // Evaluate safely
                val = new Function(`return ${Formule}`)();
                val = roundToDecimals(val);
                fromExpression = true;
            } catch (e) {
                val = 'Error';
            }
        }
        // Convert to requested output unit or per-type base unit
        if (prop.unit && outputUnit) {
            const numVal = Number(val);
            if (isFinite(numVal)) {
                if (outputUnit === '__BASE__') {
                    const target = toBaseUnitFor(prop.unit);
                    if (target && target !== prop.unit) {
                        // If the value came from an expression, it should already be in base due to inputs normalized;
                        // but converting again from the declared unit is harmless only when val was a raw value.
                        if (!fromExpression) {
                            return convertToUnit(numVal, prop.unit, target);
                        } else {
                            return numVal;
                        }
                    }
                    return numVal;
                } else {
                    return convertToUnit(numVal, prop.unit, outputUnit);
                }
            }
        }
        return val;
    }
    properties.forEach(prop => {
        if (prop.name && prop.name.trim() !== '') {
            map[prop.name.toLowerCase()] = getCalculatedValue(prop);
        }
    });
    return map;
};

const evaluateFormule = (Formule, propertiesMap) => {
    // Check if Formule is valid
    if (!Formule || typeof Formule !== 'string') {
        return { value: 0, error: 'Invalid formula' };
    }

    let expression = Formule;
    // Normalize common multiply symbols
    expression = expression.replace(/[x×]/g, '*');
    // Replace property names with their numeric values from the map (escape regex specials)
    const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    Object.keys(propertiesMap).forEach(key => {
        const escaped = escapeRegex(key);
        // If the name contains non-word chars, \b may not work; fall back to plain global replace
        const hasNonWord = /[^A-Za-z0-9_]/.test(key);
        const regex = hasNonWord ? new RegExp(escaped, 'gi') : new RegExp(`\\b${escaped}\\b`, 'gi');
        expression = expression.replace(regex, propertiesMap[key]);
    });

    // Normalize length units to meters
    expression = expression.replace(/(\d+(?:\.\d+)?)\s*(mm|cm|m)\b/gi, (match, num, unit) => {
        const valueInMeters = convertToUnit(parseFloat(num), unit.toLowerCase(), 'm');
        return valueInMeters.toString();
    });

    // Normalize mass units to kg
    expression = expression.replace(/(\d+(?:\.\d+)?)\s*(g|kg)\b/gi, (match, num, unit) => {
        const valueInKg = convertToUnit(parseFloat(num), unit.toLowerCase(), 'kg');
        return valueInKg.toString();
    });

    // Normalize volume units to liters (L)
    expression = expression.replace(/(\d+(?:\.\d+)?)\s*(mL|L)\b/gi, (match, num, unit) => {
        const valueInL = convertToUnit(parseFloat(num), unit, 'L');
        return valueInL.toString();
    });

    // Normalize area units to m²
    expression = expression.replace(/(\d+(?:\.\d+)?)\s*(m²|cm²|mm²)\b/gi, (match, num, unit) => {
        const valueInM2 = convertToUnit(parseFloat(num), unit, 'm²');
        return valueInM2.toString();
    });

    // Normalize cubic units to m³
    expression = expression.replace(/(\d+(?:\.\d+)?)\s*(m³)\b/gi, (match, num, unit) => {
        const valueInM3 = convertToUnit(parseFloat(num), unit, 'm³');
        return valueInM3.toString();
    });

    try {
        // Check for any remaining non-numeric parts that aren't operators
        if (/[^0-9+\-*/().\s]/.test(expression)) {
            return { value: null, error: 'Onbekende variabelen in formule' };
        }
        // Use Function constructor for safer evaluation
        const result = new Function(`return ${expression}`)();
        if (typeof result === 'number' && !isNaN(result)) {
            // The result is now in meters, round it for consistency
            return { value: roundToDecimals(result), error: null };
        }
        return { value: null, error: 'Formule kon niet worden berekend' };
    } catch (e) {
        return { value: null, error: 'Formule kon niet worden berekend' };
    }
};

// Helper for illustrating floating-point vs rounded output in logs only
const formatNumberForLog = (n, decimals = 6) => {
    if (typeof n !== 'number' || isNaN(n)) return { raw: n, toFixed: null, rounded: null, trimmed: null };
    const fixed = n.toFixed(decimals);
    const rounded = Number(fixed);
    const trimmed = String(rounded).replace(/\.?0+$/, '');
    return { raw: n, toFixed: fixed, rounded, trimmed };
};

const SafeView = ({ children, ...rest }) => (
    <View {...rest}>
        {React.Children.map(children, (child) => {
            if (typeof child === 'string' || typeof child === 'number') {
                return <Text>{child}</Text>;
            }
            return child;
        })}
    </View>
);

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

// ✅ objectId toegevoegd als prop
const EditPropertyModal = ({ visible, onClose, objectId, property, existingPropertiesDraft, onSaved }) => {
    const initialFormule = property?.formule || property?.Formule_expression || property?.formules?.formule || '';
    const [editedName, setEditedName] = useState(property?.name || '');
    const [editedValue, setEditedValue] = useState(property?.waarde || '');
    // Local buffer for waarde input to prevent re-render focus loss when parent state updates
    const [editedValueInput, setEditedValueInput] = useState(property?.waarde || '');
    const [editedFormule, setEditedFormule] = useState(initialFormule);
    const [editedUnit, setEditedUnit] = useState(property?.eenheid || '');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    // Formula selection state
    const [editedFormuleId, setEditedFormuleId] = useState(property?.Formule_id ?? property?.formule_id ?? null);
    // Picker modal state
    const [showFormulePicker, setShowFormulePicker] = useState(false);
    const [formulesList, setFormulesList] = useState([]);
    const [formulesLoading, setFormulesLoading] = useState(false);
    const [formulesError, setFormulesError] = useState(null);
    // Global cache to avoid refetch flashes
    const getFormulesCache = () => {
        try {
            if (!globalThis.__formulesCache) {
                globalThis.__formulesCache = { data: [], fetchedAt: 0, ttlMs: 60000 };
            }
            return globalThis.__formulesCache;
        } catch (_) {
            return { data: [], fetchedAt: 0, ttlMs: 60000 };
        }
    };

    const loadFormules = async (force = false) => {
        const cache = getFormulesCache();
        const now = Date.now();
        if (!force && cache.data.length && (now - cache.fetchedAt < cache.ttlMs)) {
            setFormulesList(cache.data);
            setFormulesError(null);
            setFormulesLoading(false);
            return;
        }
        setFormulesLoading(true);
        setFormulesError(null);

        // ✅ fetchFormulesSafe geeft nu direct een array terug
        try {
            const list = await fetchFormulesSafe();
            setFormulesList(list);
            cache.data = list;
            cache.fetchedAt = now;
            setFormulesError(null);
        } catch (e) {
            console.warn('[EditPropertyModal] loadFormules error:', e);
            setFormulesError('Kon formules niet laden');
        }

        setFormulesLoading(false);
    };

    // Preload when modal opens to reduce perceived empty state
    useEffect(() => {
        if (visible) {
            loadFormules(false);
        }
    }, [visible]);
    const [showAddFormuleModal, setShowAddFormuleModal] = useState(false);

    const handleUnitChange = (newUnit) => {
        const currentUnit = editedUnit;
        const currentValue = parseFloat(editedValue.replace(',', '.'));
        if (!isNaN(currentValue) && currentUnit && newUnit && currentUnit !== newUnit) {
            // Convert only if both are recognized
            const convertedValue = convertToUnit(currentValue, currentUnit, newUnit);
            setEditedValue(String(convertedValue));
        }
        setEditedUnit(newUnit);
    };

    // Init state ONLY when property id changes or modal just became visible to prevent resets on each parent re-render
    const prevPropertyIdRef = React.useRef(null);
    useEffect(() => {
        if (!visible) return;
        const currentId = property?.id;
        const firstOpenForId = prevPropertyIdRef.current !== currentId;
        if (firstOpenForId) {
            prevPropertyIdRef.current = currentId;
            setEditedName(property?.name || '');
            const initialVal = property?.waarde || '';
            setEditedValue(initialVal);
            setEditedValueInput(initialVal);
            setEditedFormule(property?.formule || property?.Formule_expression || property?.formules?.formule || '');
            setEditedUnit(property?.eenheid || '');
            setEditedFormuleId(property?.Formule_id ?? property?.formule_id ?? null);
            console.log('[EditPropertyModal] Initialized state for property id:', currentId);
        }
    }, [visible, property?.id]);

    const mapForUnit = useMemo(() => {
        const props = (existingPropertiesDraft || []).map(p => {
            const expr = p?.Formule_expression || p?.formule || p?.formules?.formule || '';
            const isExpr = expr && /[+\-*/]/.test(expr);
            return {
                name: p.name,
                value: isExpr
                    ? (() => {
                        // Evaluate nested formulas using base-normalized inputs
                        const innerMap = buildPropertiesMap(
                            (existingPropertiesDraft || []).map(x => ({ name: x.name, value: x.waarde, unit: x.eenheid || '' })),
                            '__BASE__'
                        );
                        const { value: innerVal, error: innerErr } = evaluateFormule(expr, innerMap);
                        return innerErr ? 'Error' : String(innerVal);
                    })()
                    : p.waarde,
                unit: p.eenheid || ''
            };
        });
        // Build the top-level substitution map in base units
        return buildPropertiesMap(props, '__BASE__');
    }, [existingPropertiesDraft]);

    // Compute numeric display value and target unit for current formula
    const computedDisplay = useMemo(() => {
        if (!editedFormule || !/[+\-*/x×]/.test(editedFormule)) return { value: null, unit: null, error: null };
        const { value, error } = evaluateFormule(editedFormule, mapForUnit);
        if (error || value == null) return { value: null, unit: null, error: error || 'Formule fout' };
        const hasMulDiv = /[*/]/.test(editedFormule);
        let displayValue = value;
        let unitToShow = null;
        const u = sanitizeUnit(editedUnit);
        const isLength = ['m', 'cm', 'mm'].includes(u);
        const isMass = ['kg', 'g'].includes(u);
        const isVolume = ['L', 'mL', 'm³'].includes(u);
        const isArea = ['m²', 'cm²', 'mm²'].includes(u);
        if (u) {
            if (!hasMulDiv && (isLength || isMass || isVolume)) {
                const base = isLength ? 'm' : isMass ? 'kg' : (isVolume ? (u === 'm³' ? 'm³' : 'L') : u);
                displayValue = convertToUnit(value, base, u);
                unitToShow = u;
            } else if (hasMulDiv && (isArea || (isVolume && u !== 'L'))) {
                const base = isArea ? 'm²' : 'm³';
                displayValue = convertToUnit(value, base, u);
                unitToShow = u;
            }
        }
        return { value: roundToDecimals(displayValue), unit: unitToShow, error: null };
    }, [editedFormule, mapForUnit, editedUnit]);

    // Debounced preview, auto-sync guarded while user actively typing
    const [formulaTyping, setFormulaTyping] = useState(false);
    const formulaTypingTimerRef = React.useRef(null);

    const handleFormulaChange = (text) => {
        setEditedFormule(text);
        if (text && editedFormuleId) setEditedFormuleId(null);
        setFormulaTyping(true);
        if (formulaTypingTimerRef.current) clearTimeout(formulaTypingTimerRef.current);
        formulaTypingTimerRef.current = setTimeout(() => {
            setFormulaTyping(false);
        }, 400); // idle debounce
    };

    const preview = useMemo(() => {
        if (!editedFormule || !/[+\-*/x×]/.test(editedFormule)) return { text: null, error: null };
        if (computedDisplay.error) return { text: computedDisplay.error, error: true };
        if (computedDisplay.value == null) return { text: null, error: null };
        const finalText = `${computedDisplay.value}${computedDisplay.unit ? ` ${computedDisplay.unit}` : ''}`;
        return { text: finalText, error: false };
    }, [editedFormule, computedDisplay]);

    // Keep Waarde field in sync only when user is not actively typing & not locked
    useEffect(() => {
        const isFormula = editedFormule && /[+\-*/x×]/.test(editedFormule);
        if (!isFormula) return;
        if (formulaTyping) return; // skip while user typing
        try {
            if (property?.id && globalThis.__propertyValueLocks && globalThis.__propertyValueLocks[property.id]?.locked) {
                return; // locked, skip
            }
        } catch (_) { }
        if (computedDisplay && typeof computedDisplay.value === 'number' && !isNaN(computedDisplay.value)) {
            const currentNum = parseFloat(String(editedValue).replace(',', '.'));
            if (!isFinite(currentNum) || Math.abs(currentNum - computedDisplay.value) > 1e-9) {
                const newVal = String(computedDisplay.value);
                setEditedValue(newVal);
                setEditedValueInput(newVal); // keep buffer aligned when formula drives value
            }
        }
    }, [editedFormule, computedDisplay, formulaTyping, editedValue]);

    const handleSave = async () => {
        console.log('[EditPropertyModal] handleSave called. objectId:', objectId, 'propertyId:', property?.id);
        if (!property?.id) { onClose(); return; }

        if (!objectId) {
            console.warn('[EditPropertyModal] Missing objectId, skipping backend update');
        }

        const isFormule = editedFormule && /[+\-*/x×]/.test(editedFormule);
        // Use the input buffer directly for manual values to ensure latest keystrokes are captured
        let waardeToSend = isFormule ? editedValue : editedValueInput;
        let formuleIdToSend = editedFormuleId ?? null;
        const isTemp = typeof property.id === 'string' && property.id.startsWith('temp_prop_');

        // 1. Calculate waarde (fast, synchronous). Do NOT block UI for formula creation.
        if (isFormule) {
            const normalizedExprForCalc = editedFormule.replace(/[x×]/g, '*');
            const { value: calculatedValue, error } = evaluateFormule(normalizedExprForCalc, mapForUnit);
            if (!error && calculatedValue !== null) {
                const hasMulDiv = /[*/]/.test(normalizedExprForCalc);
                const u = sanitizeUnit(editedUnit);
                const isLength = ['m', 'cm', 'mm'].includes(u);
                const isMass = ['kg', 'g'].includes(u);
                const isVolume = ['L', 'mL', 'm³'].includes(u);
                const isArea = ['m²', 'cm²', 'mm²'].includes(u);
                let base = 'm';
                if (isMass) base = 'kg';
                else if (isVolume) base = u === 'm³' ? 'm³' : 'L';
                else if (isArea) base = 'm²';
                if (hasMulDiv) {
                    if (isArea || isVolume) {
                        waardeToSend = convertToUnit(calculatedValue, base, u);
                    } else {
                        waardeToSend = calculatedValue;
                    }
                } else {
                    if (isLength || isMass || isVolume) {
                        waardeToSend = convertToUnit(calculatedValue, base, u);
                    } else {
                        waardeToSend = calculatedValue;
                    }
                }
            }
        }

        // Build separate payloads: one for UI (camel/Pascal), one for API (snake_case)
        // Fix: Controleer of waardeToSend een getal is voordat we Number() gebruiken
        const numericValue = Number(waardeToSend);
        const finalWaarde = isFinite(numericValue) ? String(roundToDecimals(numericValue)) : String(waardeToSend);
        
        const basePayloadUi = {
            name: (editedName.trim() || property.name),
            waarde: finalWaarde,
            eenheid: editedUnit || '',
            Formule_id: formuleIdToSend ?? null,
        };

        const basePayloadApi = {
            name: basePayloadUi.name,
            waarde: basePayloadUi.waarde,
            eenheid: basePayloadUi.eenheid,
            // Use Formule_id (API expects this exact key)
            Formule_id: basePayloadUi.Formule_id,
            formule: isFormule ? editedFormule : '',
        };

        // Optimistic UI
        onSaved({
            id: property.id,
            name: basePayloadUi.name,
            waarde: basePayloadUi.waarde,
            formule: isFormule ? editedFormule : '',
            eenheid: basePayloadUi.eenheid,
            Formule_id: basePayloadUi.Formule_id,
            Formule_expression: isFormule ? editedFormule : '',
        });
        onClose();

        // ✅ Persist with API payload (met objectId én property.id)
        if (objectId) {
            let targetPropertyId = property.id;

            // If it's a temp property, try to resolve the real ID from the backend by name
            if (isTemp) {
                console.log('[EditPropertyModal] Temp property detected. Attempting to resolve real ID by name:', property.name);
                const realId = await findPropertyIdByName(objectId, property.name);
                if (realId) {
                    console.log('[EditPropertyModal] Resolved real ID for temp property:', realId);
                    targetPropertyId = realId;
                } else {
                    console.warn('[EditPropertyModal] Could not resolve real ID for temp property. Skipping backend update.');
                    return;
                }
            }

            const persisted = await updateProperty(objectId, targetPropertyId, basePayloadApi);
            if (!persisted) {
                // Only alert if it wasn't a temp property that we failed to resolve (which we already logged)
                if (!isTemp) {
                     Alert.alert('Opslaan deels mislukt', 'Waarde tijdelijk bijgewerkt maar server update faalde. Probeer opnieuw.');
                }
            } else {
                console.log('[EditPropertyModal] Property base update persisted');
                try { if (typeof property?.onRefresh === 'function') property.onRefresh(); } catch (_) { }
            }
        }

        // Background formula link
        if (isFormule && !formuleIdToSend && typeof editedFormule === 'string' && editedFormule.trim() && objectId) {
            (async () => {
                const trimmedExpr = editedFormule.replace(/[x×]/g, '*').trim();
                let newId = null;
                // Attempt targeted reuse
                try {
                    const existingSingle = await fetchFormuleByExpression(trimmedExpr);
                    if (existingSingle?.id) {
                        newId = existingSingle.id;
                        console.log('[EditPropertyModal] Background targeted reuse success. Formula id:', newId);
                    } else {
                        // Fallback: broad fetch + client match
                        const all = await fetchFormules();
                        const match = Array.isArray(all) ? all.find(f => String(f.formule).replace(/[x×]/g, '*').trim() === trimmedExpr) : null;
                        if (match?.id) {
                            newId = match.id;
                            console.log('[EditPropertyModal] Background broad reuse success. Formula id:', newId);
                        }
                    }
                } catch (eLookup) {
                    console.warn('[EditPropertyModal] Background formula reuse failed:', eLookup?.message);
                }
                // Create if still missing
                if (!newId) {
                    try {
                        const friendlyNameBase = (editedName && editedName.trim()) || property?.name || 'Aangepaste formule';
                        const friendlyName = `${friendlyNameBase}`;
                        console.log('[EditPropertyModal] Background creating formula name:', friendlyName);
                        const res = await createFormule(friendlyName, trimmedExpr);
                        if (res && res.success && res.id) {
                            newId = res.id;
                            console.log('[EditPropertyModal] Background creation success. New id:', newId);
                        } else {
                            console.warn('[EditPropertyModal] Background creation failed:', res?.message);
                        }
                    } catch (eCreate) {
                        console.warn('[EditPropertyModal] Background creation error:', eCreate?.message);
                    }
                }
                // Patch property with formula id if obtained
                if (newId) {
                    try {
                        const patchPayloadApi = { ...basePayloadApi, Formule_id: newId };
                        const patched = await updateProperty(objectId, property.id, patchPayloadApi);
                        if (patched) {
                            console.log('[EditPropertyModal] Background formula link persisted.', { propertyId: property.id, newId });
                            try { if (typeof property?.onRefresh === 'function') property.onRefresh(); } catch (_) { }
                        } else {
                            console.warn('[EditPropertyModal] Background formula link patch failed');
                        }
                    } catch (ePatch) {
                        console.warn('[EditPropertyModal] Background formula link patch error:', ePatch?.message);
                    }
                } else {
                    console.log('[EditPropertyModal] Background formula linking ended. No id resolved for expr.');
                }
            })().catch(e => console.warn('[EditPropertyModal] Background formula linking outer error:', e?.message));
        }
    };

    const handleDelete = () => {
        if (!property?.id) { onClose(); return; }
        console.log('[EditPropertyModal] Delete button pressed for property:', property.name, 'ID:', property.id);
        setShowDeleteConfirm(true);
    };

    const handleConfirmDelete = async () => {
        console.log('[EditPropertyModal] User confirmed delete, starting delete for property ID:', property.id);
        setShowDeleteConfirm(false);

        if (!objectId) {
            console.warn('[EditPropertyModal] Missing objectId, cannot delete in backend');
            return;
        }

        try {
            const success = await deleteProperty(objectId, property.id);
            console.log('[EditPropertyModal] Delete API response:', success);

            if (success) {
                console.log('[EditPropertyModal] Success - calling onSaved callback');
                // Update global object hierarchy cache to reflect the deletion immediately
                try {
                    const g = globalThis;
                    if (g.__objectsHierarchyCache && typeof g.__objectsHierarchyCache === 'object') {
                        const findAndUpdateObject = (items, targetId) => {
                            if (!Array.isArray(items)) return false;
                            for (const item of items) {
                                if (item.id === targetId) {
                                    // Remove the property from this object
                                    if (Array.isArray(item.properties)) {
                                        item.properties = item.properties.filter(p => p.id !== property.id);
                                        console.log('[EditPropertyModal] Updated global cache for object:', targetId);
                                    }
                                    return true;
                                }
                                // Search in children
                                if (Array.isArray(item.children) && findAndUpdateObject(item.children, targetId)) {
                                    return true;
                                }
                            }
                            return false;
                        };
                        findAndUpdateObject(g.__objectsHierarchyCache, objectId);
                    }
                    // Also update the quick cache
                    if (g.__currentObjectItems && g.__currentObjectItems[objectId]) {
                        g.__currentObjectItems[objectId].properties = g.__currentObjectItems[objectId].properties.filter(p => p.id !== property.id);
                    }
                    // Also remove from optimistic cache if present
                    if (g.__tempPropertiesCache && g.__tempPropertiesCache.map && g.__tempPropertiesCache.map.has(objectId)) {
                        const entry = g.__tempPropertiesCache.map.get(objectId);
                        if (entry && Array.isArray(entry.props)) {
                            entry.props = entry.props.filter(p => p.id !== property.id);
                            console.log('[EditPropertyModal] Removed from optimistic cache:', property.id);
                        }
                    }
                    // Trigger all listeners
                    if (Array.isArray(g.__propertyDeletionListeners)) {
                        g.__propertyDeletionListeners.forEach(listener => {
                            try {
                                listener();
                            } catch (e) {
                                console.warn('[EditPropertyModal] Error calling deletion listener:', e);
                            }
                        });
                    }
                } catch (e) {
                    console.warn('[EditPropertyModal] Could not update global cache:', e);
                }
                onSaved({ __deleted: true, id: property.id });
                onClose();
            }
        } catch (error) {
            console.error('[EditPropertyModal] Exception during delete:', error);
        }
    };

    const handleCancelDelete = () => {
        console.log('[EditPropertyModal] User cancelled delete');
        setShowDeleteConfirm(false);
    };

    if (!visible) return null;

    const existingExpression = property?.formule || property?.Formule_expression || '';

    return (
        <>
            <Modal transparent animationType={Platform.OS === 'ios' ? 'slide' : 'fade'} visible={visible} onRequestClose={onClose}>
                <SafeView style={[AppStyles.modalOverlay, { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }]}>
                    <SafeView style={[AppStyles.card, { width: '90%', maxWidth: 520, padding: 16 }]}>
                        <Text style={[AppStyles.headerTitleLg, { marginBottom: 12 }]}>Eigenschap bewerken</Text>

                        <Text style={AppStyles.formLabel}>Naam</Text>
                        <TextInput
                            placeholder="Bijv. Lengte"
                            value={editedName}
                            onChangeText={setEditedName}
                            style={AppStyles.formInput}
                        />

                        {/* Formula input with picker button styled like Waarde input in AddPropertyScreen */}
                        <Text style={[AppStyles.formLabel, { marginTop: 12 }]}>Formule</Text>
                        <WaardeInput
                            value={editedFormule || ''}
                            isFormula={!!(editedFormule && /[+\-*/x×]/.test(editedFormule))}
                            computedValue={computedDisplay && !computedDisplay.error ? computedDisplay.value : null}
                            unit={computedDisplay && !computedDisplay.error ? (computedDisplay.unit || '') : ''}
                            error={computedDisplay && computedDisplay.error ? computedDisplay.error : null}
                            onChange={handleFormulaChange}
                            onFocus={() => { console.log('[EditPropertyModal] formule input FOCUS'); }}
                            onBlur={() => { console.log('[EditPropertyModal] formule input BLUR'); }}
                            onAddFormule={() => {
                                setShowFormulePicker(true);
                                if (!formulesLoading && formulesList.length === 0) {
                                    loadFormules(false);
                                }
                            }}
                        />
                        {(editedFormuleId || editedFormule) && (
                            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                                <TouchableOpacity
                                    onPress={() => { setEditedFormuleId(null); setEditedFormule(''); }}
                                    style={{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.lightGray100, borderRadius: 6, borderWidth: 1, borderColor: colors.lightGray300 }}
                                >
                                    <Text style={{ color: colors.lightGray800, fontWeight: '600' }}>Loskoppelen (waarde blijft)</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => {
                                        try { globalThis.__propertyValueLocks = globalThis.__propertyValueLocks || {}; } catch (_) { }
                                        try {
                                            if (property?.id) {
                                                const locks = globalThis.__propertyValueLocks;
                                                locks[property.id] = { locked: true, value: editedValue };
                                            }
                                        } catch (_) { }
                                        Alert.alert('Automatische berekening gepauzeerd', 'Deze waarde wordt niet meer automatisch overschreven zolang dit venster open blijft. Gebruik "Loskoppelen" voor permanente handmatige controle.');
                                    }}
                                    style={{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.blue50, borderRadius: 6, borderWidth: 1, borderColor: colors.blue200 }}
                                >
                                    <Text style={{ color: colors.blue700, fontWeight: '600' }}>Pauzeer auto</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        <Text style={[AppStyles.formLabel, { marginTop: 12 }]}>Waarde</Text>
                        <TextInput
                            placeholder="Bijv. 20"
                            value={editedValueInput}
                            onChangeText={(text) => {
                                setEditedValueInput(text);
                            }}
                            onBlur={() => {
                                console.log('[EditPropertyModal] waarde input BLUR commit');
                                const isFormula = editedFormule && /[+\-*/x×]/.test(editedFormule);
                                if (!isFormula) {
                                    setEditedValue(editedValueInput);
                                }
                            }}
                            onFocus={() => { console.log('[EditPropertyModal] waarde input FOCUS'); }}
                            editable={!(editedFormule && /[+\-*/x×]/.test(editedFormule))}
                            style={[AppStyles.formInput, (editedFormule && /[+\-*/x×]/.test(editedFormule)) && { backgroundColor: '#F9FAFB', color: colors.lightGray800 }]}
                            blurOnSubmit={false}
                        />
                        {editedFormule && /[+\-*/x×]/.test(editedFormule) && (
                            <Text style={{ color: colors.lightGray600, marginTop: 4 }}>
                                Waarde wordt automatisch berekend{computedDisplay.unit ? ` (${computedDisplay.unit})` : ''}
                            </Text>
                        )}

                        <Text style={[AppStyles.formLabel, { marginTop: 12 }]}>Eenheid</Text>
                        <View style={styles.unitPickerContainer}>
                            {['Geen', 'm', 'cm', 'mm', 'm²', 'cm²', 'mm²', 'm³', 'kg', 'g', 'L', 'mL'].map((unit) => (
                                <TouchableOpacity
                                    key={unit}
                                    style={[
                                        styles.unitButton,
                                        (editedUnit === unit || (unit === 'Geen' && !editedUnit)) && styles.unitButtonSelected
                                    ]}
                                    onPress={() => handleUnitChange(unit === 'Geen' ? '' : unit)}
                                >
                                    <Text style={[
                                        styles.unitButtonText,
                                        (editedUnit === unit || (unit === 'Geen' && !editedUnit)) && styles.unitButtonTextSelected
                                    ]}>
                                        {unit}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <SafeView style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
                            <TouchableOpacity onPress={handleDelete} style={{ paddingVertical: 10, paddingHorizontal: 14, backgroundColor: colors.red600, borderRadius: 8 }}>
                                <Text style={{ color: colors.white, fontWeight: '600' }}>Verwijder</Text>
                            </TouchableOpacity>
                            <SafeView style={{ flexDirection: 'row' }}>
                                <TouchableOpacity onPress={onClose} style={{ paddingVertical: 10, paddingHorizontal: 14, backgroundColor: colors.lightGray200, borderRadius: 8, marginRight: 8 }}>
                                    <Text style={{ color: colors.lightGray800, fontWeight: '600' }}>Annuleer</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleSave} style={{ paddingVertical: 10, paddingHorizontal: 14, backgroundColor: colors.blue600, borderRadius: 8 }}>
                                    <Text style={{ color: colors.white, fontWeight: '600' }}>Opslaan</Text>
                                </TouchableOpacity>
                            </SafeView>
                        </SafeView>
                    </SafeView>
                </SafeView>
            </Modal>

            {/* Custom Delete Confirmation Modal */}
            <Modal
                visible={showDeleteConfirm}
                transparent={true}
                animationType="fade"
                onRequestClose={handleCancelDelete}
            >
                <View style={{
                    flex: 1,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: 20
                }}>
                    <View style={{
                        backgroundColor: 'white',
                        borderRadius: 12,
                        padding: 24,
                        minWidth: 300,
                        maxWidth: 400
                    }}>
                        <Text style={{
                            fontSize: 18,
                            fontWeight: '600',
                            textAlign: 'center',
                            marginBottom: 16,
                            color: '#1F2937'
                        }}>
                            Bevestig
                        </Text>

                        <Text style={{
                            fontSize: 16,
                            textAlign: 'center',
                            marginBottom: 24,
                            color: '#4B5563',
                            lineHeight: 24
                        }}>
                            Weet je zeker dat je deze eigenschap wilt verwijderen?
                        </Text>

                        <View style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            gap: 12
                        }}>
                            <TouchableOpacity
                                onPress={handleCancelDelete}
                                style={{
                                    flex: 1,
                                    paddingVertical: 10,
                                    paddingHorizontal: 14,
                                    backgroundColor: colors.lightGray200,
                                    borderRadius: 8
                                }}
                            >
                                <Text style={{
                                    color: colors.lightGray800,
                                    fontWeight: '600',
                                    textAlign: 'center'
                                }}>Annuleer</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleConfirmDelete}
                                style={{
                                    flex: 1,
                                    paddingVertical: 10,
                                    paddingHorizontal: 14,
                                    backgroundColor: colors.red600,
                                    borderRadius: 8
                                }}
                            >
                                <Text style={{
                                    color: colors.white,
                                    fontWeight: '600',
                                    textAlign: 'center'
                                }}>
                                    Verwijder
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Formule Picker Modal */}
            {showFormulePicker && (
                <FormulePickerModal
                    visible={showFormulePicker}
                    onClose={() => setShowFormulePicker(false)}
                    Formules={formulesList}
                    loading={formulesLoading}
                    error={formulesError}
                    onRetry={() => loadFormules(true)}
                    onSelectFormule={(f) => {
                        if (f?.id) {
                            setEditedFormuleId(f.id);
                            setEditedFormule(String(f.formule || ''));
                        }
                    }}
                    onAddFormule={() => {
                        setShowFormulePicker(false);
                        setShowAddFormuleModal(true);
                    }}
                    onEditFormule={undefined}
                />
            )}

            {/* Add Formule Modal (create new) */}
            {showAddFormuleModal && (
                <AddFormuleModal
                    visible={showAddFormuleModal}
                    onClose={() => setShowAddFormuleModal(false)}
                    onSave={(saved) => {
                        // Update local selection to the newly created/edited formula
                        if (saved?.id && saved.formule != null) {
                            setEditedFormuleId(saved.id);
                            setEditedFormule(String(saved.formule));
                        }
                        setShowAddFormuleModal(false);
                    }}
                />
            )}
        </>
    );
};

const styles = {
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
};

export default EditPropertyModal;
