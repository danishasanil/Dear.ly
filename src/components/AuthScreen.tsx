import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Heart, ShieldCheck, BookOpen, MessageSquareText, Feather } from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const { signInWithGoogle, loading, error, clearError } = useAuth();

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex flex-col justify-between items-center p-6 sm:p-12 relative overflow-hidden">
      {/* Decorative subtle background accents */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-[#F3E8DC] blur-3xl opacity-60 pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-[#EAE3DA] blur-3xl opacity-60 pointer-events-none" />

      {/* Top Brand Tagline */}
      <div className="w-full max-w-md flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#E8DCC4] flex items-center justify-center text-[#735A38]">
            <Feather size={16} />
          </div>
          <span className="font-display font-medium text-lg tracking-tight text-[#2D2A26]">Dear.ly</span>
        </div>
        <span className="text-xs font-medium px-3 py-1 rounded-full bg-[#F4EFEA] text-[#736E65] border border-[#EAE3DA]">
          Personal AI Journal
        </span>
      </div>

      {/* Main Hero Card */}
      <div className="w-full max-w-md my-auto py-8 z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EBF1ED] text-[#4D6D5C] text-xs font-medium mb-4">
            <Sparkles size={13} />
            <span>Private & Thoughtful Space</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-medium text-[#2D2A26] tracking-tight leading-tight mb-3">
            A quiet sanctuary for your thoughts.
          </h1>
          <p className="text-sm text-[#736E65] leading-relaxed max-w-xs mx-auto">
            Reflect on your day, explore your feelings, and talk naturally with a calm, supportive AI companion.
          </p>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <div className="p-3.5 rounded-2xl bg-white border border-[#EAE3DA] shadow-xs flex flex-col gap-1.5">
            <div className="w-7 h-7 rounded-xl bg-[#FDF0ED] flex items-center justify-center text-[#D98880]">
              <BookOpen size={15} />
            </div>
            <h2 className="text-xs font-semibold text-[#2D2A26]">Mindful Journaling</h2>
            <p className="text-[11px] text-[#736E65] leading-snug">
              Save reflections with gentle AI insights.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-[#EAE3DA] shadow-xs flex flex-col gap-1.5">
            <div className="w-7 h-7 rounded-xl bg-[#EFF4F2] flex items-center justify-center text-[#6B8E7D]">
              <MessageSquareText size={15} />
            </div>
            <h2 className="text-xs font-semibold text-[#2D2A26]">Companion Talk</h2>
            <p className="text-[11px] text-[#736E65] leading-snug">
              Multi-turn conversations that listen warmly.
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-[#FDF0ED] border border-[#F5C7C1] text-[#A64438] text-xs flex items-center justify-between">
            <span>{error}</span>
            <button
              id="clear-auth-error-btn"
              onClick={clearError}
              className="font-semibold text-xs ml-2 hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Google Sign In Action */}
        <div className="space-y-3">
          <button
            id="google-sign-in-btn"
            onClick={signInWithGoogle}
            disabled={loading}
            className="w-full py-3.5 px-6 rounded-2xl bg-[#2D2A26] hover:bg-[#1A1816] text-[#FAF7F2] font-medium text-sm flex items-center justify-center gap-3 transition-all duration-200 shadow-sm hover:shadow active:scale-[0.99] disabled:opacity-60 cursor-pointer"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-[#FAF7F2] border-t-transparent rounded-full animate-spin" />
                <span>Opening your journal...</span>
              </div>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.4 8.9 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.3 14.7c-.2-.7-.4-1.5-.4-2.4s.2-1.7.4-2.4L1.6 7c-.8 1.6-1.3 3.4-1.3 5.3s.5 3.7 1.3 5.3l3.7-2.9z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5L1.6 16.2C3.5 20.1 7.4 23 12 23z"
                  />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>
        </div>

        {/* Privacy Note */}
        <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-[#736E65]">
          <ShieldCheck size={14} className="text-[#6B8E7D]" />
          <span>Strictly private. Only you can access your reflections.</span>
        </div>
      </div>

      {/* Footer reassurance */}
      <div className="w-full max-w-md text-center z-10">
        <p className="text-[11px] text-[#A69F94] flex items-center justify-center gap-1">
          Crafted with care <Heart size={10} className="text-[#D98880] fill-[#D98880]" /> for your personal wellbeing
        </p>
      </div>
    </div>
  );
};
