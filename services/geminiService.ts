
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { LessonPlan, MindMapData, MindMapMode, PresentationScript, ContentResult, CharacterProfile, AppMode, ImageRatio, SpeechEvaluation } from "../types";

// ===== API KEY MANAGEMENT =====
// Priority: localStorage > environment variable
const API_KEY_STORAGE = 'nextgen_english_api_key';
const MODEL_STORAGE = 'nextgen_english_selected_model';

// Model fallback order as per AI_INSTRUCTIONS.md
// Default: gemini-3-pro-preview
// Fallback: gemini-3-flash-preview �?gemini-3-pro-preview �?gemini-2.5-flash
export const AVAILABLE_MODELS = [
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', isDefault: true },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
];

export const getApiKey = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(API_KEY_STORAGE);
  }
  return null;
};

export const setApiKey = (key: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(API_KEY_STORAGE, key);
  }
};

export const getSelectedModel = (): string => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(MODEL_STORAGE) || AVAILABLE_MODELS[0].id;
  }
  return AVAILABLE_MODELS[0].id;
};

export const setSelectedModel = (modelId: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(MODEL_STORAGE, modelId);
  }
};

export const hasApiKey = (): boolean => {
  return !!getApiKey();
};

// Create AI instance with API key from localStorage
const getAI = () => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('API_KEY_REQUIRED: Vui lòng nhập API key đ�?s�?dụng ứng dụng');
  }
  return new GoogleGenAI({ apiKey });
};

// Retry with model fallback
export const callWithFallback = async <T>(
  fn: (model: string) => Promise<T>,
  startModelIndex: number = 0
): Promise<T> => {
  const models = AVAILABLE_MODELS.slice(startModelIndex);
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      return await fn(model.id);
    } catch (error: any) {
      lastError = error;
      console.warn(`Model ${model.id} failed, trying next...`, error.message);
      // Continue to next model
    }
  }

  // All models failed
  throw lastError || new Error('Tất c�?các model đều thất bại');
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });
};

// ===== TTS SYSTEM: Mobile-First with IMMEDIATE Playback =====
// Uses Web Speech API with SYNCHRONOUS speak() for mobile compatibility
// CRITICAL: On Android, speak() MUST be called synchronously in the click handler

let currentUtterance: SpeechSynthesisUtterance | null = null;
let cachedVoice: SpeechSynthesisVoice | null = null;
let ttsInitialized = false;

// Get voices SYNCHRONOUSLY - do not await
const getVoicesSync = (): SpeechSynthesisVoice[] => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices();
};

// Get the best English voice from available voices - prefer expressive female voices
const getBestVoice = (voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null => {
  if (cachedVoice && voices.includes(cachedVoice)) return cachedVoice;
  if (!voices || voices.length === 0) return null;

  // Priority: Female voices (more melodic) > Google > Microsoft > Native English
  const priorities = [
    // Female Google voices - most natural and melodic
    (v: SpeechSynthesisVoice) => v.name.includes('Google') && v.lang.startsWith('en') && (v.name.includes('Female') || v.name.includes('UK English Female')),
    // Any Google English voice
    (v: SpeechSynthesisVoice) => v.name.includes('Google') && v.lang.startsWith('en'),
    // Microsoft Zira/Aria - expressive female voices
    (v: SpeechSynthesisVoice) => v.name.includes('Microsoft') && v.lang.startsWith('en') && (v.name.includes('Zira') || v.name.includes('Aria') || v.name.includes('Jenny')),
    // Any Microsoft English voice
    (v: SpeechSynthesisVoice) => v.name.includes('Microsoft') && v.lang.startsWith('en'),
    // US English - clearer pronunciation
    (v: SpeechSynthesisVoice) => v.lang === 'en-US',
    // Any English voice
    (v: SpeechSynthesisVoice) => v.lang.startsWith('en'),
  ];

  for (const check of priorities) {
    const voice = voices.find(check);
    if (voice) {
      cachedVoice = voice;
      return voice;
    }
  }

  cachedVoice = voices[0];
  return voices[0];
};

// Pre-load voices in background (non-blocking)
const preloadVoices = () => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  // Try to get voices immediately
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    getBestVoice(voices); // Cache the best voice
    return;
  }

  // Listen for voices to become available
  window.speechSynthesis.onvoiceschanged = () => {
    const v = window.speechSynthesis.getVoices();
    if (v.length > 0) {
      getBestVoice(v); // Cache the best voice
    }
  };
};

// Initialize TTS - call this on first user interaction (e.g., page touch)
export const initTTSOnUserInteraction = (): void => {
  if (ttsInitialized) return;
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  ttsInitialized = true;

  // Warm up the speech synthesis engine with a silent utterance
  // This tricks mobile browsers into allowing future speech
  try {
    const warmup = new SpeechSynthesisUtterance('');
    warmup.volume = 0;
    warmup.rate = 10; // Fast to complete quickly
    window.speechSynthesis.speak(warmup);
    window.speechSynthesis.cancel(); // Cancel immediately
  } catch (e) {
    // Ignore errors during warmup
  }

  // Pre-cache voices
  preloadVoices();
};

// Pre-load voices on page load
if (typeof window !== 'undefined' && window.speechSynthesis) {
  preloadVoices();

  // Also try to init on first touch/click anywhere
  const initOnInteraction = () => {
    initTTSOnUserInteraction();
    document.removeEventListener('touchstart', initOnInteraction);
    document.removeEventListener('click', initOnInteraction);
  };
  document.addEventListener('touchstart', initOnInteraction, { passive: true });
  document.addEventListener('click', initOnInteraction, { passive: true });
}

// Main TTS function - FULLY SYNCHRONOUS for mobile compatibility
// NO AWAITS before speak() - this is critical for Android
export const playGeminiTTS = (text: string): void => {
  // Check availability
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    console.warn('Speech synthesis not available');
    return;
  }

  // Clean text - keep only speakable characters
  const cleanText = text.trim().replace(/[^\w\s.,!?'"-]/g, '');
  if (!cleanText) return;

  // CRITICAL: Cancel any existing speech FIRST
  window.speechSynthesis.cancel();
  currentUtterance = null;

  // Create utterance IMMEDIATELY - no delays
  try {
    const utterance = new SpeechSynthesisUtterance(cleanText);
    currentUtterance = utterance;

    // Get voices synchronously - use cached or whatever is available
    const voices = getVoicesSync();
    const voice = getBestVoice(voices);
    if (voice) {
      utterance.voice = voice;
    }

    // Settings for melodic, engaging pronunciation (trầm bổng, cuốn hút)
    utterance.lang = 'en-US';
    utterance.rate = 0.85;  // Slightly slower for clearer, more expressive speech
    utterance.pitch = 1.1;  // Slightly higher for warmer, more melodic tone
    utterance.volume = 1.0;

    // Event handlers
    utterance.onend = () => {
      currentUtterance = null;
    };

    utterance.onerror = (e) => {
      // Don't log 'interrupted' errors - they're normal when canceling
      if (e.error !== 'interrupted') {
        console.warn('TTS error:', e.error);
      }
      currentUtterance = null;
    };

    // SPEAK IMMEDIATELY - NO DELAYS!
    window.speechSynthesis.speak(utterance);

    // Mobile Chrome/Safari fix: resume if browser pauses speech
    // Check every 100ms and resume if paused
    let resumeAttempts = 0;
    const mobileResumeFix = setInterval(() => {
      resumeAttempts++;

      // Stop checking after speech ends or 30 seconds
      if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
        clearInterval(mobileResumeFix);
        return;
      }

      if (resumeAttempts > 300) { // 30 seconds max
        clearInterval(mobileResumeFix);
        currentUtterance = null;
        return;
      }

      // Resume if paused (happens on some Android devices)
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    }, 100);

  } catch (e) {
    console.error('TTS Error:', e);
  }
};

// Stop any playing audio
export const stopTTS = () => {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  currentUtterance = null;
};

// Optional: Gemini TTS for high-quality audio (can be used as enhancement)
export const generateAudioFromContent = async (text: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' }
        }
      }
    },
  });
  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
};

export const generateLessonPlan = async (topicInput?: string, textInput?: string, images: string[] = []): Promise<LessonPlan> => {
  const ai = getAI();
  const imageParts = images.map(data => ({ inlineData: { data, mimeType: 'image/jpeg' } }));
  const prompt = `NEXTGEN ENGLISH AI - EXPERT PEDAGOGY MODE (CHUYÊN GIA TIẾNG ANH).
  TASK: Analyze the provided content (text/images) and create a comprehensive lesson plan.
  
  ===== ⚠️⚠️⚠️ CRITICAL WARNING: ZERO TOLERANCE FOR GRADING ERRORS ⚠️⚠️⚠️ =====
  
  🚨 BẠN ĐANG TẠO BÀI KIỂM TRA CHO HỌC SINH THẬT! 🚨
  - Nếu đáp án SAI �?Học sinh b�?chấm SAI �?Học sinh mất niềm tin �?THẤT BẠI!
  - Mỗi câu hỏi PHẢI được kiểm tra 2 LẦN trước khi output
  - KHÔNG ĐƯỢC phép ra đ�?1 kiểu, đáp án 1 kiểu khác!
  
  ===== CRITICAL: 100% CONTENT EXTRACTION =====
  ⚠️ QUAN TRỌNG NHẤT: Phải trích xuất CHÍNH XÁC và ĐẦY Đ�?100% nội dung t�?nguồn!
  - Nếu ảnh/văn bản có 10 t�?vựng �?tạo ĐÚNG 10 t�?vựng, KHÔNG được b�?sót
  - Nếu ảnh/văn bản có 5 t�?vựng �?tạo ĐÚNG 5 t�?vựng
  - KHÔNG được t�?thêm t�?vựng mà nguồn không có
  - KHÔNG được b�?sót bất k�?t�?vựng nào trong nguồn
  - T�?vựng phải GIỐNG HỆT với nội dung gốc (word, IPA, meaning, example)
  
  CRITICAL LANGUAGE REQUIREMENTS:
  - GRAMMAR section:
    * "topic": Keep in English (the grammar rule name)
    * "explanation": MUST be in VIETNAMESE (giải thích bằng tiếng Việt, d�?hiểu cho học sinh)
    * "examples": Each example MUST include Vietnamese translation in format: "English sentence" �?"bản dịch tiếng việt viết thường"
  
  - VOCABULARY section (EXTRACT ALL FROM SOURCE):
    * Extract EVERY SINGLE vocabulary word from the source - DO NOT SKIP ANY
    * "word": English word (EXACTLY as shown in source)
    * "ipa": IPA pronunciation (EXACTLY as shown in source if available)
    * "meaning": Vietnamese meaning (EXACTLY as shown in source, lowercase)
    * "example": English example sentence (EXACTLY as shown in source)
    * "sentenceMeaning": Vietnamese translation of example (EXACTLY as shown in source, lowercase)
  
  ===== MEGATEST EXERCISE REQUIREMENTS (CHẤT LƯỢNG CHUYÊN GIA - 20 NĂM KINH NGHIỆM) =====
  
  🎓 YOU ARE A PROFESSIONAL ENGLISH TEACHER WITH 20 YEARS EXPERIENCE
  You must create exercises with 100% grammatical accuracy. Every answer key must be verified.
  
  ===== ⚠️ CRITICAL: 80% CONTENT MUST USE INPUT VOCABULARY/GRAMMAR =====
  
  MANDATORY RULE: At least 80% of ALL exercises (32/40 questions) MUST directly use the vocabulary, 
  grammar patterns, and concepts from the INPUT SOURCE provided by the user.
  
  EXAMPLE: If user provides these adverbs: "Always, Usually, Often, Sometimes, Never, Every day..."
  Then 80% of your exercises MUST:
  �?Multiple Choice: "I ____ go to school on foot." (A) always (B) tomorrow (C) yesterday (D) last week
  �?Fill-blank: "She ____ drinks coffee in the morning." �?Answer: usually/always/often
  �?Scramble: "always / I / breakfast / have / at 7 AM / ." �?"I always have breakfast at 7 AM."
  �?Error ID: "He (A) go (B) always (C) to school (D) late." �?Error at (A) or (B) based on grammar rules
  
  �?DO NOT create exercises about random topics unrelated to the input!
  �?DO NOT ignore the input vocabulary and create exercises about colors when user gave time adverbs!
  
  HOW TO CALCULATE 80%:
  - Total exercises = 10 MC + 10 Fill + 10 Scramble + 10 Error = 40 questions
  - 80% = At least 32 questions MUST use input vocabulary/grammar
  - Remaining 20% (8 questions) can introduce related/supporting concepts
  
  VERIFICATION CHECKLIST:
  �?Did I use at least 8/10 Multiple Choice questions with input vocabulary?
  �?Did I use at least 8/10 Fill-blank questions with input vocabulary?
  �?Did I use at least 8/10 Scramble sentences with input vocabulary?
  �?Did I use at least 8/10 Error ID sentences with input vocabulary?
  
  ===== ⚠️ CRITICAL: MATCH DIFFICULTY LEVEL WITH INPUT =====
  
  🎯 GOLDEN RULE: Exercise difficulty MUST match the input example sentences!
  
  STEP 1: Analyze the input sentences complexity:
  - Simple: "He has a bat." (Subject + verb + object) = 4-5 words, basic verbs
  - Medium: "I usually go to school by bus." = 6-8 words, more structure
  - Complex: "She wants to buy a new dress for the party." = 8+ words, infinitives, clauses
  
  STEP 2: Create exercises at the SAME complexity level!
  
  �?WRONG EXAMPLE (INPUT IS SIMPLE BUT EXERCISE IS COMPLEX):
  Input vocabulary: Bat - "He has a bat."
  �?Exercise: "She wants to use the map to find her way." (TOO COMPLEX!)
  �?Exercise: "I hit the ball with a bat." (MORE COMPLEX THAN INPUT!)
  �?Exercise: "The map shows the way to the city." (TOO COMPLEX!)
  
  �?CORRECT EXAMPLE (MATCHING DIFFICULTY):
  Input vocabulary: Bat - "He has a bat.", Map - "I need a map.", Bed - "The bed is big."
  �?Multiple Choice: "He has a ____." (A) bat (B) car (C) book (D) pen
  �?Fill-blank: "I need a ____." �?map
  �?Scramble: "has / He / a / bat / ." �?"He has a bat."
  �?Error ID: "He (A) have (B) a (C) bat (D) ." �?Error at (A): "have" should be "has"
  
  DIFFICULTY MATCHING RULES:
  1. If input uses 3-5 word sentences �?Exercises use 3-5 word sentences
  2. If input uses simple verbs (has, is, need) �?Exercises use same simple verbs
  3. If input uses basic structures (S + V + O) �?Exercises use same basic structures
  4. DO NOT add infinitives (to + verb) if input doesn't have them
  5. DO NOT add complex clauses if input only has simple sentences
  6. PREFER using the EXACT example sentences from input as exercise base
  
  VERIFICATION: Before submitting, check each exercise:
  �?Is this sentence complexity similar to input examples?
  �?Am I using vocabulary from the input, not new complex words?
  �?Would a student who learned the input vocabulary understand this exercise?
  
  ===== FUNDAMENTAL GRAMMAR RULES CHECKLIST =====
  Before creating ANY exercise, verify these 15 grammar rules:
  
  1. SUBJECT-VERB AGREEMENT:
     - He/She/It + V-s/es: "She walks" �? "She walk" �?     - I/You/We/They + V: "They walk" �? "They walks" �?     - There is + singular, There are + plural
  
  2. VERB vs NOUN FORMS (CRITICAL!):
     - VERB �?NOUN examples:
       * complain �?complaint ("make a complaint" �? "make a complain" �?
       * advise �?advice ("give advice" �? "give advise" �?
       * believe �?belief ("have a belief" �?
       * choose �?choice ("make a choice" �?
       * succeed �?success ("achieve success" �?
       * decide �?decision ("make a decision" �?
       * explain �?explanation ("give an explanation" �?
       * describe �?description ("write a description" �?
  
  3. TENSE CONSISTENCY:
     - Past markers (yesterday, last week, ago) �?Past tense
     - Present markers (every day, usually, always) �?Present tense
     - Now, at the moment �?Present continuous
     - Since, for + duration �?Present perfect
  
  4. ARTICLES (a/an/the):
     - a + consonant sound: "a book", "a university" (yoo-sound)
     - an + vowel sound: "an apple", "an hour" (silent h)
     - the = specific/known item
     - No article: plural general, uncountable general
  
  5. PREPOSITIONS:
     - listen TO music �?(not "listen music")
     - depend ON �?(not "depend of")
     - interested IN �?(not "interested on")
     - good AT �?(not "good in")
     - arrive AT (place) / arrive IN (city/country)
     - on Monday, in January, at 5 o'clock
  
  6. PRONOUN FORMS:
     - Subject: I, you, he, she, it, we, they
     - Object: me, you, him, her, it, us, them
     - Possessive adj: my, your, his, her, its, our, their
     - Possessive pronoun: mine, yours, his, hers, ours, theirs
     - "Him went home" �?�?"He went home" �?  
  7. COMPARATIVE & SUPERLATIVE:
     - Short adj: -er/-est (big �?bigger �?biggest)
     - Long adj: more/most (beautiful �?more beautiful)
     - NEVER combine: "more bigger" �? "most biggest" �?     - Irregular: good �?better �?best, bad �?worse �?worst
  
  8. ADVERB WORD ORDER:
     - Frequency adverbs (always, usually, often, sometimes, never):
       * Before main verb: "I always eat" �?       * After BE verb: "She is always late" �? "She always is late" �?  
  9. INFINITIVE vs GERUND:
     - want/need/decide/hope + TO + V: "want to go" �?     - enjoy/finish/avoid/mind + V-ing: "enjoy swimming" �?     - stop + to (purpose) vs stop + -ing (end activity)
  
  10. COUNTABLE vs UNCOUNTABLE:
      - Uncountable: water, information, advice, furniture, news, homework
      - "informations" �? "advices" �? "furnitures" �?      - much/little + uncountable, many/few + countable
  
  11. RELATIVE PRONOUNS:
      - who/that = people, which/that = things
      - whose = possession, where = place, when = time
  
  12. CONDITIONALS:
      - Type 0: If + present, present (general truth)
      - Type 1: If + present, will + V (real future)
      - Type 2: If + past, would + V (unreal present)
      - Type 3: If + had + PP, would have + PP (unreal past)
  
  13. MODAL VERBS:
      - Modal + base verb: "can swim" �? "can swims" �? "can to swim" �?      - must/should/can/could/may/might/will/would
  
  14. PASSIVE VOICE:
      - be + past participle: "is written", "was built", "has been done"
      - "The book was wrote" �?�?"The book was written" �?  
  15. THERE vs THEIR vs THEY'RE:
      - there = location/existence, their = possession, they're = they are
  
  ===== EXERCISE-SPECIFIC REQUIREMENTS =====
  
  📝 MULTIPLE CHOICE (multipleChoice):
  - "question": A sentence with ONE blank using "____" for the gap
  - "options": 4 options [A, B, C, D] - only ONE grammatically correct
  - "correctAnswer": Index of correct option (0-3)
  - ⚠️ VERIFY: Check the correct answer against grammar rules above
  - ⚠️ VERIFY: Ensure 3 wrong options are clearly grammatically incorrect
  - "explanation": Vietnamese explanation with grammar rule reference
  
  MULTIPLE CHOICE VALIDATION EXAMPLE:
  Question: "She ____ to school every day."
  Options: ["go", "goes", "going", "went"]
  �?Check: Subject "She" (3rd person singular) + "every day" (present habit)
  �?Rule 1: She + V-s = "goes"
  �?correctAnswer: 1 (index of "goes")

  📝 FILL-IN-THE-BLANK (fillBlank):
  ⚠️ CRITICAL: ONLY 1 WORD ANSWER, ONLY 1 BLANK
  - "question": Complete sentence with exactly ONE blank "____"
  - "correctAnswer": EXACTLY 1 WORD (no phrases like "am eating")
  - "alternativeAnswers": Array of alternative correct answers (if multiple words are equally correct)
    ⚠️ IMPORTANT: If input teaches that multiple words are interchangeable (e.g., "although/though", "because/since"),
    then include ALL valid alternatives! Example:
    - If prompt says "although/though are interchangeable" �?Use "correctAnswer": "although", "alternativeAnswers": ["though"]
    - If prompt says "because/since/as can be used" �?Use "correctAnswer": "because", "alternativeAnswers": ["since", "as"]
  - "explanation": Vietnamese explanation
  - ⚠️ VERIFY: The completed sentence must be 100% grammatically correct
  
  FILL-BLANK VALIDATION EXAMPLE:
  Question: "____ it rained, they went to the cinema." �?Answer: "Although"
  �?If input teaches both "although" and "though" are correct:
    correctAnswer: "Although", alternativeAnswers: ["Though"]
  �?Both answers will be accepted as correct!
  
  ===== 🚨🚨🚨 ERROR IDENTIFICATION - MANDATORY DOUBLE-CHECK PROTOCOL 🚨🚨🚨 =====
  
  📝 ERROR IDENTIFICATION (errorId):
  ⚠️ ĐÂY LÀ PHẦN D�?SAI NHẤT! PHẢI KIỂM TRA THẬT K�?
  
  🔴🔴🔴 CRITICAL - ĐỌC K�?VÀ LÀM ĐÚNG 🔴🔴🔴
  
  INDEX MAPPING TABLE - HỌC THUỘC LÒNG:
  ┌─────────┬─────────────────────�?  �?CH�?CÁI �?correctOptionIndex  �?  ├─────────┼─────────────────────�?  �?  (A)   �?        0           �?  �?  (B)   �?        1           �?  �?  (C)   �?        2           �?  �?  (D)   �?        3           �?  └─────────┴─────────────────────�?  
  📋 QUY TRÌNH BẮT BUỘC 5 BƯỚC:
  
  BƯỚC 1 - TẠO CÂU:
  Viết câu có ĐÚNG 1 lỗi ng�?pháp. Đánh dấu 4 phần (A), (B), (C), (D).
  
  BƯỚC 2 - TÌM LỖI:
  Xác định CH�?CÁI của phần có lỗi. Ví d�? "Lỗi �?phần (A)"
  
  BƯỚC 3 - CHUYỂN ĐỔI CH�?CÁI SANG INDEX:
  Dùng bảng trên: A�?, B�?, C�?, D�?
  Ví d�? Lỗi �?(A) �?correctOptionIndex = 0
  
  BƯỚC 4 - GHI VÀO JSON:
  "correctOptionIndex": [s�?đã tính �?bước 3]
  
  BƯỚC 5 - KIỂM TRA NGƯỢC (BẮT BUỘC!):
  Đọc lại explanation và xem phần có lỗi có khớp với options[correctOptionIndex] không.
  Nếu explanation nói "lỗi �?go" thì options[correctOptionIndex] PHẢI chứa "go"!
  
  ===== VÍ D�?THỰC T�?- LÀM THEO Y HỆT =====
  
  📌 VÍ D�?1 - LỖI �?(A):
  sentence: "She (A) have (B) a (C) table (D) ."
  options: ["(A) have", "(B) a", "(C) table", "(D) ."]
  
  Bước 2: Lỗi �?"have" �?Đây là phần (A)
  Bước 3: (A) �?index 0
  Bước 4: correctOptionIndex: 0
  Bước 5: options[0] = "(A) have" �?KHỚP VỚI LỖI!
  
  explanation: "Lỗi �?(A). 'She' là ngôi 3 s�?ít �?dùng 'has', không phải 'have'."
  
  📌 VÍ D�?2 - LỖI �?(B):
  sentence: "The (A) bananas (B) is (C) yellow (D) ."
  options: ["(A) bananas", "(B) is", "(C) yellow", "(D) ."]
  
  Bước 2: Lỗi �?"is" �?Đây là phần (B)
  Bước 3: (B) �?index 1
  Bước 4: correctOptionIndex: 1
  Bước 5: options[1] = "(B) is" �?KHỚP VỚI LỖI!
  
  explanation: "Lỗi �?(B). 'bananas' là s�?nhiều �?dùng 'are', không phải 'is'."
  
  📌 VÍ D�?3 - LỖI �?(A) VỚI THÌ QUÁ KH�?
  sentence: "I (A) go (B) to (C) the aquarium (D) yesterday."
  options: ["(A) go", "(B) to", "(C) the aquarium", "(D) yesterday"]
  
  Bước 2: "yesterday" = thời gian quá kh�?�?lỗi �?"go" cần đổi thành "went"
          "go" nằm �?phần (A)
  Bước 3: (A) �?index 0
  Bước 4: correctOptionIndex: 0
  Bước 5: options[0] = "(A) go" �?KHỚP! 
          �?KHÔNG PHẢI options[1] = "(B) to"!
  
  explanation: "Lỗi �?(A). 'yesterday' là thời gian quá kh�?�?'go' phải đổi thành 'went'."
  
  ⚠️ LƯU Ý: Trong ví d�?trên, "to" KHÔNG có lỗi! "go to" là đúng ng�?pháp.
  Lỗi là �?THÌ của động t�?(go �?went), không phải �?giới t�?"to".
  
  📌 VÍ D�?4 - LỖI �?(D):
  sentence: "He (A) put (B) the (C) cup (D) in the table."
  options: ["(A) put", "(B) the", "(C) cup", "(D) in the table"]
  
  Bước 2: Lỗi �?"in the table" �?phải dùng "on" (vật �?TRÊN b�?mặt)
          "in the table" nằm �?phần (D)
  Bước 3: (D) �?index 3
  Bước 4: correctOptionIndex: 3
  Bước 5: options[3] = "(D) in the table" �?KHỚP VỚI LỖI!
  
  explanation: "Lỗi �?(D). Vật �?TRÊN b�?mặt �?dùng 'on', không phải 'in'."
  
  📌 VÍ D�?5 - LỖI �?(C):
  sentence: "They (A) went (B) to (C) school yesterday (D) ."
  options: ["(A) went", "(B) to", "(C) school yesterday", "(D) ."]
  
  Gi�?s�?câu này đúng ng�?pháp, KHÔNG có lỗi �?ĐỔI thành câu khác!
  
  sentence: "She (A) can (B) swims (C) very fast (D) ."
  options: ["(A) can", "(B) swims", "(C) very fast", "(D) ."]
  
  Bước 2: "can" là modal verb �?động t�?theo sau phải �?dạng nguyên
          "swims" sai, phải là "swim" �?Lỗi �?(B)
  Bước 3: (B) �?index 1
  Bước 4: correctOptionIndex: 1
  Bước 5: options[1] = "(B) swims" �?KHỚP VỚI LỖI!
  
  explanation: "Lỗi �?(B). Sau 'can' động t�?phải �?dạng nguyên �?'swim', không phải 'swims'."
  
  ===== �?SAI LẦM THƯỜNG GẶP - TUYỆT ĐỐI KHÔNG LÀM �?=====
  
  �?SAI LẦM 1: Explanation nói lỗi �?"go" nhưng correctOptionIndex = 1
  Vì "go" �?phần (A) �?correctOptionIndex PHẢI = 0, không phải 1!
  
  �?SAI LẦM 2: Nhầm lẫn giữa v�?trí xuất hiện và ch�?cái
  "go" xuất hiện đầu tiên NHƯNG nó có th�?là (A), (B), (C) hoặc (D) tùy câu
  �?Luôn xem ch�?cái trong ngoặc đơn, KHÔNG đếm v�?trí!
  
  ===== KIỂM TRA CUỐI CÙNG CHO ERROR ID =====
  
  🔍 FINAL CHECK - ĐỌC TO VÀ TR�?LỜI:
  
  1. Explanation nói lỗi �?t�?cụm t�?nào? �?Ghi ra: "__________"
  2. T�?cụm t�?đó nằm �?ch�?cái nào (A/B/C/D)? �?Ghi ra: "(___)"
  3. Ch�?cái đó tương ứng với index mấy? �?A=0, B=1, C=2, D=3 �?Index: ___
  4. correctOptionIndex trong JSON có = index �?bước 3 không? �?CÓ �?/ KHÔNG �?  
  Nếu bước 4 = KHÔNG �?SỬA LẠI correctOptionIndex!
  
  ===== 🚨🚨🚨 SCRAMBLE - MANDATORY WORD MATCH VALIDATION 🚨🚨🚨 =====

  📝 SCRAMBLE (scramble):
  ⚠️ LỖI THƯỜNG GẶP NHẤT: T�?TRONG SCRAMBLED KHÔNG KHỚP VỚI CORRECTSENTENCE!
  
  🔴 QUY TẮC VÀNG: scrambled PHẢI chứa CHÍNH XÁC các t�?trong correctSentence!
  
  📋 QUY TRÌNH BẮT BUỘC CHO MỖI CÂU SCRAMBLE:
  
  BƯỚC 1 - VIẾT CORRECTSENTENCE TRƯỚC:
  Viết câu hoàn chỉnh, kiểm tra ng�?pháp 100% đúng.
  Ví d�? "He has a bat."
  
  BƯỚC 2 - TÁCH T�?
  Tách correctSentence thành mảng t�?(bao gồm c�?dấu câu).
  Ví d�? ["He", "has", "a", "bat", "."] �?5 phần t�?  
  BƯỚC 3 - XÁO TRỘN:
  Xáo trộn mảng t�?đ�?tạo scrambled.
  Ví d�? ["bat", "a", "He", "has", "."] �?5 phần t�?  
  BƯỚC 4 - XÁC MINH:
  ĐẾM S�?PHẦN T�? scrambled.length === correctSentence (đã tách).length?
  SO SÁNH T�? Mỗi t�?trong scrambled có trong correctSentence không?
  
  ===== VÍ D�?ĐÚNG =====
  
  VÍ D�?1:
  �?correctSentence: "He has a bat."
  �?Tách t�? ["He", "has", "a", "bat", "."] (5 t�?
  �?scrambled: ["bat", "a", "He", "has", "."] (5 t�? �?KHỚP!
  
  VÍ D�?2:
  �?correctSentence: "This is a green apple."
  �?Tách t�? ["This", "is", "a", "green", "apple", "."] (6 t�?
  �?scrambled: ["green", "a", "apple", "This", "is", "."] (6 t�? �?KHỚP!
  
  ===== VÍ D�?SAI - TUYỆT ĐỐI KHÔNG LÀM =====
  
  �?SAI - THỪA T�?
  correctSentence: "I like pizza."
  scrambled: ["to", "I", "pizza", "like", "."] �?Thừa "to"! WRONG!
  
  �?SAI - THIẾU T�?
  correctSentence: "This is a green apple."
  scrambled: ["green", "apple", "This", "is", "."] �?Thiếu "a"! WRONG!
  
  �?SAI - T�?KHÁC:
  correctSentence: "This is a green apple."
  scrambled: ["green", "an", "apple", "This", "is", "."] �?"an" thay vì "a"! WRONG!
  
  ===== KIỂM TRA CUỐI CÙNG CHO SCRAMBLE =====
  Trước khi submit mỗi câu Scramble, TR�?LỜI các câu hỏi:
  �?correctSentence có đúng ng�?pháp 100% không?
  �?Tôi đã tách correctSentence thành từng t�?chưa?
  �?scrambled có ĐÚNG s�?t�?như correctSentence không?
  �?Mỗi t�?trong scrambled có xuất hiện trong correctSentence không?
  �?Không có t�?thừa, t�?thiếu, hay t�?b�?thay đổi?

  MANDATORY REQUIREMENTS:
  1. Extract 100% of vocabulary and grammar from source
  2. Create EXACTLY 10 Multiple Choice Questions
  3. Create EXACTLY 10 Scramble Questions
  4. Create EXACTLY 10 Fill-in-the-blank Questions
  5. Create EXACTLY 10 Vocabulary Translation Questions (vocabTranslation)
  6. Create EXACTLY 5 True/False Reading Comprehension Questions (trueFalse)
  7. Create EXACTLY 5 Listening Comprehension Questions (listening)
  NOTE: Do NOT create Error Identification Questions.
  TOTAL: 10 + 10 + 10 + 10 + 5 + 5 = 50 questions (graded on 10-point scale)
  
  ===== 📝 VOCABULARY TRANSLATION (vocabTranslation) =====
  Bài tập t�?vựng Anh-Việt: Cho t�?tiếng Anh, chọn 1 trong 4 nghĩa tiếng Việt đúng.
  
  STRUCTURE:
  {
    "id": "vocab_1",
    "word": "apple",
    "options": ["qu�?táo", "qu�?cam", "qu�?chuối", "qu�?lê"],
    "correctAnswer": 0,
    "explanation": "'apple' nghĩa là 'qu�?táo'"
  }
  
  RULES:
  - "word": T�?tiếng Anh t�?bài học vocabulary
  - "options": 4 nghĩa tiếng Việt (1 đúng, 3 sai nhưng hợp lý)
  - "correctAnswer": Index của đáp án đúng (0-3)
  - ⚠️ 3 đáp án sai PHẢI là t�?cùng ch�?đ�? KHÔNG quá d�?nhận ra
  - ⚠️ PHẢI s�?dụng t�?vựng t�?vocabulary section của bài học
  
  ===== 📝 TRUE/FALSE READING (trueFalse + trueFalsePassage) =====
  Bài tập đọc hiểu True/False: MỘT bài đọc c�?định + 5 câu hỏi True/False dựa trên bài đọc đó.
  
  ⚠️ QUAN TRỌNG: BẠN PHẢI TẠO 2 PHẦN:
  1. "trueFalsePassage": Một đoạn văn tiếng Anh 100-150 t�?v�?ch�?đ�?bài học
  2. "trueFalse": 5 câu hỏi True/False DỰA TRÊN đoạn văn đó
  
  🎯 CRITICAL: PASSAGE DIFFICULTY MUST MATCH INPUT VOCABULARY LEVEL 🎯
  
  STEP 1 - ANALYZE INPUT DIFFICULTY:
  Xem xét t�?vựng và câu ví d�?đầu vào đ�?xác định trình đ�?
  
  📗 BEGINNER (Cơ bản - A1/A2):
  - T�?vựng đơn giản: apple, cat, dog, school, family, big, small
  - Câu ví d�?ngắn: "He has a bat.", "I like pizza.", "She is happy."
  - Cấu trúc: Subject + Verb + Object (3-6 t�?
  �?Tạo passage với câu ngắn 5-8 t�? t�?vựng đơn giản, thì hiện tại đơn
  
  📘 INTERMEDIATE (Trung cấp - B1):
  - T�?vựng phong phú hơn: environment, technology, experience
  - Câu ví d�?dài hơn: "I usually go to school by bus every morning."
  - Cấu trúc: Có trạng t�? giới t�?(6-12 t�?
  �?Tạo passage với câu 8-15 t�? nhiều thì, t�?nối đơn giản
  
  📙 ADVANCED (Nâng cao - B2+):
  - T�?vựng học thuật: sustainable, consequence, phenomenon
  - Câu phức tạp với mệnh đ�?ph�? infinitive, gerund
  �?Tạo passage với câu phức, t�?nối logic, nhiều thì
  
  STEP 2 - USE INPUT VOCABULARY IN PASSAGE:
  ⚠️ BẮT BUỘC: Passage PHẢI s�?dụng ÍT NHẤT 5 t�?vựng t�?vocabulary section đầu vào!
  Điều này giúp học sinh ôn tập t�?vựng đã học qua ng�?cảnh đọc hiểu.
  
  EXAMPLE - BEGINNER LEVEL:
  Input vocab: cat, dog, big, small, happy
  �?trueFalsePassage: "I have a cat. My cat is small. It is very happy. My friend has a dog. The dog is big. The cat and the dog are friends. They play together every day."
  
  EXAMPLE - INTERMEDIATE LEVEL:  
  Input vocab: environment, protect, recycle, pollution, nature
  �?trueFalsePassage: "Today, many people want to protect the environment. They recycle paper, plastic, and glass. Pollution is a big problem in cities. We should take care of nature and plant more trees. Everyone can help protect our planet."
  
  STRUCTURE FOR trueFalsePassage:
  "trueFalsePassage": "[Đoạn văn 150-200 t�?PHÙ HỢP VỚI TRÌNH Đ�?t�?vựng đầu vào]"
  
  STRUCTURE FOR trueFalse:
  {
    "id": "tf_1",
    "statement": "Tom is a teacher.",
    "isTrue": false,
    "explanation": "Sai. Theo bài đọc, Tom là học sinh (student), không phải giáo viên."
  }
  
  RULES:
  - "trueFalsePassage": 150-200 t�? Đ�?KHÓ TƯƠNG ĐƯƠNG với t�?vựng đầu vào
  - "trueFalsePassage": PHẢI s�?dụng ít nhất 5 t�?t�?vocabulary section
  - "statement": Một câu khẳng định VỀ NỘI DUNG BÀI ĐỌC (tiếng Anh)
  - "isTrue": true hoặc false
  - "explanation": Giải thích bằng tiếng Việt, trích dẫn thông tin t�?bài đọc
  - ⚠️ TẤT C�?5 statements PHẢI dựa trên trueFalsePassage
  - ⚠️ 2-3 câu TRUE, 2-3 câu FALSE (cân bằng)
  - ⚠️ KHÔNG được tạo statement v�?thông tin không có trong bài đọc
  - ⚠️ Câu hỏi cũng phải PHÙ HỢP trình đ�?(câu hỏi đơn giản cho beginner)
  
  ===== 📝 LISTENING COMPREHENSION (listening) =====
  Bài tập nghe hiểu: 5 câu hỏi nghe với Text-to-Speech.
  
  STRUCTURE:
  {
    "id": "listen_1",
    "audioText": "I go to school every day.",
    "options": ["I go to school every day.", "I go to work every day.", "I go to the park every day.", "I stay home every day."],
    "correctAnswer": 0,
    "explanation": "Câu nghe là 'I go to school every day.' - Tôi đi học mỗi ngày."
  }
  
  RULES:
  - "id": ID duy nhất (listen_1, listen_2, ...)
  - "audioText": Câu tiếng Anh ngắn gọn (5-12 t�?, S�?DỤNG T�?VỰNG ĐÃ HỌC
  - "options": 4 lựa chọn text (1 đúng = audioText, 3 sai nhưng tương t�?
  - "correctAnswer": Index của đáp án đúng (0-3)
  - "explanation": Giải thích tiếng Việt + dịch nghĩa câu đúng
  - ⚠️ Câu nghe PHẢI s�?dụng t�?vựng và ng�?pháp t�?bài học
  - ⚠️ 3 đáp án sai phải giống câu đúng nhưng thay đổi 1-2 t�?  - ⚠️ Đ�?khó phải PHÙ HỢP với trình đ�?đầu vào
  
  ===== FINAL QUALITY ASSURANCE =====
  Before submitting, verify EACH question:
  
  �?CHECKLIST FOR EVERY QUESTION:
  �?Does the correct answer follow the 15 grammar rules?
  �?Is there only ONE possible correct answer?
  �?For Scramble: Does scrambled array contain EXACT same words as correctSentence?
  �?For Scramble: No extra words, no missing words, no changed words?
  �?For VocabTranslation: Is the word from the vocabulary section?
  �?For VocabTranslation: Are all 4 options reasonable Vietnamese translations?
  �?For TrueFalse: Is the statement based on the reading passage?
  �?For TrueFalse: Is the explanation accurate in Vietnamese?
  �?Is the explanation accurate and educational?
  
  ⚠️ IF UNSURE: Re-read the 15 grammar rules and apply them systematically
  
  All content must align strictly with the source provided. Do not invent unrelated topics.`;

  const inputParts: any[] = [];
  if (textInput) inputParts.push({ text: `SOURCE TEXT:\n${textInput}` });
  if (topicInput) inputParts.push({ text: `TOPIC FOCUS:\n${topicInput}` });
  inputParts.push(...imageParts);
  inputParts.push({ text: prompt });

  // Use fallback mechanism - automatically retry with next model if current fails
  return callWithFallback(async (modelId: string) => {
    console.log(`🤖 Đang th�?với model: ${modelId}`);
    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts: inputParts },
      config: { responseMimeType: "application/json", responseSchema: lessonSchema }
    });
    return safeJsonParse<LessonPlan>(response.text);
  });
};

export const analyzeImageAndCreateContent = async (images: string[], mimeType: string, char: CharacterProfile, mode: AppMode, customPrompt?: string, topic?: string, text?: string): Promise<ContentResult> => {
  const ai = getAI();
  const imageParts = images.map(data => ({ inlineData: { data, mimeType } }));
  const prompt = `NEXTGEN ENGLISH AI - CREATIVE STORYTELLER.
  
  Analyze the input and create:
  1. A magical story featuring ${char.name}.
  2. EXACTLY 10 Comprehension Quiz questions.
  3. EXACTLY 10 Speaking interaction prompts.
  4. A SCIENTIFIC WRITING PROMPT for the student in BOTH English and Vietnamese.
  
  Source material: Topic: ${topic || "N/A"}, Text: ${text || "N/A"}.
  Character context: ${char.promptContext}.`;

  const response = await ai.models.generateContent({
    model: getSelectedModel(),
    contents: { parts: [...imageParts, { text: prompt }] },
    config: { responseMimeType: "application/json", responseSchema: contentResultSchema }
  });
  return safeJsonParse<ContentResult>(response.text);
};

const safeJsonParse = <T>(text: string): T => {
  try {
    let cleanText = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const start = Math.min(cleanText.indexOf('{') === -1 ? Infinity : cleanText.indexOf('{'), cleanText.indexOf('[') === -1 ? Infinity : cleanText.indexOf('['));
    const end = Math.max(cleanText.lastIndexOf('}'), cleanText.lastIndexOf(']'));
    if (start !== Infinity && end !== -1) cleanText = cleanText.substring(start, end + 1);
    return JSON.parse(cleanText) as T;
  } catch (e) { throw new Error("Lỗi x�?lý d�?liệu AI."); }
};

const lessonSchema = { type: Type.OBJECT, properties: { topic: { type: Type.STRING }, vocabulary: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { word: { type: Type.STRING }, emoji: { type: Type.STRING }, ipa: { type: Type.STRING }, meaning: { type: Type.STRING }, example: { type: Type.STRING }, sentenceMeaning: { type: Type.STRING }, type: { type: Type.STRING } }, required: ["word", "ipa", "meaning", "example", "type", "emoji"] } }, grammar: { type: Type.OBJECT, properties: { topic: { type: Type.STRING }, explanation: { type: Type.STRING }, examples: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["topic", "explanation", "examples"] }, reading: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, passage: { type: Type.STRING }, translation: { type: Type.STRING }, comprehension: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, question: { type: Type.STRING }, options: { type: Type.ARRAY, items: { type: Type.STRING } }, correctAnswer: { type: Type.INTEGER }, explanation: { type: Type.STRING } }, required: ["id", "question", "options", "correctAnswer"] } } }, required: ["title", "passage", "translation", "comprehension"] }, practice: { type: Type.OBJECT, properties: { listening: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, audioText: { type: Type.STRING }, options: { type: Type.ARRAY, items: { type: Type.STRING } }, correctAnswer: { type: Type.INTEGER }, explanation: { type: Type.STRING } }, required: ["id", "audioText", "options", "correctAnswer"] } }, megaTest: { type: Type.OBJECT, properties: { multipleChoice: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, question: { type: Type.STRING }, options: { type: Type.ARRAY, items: { type: Type.STRING } }, correctAnswer: { type: Type.INTEGER }, explanation: { type: Type.STRING } }, required: ["id", "question", "options", "correctAnswer"] } }, scramble: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, scrambled: { type: Type.ARRAY, items: { type: Type.STRING } }, correctSentence: { type: Type.STRING }, translation: { type: Type.STRING } }, required: ["id", "scrambled", "correctSentence"] } }, fillBlank: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, question: { type: Type.STRING }, correctAnswer: { type: Type.STRING }, alternativeAnswers: { type: Type.ARRAY, items: { type: Type.STRING } }, clueEmoji: { type: Type.STRING }, explanation: { type: Type.STRING } }, required: ["id", "question", "correctAnswer"] } }, errorId: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, sentence: { type: Type.STRING }, options: { type: Type.ARRAY, items: { type: Type.STRING } }, correctOptionIndex: { type: Type.INTEGER }, explanation: { type: Type.STRING } }, required: ["id", "sentence", "correctOptionIndex"] } }, vocabTranslation: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, word: { type: Type.STRING }, options: { type: Type.ARRAY, items: { type: Type.STRING } }, correctAnswer: { type: Type.INTEGER }, explanation: { type: Type.STRING } }, required: ["id", "word", "options", "correctAnswer"] } }, trueFalsePassage: { type: Type.STRING }, trueFalse: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, statement: { type: Type.STRING }, isTrue: { type: Type.BOOLEAN }, explanation: { type: Type.STRING } }, required: ["id", "statement", "isTrue", "explanation"] } }, matching: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, left: { type: Type.STRING }, right: { type: Type.STRING } }, required: ["id", "left", "right"] } } }, required: ["multipleChoice", "scramble", "fillBlank", "vocabTranslation", "trueFalsePassage", "trueFalse", "matching"] } }, required: ["listening", "megaTest"] }, teacherTips: { type: Type.STRING } }, required: ["topic", "vocabulary", "grammar", "reading", "practice", "teacherTips"] };

const contentResultSchema = {
  type: Type.OBJECT,
  properties: {
    storyEnglish: { type: Type.STRING },
    translatedText: { type: Type.STRING },
    writingPromptEn: { type: Type.STRING },
    writingPromptVi: { type: Type.STRING },
    vocabulary: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { word: { type: Type.STRING }, meaning: { type: Type.STRING }, emoji: { type: Type.STRING } } } },
    imagePrompt: { type: Type.STRING },
    comprehensionQuestions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, question: { type: Type.STRING }, options: { type: Type.ARRAY, items: { type: Type.STRING } }, correctAnswer: { type: Type.INTEGER }, explanation: { type: Type.STRING } } } },
    speakingQuestions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, question: { type: Type.STRING }, suggestedAnswer: { type: Type.STRING } } } }
  },
  required: ["storyEnglish", "translatedText", "writingPromptEn", "writingPromptVi", "vocabulary", "imagePrompt", "comprehensionQuestions", "speakingQuestions"]
};

export const generateMindMap = async (content: any, mode: MindMapMode): Promise<MindMapData> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Create a professional Mind Map following Tony Buzan's principles for: ${JSON.stringify(content)}. 
    Structure: Root node is the main topic. Child nodes are key sub-concepts with emojis. 
    Output strictly in JSON format matching the schema.`,
    config: { responseMimeType: "application/json", responseSchema: mindMapSchema }
  });
  return safeJsonParse<MindMapData>(response.text);
};

export const evaluateSpeech = async (base64Audio: string): Promise<SpeechEvaluation> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: { parts: [{ inlineData: { data: base64Audio, mimeType: 'audio/wav' } }, { text: "Evaluate the student's speaking performance on a scale of 0-10. Provide encouraging feedback in Vietnamese." }] },
    config: { responseMimeType: "application/json", responseSchema: speechEvaluationSchema }
  });
  return safeJsonParse<SpeechEvaluation>(response.text);
};

export const generateStoryImage = async (prompt: string, style: string, ratio: ImageRatio): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: `A high-quality educational illustration for kids: ${prompt}. Artistic Style: ${style}. High resolution, 8k, vibrant colors.` }] },
    config: { imageConfig: { aspectRatio: ratio } }
  });
  for (const part of response.candidates[0].content.parts) { if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`; }
  throw new Error("Image generation failed");
};

export const correctWriting = async (userText: string, creativePrompt: string): Promise<any> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Evaluate and correct this student writing: "${userText}". The topic was: "${creativePrompt}". Provide a score (0-10), feedback, fixed text, and detailed error list.`,
    config: { responseMimeType: "application/json", responseSchema: writingCorrectionSchema }
  });
  return safeJsonParse<any>(response.text);
};

export const generatePresentation = async (data: MindMapData): Promise<PresentationScript> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Create a professional English presentation script for a student based on this Mind Map data: ${JSON.stringify(data)}. 
    Include a warm introduction, body sections for each node, and a polite conclusion. 
    Provide both English script and Vietnamese translation.`,
    config: { responseMimeType: "application/json", responseSchema: presentationSchema }
  });
  return safeJsonParse<PresentationScript>(response.text);
};

export const generateMindMapPrompt = async (content: any, mode: MindMapMode): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `TASK: Generate a single, highly detailed English prompt for drawing a professional Tony Buzan Mind Map using AI art tools (like Midjourney or DALL-E). 
    CONTENT SOURCE: ${JSON.stringify(content)}. 
    
    PROMPT SPECIFICATIONS:
    - Style: 3D Organic Tony Buzan Mind Map, Pixar-style animation render.
    - Central Theme: A clear 3D icon representing the lesson topic at the center.
    - Branches: Curvy, organic, thick-to-thin colorful branches spreading outwards.
    - Elements: Floating keywords in English, cute 3D emojis/icons next to branches.
    - Environment: Clean bright studio background, 8k resolution, cinematic lighting, vibrant pedagogical colors.
    - Exclude: No text other than the keywords. 
    
    JUST PROVIDE THE RAW PROMPT STRING.`
  });
  return response.text;
};

const mindMapSchema = { type: Type.OBJECT, properties: { center: { type: Type.OBJECT, properties: { title_en: { type: Type.STRING }, title_vi: { type: Type.STRING }, emoji: { type: Type.STRING } } }, nodes: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { text_en: { type: Type.STRING }, text_vi: { type: Type.STRING }, emoji: { type: Type.STRING } } } } } };
const presentationSchema = { type: Type.OBJECT, properties: { introduction: { type: Type.OBJECT, properties: { english: { type: Type.STRING }, vietnamese: { type: Type.STRING } } }, body: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { keyword: { type: Type.STRING }, script: { type: Type.STRING } } } }, conclusion: { type: Type.OBJECT, properties: { english: { type: Type.STRING }, vietnamese: { type: Type.STRING } } } } };
const speechEvaluationSchema = { type: Type.OBJECT, properties: { scores: { type: Type.OBJECT, properties: { pronunciation: { type: Type.NUMBER } } }, overallScore: { type: Type.NUMBER }, feedback: { type: Type.STRING } } };
const writingCorrectionSchema = { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, feedback: { type: Type.STRING }, fixedText: { type: Type.STRING }, breakdown: { type: Type.OBJECT, properties: { vocabulary: { type: Type.NUMBER }, grammar: { type: Type.NUMBER } } }, errors: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { original: { type: Type.STRING }, fixed: { type: Type.STRING }, reason: { type: Type.STRING } } } }, suggestions: { type: Type.STRING } } };
