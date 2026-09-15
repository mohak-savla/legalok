import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { TA, KN, GU } from './indic';

const EN = {
  tagline: 'Create legal documents without a lawyer',
  heroSub: 'NDAs, Rent Agreements, Employment Contracts and more — answer a few questions and your document builds itself.',
  start: 'Start Creating Now', browse: 'Browse Templates',
  how: 'How it works', how1: 'Choose a template', how1s: 'Business & personal documents crafted by legal experts.',
  how2: 'Answer questions', how2s: 'Watch your document build live as you answer.',
  how3: 'Pay, sign & download', how3s: 'Secure payment, digital signatures, instant download.',
  dashboard: 'Dashboard', myDocuments: 'My Documents', favorites: 'Favorites', templates: 'Templates',
  profile: 'Profile', audit: 'Audit Log', admin: 'Admin Panel', logout: 'Logout', login: 'Login', signup: 'Sign Up Free',
  welcome: 'Welcome back', total: 'Total', createNew: 'Create New Document',
  search: 'Search templates…', all: 'All Documents', business: 'Business', personal: 'Personal',
  free: 'Free', questions: 'questions', next: 'Next', prev: 'Previous', complete: 'Complete & Proceed',
  required: 'This question is required', guide: 'Guide', watchVideo: 'Watch video explanation',
  preview: 'Live Preview', locked: 'Unlocks after payment',
  payNow: 'Pay & Generate', downloadDoc: 'Download DOC', downloadPdf: 'Download PDF',
  sign: 'Sign Document', sendSign: 'Send for Signing', viewAudit: 'View Audit Log',
  saved: 'Saved', saving: 'Saving…',
  language: 'Language',
};

const HI = {
  tagline: 'बिना वकील के कानूनी दस्तावेज़ बनाएं',
  heroSub: 'एनडीए, किराया समझौता, रोज़गार अनुबंध और भी बहुत कुछ — कुछ सवालों के जवाब दें और दस्तावेज़ अपने आप तैयार हो जाए।',
  start: 'अभी शुरू करें', browse: 'टेम्पलेट देखें',
  how: 'यह कैसे काम करता है', how1: 'टेम्पलेट चुनें', how1s: 'विशेषज्ञों द्वारा बनाए गए दस्तावेज़।',
  how2: 'सवालों के जवाब दें', how2s: 'जवाब देते ही दस्तावेज़ लाइव बनता है।',
  how3: 'भुगतान, हस्ताक्षर और डाउनलोड', how3s: 'सुरक्षित भुगतान, डिजिटल हस्ताक्षर, तुरंत डाउनलोड।',
  dashboard: 'डैशबोर्ड', myDocuments: 'मेरे दस्तावेज़', favorites: 'पसंदीदा', templates: 'टेम्पलेट',
  profile: 'प्रोफ़ाइल', audit: 'ऑडिट लॉग', admin: 'एडमिन पैनल', logout: 'लॉगआउट', login: 'लॉगिन', signup: 'मुफ़्त साइन अप',
  welcome: 'वापसी पर स्वागत है', total: 'कुल', createNew: 'नया दस्तावेज़ बनाएं',
  search: 'टेम्पलेट खोजें…', all: 'सभी दस्तावेज़', business: 'व्यापार', personal: 'व्यक्तिगत',
  free: 'मुफ़्त', questions: 'प्रश्न', next: 'आगे', prev: 'पीछे', complete: 'पूरा करें',
  required: 'यह प्रश्न आवश्यक है', guide: 'मार्गदर्शन', watchVideo: 'वीडियो देखें',
  preview: 'लाइव प्रीव्यू', locked: 'भुगतान के बाद खुलेगा',
  payNow: 'भुगतान करें', downloadDoc: 'DOC डाउनलोड', downloadPdf: 'PDF डाउनलोड',
  sign: 'हस्ताक्षर करें', sendSign: 'हस्ताक्षर के लिए भेजें', viewAudit: 'ऑडिट देखें',
  saved: 'सहेजा गया', saving: 'सहेज रहे हैं…',
  language: 'भाषा',
};

export const LANGS = [
  { code: 'en', label: 'English' }, { code: 'hi', label: 'हिन्दी' },
  { code: 'ta', label: 'தமிழ்' }, { code: 'kn', label: 'ಕನ್ನಡ' }, { code: 'gu', label: 'ગુજરાતી' },
];

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: EN },
    hi: { translation: HI },
    ta: { translation: TA },
    kn: { translation: KN },
    gu: { translation: GU },
  },
  lng: localStorage.getItem('legalok.lang') || 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
