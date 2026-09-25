export interface ReminderPreferences { days: number[]; time: string; quietStart: string; quietEnd: string; timezone: string; locale: string; courses: string[]; weekly: boolean; pauseUntil: number; skipDay: string }
export const DAY: number;
export const LANGS: string[];
export const COURSES: string[];
export function localParts(at: number, timezone: string): {day: string; time: string};
export function validTimezone(zone: unknown): boolean;
export function addDays(day: string, n: number): string;
export function weekday(day: string): number;
export function weekStart(day: string): string;
export function quietAt(time: string, start: string, end: string): boolean;
export function preferences(raw: unknown): ReminderPreferences;
export function wallTimes(day: string, time: string, timezone: string): number[];
export function nextSlot(p: ReminderPreferences, after: number): number | null;
export function delivery(state: any, now: number): 'weekly' | 'review' | 'practice' | null;
