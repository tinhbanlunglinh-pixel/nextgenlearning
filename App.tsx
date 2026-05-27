
import React, { useState, useEffect, useRef } from 'react';
import { generateLessonPlan, fileToBase64, getApiKey, setApiKey, hasApiKey, AVAILABLE_MODELS, getSelectedModel, setSelectedModel } from './services/geminiService';
import { LessonPlan } from './types';
import { VocabularySection } from './components/VocabularySection';
import { MegaChallenge } from './components/MegaChallenge';
import { UploadZone } from './components/UploadZone';
import { LessonCertificate } from './components/LessonCertificate';
import { LearningHistory } from './components/LearningHistory';
import { saveLessonRecord, generateRecordId } from './services/historyService';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

interface LogoProps {
  className?: string;
  color?: string;
}

const NextgenEnglishLogo = ({ className = "w-16 h-16", color = "currentColor" }: LogoProps) => (<div className={`relative ${className} flex items-center justify-center overflow-hidden rounded-xl bg-white`}><img src="https://i.postimg.cc/qB1tK6QH/bead166f8a480b165259.jpg" className="w-full h-full object-contain" alt="Nextgen English Logo" /></div>);

function App() {
  // Simplified - only keeping the planner/learning tab
  const [plannerMode, setPlannerMode] = useState<'topic' | 'text' | 'image'>('topic');
  const [topic, setTopic] = useState('');
  const [lessonText, setLessonText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [lesson, setLesson] = useState<LessonPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [studentName, setStudentName] = useState('');
  // Removed listeningCorrect since listening section was removed
  const [megaScores, setMegaScores] = useState({ mc: 0, scramble: 0, fill: 0, vocab: 0, tf: 0, listen: 0 });
  const [showCertificate, setShowCertificate] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const savedRef = useRef(false); // Prevent duplicate saves

  // API Key & Settings Management
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [selectedModelId, setSelectedModelId] = useState(AVAILABLE_MODELS[0].id);
  const [apiKeyValid, setApiKeyValid] = useState(false);

  // Check API key on mount
  useEffect(() => {
    const key = getApiKey();
    if (key) {
      setApiKeyInput(key);
      setApiKeyValid(true);
    } else {
      setShowSettings(true); // Show modal if no API key
    }
    setSelectedModelId(getSelectedModel());
  }, []);

  const handleSaveSettings = () => {
    if (apiKeyInput.trim()) {
      setApiKey(apiKeyInput.trim());
      setSelectedModel(selectedModelId);
      setApiKeyValid(true);
      setShowSettings(false);
    }
  };

  // Calculate total correct answers from all 6 exercise types (50 questions total)
  const totalCorrectCount = megaScores.mc + megaScores.scramble + megaScores.fill + megaScores.vocab + megaScores.tf + megaScores.listen;
  const totalQuestions = (lesson?.practice?.megaTest?.multipleChoice?.length || 0) +
    (lesson?.practice?.megaTest?.scramble?.length || 0) +
    (lesson?.practice?.megaTest?.fillBlank?.length || 0) +
    (lesson?.practice?.megaTest?.vocabTranslation?.length || 0) +
    (lesson?.practice?.megaTest?.trueFalse?.length || 0) +
    (lesson?.practice?.listening?.length || 0);

  const handleGenerate = async () => {
    // Check API key first
    if (!hasApiKey()) {
      setShowSettings(true);
      setError("Vui lòng nhập API Key trước khi sử dụng!");
      return;
    }

    if (plannerMode === 'topic' && !topic.trim()) { setError("Hãy nhập chủ đề bài học con nhé!"); return; }
    if (plannerMode === 'text' && !lessonText.trim()) { setError("Hãy dán nội dung bài học vào đây!"); return; }
    if (plannerMode === 'image' && selectedFiles.length === 0) { setError("Hãy chọn ít nhất một tấm ảnh tài liệu!"); return; }

    setLoading(true);
    setError(null);
    setLesson(null);
    setShowCertificate(false);
    savedRef.current = false;

    try {
      let base64Images: string[] = [];
      if (plannerMode === 'image' && selectedFiles.length > 0) {
        base64Images = await Promise.all(selectedFiles.map(file => fileToBase64(file)));
      }
      const data = await generateLessonPlan(
        plannerMode === 'topic' ? topic : undefined,
        plannerMode === 'text' ? lessonText : undefined,
        base64Images
      );
      setLesson(data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      // Hiển thị nguyên văn lỗi từ?API như yêu cầu
      const rawError = err.message || "Lỗi không xác định";
      if (rawError.includes("429") || rawError.includes("RESOURCE_EXHAUSTED")) {
        setError("LỖI 429: Hết hạn mức sử dụng (Quota Exhausted). Cô hãy đổi API Key khác nhé!");
      } else if (rawError.includes("401") || rawError.includes("API_KEY_INVALID")) {
        setError("LỖI 401: Mã API Key không hợp lệ!? Cô hãy kiểm tra lại nhé!");
      } else {
        setError(`LỖI HỆ THỐNG: ${rawError}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Calculate score: 10 points total, distributed across all questions
  function calculateTotalScore() {
    const total = totalQuestions || 1; // Prevent division by zero
    const raw = (totalCorrectCount / total) * 10;
    return Math.round(raw * 10) / 10;
  }

  // Format score with decimal comma (Vietnamese style)
  function formatScore(score: number): string {
    return score.toFixed(1).replace('.', ',');
  }

  const totalScore = calculateTotalScore();

  function getEvaluation(score: number) {
    const s = score || 0;
    if (s >= 9) return { text: "XUẤT SẮC", emoji: "🏆", level: "EXCELLENT", praise: "Con là một ngôi sao sáng nhất lớp NEXTGEN ENGLISH!" };
    if (s >= 7) return { text: "KHÁ GIỎI", emoji: "🌟", level: "GREAT JOB", praise: "Con làm bài rất tuyệt vời, tiếp tục phát huy nhé!" };
    if (s >= 5) return { text: "CỐ GẮNG", emoji: "👍", level: "GOOD EFFORT", praise: "Con đã nỗ lực rất nhiều, NEXTGEN ENGLISH tự hào về con!" };
    return { text: "CẦN NỖ LỰC", emoji: "💪", level: "KEEP IT UP", praise: "Đừng nản lòng con nhé, bài sau mình làm tốt hơn nào!" };
  }

  const evaluation = getEvaluation(totalScore);

  return (
    <div className="min-h-screen bg-brand-50 flex flex-col font-serif text-slate-900">
      <header className="bg-brand-700 border-b-4 border-brand-800 sticky top-0 z-50 shadow-xl">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-6 h-16 sm:h-24 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4 cursor-pointer">
            <NextgenEnglishLogo className="w-10 h-10 sm:w-14 sm:h-14 bg-white rounded-xl sm:rounded-2xl p-1 sm:p-1.5 shadow-lg" color="#16a34a" />
            <div className="flex flex-col">
              <h1 className="text-base sm:text-xl md:text-3xl font-black text-brand-300 uppercase tracking-tighter font-display">NEXTGEN ENGLISH</h1>
              <span className="text-[8px] sm:text-[10px] font-black text-white uppercase tracking-[0.1em] sm:tracking-[0.2em] opacity-90 font-sans hidden xs:block">Learn English, Lead the way</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* History Button */}
            <button
              onClick={() => setShowHistory(true)}
              className="flex items-center gap-1 sm:gap-2 bg-white/10 hover:bg-white/20 px-2 sm:px-3 py-1 sm:py-2 rounded-lg transition-all"
            >
              <span className="text-base sm:text-lg">📊</span>
              <span className="text-white text-xs sm:text-sm font-bold hidden sm:block">Lịch sử</span>
            </button>

            {/* Settings Button */}
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-1 sm:gap-2 bg-white/10 hover:bg-white/20 px-2 sm:px-3 py-1 sm:py-2 rounded-lg transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-white text-xs sm:text-sm font-bold hidden sm:block">API Key</span>
              {!apiKeyValid && <span className="text-red-400 text-[10px] sm:text-xs font-bold">Chưa có key!</span>}
            </button>
          </div>
        </div>
      </header>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-brand-800">⚙️ Thiết lập API Key</h2>
              {apiKeyValid && (
                <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">🔑 API Key</label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Nhập API key của bạn..."
                  className="w-full p-3 border-2 border-brand-200 rounded-xl focus:border-brand-500 outline-none"
                />
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-red-500 text-xs font-bold hover:underline mt-1 inline-block"
                >
                  👉 Lấy API key miễn phí tại đây
                </a>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">🤖 Chọn Model AI</label>
                <div className="grid gap-2">
                  {AVAILABLE_MODELS.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => setSelectedModelId(model.id)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${selectedModelId === model.id
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-slate-200 hover:border-brand-300'
                        }`}
                    >
                      <span className="font-bold">{model.name}</span>
                      {model.isDefault && <span className="ml-2 text-xs bg-brand-500 text-white px-2 py-0.5 rounded">Mặc định</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveSettings}
              disabled={!apiKeyInput.trim()}
              className="w-full py-3 bg-brand-500 text-white rounded-xl font-bold text-lg hover:bg-brand-600 transition-all disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              💾 Lưu cài đặt
            </button>
          </div>
        </div>
      )}

      <main className="max-w-[1400px] mx-auto px-3 sm:px-6 py-4 sm:py-10 flex-grow w-full relative">
        <div>
          <div className="space-y-8 sm:space-y-16">
            {!lesson ? (
              <div className="bg-white rounded-2xl sm:rounded-[3rem] shadow-xl border-b-4 sm:border-b-[12px] border-r-4 sm:border-r-[12px] border-brand-100 p-4 sm:p-8 md:p-16 max-w-4xl mx-auto animate-fade-in text-center relative overflow-hidden ring-2 sm:ring-4 ring-white">
                <div className="absolute top-0 left-0 w-full h-3 bg-brand-500"></div>
                <NextgenEnglishLogo className="w-20 h-20 sm:w-32 sm:h-32 mx-auto mb-4 sm:mb-8 drop-shadow-xl" color="#15803d" />
                <h2 className="text-lg sm:text-2xl md:text-4xl font-black text-brand-800 mb-2 uppercase tracking-tighter font-display">Let's learn English with NEXTGEN ENGLISH</h2>
                <p className="text-xs sm:text-sm font-black text-slate-400 mb-4 sm:mb-8 uppercase italic opacity-60">"Learn English, Lead the way"</p>

                <div className="space-y-8 text-left">
                  <div className="flex bg-slate-100 p-2 rounded-2xl gap-2 shadow-inner">
                    {[{ id: 'topic', label: 'Chủ đề', icon: '💡' }, { id: 'text', label: 'Văn bản', icon: '📝' }, { id: 'image', label: 'Hình ảnh', icon: '📸' }].map(m => (
                      <button key={m.id} onClick={() => { setPlannerMode(m.id as any); setTopic(''); setLessonText(''); setSelectedFiles([]); setError(null); }} className={`flex-1 py-3 rounded-xl font-black text-base flex items-center justify-center gap-2 transition-all ${plannerMode === m.id ? 'bg-brand-500 text-white shadow-lg scale-105' : 'text-slate-500 hover:bg-white'}`}>{m.icon} {m.label}</button>
                    ))}
                  </div>
                  <div className="min-h-[150px]">
                    {plannerMode === 'topic' && <input type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="Nhập chủ đề (VD: Animals, My Family...)" className="w-full p-6 text-2xl rounded-2xl border-4 border-brand-50 font-black bg-brand-50/50 outline-none text-brand-900" />}
                    {plannerMode === 'text' && <textarea value={lessonText} onChange={e => setLessonText(e.target.value)} placeholder="Dán nội dung bài học vào đây..." rows={6} className="w-full p-6 text-lg rounded-2xl border-4 border-brand-50 bg-brand-50/50 resize-none font-black text-slate-700 outline-none" />}
                    {plannerMode === 'image' && <UploadZone onFilesSelect={setSelectedFiles} isLoading={loading} fileCount={selectedFiles.length} />}
                  </div>
                  <button onClick={handleGenerate} disabled={loading} className="w-full py-6 bg-brand-500 border-b-8 border-brand-700 text-white rounded-3xl font-black text-2xl shadow-xl transform active:translate-y-2 active:border-b-0 uppercase tracking-tighter">
                    {loading ? 'ĐANG SOẠN BÀI SIÊU TỐC...' : '🚀 BẮT ĐẦU NGAY!'}
                  </button>
                  {error && <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-600 font-black text-lg text-center animate-bounce shadow-md">⚠️ {error}</div>}
                </div>
              </div>
            ) : (
              <div className="space-y-8 sm:space-y-16 animate-fade-in">
                <div className="text-center relative py-6 sm:py-10 bg-white rounded-2xl sm:rounded-[4rem] shadow-xl border-2 sm:border-4 border-brand-50 ring-2 sm:ring-4 ring-white overflow-hidden">
                  {/* Nút tạo bài học mới */}
                  <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
                    <button
                      onClick={() => {
                        setLesson(null);
                        setTopic('');
                        setLessonText('');
                        setSelectedFiles([]);
                        setStudentName('');
                        setMegaScores({ mc: 0, scramble: 0, fill: 0, vocab: 0, tf: 0, listen: 0 });
                        setShowCertificate(false);
                        setError(null);
                      }}
                      className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-3 py-2 sm:px-5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm shadow-lg transition-all active:scale-95"
                    >
                      <span className="text-base sm:text-lg">🔄</span>
                      <span className="hidden sm:inline">Tạo bài học mới</span>
                      <span className="sm:hidden">Bài mới</span>
                    </button>
                  </div>

                  <h1 className="text-2xl sm:text-4xl md:text-6xl font-black text-brand-800 uppercase font-display mb-4 sm:mb-6 px-4 break-words">{lesson.topic}</h1>
                  <div className="flex flex-col items-center gap-4">
                    <label className="text-brand-600 font-black uppercase tracking-[0.2em] text-base font-sans">Chào mừng con:</label>
                    <input type="text" placeholder="Nhập tên của con nhé..." value={studentName} onChange={e => setStudentName(e.target.value)} className="p-4 w-full max-w-xl rounded-2xl border-4 border-brand-50 font-black text-2xl text-center outline-none bg-brand-50/50" />
                  </div>
                </div>

                <div className="bg-white p-3 sm:p-5 rounded-xl sm:rounded-2xl shadow-lg border border-brand-100">
                  <VocabularySection items={lesson.vocabulary} />
                </div>

                <div className="bg-highlight-400 p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-lg border-4 border-white">
                  <h2 className="text-base sm:text-xl font-bold text-brand-900 uppercase tracking-tight mb-3 sm:mb-4 flex items-center gap-2">
                    <span className="text-xl sm:text-2xl">💡</span> Ngữ pháp quan trọng
                  </h2>
                  <div className="bg-white/95 p-3 sm:p-5 rounded-lg sm:rounded-xl shadow-md">
                    <h3 className="text-base sm:text-xl font-bold text-brand-700 mb-2">{lesson.grammar?.topic}</h3>
                      <p className="text-sm sm:text-base text-slate-700 leading-relaxed mb-4 border-l-3 border-brand-500 pl-3">{lesson.grammar?.explanation}</p>
                    <div className="space-y-2">
                        <h4 className="text-xs sm:text-sm font-bold text-brand-600 uppercase">Ví dụ:</h4>
                      <div className="grid gap-2">
                        {(lesson.grammar?.examples || []).map((ex, i) => (
                          <div key={i} className="bg-brand-50 p-2 sm:p-3 rounded-lg border border-brand-100 flex items-center gap-2">
                            <span className="text-lg">💎</span>
                            <p className="text-sm sm:text-base text-slate-700 italic">"{ex}"</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Listening section restored */}
                {lesson.practice?.megaTest && <MegaChallenge megaData={lesson.practice.megaTest} listeningData={lesson.practice.listening} onScoresUpdate={setMegaScores} />}

                <div className="text-center py-8 sm:py-12 bg-white rounded-xl sm:rounded-2xl shadow-lg border border-brand-100 flex flex-col items-center gap-4 sm:gap-6 relative overflow-hidden">
                  <NextgenEnglishLogo className="w-16 h-16 sm:w-20 sm:h-20 drop-shadow-lg" color="#15803d" />
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl sm:text-6xl font-bold text-brand-600 leading-none">{formatScore(totalScore)}</span>
                      <span className="text-xl sm:text-2xl font-bold text-slate-300">/10</span>
                    </div>
                    <div className="text-sm sm:text-base font-semibold text-brand-500 bg-brand-50 px-4 py-1 rounded-full">
                      Số câu đúng: <span className="text-brand-700 font-bold">{totalCorrectCount}/{totalQuestions}</span>
                    </div>
                    <div className={`px-6 py-2 sm:px-8 sm:py-3 rounded-full font-bold text-base sm:text-xl shadow-lg ${totalScore >= 5 ? 'bg-brand-500 text-white' : 'bg-orange-500 text-white'}`}>
                      {evaluation.emoji} {evaluation.text}
                    </div>

                    <button
                      onClick={() => {
                        setShowCertificate(true);
                        // Auto-save lesson to history
                        if (!savedRef.current && lesson) {
                          savedRef.current = true;
                          saveLessonRecord({
                            id: generateRecordId(),
                            date: new Date().toISOString(),
                            topic: lesson.topic,
                            score: totalScore,
                            totalCorrect: totalCorrectCount,
                            totalQuestions: totalQuestions,
                            skillScores: { ...megaScores },
                            studentName: studentName || 'Ẩn danh',
                          });
                        }
                      }}
                      className="mt-4 px-6 py-3 sm:px-8 sm:py-4 bg-emerald-500 text-white rounded-xl font-bold text-sm sm:text-base shadow-lg hover:bg-emerald-400 transition-all"
                    >
                      📜 Xuất chứng nhận
                    </button>
                  </div>
                </div>

                {showCertificate && (
                  <LessonCertificate
                    studentName={studentName}
                    topic={lesson.topic}
                    score={totalScore}
                    totalCorrect={totalCorrectCount}
                    evaluation={evaluation}
                    onClose={() => setShowCertificate(false)}
                  />
                )}

                {/* InfographicPoster removed */}
              </div>
            )}

            {/* Learning History Modal */}
            {showHistory && <LearningHistory onClose={() => setShowHistory(false)} />}
          </div>
        </div>
        {/* Story, MindMap and Prompt tabs removed */}
      </main>

            <footer className="bg-brand-900 text-white border-t-[10px] border-brand-800 pt-20 pb-10">
        <div className="max-w-[1400px] mx-auto px-6 text-center md:text-left">
          <div className="grid md:grid-cols-3 gap-12 items-start mb-16">
            <div className="space-y-6 flex flex-col items-center md:items-start text-center md:text-left">
              <div className="bg-white p-4 rounded-[2rem] w-fit shadow-xl border-4 border-brand-300"><NextgenEnglishLogo className="w-20 h-20" color="#15803d" /></div>
              <div><h3 className="font-black text-2xl text-brand-300 uppercase leading-none font-display">NEXTGEN ENGLISH</h3><p className="text-white font-black text-base mt-2 opacity-90 italic">“Learn English, Lead the way”</p></div>
            </div>
            <div className="space-y-6 text-center md:text-left">
              <h4 className="font-black text-brand-300 text-xl uppercase tracking-[0.2em] border-b-2 border-white/10 pb-2 font-sans">Liên Hệ</h4>
              <ul className="space-y-4 font-black text-brand-100 text-lg">
                <li className="flex items-start gap-3">📍<span>Số 32 Tổ 31B K9, Quang Trung, Phường Uông Bí, Quảng Ninh</span></li>
                <li className="flex items-center gap-3">📞<a href="tel:0986197229" className="hover:text-white transition-colors">Hotline: 0986 197 229 / 0334 141 989</a></li>
                <li className="flex items-center gap-3">✉️<a href="mailto:nextgen.uongbi@gmail.com" className="hover:text-white transition-colors text-base">nextgen.uongbi@gmail.com</a></li>
                <li className="flex items-center gap-3">🌐<a href="https://www.facebook.com/people/Trung-T%C3%A2m-Ngoa%CC%A3i-Ng%C6%B0%CC%83-Nextgen-U%C3%B4ng-Bi%CC%81/61575042515566/" target="_blank" className="hover:text-white transition-colors underline decoration-2">Fanpage Facebook</a></li>
              </ul>
            </div>
            <div className="space-y-6 text-center md:text-left">
                <h4 className="font-black text-brand-300 text-xl uppercase tracking-[0.2em] border-b-2 border-white/10 pb-2 font-sans">Slogan</h4>
                <div className="bg-white/5 p-8 rounded-[2rem] border-2 border-white/10 shadow-xl backdrop-blur-sm"><p className="text-xl font-black italic text-white mb-3 leading-tight">“Learn English, Lead the way”</p><p className="text-brand-300 font-black text-base uppercase tracking-widest font-sans">HỌC TIẾNG ANH . DẪN LỐI TƯƠNG LAI.</p></div>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-brand-200 text-sm">
            <p>© 2026 Nextgen English. Một trường Anh ngữ chuyên nghiệp & hiện đại.</p>
            <div className="flex gap-4">
              <a href="#" className="hover:text-white transition-colors">Chính sách bảo mật</a>
              <span className="text-white/20">|</span>
              <a href="#" className="hover:text-white transition-colors">Điều khoản dịch vụ</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
export default App;
