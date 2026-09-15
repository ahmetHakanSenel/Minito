import React from 'react';
import { Sparkles } from 'lucide-react-native';

interface MinitoIconProps {
  size?: number;
  color?: string;
}

/**
 * MinitoIcon - Magic/Action icon
 * Uses Sparkles from Lucide to symbolize the "magic" of breaking down tasks
 */
export const MinitoIcon: React.FC<MinitoIconProps> = ({ size = 80, color = '#8B5CF6' }) => {
  return <Sparkles size={size} color={color} strokeWidth={2.5} />;
};
