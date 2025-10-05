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
    'dashboard.topPositions': 'Top Positions',
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
    'dashboard.topPositions': 'Principales Positions',
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
