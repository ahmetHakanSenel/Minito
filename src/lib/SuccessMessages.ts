/**
 * Success Messages Pool
 *
 * Dynamic, variable rewards for ADHD engagement.
 * The app randomly selects a title from this pool to create "Novelty".
 *
 * Each message has English and Turkish versions, plus a Lucide icon and color.
 */

export interface SuccessMessage {
  en: string;
  tr: string;
  icon: string; // Lucide icon name
  color: string; // Hex color for icon glow
}

export const SUCCESS_MESSAGES: SuccessMessage[] = [
  {
    en: 'YOU OWN YOUR BRAIN!',
    tr: 'BEYNİNİN PATRONU SENSİN!',
    icon: 'BrainCircuit',
    color: '#8B5CF6', // Primary
  },
  {
    en: 'TASK VAPORIZED!',
    tr: 'GÖREV BUHARLAŞTI!',
    icon: 'Wind',
    color: '#34D399', // Success
  },
  {
    en: 'CHAOS: 0 — YOU: 1',
    tr: 'KAOS: 0 — SEN: 1',
    icon: 'Trophy',
    color: '#F59E0B', // Amber
  },
  {
    en: 'DOPAMINE SHOWER!',
    tr: 'DOPAMİN ŞELALESİ!',
    icon: 'Zap',
    color: '#EAB308', // Yellow
  },
  {
    en: 'WHO CAN STOP YOU?',
    tr: 'KİM TUTABİLİR SENİ?',
    icon: 'Rocket',
    color: '#EF4444', // Red
  },
  {
    en: 'JUST LIKE THAT!',
    tr: 'BU İŞ BU KADAR!',
    icon: 'Sparkles',
    color: '#EC4899', // Pink
  },
  {
    en: 'LEGENDARY FLOW!',
    tr: 'EFSANEVİ PERFORMANS!',
    icon: 'Music',
    color: '#6366F1', // Indigo
  },
  {
    en: 'MONSTER SLAIN!',
    tr: 'BİR CANAVAR DAHA GİTTİ!',
    icon: 'Ghost',
    color: '#10B981', // Emerald
  },
  {
    en: 'FOCUS MASTER!',
    tr: 'ODAKLANMA USTASI!',
    icon: 'Target',
    color: '#3B82F6', // Blue
  },
  {
    en: 'NOTHING IS IMPOSSIBLE!',
    tr: 'HİÇBİR ŞEY İMKANSIZ DEĞİL!',
    icon: 'Crown',
    color: '#A855F7', // Purple
  },
];

/**
 * Get a random success message based on the current language
 * @param language - Current language code ('en' or 'tr')
 * @returns Random success message object with text, icon, and color
 */
export function getRandomSuccessMessage(language: 'en' | 'tr' = 'en'): SuccessMessage {
  const randomIndex = Math.floor(Math.random() * SUCCESS_MESSAGES.length);
  return SUCCESS_MESSAGES[randomIndex];
}
