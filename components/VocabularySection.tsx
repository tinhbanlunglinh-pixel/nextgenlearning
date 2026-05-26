
import React, { useState } from 'react';
import { VocabularyItem } from '../types';
import { playGeminiTTS } from '../services/geminiService';

interface VocabularySectionProps {
  items: VocabularyItem[];
}

export const VocabularySection: React.FC<VocabularySectionProps> = ({ items = [] }) => {
  const [showMeaning, setShowMeaning] = useState(true);

  const handlePlayAudio = (text: string) => {
    playGeminiTTS(text);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-row justify-between items-center gap-3 border-b-2 border-brand-100 pb-3">
        <h2 className="text-lg sm:text-xl font-black text-brand-800 uppercase tracking-tight">
          📖 Từ vựng
        </h2>
        <button
          onClick={() => setShowMeaning(!showMeaning)}
          className="text-xs bg-white border border-brand-200 px-3 py-1 rounded-full hover:bg-brand-50 transition-all text-brand-600 font-bold"
        >
          {showMeaning ? 'Ẩn nghĩa' : 'Hiện nghĩa'}
        </button>
      </div>

      {/* Vocabulary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="bg-white p-3 sm:p-4 rounded-xl shadow-md border border-slate-100 hover:shadow-lg transition-all"
          >
            {/* Card Content */}
            <div className="flex gap-3">
              {/* Emoji Icon */}
              <div className="shrink-0">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-brand-50 rounded-lg flex items-center justify-center">
                  <span className="text-xl sm:text-2xl select-none">{item.emoji || "📝"}</span>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Word + Audio */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-bold text-brand-900 leading-tight">
                      {item.word}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1 mt-0.5">
                      <span className="text-brand-600 text-xs font-mono bg-brand-50 px-1.5 py-0.5 rounded">
                        /{item.ipa}/
                      </span>
                      <span className="text-[8px] sm:text-[9px] bg-brand-500 text-white px-1.5 py-0.5 rounded font-bold uppercase">
                        {item.type}
                      </span>
                    </div>
                  </div>

                  {/* Audio Button */}
                  <button
                    onClick={() => handlePlayAudio(item.word)}
                    className="shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-brand-100 text-brand-700 hover:bg-brand-500 hover:text-white transition-all flex items-center justify-center"
                    aria-label="Phát âm"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                    </svg>
                  </button>
                </div>

                {/* Meaning */}
                {showMeaning && (
                  <p className="text-amber-600 font-bold text-sm sm:text-base mt-1.5 italic">
                    {item.meaning}
                  </p>
                )}

                {/* Example */}
                <div className="mt-2 bg-slate-50 p-2 sm:p-3 rounded-lg relative">
                  <p className="text-slate-700 text-xs sm:text-sm font-medium italic pr-7 leading-relaxed">
                    "{item.example}"
                  </p>

                  {showMeaning && item.sentenceMeaning && (
                    <p className="text-brand-500 text-[10px] sm:text-xs font-semibold mt-1.5 pt-1.5 border-t border-slate-200">
                      → {item.sentenceMeaning}
                    </p>
                  )}

                  {/* Example Audio */}
                  <button
                    onClick={() => handlePlayAudio(item.example)}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white text-slate-400 hover:text-brand-500 border border-slate-200 flex items-center justify-center transition-all"
                    aria-label="Phát câu"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
