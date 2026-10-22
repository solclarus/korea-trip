import { Bus, CarTaxiFront, Footprints, Plane, TrainFront, TrainFrontTunnel, type LucideIcon } from 'lucide-react';
import type { MoveMode } from '@/types';

/** 移動手段のアイコン（Lucide） */
export const MODE_ICON: Record<MoveMode, LucideIcon> = {
  flight: Plane,
  train: TrainFront,
  subway: TrainFrontTunnel,
  bus: Bus,
  taxi: CarTaxiFront,
  walk: Footprints,
};
