/**
 * i18n — Phase 9
 * Shared translations for login + all dashboards.
 * Usage: import { t, setLang, applyToDOM } from './i18n.js';
 */

export const LANGS = {
  en: {
    dir: 'ltr',
    // ── Login ──
    subtitle: 'Professional training management platform',
    usernameLabel: 'Username', passwordLabel: 'Password',
    usernamePh: 'Enter your username', passwordPh: 'Enter your password',
    forgot: 'Forgot password?', signin: 'Sign In',
    pill1: '📋 Custom Programs', pill2: '👥 Client Management', pill3: '🔒 Secure Access',
    poweredBy: 'Powered by',
    fpTitle: 'Reset your password', fpPhone: 'Phone Number', fpPhonePh: '+1 (555) 123-4567',
    fpSend: 'Send Code', fpCodeLabel: '6-Digit Code', fpCodePh: '000000',
    fpVerify: 'Verify Code', fpBack: '← Use a different number',
    fpNewPass: 'New Password', fpNewPassPh: 'Enter new password',
    fpConfPass: 'Confirm Password', fpConfPassPh: 'Confirm password',
    fpReset: 'Reset Password', fpBackLogin: '← Back to Sign In',
    // ── Coach nav ──
    navMembers: 'Members',
    navTasks: 'Tasks', navMessages: 'Messages',
    navBilling: 'Billing', navSettings: 'Settings', navDesign: 'Brand & Design',
    // ── Client nav ──
    navHome: 'Home', navProgram: 'My Program', navProgress: 'Analytics',
    navFormcheck: 'Form Check', navBillingClient: 'Billing', navProfile: 'Profile',
    // ── Common ──
    signOut: 'Sign Out',
    active: 'Active', atRisk: 'At Risk', expired: 'Expired',
    noActivity: 'No activity',
    startWorkout: '🚀 Start Workout',
    sendMessage: '💬 Send Message',
    saveBtn: 'Save', cancelBtn: 'Cancel',
  },

  he: {
    dir: 'rtl',
    // ── Login ──
    subtitle: 'פלטפורמת ניהול אימונים מקצועית',
    usernameLabel: 'שם משתמש', passwordLabel: 'סיסמה',
    usernamePh: 'הכנס שם משתמש', passwordPh: 'הכנס סיסמה',
    forgot: 'שכחת סיסמה?', signin: 'כניסה',
    pill1: '📋 תוכניות אישיות', pill2: '👥 ניהול מתאמנים', pill3: '🔒 גישה מאובטחת',
    poweredBy: 'מופעל על ידי',
    fpTitle: 'איפוס סיסמה', fpPhone: 'מספר טלפון', fpPhonePh: '050-000-0000',
    fpSend: 'שלח קוד', fpCodeLabel: 'קוד בן 6 ספרות', fpCodePh: '000000',
    fpVerify: 'אמת קוד', fpBack: '← השתמש במספר אחר',
    fpNewPass: 'סיסמה חדשה', fpNewPassPh: 'הכנס סיסמה חדשה',
    fpConfPass: 'אמת סיסמה', fpConfPassPh: 'אמת סיסמה',
    fpReset: 'אפס סיסמה', fpBackLogin: '← חזור לכניסה',
    // ── Coach nav ──
    navMembers: 'מתאמנים',
    navTasks: 'משימות', navMessages: 'הודעות',
    navBilling: 'חיוב', navSettings: 'הגדרות', navDesign: 'מיתוג ועיצוב',
    // ── Client nav ──
    navHome: 'בית', navProgram: 'התוכנית שלי', navProgress: 'ניתוח',
    navFormcheck: 'בדיקת טכניקה', navBillingClient: 'חיוב', navProfile: 'פרופיל',
    // ── Common ──
    signOut: 'התנתק',
    active: 'פעיל', atRisk: 'בסיכון', expired: 'פג תוקף',
    noActivity: 'אין פעילות',
    startWorkout: '🚀 התחל אימון',
    sendMessage: '💬 שלח הודעה',
    saveBtn: 'שמור', cancelBtn: 'ביטול',
  },

  ar: {
    dir: 'rtl',
    // ── Login ──
    subtitle: 'منصة إدارة التدريب المحترفة',
    usernameLabel: 'اسم المستخدم', passwordLabel: 'كلمة المرور',
    usernamePh: 'أدخل اسم المستخدم', passwordPh: 'أدخل كلمة المرور',
    forgot: 'هل نسيت كلمة المرور؟', signin: 'تسجيل الدخول',
    pill1: '📋 برامج مخصصة', pill2: '👥 إدارة العملاء', pill3: '🔒 وصول آمن',
    poweredBy: 'مدعوم من',
    fpTitle: 'إعادة تعيين كلمة المرور', fpPhone: 'رقم الهاتف', fpPhonePh: '+966 50 000 0000',
    fpSend: 'إرسال الكود', fpCodeLabel: 'كود من 6 أرقام', fpCodePh: '000000',
    fpVerify: 'التحقق من الكود', fpBack: '← استخدم رقم آخر',
    fpNewPass: 'كلمة مرور جديدة', fpNewPassPh: 'أدخل كلمة مرور جديدة',
    fpConfPass: 'تأكيد كلمة المرور', fpConfPassPh: 'تأكيد كلمة المرور',
    fpReset: 'إعادة تعيين', fpBackLogin: '← العودة إلى تسجيل الدخول',
    // ── Coach nav ──
    navMembers: 'الأعضاء',
    navTasks: 'المهام', navMessages: 'الرسائل',
    navBilling: 'الفواتير', navSettings: 'الإعدادات', navDesign: 'العلامة التجارية',
    // ── Client nav ──
    navHome: 'الرئيسية', navProgram: 'برنامجي', navProgress: 'التحليلات',
    navFormcheck: 'فحص التقنية', navBillingClient: 'الفواتير', navProfile: 'الملف الشخصي',
    // ── Common ──
    signOut: 'تسجيل الخروج',
    active: 'نشط', atRisk: 'في خطر', expired: 'منتهي الصلاحية',
    noActivity: 'لا نشاط',
    startWorkout: '🚀 ابدأ التمرين',
    sendMessage: '💬 إرسال رسالة',
    saveBtn: 'حفظ', cancelBtn: 'إلغاء',
  },

  es: {
    dir: 'ltr',
    subtitle: 'Plataforma profesional de gestión deportiva',
    usernameLabel: 'Usuario', passwordLabel: 'Contraseña',
    usernamePh: 'Ingresa tu usuario', passwordPh: 'Ingresa tu contraseña',
    forgot: '¿Olvidaste la contraseña?', signin: 'Ingresar',
    pill1: '📋 Programas personalizados', pill2: '👥 Gestión de clientes', pill3: '🔒 Acceso seguro',
    poweredBy: 'Con tecnología de',
    fpTitle: 'Restablecer contraseña', fpPhone: 'Número de teléfono', fpPhonePh: '+1 (555) 123-4567',
    fpSend: 'Enviar código', fpCodeLabel: 'Código de 6 dígitos', fpCodePh: '000000',
    fpVerify: 'Verificar código', fpBack: '← Usar otro número',
    fpNewPass: 'Nueva contraseña', fpNewPassPh: 'Ingresa nueva contraseña',
    fpConfPass: 'Confirmar contraseña', fpConfPassPh: 'Confirmar contraseña',
    fpReset: 'Restablecer', fpBackLogin: '← Volver al inicio',
    navMembers: 'Miembros', navTasks: 'Tareas',
    navMessages: 'Mensajes', navBilling: 'Facturación',
    navSettings: 'Ajustes', navDesign: 'Marca y Diseño',
    navHome: 'Inicio', navProgram: 'Mi Programa', navProgress: 'Analítica',
    navFormcheck: 'Control de Técnica', navBillingClient: 'Facturación', navProfile: 'Perfil',
    signOut: 'Cerrar sesión',
    active: 'Activo', atRisk: 'En riesgo', expired: 'Expirado',
    noActivity: 'Sin actividad', startWorkout: '🚀 Comenzar Entrenamiento',
    sendMessage: '💬 Enviar Mensaje', saveBtn: 'Guardar', cancelBtn: 'Cancelar',
  },

  fr: {
    dir: 'ltr',
    subtitle: 'Plateforme de gestion sportive professionnelle',
    usernameLabel: 'Identifiant', passwordLabel: 'Mot de passe',
    usernamePh: 'Entrez votre identifiant', passwordPh: 'Entrez votre mot de passe',
    forgot: 'Mot de passe oublié?', signin: 'Se connecter',
    pill1: '📋 Programmes personnalisés', pill2: '👥 Gestion des clients', pill3: '🔒 Accès sécurisé',
    poweredBy: 'Propulsé par',
    fpTitle: 'Réinitialiser le mot de passe', fpPhone: 'Numéro de téléphone', fpPhonePh: '+33 6 00 00 00 00',
    fpSend: 'Envoyer le code', fpCodeLabel: 'Code à 6 chiffres', fpCodePh: '000000',
    fpVerify: 'Vérifier le code', fpBack: '← Utiliser un autre numéro',
    fpNewPass: 'Nouveau mot de passe', fpNewPassPh: 'Entrez un nouveau mot de passe',
    fpConfPass: 'Confirmer le mot de passe', fpConfPassPh: 'Confirmer le mot de passe',
    fpReset: 'Réinitialiser', fpBackLogin: '← Retour à la connexion',
    navMembers: 'Membres', navTasks: 'Tâches',
    navMessages: 'Messages', navBilling: 'Facturation',
    navSettings: 'Paramètres', navDesign: 'Marque et Design',
    navHome: 'Accueil', navProgram: 'Mon Programme', navProgress: 'Analytique',
    navFormcheck: 'Contrôle Technique', navBillingClient: 'Facturation', navProfile: 'Profil',
    signOut: 'Se déconnecter',
    active: 'Actif', atRisk: 'À risque', expired: 'Expiré',
    noActivity: 'Aucune activité', startWorkout: '🚀 Démarrer l\'entraînement',
    sendMessage: '💬 Envoyer un message', saveBtn: 'Enregistrer', cancelBtn: 'Annuler',
  },
};

let _lang = localStorage.getItem('bix_lang') || 'en';

export function t(key) {
  return (LANGS[_lang] || LANGS.en)[key] ?? (LANGS.en[key] ?? key);
}

export function dir() {
  return (LANGS[_lang] || LANGS.en).dir || 'ltr';
}

export function setLang(code) {
  if (!LANGS[code]) return;
  _lang = code;
  localStorage.setItem('bix_lang', code);
  applyToDOM(document);
}

export function applyToDOM(root) {
  const translations = LANGS[_lang] || LANGS.en;
  root.documentElement
    ? (root.documentElement.lang = _lang, root.documentElement.dir = translations.dir)
    : null;
  root.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (translations[key] !== undefined) el.textContent = translations[key];
  });
  root.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const key = el.dataset.i18nPh;
    if (translations[key] !== undefined) el.placeholder = translations[key];
  });
}

export function getCurrentLang() { return _lang; }
