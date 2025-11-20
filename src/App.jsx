import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, Edit3, Eye, Plus, Trash2, Save, RefreshCw, CheckCircle, XCircle, Users, Loader2, EyeOff, Lock, AlertTriangle } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, addDoc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';

// ==================================================================================
// 🔧 TEACHER CONFIGURATION AREA
// Paste your keys inside the quotes below.
// ==================================================================================

const GEMINI_API_KEY = "AIzaSyAP9aBXGhgxgZvN7AoBXvab2KiQ1AwzSK0"; // Example: "AIzaSy..."

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBUCnlQezJag7yzn_RgzcGmsDZj0vUw17Y",
  authDomain: "mathquiz-7bd8e.firebaseapp.com",
  projectId: "mathquiz-7bd8e",
  storageBucket: "mathquiz-7bd8e.firebasestorage.app",
  messagingSenderId: "899612963466",
  appId: "1:899612963466:web:9972fdef028ace44f37373",
  measurementId: "G-E4FZS9M3PD"
};

const TEACHER_PASSWORD = "112358"; // Change this to a secret password for yourself

// ==================================================================================
// 🚀 APP CODE (Do not edit below unless you know React)
// ==================================================================================

// --- Initialize Services (Only if config is present) ---
let app, auth, db;
const isConfigured = FIREBASE_CONFIG.apiKey && GEMINI_API_KEY;

if (isConfigured) {
  app = initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);
  db = getFirestore(app);
}

// --- AI Grading Service ---
const gradeWithAI = async (quiz, answers) => {
  if (!GEMINI_API_KEY) return null;
  try {
    const prompt = `
      You are a strict but helpful math teacher. Grade the following student answers.
      
      Quiz Title: ${quiz.title}
      
      Questions and Student Answers:
      ${quiz.questions.map(q => `
        Question ID: ${q.id}
        Question: ${q.text}
        Student Answer: ${answers[q.id] || "(No answer provided)"}
      `).join('\n')}

      For each question, determine if the math is correct.
      The student is using LaTeX.
      
      Return ONLY a valid JSON object with this structure:
      {
        "evaluations": {
          "question_id_here": {
            "isCorrect": boolean,
            "feedback": "Short, helpful 1-sentence feedback."
          }
        }
      }
    `;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      }
    );

    const data = await response.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
        text = text.replace(/```json\n?|\n?```/g, '');
        return JSON.parse(text);
    }
    return null;
  } catch (error) {
    console.error("AI Grading Error:", error);
    return null;
  }
};

// --- KaTeX Loader ---
const useKaTeX = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  useEffect(() => {
    if (window.katex) { setIsLoaded(true); return; }
    const link = document.createElement('link');
    link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js";
    script.onload = () => setIsLoaded(true);
    document.body.appendChild(script);
  }, []);
  return isLoaded;
};

// --- Math Renderer ---
const MathRenderer = ({ text, className = "" }) => {
  const containerRef = useRef(null);
  const isKaTeXLoaded = useKaTeX();

  useEffect(() => {
    if (!isKaTeXLoaded || !containerRef.current || typeof text !== 'string') return;
    const renderMath = () => {
        const container = containerRef.current;
        container.innerHTML = '';
        const parts = text.split(/(\$\$[\s\S]*?\$\$)/g);
        parts.forEach(part => {
            if (part.startsWith('$$') && part.endsWith('$$')) {
                const math = part.slice(2, -2);
                const span = document.createElement('div');
                span.className = "my-2 text-center overflow-x-auto";
                try { window.katex.render(math, span, { displayMode: true, throwOnError: false }); } 
                catch (e) { span.textContent = part; }
                container.appendChild(span);
            } else {
                const inlineParts = part.split(/(\$[\s\S]*?\$)/g);
                inlineParts.forEach(subPart => {
                    if (subPart.startsWith('$') && subPart.endsWith('$')) {
                        const math = subPart.slice(1, -1);
                        const span = document.createElement('span');
                        try { window.katex.render(math, span, { displayMode: false, throwOnError: false }); } 
                        catch (e) { span.textContent = subPart; }
                        container.appendChild(span);
                    } else {
                        const span = document.createElement('span');
                        span.textContent = subPart;
                        container.appendChild(span);
                    }
                });
            }
        });
    };
    renderMath();
  }, [text, isKaTeXLoaded]);

  if (!isKaTeXLoaded) return <span className="text-slate-400 text-xs">...</span>;
  if (typeof text !== 'string') return null; 
  return <div ref={containerRef} className={`whitespace-pre-wrap ${className}`} />;
};

// --- Main Application ---
export default function App() {
  // Configuration Check
  if (!isConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-lg w-full text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
            <h1 className="text-xl font-bold text-slate-800">Setup Required</h1>
            <p className="text-slate-600">You need to configure your keys to use this app.</p>
            <div className="text-left bg-slate-50 p-4 rounded border border-slate-200 text-sm font-mono overflow-x-auto">
                1. Open <strong>MathQuizApp.jsx</strong><br/>
                2. Find <strong>FIREBASE_CONFIG</strong> and paste your Firebase keys.<br/>
                3. Find <strong>GEMINI_API_KEY</strong> and paste your AI key.
            </div>
        </div>
      </div>
    );
  }

  const [user, setUser] = useState(null);
  const [mode, setMode] = useState('landing'); 
  const [passwordInput, setPasswordInput] = useState('');
  
  const [quiz, setQuiz] = useState({
    id: 'active-quiz',
    title: "New Quiz",
    questions: [{ id: 1, text: "Solve for x: $2x = 10$", showFeedback: true }]
  });
  const [studentName, setStudentName] = useState('');
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [submissionStatus, setSubmissionStatus] = useState('');

  // Initialize Auth
  useEffect(() => {
    signInAnonymously(auth);
    return onAuthStateChanged(auth, setUser);
  }, []);

  // Load Quiz (Real-time)
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'quizzes', 'active'), (doc) => {
      if (doc.exists()) setQuiz(doc.data());
    });
    return () => unsub();
  }, [user]);

  // Load Submissions (Teacher)
  useEffect(() => {
    if (!user || mode !== 'teacher') return;
    const q = query(collection(db, 'submissions'), orderBy('timestamp', 'desc'), limit(50));
    const unsub = onSnapshot(q, (snapshot) => {
      setSubmissions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user, mode]);

  // Actions
  const handleSaveQuiz = async () => {
    await setDoc(doc(db, 'quizzes', 'active'), quiz);
    alert("Quiz published!");
  };

  const handleSubmitQuiz = async () => {
    if (!studentName.trim()) return alert("Name required");
    setIsSubmitting(true);
    setSubmissionStatus('AI Grading...');
    
    const grading = await gradeWithAI(quiz, answers);
    setAiResult(grading);

    setSubmissionStatus('Saving...');
    try {
        await addDoc(collection(db, 'submissions'), {
            quizId: quiz.id,
            studentName,
            answers,
            grading: grading ? grading.evaluations : null,
            timestamp: Date.now()
        });
        setSubmissionStatus('Success');
    } catch (e) {
        console.error(e);
        setSubmissionStatus('Error saving');
    }
    setIsSubmitting(false);
  };

  // Helper to toggle feedback
  const toggleFeedback = (qId) => {
      setQuiz(prev => ({
          ...prev,
          questions: prev.questions.map(q => q.id === qId ? { ...q, showFeedback: !q.showFeedback } : q)
      }));
  };

  // --- Views ---

  if (mode === 'landing') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center space-y-6 border border-slate-200">
          <BookOpen className="w-12 h-12 mx-auto text-indigo-600" />
          <h1 className="text-2xl font-bold text-slate-800">Math Quiz Classroom</h1>
          <button onClick={() => setMode('student')} className="w-full p-4 rounded-xl border-2 border-indigo-100 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-200 text-indigo-900 font-bold transition-all">
            I am a Student
          </button>
          <div className="border-t pt-4 mt-4">
            <p className="text-xs text-slate-400 uppercase mb-2">Teacher Access</p>
            <div className="flex gap-2">
              <input type="password" placeholder="Password" className="flex-1 p-2 border rounded text-sm" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} />
              <button onClick={() => passwordInput === TEACHER_PASSWORD ? setMode('teacher') : alert('Wrong password')} className="px-4 bg-slate-800 text-white rounded text-sm">Login</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'teacher') {
    return (
      <div className="min-h-screen bg-slate-50 p-6 pb-24">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
                <h2 className="font-bold flex items-center gap-2"><Edit3 className="w-5 h-5 text-indigo-600"/> Editor</h2>
                <div className="flex gap-2">
                    <button onClick={handleSaveQuiz} className="px-3 py-1 bg-indigo-600 text-white rounded text-sm flex gap-1 items-center"><Save className="w-3 h-3"/> Publish</button>
                    <button onClick={() => setMode('landing')} className="px-3 py-1 border rounded text-sm">Exit</button>
                </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm space-y-4">
                <input className="w-full text-xl font-bold border-b pb-2 outline-none" value={quiz.title} onChange={e => setQuiz({...quiz, title: e.target.value})} />
                {quiz.questions.map((q, i) => (
                  <div key={q.id} className="p-4 bg-slate-50 border rounded-lg relative">
                    <div className="flex justify-between mb-2">
                        <span className="text-xs font-bold text-slate-400">Q{i+1}</span>
                        <div className="flex gap-2">
                            <button onClick={() => toggleFeedback(q.id)} className="text-xs text-slate-500 underline">{q.showFeedback ? 'Hide Feedback' : 'Show Feedback'}</button>
                            <button onClick={() => setQuiz(p => ({...p, questions: p.questions.filter(x => x.id !== q.id)}))} className="text-red-500"><Trash2 className="w-3 h-3"/></button>
                        </div>
                    </div>
                    <textarea className="w-full p-2 border rounded text-sm font-mono" rows={3} value={q.text} onChange={e => {
                        const n = [...quiz.questions]; n[i].text = e.target.value; setQuiz({...quiz, questions: n});
                    }} />
                    <div className="mt-2 p-2 bg-white border rounded"><MathRenderer text={q.text}/></div>
                  </div>
                ))}
                <button onClick={() => setQuiz(p => ({...p, questions: [...p.questions, {id: Date.now(), text: "", showFeedback: true}]}))} className="w-full py-2 border-2 border-dashed rounded text-slate-400 hover:text-indigo-600 hover:border-indigo-400 flex justify-center items-center gap-2"><Plus className="w-4 h-4"/> Add Question</button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg shadow-sm font-bold text-slate-700 flex items-center gap-2"><Users className="w-5 h-5"/> Submissions</div>
            {submissions.map(sub => (
                <div key={sub.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-100">
                    <div className="flex justify-between font-bold text-slate-700 mb-2">
                        <span>{sub.studentName}</span>
                        <span className="text-xs font-normal text-slate-400">{new Date(sub.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="space-y-2">
                        {quiz.questions.map((q, i) => (
                            <div key={q.id} className="text-sm border-b last:border-0 pb-2">
                                <div className="flex justify-between text-xs text-slate-500 mb-1">
                                    <span>Q{i+1}</span>
                                    {sub.grading?.[q.id] && (
                                        <span className={sub.grading[q.id].isCorrect ? "text-green-600" : "text-red-600"}>
                                            {sub.grading[q.id].isCorrect ? "Correct" : "Review"}
                                        </span>
                                    )}
                                </div>
                                <div className="bg-indigo-50 p-2 rounded"><MathRenderer text={sub.answers[q.id] || "-"} /></div>
                                {sub.grading?.[q.id]?.feedback && <div className="text-xs italic text-slate-500 mt-1 pl-2 border-l-2">{sub.grading[q.id].feedback}</div>}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Student View
  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-24">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm">
            <div className="flex justify-between mb-4">
                <h1 className="text-2xl font-bold">{quiz.title}</h1>
                <button onClick={() => setMode('landing')} className="text-xs text-slate-400">Exit</button>
            </div>
            <input className="w-full p-3 border rounded" placeholder="Your Name" value={studentName} onChange={e => setStudentName(e.target.value)} disabled={!!aiResult} />
        </div>
        {quiz.questions.map((q, i) => (
            <div key={q.id} className="bg-white p-6 rounded-xl shadow-sm space-y-4">
                <div className="border-b pb-4"><span className="text-xs font-bold text-slate-400">Q{i+1}</span><MathRenderer text={q.text} className="text-lg mt-1"/></div>
                <textarea className="w-full p-3 border rounded font-mono text-sm" rows={2} placeholder="Type answer (LaTeX allowed)..." value={answers[q.id] || ''} onChange={e => setAnswers({...answers, [q.id]: e.target.value})} disabled={!!aiResult} />
                <div className="bg-indigo-50 p-3 rounded min-h-[40px]"><span className="text-[10px] uppercase font-bold text-indigo-300 block mb-1">Preview</span><MathRenderer text={answers[q.id]} /></div>
                
                {aiResult?.evaluations?.[q.id] && q.showFeedback && (
                    <div className={`p-3 rounded flex gap-2 items-start ${aiResult.evaluations[q.id].isCorrect ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                        {aiResult.evaluations[q.id].isCorrect ? <CheckCircle className="w-4 h-4 mt-1"/> : <XCircle className="w-4 h-4 mt-1"/>}
                        <div className="text-sm">
                            <div className="font-bold">{aiResult.evaluations[q.id].isCorrect ? "Correct" : "Needs Review"}</div>
                            <div>{aiResult.evaluations[q.id].feedback}</div>
                        </div>
                    </div>
                )}
                {aiResult?.evaluations?.[q.id] && !q.showFeedback && (
                    <div className="p-3 bg-blue-50 text-blue-800 rounded flex gap-2 text-sm"><Lock className="w-4 h-4"/> Response Recorded</div>
                )}
            </div>
        ))}
        {!aiResult ? (
            <button onClick={handleSubmitQuiz} disabled={isSubmitting} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold shadow hover:bg-indigo-700 flex justify-center items-center gap-2">
                {isSubmitting && <Loader2 className="animate-spin w-4 h-4"/>} {isSubmitting ? submissionStatus : "Submit Quiz"}
            </button>
        ) : (
            <div className="bg-white p-6 rounded-xl shadow text-center">
                <h3 className="text-xl font-bold text-slate-800">Submitted!</h3>
                <p className="text-slate-500 mb-4">Your teacher has your results.</p>
                <button onClick={() => {setAiResult(null); setAnswers({}); setSubmissionStatus('')}} className="text-indigo-600 font-bold">Take Another</button>
            </div>
        )}
      </div>
    </div>
  );
}
