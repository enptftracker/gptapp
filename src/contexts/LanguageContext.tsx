import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'fr';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  en: {
    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.subtitle': 'Your portfolio performance overview',
    'dashboard.last24h': 'last 24h',
    'dashboard.investments': 'INVESTMENTS',
    'dashboard.totalPL': 'TOTAL P/L',
    'dashboard.updating': 'Updating...',
    'dashboard.refreshPrices': 'Refresh Prices',
    'dashboard.newPortfolio': 'New Portfolio',
    'dashboard.portfolioAllocation': 'Portfolio Allocation',
    'dashboard.topPositions': 'All Positions',
    'dashboard.viewAll': 'View All',
    'dashboard.portfolioSummary': 'Portfolio Summary',
    'dashboard.positions': 'positions',
    'dashboard.noPortfolios': 'No portfolios found',
    'dashboard.noPortfoliosDesc': 'Create your first portfolio to start tracking your investments',
    'dashboard.createPortfolio': 'Create Portfolio',
    
    // Settings
    'settings.title': 'Settings',
    'settings.subtitle': 'Manage your account preferences',
    'settings.baseCurrency': 'Base Currency',
    'settings.baseCurrencyDesc': 'Your default currency for portfolio valuation',
    'settings.timezone': 'Timezone',
    'settings.timezoneDesc': 'Your local timezone for dates and times',
    'settings.lotMethod': 'Lot Method',
    'settings.lotMethodDesc': 'Cost basis calculation method for tax reporting',
    'settings.theme': 'Theme',
    'settings.themeDesc': 'Select your preferred theme',
    'settings.language': 'Language',
    'settings.languageDesc': 'Select your preferred language',
    'settings.saveChanges': 'Save Changes',
    'settings.saving': 'Saving...',
    'settings.saved': 'Settings saved successfully',
    'settings.error': 'Failed to save settings',
    'settings.security': 'Security',
    'settings.passwordDesc': 'Update your account password regularly to keep your investments safe.',
    'settings.currentPassword': 'Current password',
    'settings.newPassword': 'New password',
    'settings.confirmPassword': 'Confirm new password',
    'settings.passwordRequirements': 'Use at least 8 characters, including one uppercase letter and one number.',
    'settings.updatePassword': 'Update password',
    'settings.updatingPassword': 'Updating password…',
    'settings.passwordUpdated': 'Password updated',
    'settings.passwordUpdatedDesc': 'Your password was changed successfully.',
    'settings.passwordUpdateFailed': 'Unable to update password',
    'settings.passwordUpdateFailedDesc': 'Please verify your current password and try again.',
    'settings.currentPasswordIncorrect': 'The current password you entered is incorrect.',
    'settings.passwordSectionTitle': 'Password',
    'settings.emailSectionTitle': 'Email address',
    'settings.emailDesc': 'Change the email that you use to sign in to your account.',
    'settings.newEmail': 'New email address',
    'settings.confirmEmail': 'Confirm new email',
    'settings.updateEmail': 'Update email',
    'settings.updatingEmail': 'Updating email…',
    'settings.emailUpdated': 'Email updated',
    'settings.emailUpdatedDesc': 'Check your inbox to confirm the new email address.',
    'settings.emailUpdateFailed': 'Unable to update email',
    'settings.emailUpdateFailedDesc': 'Please verify your password and email details, then try again.',
    'settings.twoFactorTitle': 'Two-factor authentication',
    'settings.twoFactorDesc': 'Add an extra layer of security with a time-based one-time password (TOTP).',
    'settings.enableTwoFactor': 'Enable 2FA',
    'settings.twoFactorEnabling': 'Preparing…',
    'settings.twoFactorEnrolling': 'Finish setup in your authenticator',
    'settings.twoFactorEnrollingDesc': 'Scan the QR code or enter the secret below, then confirm with a 6-digit code.',
    'settings.twoFactorEnterCode': 'Enter the 6-digit code',
    'settings.twoFactorCodePlaceholder': '123456',
    'settings.twoFactorSecret': 'Secret',
    'settings.twoFactorScan': 'Scan this QR code with your authenticator app or enter the secret manually.',
    'settings.twoFactorQrAlt': 'Authentication QR code',
    'settings.confirmTwoFactor': 'Confirm & enable',
    'settings.twoFactorVerifying': 'Verifying…',
    'settings.twoFactorCancel': 'Cancel setup',
    'settings.twoFactorCanceling': 'Cancelling…',
    'settings.twoFactorCancelFailed': 'Unable to cancel setup',
    'settings.twoFactorCancelFailedDesc': 'Try starting the setup again.',
    'settings.twoFactorEnabled': 'Two-factor enabled',
    'settings.twoFactorEnabledDesc': 'TOTP authentication is now active for your account.',
    'settings.twoFactorEnabledHelper': 'Two-factor authentication is enabled. You will need your authenticator app to sign in.',
    'settings.disableTwoFactor': 'Disable 2FA',
    'settings.twoFactorDisabling': 'Disabling…',
    'settings.twoFactorDisabled': 'Two-factor disabled',
    'settings.twoFactorDisabledDesc': 'You can enable TOTP authentication again at any time.',
    'settings.twoFactorEnableFailed': 'Unable to start 2FA setup',
    'settings.twoFactorEnableFailedDesc': 'Please try again in a moment.',
    'settings.twoFactorVerifyFailed': 'Unable to verify code',
    'settings.twoFactorVerifyFailedDesc': 'Double-check the 6-digit code from your authenticator and try again.',
    'settings.twoFactorDisableFailed': 'Unable to disable 2FA',
    'settings.twoFactorDisableFailedDesc': 'Something went wrong while disabling two-factor authentication.',
    'settings.twoFactorLoadFailed': 'Unable to load 2FA status',
    'settings.twoFactorLoadFailedDesc': 'Refresh the page to try again.',
    'settings.twoFactorUnavailableTitle': 'Two-factor authentication is unavailable',
    'settings.twoFactorUnavailableDesc': 'Your workspace administrator needs to enable MFA in Supabase before you can set it up here.',

    // Theme
    'theme.light': 'Light',
    'theme.dark': 'Dark',
    'theme.system': 'System',
    
    // Language
    'language.english': 'English',
    'language.french': 'French',
    
    // Common
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
  },
  fr: {
    // Dashboard
    'dashboard.title': 'Tableau de bord',
    'dashboard.subtitle': 'Aperçu des performances de votre portefeuille',
    'dashboard.last24h': 'dernières 24h',
    'dashboard.investments': 'INVESTISSEMENTS',
    'dashboard.totalPL': 'TOTAL P/L',
    'dashboard.updating': 'Mise à jour...',
    'dashboard.refreshPrices': 'Actualiser les prix',
    'dashboard.newPortfolio': 'Nouveau Portfolio',
    'dashboard.portfolioAllocation': 'Allocation du Portfolio',
    'dashboard.topPositions': 'Toutes les positions',
    'dashboard.viewAll': 'Voir Tout',
    'dashboard.portfolioSummary': 'Résumé du Portfolio',
    'dashboard.positions': 'positions',
    'dashboard.noPortfolios': 'Aucun portefeuille trouvé',
    'dashboard.noPortfoliosDesc': 'Créez votre premier portefeuille pour commencer à suivre vos investissements',
    'dashboard.createPortfolio': 'Créer un Portfolio',
    
    // Settings
    'settings.title': 'Paramètres',
    'settings.subtitle': 'Gérez vos préférences de compte',
    'settings.baseCurrency': 'Devise de base',
    'settings.baseCurrencyDesc': 'Votre devise par défaut pour l\'évaluation du portefeuille',
    'settings.timezone': 'Fuseau horaire',
    'settings.timezoneDesc': 'Votre fuseau horaire local pour les dates et heures',
    'settings.lotMethod': 'Méthode de lot',
    'settings.lotMethodDesc': 'Méthode de calcul du coût de base pour la déclaration fiscale',
    'settings.theme': 'Thème',
    'settings.themeDesc': 'Sélectionnez votre thème préféré',
    'settings.language': 'Langue',
    'settings.languageDesc': 'Sélectionnez votre langue préférée',
    'settings.saveChanges': 'Enregistrer les modifications',
    'settings.saving': 'Enregistrement...',
    'settings.saved': 'Paramètres enregistrés avec succès',
    'settings.error': 'Échec de l\'enregistrement des paramètres',
    'settings.security': 'Sécurité',
    'settings.passwordDesc': 'Mettez à jour régulièrement votre mot de passe pour sécuriser vos investissements.',
    'settings.currentPassword': 'Mot de passe actuel',
    'settings.newPassword': 'Nouveau mot de passe',
    'settings.confirmPassword': 'Confirmez le nouveau mot de passe',
    'settings.passwordRequirements': 'Utilisez au moins 8 caractères, dont une majuscule et un chiffre.',
    'settings.updatePassword': 'Mettre à jour le mot de passe',
    'settings.updatingPassword': 'Mise à jour du mot de passe…',
    'settings.passwordUpdated': 'Mot de passe mis à jour',
    'settings.passwordUpdatedDesc': 'Votre mot de passe a été modifié avec succès.',
    'settings.passwordUpdateFailed': 'Impossible de mettre à jour le mot de passe',
    'settings.passwordUpdateFailedDesc': 'Vérifiez votre mot de passe actuel et réessayez.',
    'settings.currentPasswordIncorrect': 'Le mot de passe actuel est incorrect.',
    'settings.passwordSectionTitle': 'Mot de passe',
    'settings.emailSectionTitle': 'Adresse e-mail',
    'settings.emailDesc': 'Modifiez l’e-mail que vous utilisez pour vous connecter à votre compte.',
    'settings.newEmail': 'Nouvelle adresse e-mail',
    'settings.confirmEmail': 'Confirmez la nouvelle adresse e-mail',
    'settings.updateEmail': 'Mettre à jour l’e-mail',
    'settings.updatingEmail': 'Mise à jour de l’e-mail…',
    'settings.emailUpdated': 'E-mail mis à jour',
    'settings.emailUpdatedDesc': 'Vérifiez votre boîte de réception pour confirmer la nouvelle adresse.',
    'settings.emailUpdateFailed': 'Impossible de mettre à jour l’e-mail',
    'settings.emailUpdateFailedDesc': 'Vérifiez votre mot de passe et les informations saisies, puis réessayez.',
    'settings.twoFactorTitle': 'Authentification à deux facteurs',
    'settings.twoFactorDesc': 'Ajoutez une couche de sécurité supplémentaire avec un code TOTP.',
    'settings.enableTwoFactor': 'Activer l’A2F',
    'settings.twoFactorEnabling': 'Préparation…',
    'settings.twoFactorEnrolling': 'Finalisez la configuration dans votre application',
    'settings.twoFactorEnrollingDesc': 'Scannez le QR code ou saisissez le secret ci-dessous, puis confirmez avec un code à 6 chiffres.',
    'settings.twoFactorEnterCode': 'Entrez le code à 6 chiffres',
    'settings.twoFactorCodePlaceholder': '123456',
    'settings.twoFactorSecret': 'Secret',
    'settings.twoFactorScan': 'Scannez ce QR code avec votre application d’authentification ou saisissez le secret manuellement.',
    'settings.twoFactorQrAlt': 'QR code d’authentification',
    'settings.confirmTwoFactor': 'Confirmer et activer',
    'settings.twoFactorVerifying': 'Vérification…',
    'settings.twoFactorCancel': 'Annuler la configuration',
    'settings.twoFactorCanceling': 'Annulation…',
    'settings.twoFactorCancelFailed': 'Impossible d’annuler la configuration',
    'settings.twoFactorCancelFailedDesc': 'Réessayez de lancer la configuration.',
    'settings.twoFactorEnabled': 'Authentification à deux facteurs activée',
    'settings.twoFactorEnabledDesc': 'L’authentification TOTP est maintenant active pour votre compte.',
    'settings.twoFactorEnabledHelper': 'L’authentification à deux facteurs est activée. Vous aurez besoin de votre application pour vous connecter.',
    'settings.disableTwoFactor': 'Désactiver l’A2F',
    'settings.twoFactorDisabling': 'Désactivation…',
    'settings.twoFactorDisabled': 'Authentification à deux facteurs désactivée',
    'settings.twoFactorDisabledDesc': 'Vous pouvez réactiver l’authentification TOTP à tout moment.',
    'settings.twoFactorEnableFailed': 'Impossible de démarrer la configuration A2F',
    'settings.twoFactorEnableFailedDesc': 'Réessayez dans un instant.',
    'settings.twoFactorVerifyFailed': 'Impossible de vérifier le code',
    'settings.twoFactorVerifyFailedDesc': 'Vérifiez le code à 6 chiffres de votre application d’authentification puis réessayez.',
    'settings.twoFactorDisableFailed': 'Impossible de désactiver l’A2F',
    'settings.twoFactorDisableFailedDesc': 'Une erreur est survenue lors de la désactivation de l’authentification à deux facteurs.',
    'settings.twoFactorLoadFailed': 'Impossible de charger l’état de l’A2F',
    'settings.twoFactorLoadFailedDesc': 'Actualisez la page pour réessayer.',
    'settings.twoFactorUnavailableTitle': 'L’authentification à deux facteurs est indisponible',
    'settings.twoFactorUnavailableDesc': 'L’administrateur doit activer la MFA dans Supabase avant que vous puissiez la configurer ici.',

    // Theme
    'theme.light': 'Clair',
    'theme.dark': 'Sombre',
    'theme.system': 'Système',
    
    // Language
    'language.english': 'Anglais',
    'language.french': 'Français',
    
    // Common
    'common.loading': 'Chargement...',
    'common.error': 'Erreur',
    'common.success': 'Succès',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem('language');
    return (stored === 'en' || stored === 'fr') ? stored : 'en';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations['en']] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
