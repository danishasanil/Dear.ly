export type NavigationTab = 'home' | 'journal' | 'calendar' | 'moments' | 'song' | 'talk' | 'settings';

export type MoodType = 'peaceful' | 'grateful' | 'thoughtful' | 'energetic' | 'overwhelmed' | 'gentle';

export type MusicPlatform = 'youtube';

export interface SongOfTheDay {
  id: string;
  userId: string;
  songTitle: string;
  platform: 'youtube' | string;
  source?: string;
  externalUrl: string;
  canonicalUrl?: string;
  youtubeVideoId?: string;
  artworkUrl?: string;
  embedUrl?: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
}

export interface Moment {
  id: string;
  userId: string;
  text?: string;
  imageUrl?: string;
  videoUrl?: string;
  mediaType?: 'photo' | 'video';
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt: string;
  lastLoginAt: string;
}

export interface JournalEntry {
  id: string;
  title: string;
  content: string;
  mood: MoodType | string;
  geminiReflection?: string;
  songOfTheDay?: SongOfTheDay;
  createdAt: string;
  updatedAt?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  status?: 'sending' | 'sent' | 'error';
  mode?: 'text' | 'voice';
  voiceGender?: 'female' | 'male';
  voiceName?: string;
}

export interface ConversationSession {
  id: string;
  title: string;
  mode: 'text' | 'voice';
  voiceGender?: 'female' | 'male';
  lastMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export type ReminderFrequency = 'once' | 'daily' | 'weekly' | 'weekdays' | 'weekends' | 'custom';

export type ReminderTone = 'gentle' | 'warm' | 'playful' | 'soft' | 'motivating' | 'casual' | 'custom';

export interface CustomReminder {
  id: string;
  userId: string;
  text: string;
  time: string; // e.g. "20:30" (24hr format)
  frequency: ReminderFrequency;
  customDays?: string[]; // e.g. ['Mon', 'Wed', 'Fri']
  tone: ReminderTone;
  customToneText?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface DearlySuggestionsConfig {
  enabled: boolean;
  frequency: 'daily' | 'few_days' | 'weekly';
  preferredTimeOfDay: 'morning' | 'afternoon' | 'evening';
  includeMomentsPrompt: boolean;
  includeInactivityPrompt: boolean;
}

export interface UserPreferences {
  voiceGender: 'female' | 'male';
  voiceName: string;
  theme: 'pastel-warm' | 'pastel-cool' | 'pastel-lavender';
  dailyReminderEnabled?: boolean;
  dearlySuggestions?: DearlySuggestionsConfig;
  reminderTimeOfDay?: 'morning' | 'afternoon' | 'evening';
  reminderTone?: 'gentle' | 'poetic' | 'reflective';
  preferredTime?: string;
}
