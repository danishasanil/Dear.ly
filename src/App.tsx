import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthScreen } from './components/AuthScreen';
import { Navigation } from './components/Navigation';
import { HomeView } from './components/HomeView';
import { JournalView } from './components/JournalView';
import { CalendarView } from './components/CalendarView';
import { MomentsView } from './components/MomentsView';
import { SongOfTheDayView } from './components/SongOfTheDayView';
import { TalkView } from './components/TalkView';
import { SettingsView } from './components/SettingsView';
import { NavigationTab } from './types';
import { Feather } from 'lucide-react';

const MainApp: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<NavigationTab>('home');
  const [passedPrompt, setPassedPrompt] = useState<string | undefined>(undefined);

  const handleNavigate = (tab: NavigationTab, promptText?: string) => {
    setPassedPrompt(promptText);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-12 h-12 rounded-full bg-[#E8DCC4] flex items-center justify-center text-[#735A38] animate-pulse">
          <Feather size={22} />
        </div>
        <p className="text-xs font-medium text-[#736E65] tracking-wide">
          Opening your personal journal...
        </p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex flex-col selection:bg-[#E8DCC4]">
      {/* Top Header & Navigation */}
      <Navigation activeTab={activeTab} onTabChange={(tab) => handleNavigate(tab)} />

      {/* Primary View Content Area strictly keyed to authenticated user.uid */}
      <main key={user.uid} className="flex-1">
        {activeTab === 'home' && <HomeView key={`home_${user.uid}`} onNavigate={handleNavigate} />}
        {activeTab === 'journal' && <JournalView key={`journal_${user.uid}`} initialPrompt={passedPrompt} />}
        {activeTab === 'calendar' && <CalendarView key={`calendar_${user.uid}`} onNavigate={handleNavigate} />}
        {activeTab === 'moments' && <MomentsView key={`moments_${user.uid}`} />}
        {activeTab === 'song' && <SongOfTheDayView key={`song_${user.uid}`} />}
        {activeTab === 'talk' && <TalkView key={`talk_${user.uid}`} initialMessage={passedPrompt} />}
        {activeTab === 'settings' && <SettingsView key={`settings_${user.uid}`} />}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
