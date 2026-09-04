import React from 'react';
import { NavigationTab } from '../types';
import { Home, BookOpen, Calendar, Camera, Music, MessageCircle, Settings, Feather } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavigationProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const { profile, user } = useAuth();

  const navItems: { id: NavigationTab; label: string; icon: React.FC<{ size?: number; className?: string }> }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'journal', label: 'Journal', icon: BookOpen },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'moments', label: 'Moments', icon: Camera },
    { id: 'song', label: 'Song', icon: Music },
    { id: 'talk', label: 'Talk', icon: MessageCircle },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-[#FAF7F2]/90 backdrop-blur-md border-b border-[#EAE3DA]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#E8DCC4] flex items-center justify-center text-[#735A38] shadow-2xs">
              <Feather size={16} />
            </div>
            <div>
              <span className="font-display font-medium text-lg tracking-tight text-[#2D2A26]">Dear.ly</span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-[#F4EFEA] p-1 rounded-full border border-[#EAE3DA]" aria-label="Main Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-desktop-${item.id}`}
                  onClick={() => onTabChange(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8E7D] active:scale-[0.98] ${
                    isActive
                      ? 'bg-white text-[#2D2A26] shadow-xs'
                      : 'text-[#736E65] hover:text-[#2D2A26] hover:bg-white/50'
                  }`}
                >
                  <Icon size={14} className={isActive ? 'text-[#6B8E7D]' : 'text-[#8C867D]'} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User Profile Mini Badge */}
          <button
            id="nav-profile-button"
            onClick={() => onTabChange('settings')}
            aria-label="Open Settings and Profile"
            className="flex items-center gap-2.5 p-1 sm:px-2.5 sm:py-1 rounded-full bg-white/80 border border-[#EAE3DA] hover:bg-white hover:border-[#D6CCC0] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8E7D] active:scale-[0.98]"
          >
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="Profile"
                className="w-6 h-6 rounded-full object-cover border border-[#EAE3DA]"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-[#EBF1ED] text-[#4D6D5C] text-xs font-semibold flex items-center justify-center">
                {profile?.displayName ? profile.displayName.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
            <span className="hidden sm:inline text-xs font-medium text-[#2D2A26] truncate max-w-[100px]">
              {profile?.displayName?.split(' ')[0] || 'My Journal'}
            </span>
          </button>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FAF7F2]/95 backdrop-blur-lg border-t border-[#EAE3DA] px-1 py-1.5 pb-safe" aria-label="Mobile Navigation">
        <div className="max-w-md mx-auto grid grid-cols-7 gap-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-mobile-${item.id}`}
                onClick={() => onTabChange(item.id)}
                aria-current={isActive ? 'page' : undefined}
                aria-label={item.label}
                className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-2xl transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8E7D] active:scale-[0.95] ${
                  isActive
                    ? 'text-[#2D2A26] bg-[#F4EFEA]'
                    : 'text-[#8C867D] hover:text-[#2D2A26]'
                }`}
              >
                <div className="relative">
                  <Icon size={17} className={isActive ? 'text-[#6B8E7D]' : ''} />
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#6B8E7D] rounded-full" />
                  )}
                </div>
                <span className={`text-[9px] sm:text-[10px] mt-1 font-medium truncate w-full text-center ${isActive ? 'font-semibold' : ''}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
