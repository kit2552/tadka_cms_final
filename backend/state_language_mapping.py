# Default State-Language Mapping for India

DEFAULT_STATE_LANGUAGE_MAPPING = {
    'all': 'Hindi',  # National/Bollywood releases
    'ap': 'Telugu',  # Andhra Pradesh
    'ar': 'English', # Arunachal Pradesh
    'as': 'Assamese', # Assam
    'br': 'Hindi',   # Bihar
    'cg': 'Hindi',   # Chhattisgarh
    'dl': 'Hindi',   # Delhi
    'ga': 'Konkani', # Goa
    'gj': 'Gujarati', # Gujarat
    'hr': 'Hindi',   # Haryana
    'hp': 'Hindi',   # Himachal Pradesh
    'jk': 'Urdu',    # Jammu and Kashmir
    'jh': 'Hindi',   # Jharkhand
    'ka': 'Kannada', # Karnataka
    'kl': 'Malayalam', # Kerala
    'ld': 'English', # Ladakh
    'mp': 'Hindi',   # Madhya Pradesh
    'mh': 'Marathi', # Maharashtra
    'mn': 'Meitei',  # Manipur
    'ml': 'English', # Meghalaya
    'mz': 'Mizo',    # Mizoram
    'nl': 'English', # Nagaland
    'or': 'Odia',    # Odisha
    'pb': 'Punjabi', # Punjab
    'rj': 'Hindi',   # Rajasthan
    'sk': 'Nepali',  # Sikkim
    'tn': 'Tamil',   # Tamil Nadu
    'ts': 'Telugu',  # Telangana
    'tr': 'Bengali', # Tripura
    'up': 'Hindi',   # Uttar Pradesh
    'uk': 'Hindi',   # Uttarakhand
    'wb': 'Bengali'  # West Bengal
}

def get_language_for_state(state_code):
    """Get the primary language for a state code"""
    return DEFAULT_STATE_LANGUAGE_MAPPING.get(state_code, 'Hindi')

def get_languages_for_states(state_codes):
    """Get list of languages for multiple state codes"""
    languages = []
    for state_code in state_codes:
        lang = get_language_for_state(state_code)
        if lang and lang not in languages:
            languages.append(lang)
    return languages
