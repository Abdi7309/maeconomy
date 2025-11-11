/* Example of the desired UI change for your 'Waarde' field.
   This code shows how to make the value input editable, while still having a button (inside the input container) to add a formule.
*/

import { Calculator } from 'lucide-react-native';
import { Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../AppStyles';

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

export default function WaardeInput({ value, onChange, onAddFormule, isFormula = false, computedValue = null, unit = '', error = null }) {
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
          console.log('[WaardeInput] Calculator button pressed, value:', value, 'isFormula:', isFormula);
          if (typeof onAddFormule === 'function') {
            onAddFormule();
          }
        }}
        style={{ padding: 8, borderLeftWidth: 1, borderLeftColor: colors.lightGray200 }}
      >
        <Calculator color={colors.primary} size={20} />
      </TouchableOpacity>
    </View>
  );
}
