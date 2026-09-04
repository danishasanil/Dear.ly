// Lightweight, gentle client-side reminder utility
// Strictly non-manipulative, no external spam infrastructure, zero emotional dependency

import { ReminderFrequency, ReminderTone, CustomReminder, DearlySuggestionsConfig } from '../types';

export interface DearlySuggestionMessage {
  id: string;
  category: 'daily' | 'inactivity' | 'moments' | 'mindfulness';
  title: string;
  body: string;
}

export const DEARLY_SUGGESTIONS: DearlySuggestionMessage[] = [
  {
    id: 'sug-today-memory',
    category: 'daily',
    title: 'Dear.ly Journal',
    body: "You haven't written anything today. Want to save a little memory? 💗",
  },
  {
    id: 'sug-tulip-moment',
    category: 'daily',
    title: 'Dear.ly Journal',
    body: '🌷 Your journal has a little moment waiting for you.',
  },
  {
    id: 'sug-few-days',
    category: 'inactivity',
    title: 'Dear.ly Journal',
    body: "It's been a few days since your last journal entry. Want to check in?",
  },
  {
    id: 'sug-whenever-feel',
    category: 'daily',
    title: 'Dear.ly Journal',
    body: "Haven't written today? That's okay. Your journal is here whenever you feel like it.",
  },
  {
    id: 'sug-moment-story',
    category: 'moments',
    title: 'Dear.ly Journal',
    body: 'You captured a moment recently — want to add a little story to it?',
  },
  {
    id: 'sug-quiet-pause',
    category: 'mindfulness',
    title: 'Dear.ly Journal',
    body: "✨ A quiet pause for your thoughts whenever you're ready.",
  },
  {
    id: 'sug-gentle-breath',
    category: 'mindfulness',
    title: 'Dear.ly Journal',
    body: "☕ Take a gentle breath. Dear.ly is here if you'd like to reflect.",
  },
  {
    id: 'sug-soft-space',
    category: 'mindfulness',
    title: 'Dear.ly Journal',
    body: '🌿 No pressure or rush — just a soft space for whatever is on your mind.',
  },
];

export const REMINDER_PRESET_IDEAS: { text: string; tone: ReminderTone; time: string; frequency: ReminderFrequency }[] = [
  { text: 'Write about how your day went 💗', tone: 'warm', time: '20:30', frequency: 'daily' },
  { text: "Remember to save today's little moment.", tone: 'gentle', time: '18:00', frequency: 'daily' },
  { text: 'Drink some water and take a break.', tone: 'soft', time: '14:00', frequency: 'weekdays' },
  { text: "Before bed, tell Dear.ly about your day.", tone: 'gentle', time: '21:30', frequency: 'daily' },
  { text: "Note one small thing you're grateful for today.", tone: 'motivating', time: '09:00', frequency: 'daily' },
  { text: 'How is your morning feeling so far?', tone: 'casual', time: '08:30', frequency: 'weekdays' },
];

export const TONE_CONFIG: Record<
  ReminderTone,
  { label: string; description: string; badgeClass: string }
> = {
  gentle: { label: 'Gentle', description: 'Patient & comforting', badgeClass: 'bg-[#EBF1ED] text-[#4D6D5C] border-[#CDE0D7]' },
  warm: { label: 'Warm', description: 'Affectionate & encouraging', badgeClass: 'bg-[#FBF2E9] text-[#9C6D3B] border-[#F5DECA]' },
  playful: { label: 'Playful', description: 'Lighthearted & joyful', badgeClass: 'bg-[#FDF6E8] text-[#A07828] border-[#F8E7BE]' },
  soft: { label: 'Soft', description: 'Quiet & unhurried', badgeClass: 'bg-[#F5EEEE] text-[#8E5B5B] border-[#E6CECE]' },
  motivating: { label: 'Motivating', description: 'Uplifting & inspiring', badgeClass: 'bg-[#EFF4F2] text-[#2C5240] border-[#B8D7C8]' },
  casual: { label: 'Casual', description: 'Simple & friendly', badgeClass: 'bg-[#F4EFEA] text-[#736E65] border-[#EAE3DA]' },
  custom: { label: 'Custom Tone', description: 'Described in your own words', badgeClass: 'bg-[#EDEBF4] text-[#5E527F] border-[#D9D3E6]' },
};

export const FREQUENCY_LABELS: Record<ReminderFrequency, string> = {
  once: 'Once',
  daily: 'Every day',
  weekly: 'Weekly',
  weekdays: 'Weekdays (Mon–Fri)',
  weekends: 'Weekends (Sat–Sun)',
  custom: 'Custom days',
};

// Get a gentle suggestion message based on tone or random pick
export function getGentleReminder(tone?: string): DearlySuggestionMessage {
  if (tone === 'warm') {
    return DEARLY_SUGGESTIONS[0];
  }
  if (tone === 'gentle') {
    return DEARLY_SUGGESTIONS[1];
  }
  if (tone === 'soft') {
    return DEARLY_SUGGESTIONS[7];
  }
  return DEARLY_SUGGESTIONS[3];
}

// Check if browser notifications are supported
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

// Get current browser notification permission
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

// Request permission with zero pressure
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    const perm = await Notification.requestPermission();
    return perm;
  } catch (err) {
    console.warn('Could not request notification permission:', err);
    return 'denied';
  }
}

// Send a single gentle web notification
export function sendGentleNotification(
  customMessage?: string,
  title: string = 'Dear.ly Journal'
): boolean {
  if (!isNotificationSupported()) return false;
  if (Notification.permission !== 'granted') return false;

  try {
    const bodyText = customMessage || DEARLY_SUGGESTIONS[0].body;

    const notif = new Notification(title, {
      body: bodyText,
      icon: '/icon.png',
      badge: '/icon.png',
      silent: false,
    });

    notif.onclick = () => {
      window.focus();
      notif.close();
    };

    return true;
  } catch (err) {
    console.warn('Error sending gentle notification:', err);
    return false;
  }
}

// Format 24h time to friendly readable string
export function formatTimeDisplay(timeStr?: string): string {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return timeStr;

  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
  return `${displayHours}:${displayMinutes} ${ampm}`;
}
