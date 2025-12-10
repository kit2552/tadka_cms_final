// Default State-Language Mapping for India
// Maps each state to its primary official language

export const DEFAULT_STATE_LANGUAGE_MAPPING = {
  'all': 'Hindi',  // National/Bollywood releases
  'ap': 'Telugu',  // Andhra Pradesh
  'ar': 'English', // Arunachal Pradesh
  'as': 'Assamese', // Assam
  'br': 'Hindi',   // Bihar
  'cg': 'Hindi',   // Chhattisgarh
  'dl': 'Hindi',   // Delhi
  'ga': 'Konkani', // Goa
  'gj': 'Gujarati', // Gujarat
  'hr': 'Hindi',   // Haryana
  'hp': 'Hindi',   // Himachal Pradesh
  'jk': 'Urdu',    // Jammu and Kashmir
  'jh': 'Hindi',   // Jharkhand
  'ka': 'Kannada', // Karnataka
  'kl': 'Malayalam', // Kerala
  'ld': 'English', // Ladakh
  'mp': 'Hindi',   // Madhya Pradesh
  'mh': 'Marathi', // Maharashtra
  'mn': 'Meitei',  // Manipur
  'ml': 'English', // Meghalaya
  'mz': 'Mizo',    // Mizoram
  'nl': 'English', // Nagaland
  'or': 'Odia',    // Odisha
  'pb': 'Punjabi', // Punjab
  'rj': 'Hindi',   // Rajasthan
  'sk': 'Nepali',  // Sikkim
  'tn': 'Tamil',   // Tamil Nadu
  'ts': 'Telugu',  // Telangana
  'tr': 'Bengali', // Tripura
  'up': 'Hindi',   // Uttar Pradesh
  'uk': 'Hindi',   // Uttarakhand
  'wb': 'Bengali'  // West Bengal
};

// Get language for a state code
export const getLanguageForState = (stateCode) => {
  return DEFAULT_STATE_LANGUAGE_MAPPING[stateCode] || 'Hindi';
};

// Get all states with their languages
export const getAllStateMappings = () => {
  return DEFAULT_STATE_LANGUAGE_MAPPING;
};
