import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
} from 'firebase/firestore';
import { db, sanitizePayload } from '../lib/firebase';
import {
  Shield,
  Volume2,
  LogOut,
  Check,
  Sparkles,
  HeartHandshake,
  Lock,
  UserPlus,
  RefreshCw,
  AlertCircle,
  Bell,
  BellOff,
  Clock,
  Send,
  Info,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  Play,
  Pause,
  X,
  Smile,
} from 'lucide-react';
import {
  UserPreferences,
  CustomReminder,
  ReminderFrequency,
  ReminderTone,
  DearlySuggestionsConfig,
} from '../types';
import {
  getNotificationPermission,
  requestNotificationPermission,
  sendGentleNotification,
  TONE_CONFIG,
  FREQUENCY_LABELS,
  REMINDER_PRESET_IDEAS,
  DEARLY_SUGGESTIONS,
  formatTimeDisplay,
} from '../lib/reminders';

const DAYS_OF_WEEK = [
  { id: 'Mon', label: 'M' },
  { id: 'Tue', label: 'T' },
  { id: 'Wed', label: 'W' },
  { id: 'Thu', label: 'T' },
  { id: 'Fri', label: 'F' },
  { id: 'Sat', label: 'S' },
  { id: 'Sun', label: 'S' },
];

export const SettingsView: React.FC = () => {
  const { user, profile, signOutUser, switchAccount, error: authError } = useAuth();

  // User Preferences
  const [preferences, setPreferences] = useState<UserPreferences>({
    voiceGender: 'female',
    voiceName: 'Aoede',
    theme: 'pastel-warm',
    dailyReminderEnabled: false,
    reminderTimeOfDay: 'evening',
    reminderTone: 'gentle',
    dearlySuggestions: {
      enabled: false,
      frequency: 'daily',
      preferredTimeOfDay: 'evening',
      includeMomentsPrompt: true,
      includeInactivityPrompt: true,
    },
  });

  // Custom Reminders State
  const [customReminders, setCustomReminders] = useState<CustomReminder[]>([]);
  const [loadingReminders, setLoadingReminders] = useState<boolean>(true);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);

  // Reminder Form State
  const [formText, setFormText] = useState<string>('');
  const [formTime, setFormTime] = useState<string>('20:30');
  const [formFrequency, setFormFrequency] = useState<ReminderFrequency>('daily');
  const [formCustomDays, setFormCustomDays] = useState<string[]>(['Mon', 'Wed', 'Fri']);
  const [formTone, setFormTone] = useState<ReminderTone>('warm');
  const [formCustomToneText, setFormCustomToneText] = useState<string>('');
  const [formSaving, setFormSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // General Settings State
  const [savingPref, setSavingPref] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [switching, setSwitching] = useState<boolean>(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState<boolean>(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [testSent, setTestSent] = useState<string | null>(null);
  const [notifPermission, setNotifPermission] = useState<string>('default');

  // Check notification permission on mount
  useEffect(() => {
    setNotifPermission(getNotificationPermission());
  }, []);

  // Fetch user preferences
  useEffect(() => {
    // Reset default preferences on user change
    setPreferences({
      voiceGender: 'female',
      voiceName: 'Aoede',
      theme: 'pastel-warm',
      dailyReminderEnabled: false,
      reminderTimeOfDay: 'evening',
      reminderTone: 'gentle',
      dearlySuggestions: {
        enabled: false,
        frequency: 'daily',
        preferredTimeOfDay: 'evening',
        includeMomentsPrompt: true,
        includeInactivityPrompt: true,
      },
    });
    setSavedSuccess(false);
    setSettingsError(null);

    if (!user) return;
    const loadPreferences = async () => {
      try {
        const prefRef = doc(db, 'users', user.uid, 'settings', 'preferences');
        const snap = await getDoc(prefRef);
        if (snap.exists()) {
          const data = snap.data() as Partial<UserPreferences>;
          setPreferences((prev) => ({
            ...prev,
            ...data,
            dearlySuggestions: data.dearlySuggestions || {
              enabled: data.dailyReminderEnabled ?? false,
              frequency: 'daily',
              preferredTimeOfDay: data.reminderTimeOfDay || 'evening',
              includeMomentsPrompt: true,
              includeInactivityPrompt: true,
            },
          }));
        }
      } catch (err) {
        console.error('Error loading preferences:', err);
      }
    };

    loadPreferences();
  }, [user]);

  // Real-time listener for user's custom reminders
  useEffect(() => {
    // Immediately reset previous custom reminders
    setCustomReminders([]);
    setIsFormOpen(false);
    setEditingReminderId(null);
    setFormText('');
    setFormError(null);

    if (!user) {
      setLoadingReminders(false);
      return;
    }

    setLoadingReminders(true);

    const remindersRef = collection(db, 'users', user.uid, 'reminders');
    const q = query(remindersRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: CustomReminder[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            userId: data.userId || user.uid,
            text: data.text || '',
            time: data.time || '20:00',
            frequency: (data.frequency as ReminderFrequency) || 'daily',
            customDays: data.customDays || [],
            tone: (data.tone as ReminderTone) || 'gentle',
            customToneText: data.customToneText || '',
            enabled: data.enabled ?? true,
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt,
          };
        });
        setCustomReminders(list);
        setLoadingReminders(false);
      },
      (err) => {
        console.error('Error listening to reminders:', err);
        setLoadingReminders(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Save general preferences to Firestore
  const savePreferences = async (updated: UserPreferences) => {
    if (!user) return;
    setSavingPref(true);
    setSavedSuccess(false);
    setSettingsError(null);

    try {
      const prefRef = doc(db, 'users', user.uid, 'settings', 'preferences');
      await setDoc(prefRef, sanitizePayload(updated), { merge: true });
      setPreferences(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (err: any) {
      console.error('Error saving preferences:', err);
      setSettingsError('Could not save preference right now.');
    } finally {
      setSavingPref(false);
    }
  };

  const handleVoiceChange = async (gender: 'female' | 'male') => {
    const updated: UserPreferences = {
      ...preferences,
      voiceGender: gender,
      voiceName: gender === 'female' ? 'Aoede' : 'Puck',
    };
    await savePreferences(updated);
  };

  // Toggle Dear.ly Suggestions (Category B)
  const handleToggleDearlySuggestions = async () => {
    const currentEnabled = preferences.dearlySuggestions?.enabled ?? preferences.dailyReminderEnabled ?? false;
    const willEnable = !currentEnabled;

    if (willEnable) {
      const perm = await requestNotificationPermission();
      setNotifPermission(perm);
    }

    const currentConfig: DearlySuggestionsConfig = preferences.dearlySuggestions || {
      enabled: false,
      frequency: 'daily',
      preferredTimeOfDay: preferences.reminderTimeOfDay || 'evening',
      includeMomentsPrompt: true,
      includeInactivityPrompt: true,
    };

    const updated: UserPreferences = {
      ...preferences,
      dailyReminderEnabled: willEnable,
      dearlySuggestions: {
        ...currentConfig,
        enabled: willEnable,
      },
    };
    await savePreferences(updated);
  };

  // Update Dear.ly Suggestions frequency or timing
  const handleUpdateSuggestionsConfig = async (
    key: keyof DearlySuggestionsConfig,
    value: any
  ) => {
    const currentConfig: DearlySuggestionsConfig = preferences.dearlySuggestions || {
      enabled: false,
      frequency: 'daily',
      preferredTimeOfDay: preferences.reminderTimeOfDay || 'evening',
      includeMomentsPrompt: true,
      includeInactivityPrompt: true,
    };

    const updated: UserPreferences = {
      ...preferences,
      dearlySuggestions: {
        ...currentConfig,
        [key]: value,
      },
    };
    await savePreferences(updated);
  };

  // Open creation form
  const handleOpenCreateForm = () => {
    setEditingReminderId(null);
    setFormText('');
    setFormTime('20:30');
    setFormFrequency('daily');
    setFormCustomDays(['Mon', 'Wed', 'Fri']);
    setFormTone('warm');
    setFormCustomToneText('');
    setFormError(null);
    setIsFormOpen(true);
  };

  // Open edit form for existing reminder
  const handleOpenEditForm = (rem: CustomReminder) => {
    setEditingReminderId(rem.id);
    setFormText(rem.text);
    setFormTime(rem.time || '20:30');
    setFormFrequency(rem.frequency || 'daily');
    setFormCustomDays(rem.customDays && rem.customDays.length > 0 ? rem.customDays : ['Mon', 'Wed', 'Fri']);
    setFormTone(rem.tone || 'gentle');
    setFormCustomToneText(rem.customToneText || '');
    setFormError(null);
    setIsFormOpen(true);
  };

  // Close form
  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingReminderId(null);
    setFormError(null);
  };

  // Save custom reminder (Create or Update)
  const handleSaveCustomReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!formText.trim()) {
      setFormError('Please enter what you would like to be reminded about.');
      return;
    }

    setFormSaving(true);
    setFormError(null);

    // Request notification permission if not yet requested
    if (notifPermission === 'default') {
      const perm = await requestNotificationPermission();
      setNotifPermission(perm);
    }

    try {
      const id = editingReminderId || `rem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const reminderDocRef = doc(db, 'users', user.uid, 'reminders', id);

      const payload: Partial<CustomReminder> = {
        userId: user.uid,
        text: formText.trim(),
        time: formTime,
        frequency: formFrequency,
        customDays: formFrequency === 'custom' ? formCustomDays : [],
        tone: formTone,
        customToneText: formTone === 'custom' ? formCustomToneText.trim() : '',
        enabled: true,
        updatedAt: new Date().toISOString(),
      };

      if (!editingReminderId) {
        payload.createdAt = new Date().toISOString();
      }

      await setDoc(reminderDocRef, sanitizePayload(payload), { merge: true });
      setIsFormOpen(false);
      setEditingReminderId(null);
    } catch (err: any) {
      console.error('Error saving custom reminder:', err);
      setFormError('Could not save your reminder. Please try again.');
    } finally {
      setFormSaving(false);
    }
  };

  // Toggle active/pause for custom reminder
  const handleToggleReminderEnabled = async (rem: CustomReminder) => {
    if (!user) return;
    try {
      const reminderDocRef = doc(db, 'users', user.uid, 'reminders', rem.id);
      await setDoc(reminderDocRef, { enabled: !rem.enabled, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (err) {
      console.error('Error toggling reminder status:', err);
    }
  };

  // Delete custom reminder
  const handleDeleteCustomReminder = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'reminders', id));
    } catch (err) {
      console.error('Error deleting reminder:', err);
    }
  };

  // Send a test notification for a reminder
  const handleSendTestNotification = (text: string, title: string = 'Dear.ly Reminder') => {
    const sent = sendGentleNotification(text, title);
    setTestSent(text);
    setTimeout(() => setTestSent(null), 3000);
  };

  // Toggle custom day in form
  const handleToggleCustomDay = (dayId: string) => {
    if (formCustomDays.includes(dayId)) {
      if (formCustomDays.length > 1) {
        setFormCustomDays(formCustomDays.filter((d) => d !== dayId));
      }
    } else {
      setFormCustomDays([...formCustomDays, dayId]);
    }
  };

  const handleSwitchAccount = async () => {
    setSwitching(true);
    setSettingsError(null);
    try {
      await switchAccount();
    } catch (err: any) {
      console.error('Failed to switch account:', err);
      setSettingsError(err.message || 'Unable to switch Google account.');
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8 pb-24 md:pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-medium text-[#2D2A26] tracking-tight">
          Settings & Profile
        </h1>
        <p className="text-xs sm:text-sm text-[#736E65] mt-1">
          Manage your account preferences, companion voice, and gentle reminders.
        </p>
      </div>

      {(settingsError || authError) && (
        <div className="p-3.5 rounded-2xl bg-[#FDF0ED] border border-[#F5C7C1] text-[#A64438] text-xs flex items-center gap-2">
          <AlertCircle size={14} className="shrink-0" />
          <span>{settingsError || authError}</span>
        </div>
      )}

      {/* Account Info Card */}
      <section className="bg-white rounded-3xl p-6 sm:p-7 border border-[#EAE3DA] shadow-xs space-y-5">
        <h2 className="text-xs font-semibold text-[#555047] uppercase tracking-wider">
          Account Profile
        </h2>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="Avatar"
                className="w-14 h-14 rounded-full object-cover border-2 border-[#EAE3DA] shadow-xs"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-[#EBF1ED] text-[#4D6D5C] text-lg font-display font-semibold flex items-center justify-center">
                {profile?.displayName?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}

            <div className="space-y-0.5">
              <h3 className="font-display font-medium text-base text-[#2D2A26]">
                {profile?.displayName || user?.displayName || 'Dear.ly Journaler'}
              </h3>
              <p className="text-xs text-[#736E65]">{user?.email || 'Authenticated with Google'}</p>
              <p className="text-[11px] text-[#A69F94]">
                Member since {new Date(profile?.createdAt || Date.now()).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>

          <button
            id="settings-switch-account-btn"
            disabled={switching}
            onClick={handleSwitchAccount}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#FAF7F2] hover:bg-[#F4EFEA] text-[#2D2A26] border border-[#EAE3DA] text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
          >
            {switching ? <RefreshCw size={13} className="animate-spin" /> : <UserPlus size={13} />}
            <span>Switch / Add Account</span>
          </button>
        </div>
      </section>

      {/* Companion Voice Selection */}
      <section className="bg-white rounded-3xl p-6 sm:p-7 border border-[#EAE3DA] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold text-[#555047] uppercase tracking-wider flex items-center gap-1.5">
              <Volume2 size={14} className="text-[#6B8E7D]" />
              <span>Companion Voice Persona</span>
            </h2>
            <p className="text-xs text-[#736E65] mt-0.5">
              Select the voice tone for your conversational interactions.
            </p>
          </div>

          {savedSuccess && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4D6D5C] bg-[#EFF4F2] px-2.5 py-0.5 rounded-full">
              <Check size={12} />
              Saved
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            id="voice-female-btn"
            disabled={savingPref}
            onClick={() => handleVoiceChange('female')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              preferences.voiceGender === 'female'
                ? 'bg-[#FDF0ED] border-[#F5CAC3] text-[#A65448] shadow-2xs ring-1 ring-[#D98880]'
                : 'bg-[#FAF7F2] border-[#EAE3DA] text-[#736E65] hover:bg-[#F4EFEA]'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold">Female Voice</span>
              {preferences.voiceGender === 'female' && <Check size={14} className="text-[#D98880]" />}
            </div>
            <p className="text-[11px] opacity-80 leading-relaxed">
              Warm, gentle, and reflective cadence (Aoede).
            </p>
          </button>

          <button
            id="voice-male-btn"
            disabled={savingPref}
            onClick={() => handleVoiceChange('male')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              preferences.voiceGender === 'male'
                ? 'bg-[#EFF4F2] border-[#D1E0D8] text-[#4D6D5C] shadow-2xs ring-1 ring-[#6B8E7D]'
                : 'bg-[#FAF7F2] border-[#EAE3DA] text-[#736E65] hover:bg-[#F4EFEA]'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold">Male Voice</span>
              {preferences.voiceGender === 'male' && <Check size={14} className="text-[#6B8E7D]" />}
            </div>
            <p className="text-[11px] opacity-80 leading-relaxed">
              Calm, grounded, and reassuring tone (Puck).
            </p>
          </button>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* REMINDERS & GENTLE PROMPTS SYSTEM                                         */}
      {/* ========================================================================= */}

      {/* Main Reminders Container */}
      <div className="space-y-6">
        {/* Section Header & Philosophy Notice */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-[#555047] uppercase tracking-wider flex items-center gap-1.5">
              <Bell size={14} className="text-[#6B8E7D]" />
              <span>Reminders & Gentle Prompts</span>
            </h2>
          </div>
          <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#EAE3DA] flex items-center gap-2.5 text-xs text-[#736E65]">
            <Shield size={14} className="text-[#6B8E7D] shrink-0" />
            <span>Optional low-pressure reminders. No urgency, manipulation, or spam.</span>
          </div>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* CATEGORY A: MY REMINDERS (User-created and controlled)                   */}
        {/* ----------------------------------------------------------------------- */}
        <section className="bg-white rounded-3xl p-6 sm:p-7 border border-[#EAE3DA] shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#F4EFEA]">
            <div>
              <h3 className="text-sm font-semibold text-[#2D2A26] flex items-center gap-1.5">
                <Calendar size={15} className="text-[#6B8E7D]" />
                <span>My Reminders</span>
              </h3>
              <p className="text-xs text-[#736E65] mt-0.5">
                Reminders you create and control.
              </p>
            </div>

            {!isFormOpen && (
              <button
                id="create-reminder-btn"
                type="button"
                onClick={handleOpenCreateForm}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2D2A26] hover:bg-[#1A1816] text-[#FAF7F2] text-xs font-medium transition-all cursor-pointer shadow-2xs self-start sm:self-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8E7D] active:scale-[0.98]"
              >
                <Plus size={14} />
                <span>Create Reminder</span>
              </button>
            )}
          </div>

          {/* Creation / Edit Form (Expandable) */}
          {isFormOpen && (
            <form
              onSubmit={handleSaveCustomReminder}
              className="p-5 rounded-2xl bg-[#FAF7F2] border border-[#EAE3DA] space-y-4 animate-in fade-in"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#2D2A26] flex items-center gap-1.5">
                  <Sparkles size={13} className="text-[#6B8E7D]" />
                  <span>{editingReminderId ? 'Edit Reminder' : 'Create a New Reminder'}</span>
                </span>
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="p-1 rounded-lg text-[#8C867D] hover:text-[#2D2A26] hover:bg-white transition-colors cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {formError && (
                <div className="p-2.5 rounded-xl bg-[#FDF0ED] border border-[#F5C7C1] text-xs text-[#A64438] flex items-center gap-2">
                  <AlertCircle size={13} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Reminder Text */}
              <div>
                <label className="text-xs font-medium text-[#2D2A26] block mb-1.5">
                  What would you like to be reminded about?
                </label>
                <textarea
                  id="custom-reminder-text-input"
                  rows={2}
                  value={formText}
                  onChange={(e) => setFormText(e.target.value)}
                  placeholder="e.g. Write about how your day went 💗"
                  className="w-full bg-white border border-[#EAE3DA] rounded-xl p-3 text-xs sm:text-sm text-[#2D2A26] placeholder-[#8C867D] focus:outline-none focus:border-[#6B8E7D] transition-colors resize-none"
                />

                {/* Quick Inspiration Presets */}
                <div className="pt-2">
                  <span className="text-[10px] uppercase font-semibold text-[#8C867D] tracking-wider block mb-1.5">
                    Ideas & Inspiration:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {REMINDER_PRESET_IDEAS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setFormText(preset.text);
                          setFormTone(preset.tone);
                          setFormTime(preset.time);
                          setFormFrequency(preset.frequency);
                        }}
                        className="text-[11px] px-2.5 py-1 rounded-full bg-white hover:bg-[#EBF1ED] border border-[#EAE3DA] hover:border-[#CDE0D7] text-[#555047] transition-all cursor-pointer"
                      >
                        {preset.text}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Time of Day (ANY time picker) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs font-medium text-[#2D2A26] block mb-1.5 flex items-center gap-1.5">
                    <Clock size={13} className="text-[#6B8E7D]" />
                    <span>Time of Day</span>
                  </label>
                  <input
                    id="custom-reminder-time-input"
                    type="time"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full bg-white border border-[#EAE3DA] rounded-xl p-2.5 text-xs text-[#2D2A26] focus:outline-none focus:border-[#6B8E7D] transition-colors"
                  />
                  <span className="text-[10px] text-[#8C867D] mt-1 block">
                    Select any time that fits your day ({formatTimeDisplay(formTime)})
                  </span>
                </div>

                {/* Repeat Frequency */}
                <div>
                  <label className="text-xs font-medium text-[#2D2A26] block mb-1.5 flex items-center gap-1.5">
                    <Calendar size={13} className="text-[#6B8E7D]" />
                    <span>Repeat Schedule</span>
                  </label>
                  <select
                    id="custom-reminder-frequency-select"
                    value={formFrequency}
                    onChange={(e) => setFormFrequency(e.target.value as ReminderFrequency)}
                    className="w-full bg-white border border-[#EAE3DA] rounded-xl p-2.5 text-xs text-[#2D2A26] focus:outline-none focus:border-[#6B8E7D] transition-colors cursor-pointer"
                  >
                    <option value="once">Once</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="weekdays">Weekdays (Mon–Fri)</option>
                    <option value="weekends">Weekends (Sat–Sun)</option>
                    <option value="custom">Custom Days</option>
                  </select>
                </div>
              </div>

              {/* Custom Days Selector (if 'custom' frequency selected) */}
              {formFrequency === 'custom' && (
                <div className="p-3 rounded-xl bg-white border border-[#EAE3DA] space-y-2 animate-in fade-in">
                  <span className="text-xs font-medium text-[#2D2A26] block">
                    Choose Days of the Week:
                  </span>
                  <div className="flex gap-1.5">
                    {DAYS_OF_WEEK.map((day) => {
                      const isSelected = formCustomDays.includes(day.id);
                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => handleToggleCustomDay(day.id)}
                          className={`w-8 h-8 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#6B8E7D] text-white shadow-2xs'
                              : 'bg-[#FAF7F2] text-[#736E65] border border-[#EAE3DA] hover:bg-[#F4EFEA]'
                          }`}
                        >
                          {day.id}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Reminder Tone / Style */}
              <div>
                <label className="text-xs font-medium text-[#2D2A26] block mb-1.5 flex items-center gap-1.5">
                  <Smile size={13} className="text-[#6B8E7D]" />
                  <span>Reminder Tone / Style</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['gentle', 'warm', 'playful', 'soft', 'motivating', 'casual', 'custom'] as ReminderTone[]).map((t) => {
                    const cfg = TONE_CONFIG[t];
                    const isSelected = formTone === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setFormTone(t)}
                        className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-white border-[#6B8E7D] text-[#2D2A26] shadow-2xs ring-1 ring-[#6B8E7D]'
                            : 'bg-white/60 border-[#EAE3DA] text-[#736E65] hover:bg-white'
                        }`}
                      >
                        <div className="text-xs font-medium">{cfg.label}</div>
                        <div className="text-[10px] opacity-70 truncate">{cfg.description}</div>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Tone Description Input */}
                {formTone === 'custom' && (
                  <div className="mt-2.5 pt-2 border-t border-[#EAE3DA] animate-in fade-in">
                    <label className="text-xs text-[#2D2A26] block mb-1">
                      Describe your desired tone in your own words:
                    </label>
                    <input
                      id="custom-tone-description-input"
                      type="text"
                      value={formCustomToneText}
                      onChange={(e) => setFormCustomToneText(e.target.value)}
                      placeholder="e.g. Warm and cozy like a cup of chamomile tea"
                      className="w-full bg-white border border-[#EAE3DA] rounded-xl p-2.5 text-xs text-[#2D2A26] placeholder-[#8C867D] focus:outline-none focus:border-[#6B8E7D] transition-colors"
                    />
                  </div>
                )}
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EAE3DA]">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-[#F4EFEA] text-[#736E65] border border-[#EAE3DA] text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="save-custom-reminder-btn"
                  type="submit"
                  disabled={formSaving}
                  className="px-5 py-2 rounded-xl bg-[#6B8E7D] hover:bg-[#5A7A6A] text-white text-xs font-medium transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                >
                  {formSaving ? 'Saving...' : editingReminderId ? 'Save Changes' : 'Create Reminder'}
                </button>
              </div>
            </form>
          )}

          {/* User's Created Reminders List */}
          <div className="space-y-3">
            {loadingReminders ? (
              <div className="p-4 text-center text-xs text-[#8C867D]">
                Loading your reminders...
              </div>
            ) : customReminders.length === 0 && !isFormOpen ? (
              <div className="p-6 rounded-2xl bg-[#FAF7F2] border border-[#EAE3DA] text-center space-y-2">
                <p className="text-xs font-medium text-[#2D2A26]">
                  You haven't created any custom reminders yet.
                </p>
                <p className="text-[11px] text-[#736E65] max-w-sm mx-auto">
                  Create gentle, personalized reminders for your favorite time of day.
                </p>
                <button
                  type="button"
                  onClick={handleOpenCreateForm}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-white hover:bg-[#F4EFEA] text-[#2D2A26] border border-[#EAE3DA] text-xs font-medium transition-colors cursor-pointer mt-1"
                >
                  <Plus size={13} />
                  <span>Add your first reminder</span>
                </button>
              </div>
            ) : (
              customReminders.map((rem) => {
                const toneCfg = TONE_CONFIG[rem.tone] || TONE_CONFIG.gentle;
                return (
                  <div
                    key={rem.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      rem.enabled
                        ? 'bg-white border-[#EAE3DA] shadow-xs'
                        : 'bg-[#FAF7F2]/60 border-[#EAE3DA]/60 opacity-65'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Time Badge */}
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FAF7F2] border border-[#EAE3DA] text-[11px] font-medium text-[#2D2A26]">
                            <Clock size={11} className="text-[#6B8E7D]" />
                            <span>{formatTimeDisplay(rem.time)}</span>
                          </span>

                          {/* Frequency Badge */}
                          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#FAF7F2] border border-[#EAE3DA] text-[#736E65]">
                            {rem.frequency === 'custom' && rem.customDays && rem.customDays.length > 0
                              ? `Days: ${rem.customDays.join(', ')}`
                              : FREQUENCY_LABELS[rem.frequency] || rem.frequency}
                          </span>

                          {/* Tone Chip */}
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${toneCfg.badgeClass}`}>
                            {rem.tone === 'custom' && rem.customToneText
                              ? `Custom: "${rem.customToneText}"`
                              : toneCfg.label}
                          </span>

                          {/* Status Tag */}
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full ${
                              rem.enabled
                                ? 'bg-[#EFF4F2] text-[#2C5240] font-medium'
                                : 'bg-[#F4EFEA] text-[#8C867D]'
                            }`}
                          >
                            {rem.enabled ? 'Active' : 'Paused'}
                          </span>
                        </div>

                        {/* Reminder Text */}
                        <p className="text-xs sm:text-sm font-medium text-[#2D2A26] leading-relaxed break-words">
                          "{rem.text}"
                        </p>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        {/* Send Test */}
                        <button
                          type="button"
                          onClick={() => handleSendTestNotification(rem.text, 'Dear.ly Reminder')}
                          title="Send test notification"
                          className="p-1.5 rounded-xl hover:bg-[#FAF7F2] text-[#736E65] hover:text-[#2D2A26] transition-colors cursor-pointer"
                        >
                          <Send size={13} />
                        </button>

                        {/* Pause / Resume */}
                        <button
                          type="button"
                          onClick={() => handleToggleReminderEnabled(rem)}
                          title={rem.enabled ? 'Pause reminder' : 'Resume reminder'}
                          className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                            rem.enabled
                              ? 'text-[#6B8E7D] hover:bg-[#EBF1ED]'
                              : 'text-[#8C867D] hover:bg-white'
                          }`}
                        >
                          {rem.enabled ? <Pause size={14} /> : <Play size={14} />}
                        </button>

                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => handleOpenEditForm(rem)}
                          title="Edit reminder"
                          className="p-1.5 rounded-xl hover:bg-[#FAF7F2] text-[#736E65] hover:text-[#2D2A26] transition-colors cursor-pointer"
                        >
                          <Pencil size={13} />
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomReminder(rem.id)}
                          title="Delete reminder"
                          className="p-1.5 rounded-xl hover:bg-[#FDF0ED] text-[#8C867D] hover:text-[#A64438] transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* ----------------------------------------------------------------------- */}
        {/* CATEGORY B: DEAR.LY SUGGESTIONS (Optional gentle prompts from Dear.ly)   */}
        {/* ----------------------------------------------------------------------- */}
        <section className="bg-white rounded-3xl p-6 sm:p-7 border border-[#EAE3DA] shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#F4EFEA]">
            <div>
              <h3 className="text-sm font-semibold text-[#2D2A26] flex items-center gap-1.5">
                <Sparkles size={15} className="text-[#C07D53]" />
                <span>Dear.ly Suggestions</span>
              </h3>
              <p className="text-xs text-[#736E65] mt-0.5">
                Optional gentle prompts from Dear.ly.
              </p>
            </div>

            {/* Suggestions Toggle Switch */}
            <button
              id="toggle-dearly-suggestions-btn"
              type="button"
              disabled={savingPref}
              onClick={handleToggleDearlySuggestions}
              aria-pressed={preferences.dearlySuggestions?.enabled}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                preferences.dearlySuggestions?.enabled ? 'bg-[#6B8E7D]' : 'bg-[#D8D1C7]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  preferences.dearlySuggestions?.enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {preferences.dearlySuggestions?.enabled ? (
            <div className="space-y-4 pt-1 animate-in fade-in">
              {/* Timing Preference */}
              <div>
                <label className="text-xs font-medium text-[#2D2A26] block mb-2 flex items-center gap-1.5">
                  <Clock size={13} className="text-[#6B8E7D]" />
                  <span>Preferred Timing for Suggestions</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'morning', label: 'Morning', desc: '9:00 AM' },
                    { id: 'afternoon', label: 'Afternoon', desc: '2:00 PM' },
                    { id: 'evening', label: 'Evening', desc: '8:00 PM' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      disabled={savingPref}
                      onClick={() => handleUpdateSuggestionsConfig('preferredTimeOfDay', item.id)}
                      className={`py-2.5 px-3 rounded-2xl border text-center transition-all cursor-pointer ${
                        preferences.dearlySuggestions?.preferredTimeOfDay === item.id
                          ? 'bg-[#EBF1ED] border-[#CDE0D7] text-[#4D6D5C] font-medium shadow-2xs ring-1 ring-[#6B8E7D]'
                          : 'bg-[#FAF7F2] border-[#EAE3DA] text-[#736E65] hover:bg-[#F4EFEA]'
                      }`}
                    >
                      <div className="text-xs">{item.label}</div>
                      <div className="text-[10px] opacity-75">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Frequency Preference */}
              <div>
                <label className="text-xs font-medium text-[#2D2A26] block mb-2 flex items-center gap-1.5">
                  <Calendar size={13} className="text-[#6B8E7D]" />
                  <span>Suggestion Frequency</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'daily', label: 'Daily', desc: 'Once a day' },
                    { id: 'few_days', label: 'Every few days', desc: 'Relaxed space' },
                    { id: 'weekly', label: 'Weekly', desc: 'Gentle check-in' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      disabled={savingPref}
                      onClick={() => handleUpdateSuggestionsConfig('frequency', item.id)}
                      className={`py-2.5 px-3 rounded-2xl border text-center transition-all cursor-pointer ${
                        preferences.dearlySuggestions?.frequency === item.id
                          ? 'bg-[#FBF2E9] border-[#F5DECA] text-[#9C6D3B] font-medium shadow-2xs ring-1 ring-[#D4A373]'
                          : 'bg-[#FAF7F2] border-[#EAE3DA] text-[#736E65] hover:bg-[#F4EFEA]'
                      }`}
                    >
                      <div className="text-xs">{item.label}</div>
                      <div className="text-[10px] opacity-75">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sample Built-in Prompts */}
              <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#EAE3DA] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#8C867D] uppercase tracking-wider">
                    Included Gentle Prompts
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSendTestNotification(DEARLY_SUGGESTIONS[0].body, 'Dear.ly Suggestion')}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6B8E7D] hover:text-[#4D6D5C] cursor-pointer"
                  >
                    <Send size={11} />
                    <span>{testSent ? 'Sent sample!' : 'Send test notification'}</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  {DEARLY_SUGGESTIONS.slice(0, 3).map((sug) => (
                    <p
                      key={sug.id}
                      className="text-xs text-[#4A453E] italic bg-white p-2.5 rounded-xl border border-[#EAE3DA]"
                    >
                      "{sug.body}"
                    </p>
                  ))}
                </div>
              </div>

              {/* Notification Permission State Notice */}
              {notifPermission === 'denied' && (
                <div className="p-3 rounded-2xl bg-[#FDF0ED] border border-[#F5C7C1] text-[11px] text-[#A64438] flex items-center gap-2">
                  <Info size={13} className="shrink-0" />
                  <span>
                    Browser notifications are currently blocked in your browser settings. In-app gentle reminders will be shown on your Home view instead.
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#EAE3DA] flex items-center gap-2.5 text-xs text-[#736E65]">
              <BellOff size={15} className="text-[#8C867D] shrink-0" />
              <span>Dear.ly Suggestions are currently turned off. You will never receive unsolicited suggestions.</span>
            </div>
          )}
        </section>
      </div>

      {/* Safety & Ethics Guidelines */}
      <section className="bg-[#FAF7F2] rounded-3xl p-6 border border-[#EAE3DA] space-y-3">
        <h2 className="text-xs font-semibold text-[#555047] uppercase tracking-wider flex items-center gap-1.5">
          <Shield size={14} className="text-[#6B8E7D]" />
          <span>Privacy & Healthy Boundaries</span>
        </h2>
        <div className="space-y-2 text-xs text-[#736E65] leading-relaxed">
          <p className="flex items-start gap-2">
            <Lock size={13} className="text-[#6B8E7D] mt-0.5 shrink-0" />
            <span>
              <strong>Private Data Isolation:</strong> Your reflections and chats are strictly scoped to your authenticated account UID.
            </span>
          </p>
          <p className="flex items-start gap-2">
            <HeartHandshake size={13} className="text-[#6B8E7D] mt-0.5 shrink-0" />
            <span>
              <strong>AI Companion Boundaries:</strong> Dear.ly is a thoughtful journaling companion, not a licensed therapist or medical professional. It encourages self-reflection without creating artificial emotional dependency.
            </span>
          </p>
        </div>
      </section>

      {/* Sign Out Action */}
      <div className="pt-2">
        {showSignOutConfirm ? (
          <div className="p-4 rounded-2xl bg-[#FDF0ED] border border-[#F5C7C1] flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
            <div>
              <p className="text-xs font-medium text-[#A64438]">Are you sure you want to sign out?</p>
              <p className="text-[11px] text-[#736E65]">Your entries and conversations remain safely saved in your account.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                id="confirm-sign-out-btn"
                onClick={async () => {
                  await signOutUser();
                  setShowSignOutConfirm(false);
                }}
                className="px-4 py-2 rounded-xl bg-[#A64438] text-white text-xs font-medium hover:bg-[#8F3930] cursor-pointer"
              >
                Yes, Sign Out
              </button>
              <button
                onClick={() => setShowSignOutConfirm(false)}
                className="px-4 py-2 rounded-xl bg-white text-[#555047] border border-[#EAE3DA] text-xs font-medium hover:bg-[#FAF7F2] cursor-pointer"
              >
                Stay Logged In
              </button>
            </div>
          </div>
        ) : (
          <button
            id="settings-sign-out-btn"
            onClick={() => setShowSignOutConfirm(true)}
            className="w-full py-3.5 px-6 rounded-2xl bg-white hover:bg-[#FDF0ED] text-[#A64438] border border-[#EAE3DA] hover:border-[#F5C7C1] font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
          >
            <LogOut size={16} />
            <span>Sign Out of Dear.ly</span>
          </button>
        )}
      </div>
    </div>
  );
};
