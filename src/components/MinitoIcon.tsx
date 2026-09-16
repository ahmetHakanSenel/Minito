import React from 'react';
import { MinitoMark } from './brand/MinitoMark';

interface MinitoIconProps {
  size?: number;
  /** Omit for the brand gradient; pass a colour only for monochrome surfaces. */
  color?: string;
}

/** The brand mark at a given size. Kept under this name for existing call sites. */
export const MinitoIcon: React.FC<MinitoIconProps> = ({ size = 80, color }) => {
  return <MinitoMark size={size} color={color} />;
};
