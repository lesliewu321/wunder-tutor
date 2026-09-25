import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ReminderPreferences } from '../../notifications/policy.mjs';
import { deviceTimezone } from './model';
export interface ReminderState {
  enabled: boolean; offered: boolean; device: string; followTimezone: boolean; prefs: ReminderPreferences;
  set: (patch: Partial<Omit<ReminderState, 'set'>>) => void;
}
export const useReminders = create<ReminderState>()(persist(set => ({
  enabled: false, offered: false, device: '', followTimezone: true,
  prefs: { days: [1, 3, 5], time: '18:00', quietStart: '20:00', quietEnd: '08:00', timezone: deviceTimezone(), locale: 'en', courses: ['en', 'zh', 'yue', 'ja', 'ko', 'fr', 'es'], weekly: false, pauseUntil: 0, skipDay: '' },
  set: patch => set(patch),
}), { name: 'wunder-tutor/reminders/v1' }));
export function reminderDevice(): string {
  let device = useReminders.getState().device;
  if (!device) { device = crypto.randomUUID(); useReminders.getState().set({ device }); }
  return device;
}
