// Default State-Language Mapping for India
// Maps each state to its primary and secondary languages (array format)

export const DEFAULT_STATE_LANGUAGE_MAPPING = {
  'all': ['Hindi'],  // National/Bollywood releases
  'ap': ['Telugu'],  // Andhra Pradesh
  'ar': ['English', 'Hindi'], // Arunachal Pradesh
  'as': ['Assamese', 'Bengali'], // Assam
  'br': ['Hindi', 'Bhojpuri'],   // Bihar
  'cg': ['Hindi'],   // Chhattisgarh
  'dl': ['Hindi', 'Punjabi', 'Urdu'],   // Delhi
  'ga': ['Konkani', 'Marathi'], // Goa
  'gj': ['Gujarati', 'Hindi'], // Gujarat
  'hr': ['Hindi'],   // Haryana
  'hp': ['Hindi'],   // Himachal Pradesh
  'jk': ['Urdu', 'Hindi', 'Kashmiri'],    // Jammu and Kashmir
  'jh': ['Hindi'],   // Jharkhand
  'ka': ['Kannada', 'Telugu'], // Karnataka
  'kl': ['Malayalam'], // Kerala
  'ld': ['English', 'Hindi'], // Ladakh
  'mp': ['Hindi'],   // Madhya Pradesh
  'mh': ['Marathi', 'Hindi'], // Maharashtra
  'mn': ['Meitei', 'English'],  // Manipur
  'ml': ['English', 'Khasi'], // Meghalaya
  'mz': ['Mizo', 'English'],    // Mizoram
  'nl': ['English'],            // Nagaland
  'or': ['Odia'],    // Odisha
  'pb': ['Punjabi', 'Hindi'], // Punjab
  'rj': ['Hindi'],   // Rajasthan
  'sk': ['Nepali', 'English'],  // Sikkim
  'tn': ['Tamil'],   // Tamil Nadu
  'ts': ['Telugu'],  // Telangana
  'tr': ['Bengali', 'Kokborok'], // Tripura
  'up': ['Hindi', 'Urdu'],   // Uttar Pradesh
  'uk': ['Hindi'],   // Uttarakhand
  'wb': ['Bengali', 'Hindi']  // West Bengal
};

// Available languages for selection
export const AVAILABLE_LANGUAGES = [
  'Hindi',
  'Telugu',
  'Tamil',
  'Kannada',
  'Malayalam',
  'Bengali',
  'Marathi',
  'Gujarati',
  'Punjabi',
  'Odia',
  'Assamese',
  'Urdu',
  'Bhojpuri',
  'Konkani',
  'Nepali',
  'Meitei',
  'Mizo',
  'Kashmiri',
  'Khasi',
  'Kokborok',
  'English'
];

// Get languages for a state code (returns array)
export const getLanguagesForState = (stateCode) => {
  const languages = DEFAULT_STATE_LANGUAGE_MAPPING[stateCode];
  if (!languages) return ['Hindi'];
  return Array.isArray(languages) ? languages : [languages];
};

// Get primary language for a state (first in array)
export const getLanguageForState = (stateCode) => {
  const languages = getLanguagesForState(stateCode);
  return languages[0] || 'Hindi';
};

// Get all states with their languages
export const getAllStateMappings = () => {
  return DEFAULT_STATE_LANGUAGE_MAPPING;
};
