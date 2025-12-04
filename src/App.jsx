import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, Edit3, Plus, Trash2, Save, CheckCircle, XCircle, Users, Loader2, Lock, LogOut, LayoutList, Shuffle, AlertTriangle, ArrowLeft, RefreshCw, Upload, FileJson, Image as ImageIcon } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, addDoc, deleteDoc, onSnapshot, query, where, getDocs } from 'firebase/firestore';

// ==================================================================================
// 🔧 CONFIGURATION
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

const TEACHER_EMAIL = "richard.ketchersid@gmail.com"; // ENTER YOUR EXACT GOOGLE EMAIL HERE

// ==================================================================================
// 🚀 APP LOGIC
// ==================================================================================

let app, auth, db;
const isConfigured = FIREBASE_CONFIG.apiKey && GEMINI_API_KEY && TEACHER_EMAIL;

if (isConfigured) {
  app = initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);
  db = getFirestore(app);
}

// --- Helpers ---
const shuffleArray = (array) => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

const gradeWithAI = async (quiz, answers) => {
  if (!GEMINI_API_KEY) return null;
  try {
    const prompt = `
      You are a helpful math teacher. Grade these student answers.
      Quiz Context: ${quiz.title}

      Questions & Student Answers:
      ${quiz.questions.map(q => `
        [QUESTION ID]: ${q.id}
        [PROMPT]: ${q.text}
        [STUDENT ANSWER]: ${answers[q.id] || "No answer provided"}
      `).join('\n----------------\n')}

      INSTRUCTIONS:
      1. Check if the math is correct. LaTeX formatting is expected.
      2. Provide a short, helpful feedback sentence (max 15 words).
      3. Return a JSON object where keys are the [QUESTION ID].

      REQUIRED JSON STRUCTURE:
      {
        "evaluations": {
          "1715...": { "isCorrect": true, "feedback": "Good job." },
          "1716...": { "isCorrect": false, "feedback": "Check your signs." }
        }
      }
    `;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } })
    });

    const data = await response.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (text) {
        text = text.replace(/```json\n?|\n?```/g, '');
        return JSON.parse(text);
    }
    return null;
  } catch (e) { 
    console.error("Grading Error", e); 
    return null; 
  }
};

// --- Components ---

// Custom Hook to load KaTeX from CDN (No npm install needed)
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

// Custom Mini-Markdown Parser (Handles **bold**, [links](url), ![images](url))
const parseMarkdown = (text) => {
    if (!text) return null;
    
    // Regex for Images: ![alt](url)
    const imgRegex = /!\[(.*?)\]\((.*?)\)/g;
    // We split by image first
    const parts = text.split(imgRegex);
    
    if (parts.length === 1) return parseLinks(text);

    const result = [];
    for (let i = 0; i < parts.length; i += 3) {
        result.push(<span key={i}>{parseLinks(parts[i])}</span>);
        if (i + 2 < parts.length) {
            const alt = parts[i+1];
            const src = parts[i+2];
            result.push(<img key={i+1} src={src} alt={alt} className="max-w-full h-auto rounded-lg shadow-sm my-4 border border-slate-200" />);
        }
    }
    return result;
};

const parseLinks = (text) => {
    // Regex for Links: [text](url)
    const parts = text.split(/\[(.*?)\]\((.*?)\)/g);
    if (parts.length === 1) return parseBold(text);
    
    const result = [];
    for (let i = 0; i < parts.length; i += 3) {
        result.push(<span key={i}>{parseBold(parts[i])}</span>);
        if (i + 2 < parts.length) {
            result.push(
                <a 
                    key={i+1} 
                    href={parts[i+2]} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-indigo-600 hover:text-indigo-800 hover:underline font-bold"
                >
                    {parseBold(parts[i+1])}
                </a>
            );
        }
    }
    return result;
};

const parseBold = (text) => {
    // Regex for Bold: **text**
    const parts = text.split(/\*\*(.*?)\*\*/g);
    if (parts.length === 1) return text;
    
    const result = [];
    for (let i = 0; i < parts.length; i += 2) {
        result.push(parts[i]);
        if (i + 1 < parts.length) {
            result.push(<strong key={i+1} className="font-extrabold text-slate-900">{parts[i+1]}</strong>);
        }
    }
    return result;
};


// Robust Math + Markdown Renderer
const MathRenderer = ({ text }) => {
  const ref = useRef(null);
  const loaded = useKaTeX();

  if (!loaded) return <span className="text-slate-400 text-xs">Loading math...</span>;
  if (!text) return null;

  const safeText = String(text);
  
  // Split by Block Math $$...$$
  const blockParts = safeText.split(/(\$\$[\s\S]*?\$\$)/g);

  return (
    <div className="text-slate-700 leading-relaxed whitespace-pre-wrap">
      {blockParts.map((part, index) => {
        if (part.startsWith('$$')) {
            // Block Math
            const math = part.slice(2, -2);
            return (
                <div key={index} className="my-4 text-center overflow-x-auto p-1" ref={node => {
                    if (node) {
                        try { window.katex.render(math, node, { displayMode: true, throwOnError: false }); } 
                        catch (e) { node.textContent = e.message; }
                    }
                }} />
            );
        } else {
            // Inline text (needs checking for $...$)
            const inlineParts = part.split(/(\$[\s\S]*?\$)/g);
            return (
                <span key={index}>
                    {inlineParts.map((subPart, subIndex) => {
                        if (subPart.startsWith('$')) {
                            const math = subPart.slice(1, -1);
                            return <span key={subIndex} className="mx-0.5 inline-block" ref={node => {
                                if (node) {
                                    try { window.katex.render(math, node, { displayMode: false, throwOnError: false }); } 
                                    catch (e) { node.textContent = e.message; }
                                }
                            }} />;
                        } else {
                            // Render Markdown here
                            return <span key={subIndex}>{parseMarkdown(subPart)}</span>;
                        }
                    })}
                </span>
            );
        }
      })}
    </div>
  );
};

export default function App() {
  if (!isConfigured) return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
          <div className="bg-white p-8 rounded shadow text-center max-w-lg">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4"/>
              <h1 className="font-bold text-xl mb-2">Configuration Missing</h1>
              <p className="text-slate-600 mb-4">Please open <code>MathQuizApp.jsx</code> and enter your keys.</p>
          </div>
      </div>
  );

  const [user, setUser] = useState(null);
  const [view, setView] = useState('loading'); 
  const [quizzes, setQuizzes] = useState([]);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  
  // Student State
  const [studentAnswers, setStudentAnswers] = useState({});
  const [studentQuestions, setStudentQuestions] = useState([]); 
  const [alreadyTaken, setAlreadyTaken] = useState(false);
  const [attemptsCount, setAttemptsCount] = useState(0);
  const [aiResult, setAiResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // File Upload Ref
  const fileInputRef = useRef(null);

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setUser(u);
    if (!u) setView('login');
    else if (u.email === TEACHER_EMAIL) setView('teacher-dashboard');
    else setView('student-select');
  }), []);

  // Fetch Quizzes List
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, 'quizzes'), (snap) => {
      setQuizzes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user]);

  // Teacher: Fetch Submissions for active quiz
  useEffect(() => {
    if (view !== 'teacher-edit' || !activeQuiz) return;
    const q = query(collection(db, 'submissions'), where('quizId', '==', activeQuiz.id));
    const unsub = onSnapshot(q, (snap) => {
      setSubmissions(snap.docs.map(d => ({id: d.id, ...d.data()})));
    });
    return () => unsub();
  }, [view, activeQuiz]);

  const handleLogin = async () => {
    try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (e) { alert(e.message); }
  };

  const createQuiz = async () => {
    const newQuiz = {
      title: "New Quiz",
      createdAt: Date.now(),
      randomize: false,
      maxAttempts: 1, 
      questions: [{ id: Date.now(), text: "New Question. Supports **bold**, [links](https://google.com), and $LaTeX$.", showFeedback: true }]
    };
    const docRef = await addDoc(collection(db, 'quizzes'), newQuiz);
    setActiveQuiz({ id: docRef.id, ...newQuiz });
    setView('teacher-edit');
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            let text = e.target.result;
            
            // SMART FIX: Remove "const EXAM_1_DATA =" wrapper if it exists
            text = text.replace(/^\s*const\s+\w+\s*=\s*/, ''); // Remove start variable
            text = text.replace(/;\s*$/, ''); // Remove trailing semicolon
            
            const json = JSON.parse(text);
            
            if (!json.title || !json.questions) {
                alert("Invalid JSON format. Needs 'title' and 'questions' array.");
                return;
            }
            // Add metadata
            const newQuiz = {
                ...json,
                createdAt: Date.now(),
                maxAttempts: json.maxAttempts || 1,
                randomize: json.randomize || false
            };
            await addDoc(collection(db, 'quizzes'), newQuiz);
            alert(`Quiz "${json.title}" uploaded successfully!`);
        } catch (error) {
            console.error(error);
            alert("Error parsing file. Please check that it is valid JSON.");
        }
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = null;
  };

  const deleteQuiz = async (id, e) => {
    e.stopPropagation();
    if (!confirm("Delete this quiz?")) return;
    await deleteDoc(doc(db, 'quizzes', id));
  };

  const deleteSubmission = async (subId) => {
      if(!confirm("Reset this student's attempt? They will be able to take the quiz again.")) return;
      await deleteDoc(doc(db, 'submissions', subId));
  };

  const saveQuiz = async () => {
    await setDoc(doc(db, 'quizzes', activeQuiz.id), activeQuiz);
    alert("Quiz Saved!");
  };

  const enterQuiz = async (quiz) => {
    setActiveQuiz(quiz);
    
    // Fetch all submissions for this user and quiz
    const q = query(collection(db, 'submissions'), where('quizId', '==', quiz.id), where('userId', '==', user.uid));
    const snap = await getDocs(q);
    
    // Sort in memory
    const userSubmissions = snap.docs.map(d => d.data()).sort((a,b) => b.timestamp - a.timestamp);
    
    const count = userSubmissions.length;
    setAttemptsCount(count);
    const allowed = quiz.maxAttempts || 1;

    if (count >= allowed) {
        const latest = userSubmissions[0];
        setAlreadyTaken(true);
        setAiResult(latest.grading);
        setStudentAnswers(latest.answers);
        setStudentQuestions(quiz.questions); 
    } else {
        setAlreadyTaken(false);
        setAiResult(null);
        setStudentAnswers({});
        setStudentQuestions(quiz.randomize ? shuffleArray(quiz.questions) : quiz.questions);
    }
    setView('student-quiz');
  };

  const submitQuiz = async () => {
    if (alreadyTaken) return;
    setIsSubmitting(true);
    
    const grading = await gradeWithAI(activeQuiz, studentAnswers);
    
    await addDoc(collection(db, 'submissions'), {
        quizId: activeQuiz.id,
        userId: user.uid,
        studentName: user.displayName,
        email: user.email,
        answers: studentAnswers,
        grading: grading ? grading.evaluations : null,
        timestamp: Date.now()
    });

    setAiResult(grading);
    setAlreadyTaken(true);
    setAttemptsCount(c => c + 1); 
    setIsSubmitting(false);
  };

  if (view === 'loading') return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600"/></div>;

  if (view === 'login') return (
    <div className="h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-sm w-full">
        <BookOpen className="w-12 h-12 mx-auto text-indigo-600 mb-4"/>
        <h1 className="text-2xl font-bold mb-2">Math Quiz Login</h1>
        <button onClick={handleLogin} className="w-full bg-white border border-slate-300 text-slate-700 py-3 rounded-lg font-bold hover:bg-slate-50 transition flex items-center justify-center gap-2">
          Sign in with Google
        </button>
      </div>
    </div>
  );

  if (view === 'teacher-dashboard') return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <h1 className="text-xl font-bold flex gap-2 items-center text-slate-800"><LayoutList className="w-6 h-6 text-indigo-600"/> Teacher Dashboard</h1>
            <div className="flex gap-4 items-center">
                <span className="text-sm font-medium text-slate-500 hidden sm:block">{user.email}</span>
                <button onClick={() => signOut(auth)} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition text-slate-600"><LogOut className="w-4 h-4"/></button>
            </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Create New Button */}
            <button onClick={createQuiz} className="h-40 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 font-bold transition group">
                <div className="p-3 bg-slate-100 rounded-full group-hover:bg-indigo-100 transition"><Plus className="w-6 h-6"/></div>
                Create Blank Quiz
            </button>
            
            {/* Upload Button */}
            <button onClick={() => fileInputRef.current?.click()} className="h-40 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 font-bold transition group">
                <div className="p-3 bg-slate-100 rounded-full group-hover:bg-emerald-100 transition"><Upload className="w-6 h-6"/></div>
                Upload Quiz JSON
            </button>
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
                accept=".json" // Changed to accept generic file to allow for sloppy extensions, but parsed as text
            />

            {quizzes.map(q => (
                <div key={q.id} onClick={() => { setActiveQuiz(q); setView('teacher-edit'); }} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:border-indigo-500 hover:shadow-md transition group relative h-40 flex flex-col justify-between">
                    <div>
                        <h2 className="font-bold text-lg text-slate-800 truncate">{q.title}</h2>
                        <div className="flex gap-2 mt-2">
                             <span className="text-xs px-2 py-1 bg-slate-100 rounded-full text-slate-500">{q.questions?.length || 0} Qs</span>
                             {q.randomize && <span className="text-xs px-2 py-1 bg-indigo-50 text-indigo-600 rounded-full flex gap-1 items-center"><Shuffle className="w-3 h-3"/> Rand</span>}
                        </div>
                    </div>
                    <div className="flex justify-between items-end mt-4">
                        <span className="text-xs text-slate-400">Created: {new Date(q.createdAt).toLocaleDateString()}</span>
                        <button onClick={(e) => deleteQuiz(q.id, e)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4"/></button>
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );

  if (view === 'teacher-edit') return (
    <div className="min-h-screen bg-slate-50 p-6 pb-20">
       <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                <button onClick={() => setView('teacher-dashboard')} className="text-sm font-medium text-slate-500 hover:text-indigo-600 flex items-center gap-1"><ArrowLeft className="w-4 h-4"/> Dashboard</button>
                <div className="flex gap-2">
                    <button onClick={saveQuiz} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold flex gap-2 items-center hover:bg-indigo-700 shadow-sm"><Save className="w-4 h-4"/> Save Quiz</button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-6">
                <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quiz Title</label>
                    <input className="w-full text-xl font-bold border-b border-slate-200 pb-2 outline-none focus:border-indigo-500 transition" value={activeQuiz.title} onChange={e => setActiveQuiz({...activeQuiz, title: e.target.value})} />
                </div>

                <div className="flex gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Max Attempts</label>
                        <input type="number" min="1" max="10" className="w-full p-2 border rounded text-sm" value={activeQuiz.maxAttempts || 1} onChange={e => setActiveQuiz({...activeQuiz, maxAttempts: parseInt(e.target.value)})} />
                    </div>
                    <div className="flex-1">
                         <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Ordering</label>
                         <button onClick={() => setActiveQuiz(p => ({...p, randomize: !p.randomize}))} className={`w-full p-2 border rounded text-sm flex gap-2 items-center justify-center ${activeQuiz.randomize ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-slate-500'}`}>
                             <Shuffle className="w-4 h-4"/> {activeQuiz.randomize ? 'Randomized' : 'Sequential'}
                         </button>
                    </div>
                </div>
                
                <div className="space-y-4">
                    {activeQuiz.questions.map((q, i) => (
                      <div key={q.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl relative group hover:border-indigo-200 transition">
                        <div className="flex justify-between mb-3">
                            <span className="text-xs font-bold text-slate-400 bg-white px-2 py-1 rounded border border-slate-200">Q{i+1}</span>
                            <div className="flex gap-3">
                                 <label className="text-xs flex items-center gap-2 text-slate-600 cursor-pointer select-none">
                                     <input type="checkbox" className="accent-indigo-600" checked={q.showFeedback} onChange={() => {
                                     const n = [...activeQuiz.questions]; n[i].showFeedback = !n[i].showFeedback; setActiveQuiz({...activeQuiz, questions: n});
                                 }} /> Show AI Feedback</label>
                                <button onClick={() => setActiveQuiz(p => ({...p, questions: p.questions.filter(x => x.id !== q.id)}))} className="text-slate-300 hover:text-red-500 transition"><Trash2 className="w-4 h-4"/></button>
                            </div>
                        </div>
                        <textarea className="w-full p-3 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none" rows={3} value={q.text} onChange={e => {
                            const n = [...activeQuiz.questions]; n[i].text = e.target.value; setActiveQuiz({...activeQuiz, questions: n});
                        }} placeholder="Enter question (Markdown & LaTeX supported)..." />
                        <div className="mt-3 p-3 bg-white border border-slate-100 rounded-lg min-h-[40px]"><MathRenderer text={q.text}/></div>
                      </div>
                    ))}
                </div>
                <button onClick={() => setActiveQuiz(p => ({...p, questions: [...p.questions, {id: Date.now(), text: "", showFeedback: true}]}))} className="w-full py-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:text-indigo-600 hover:border-indigo-400 flex justify-center items-center gap-2 font-bold transition"><Plus className="w-5 h-5"/> Add Question</button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 font-bold text-slate-700 flex items-center gap-2"><Users className="w-5 h-5 text-indigo-600"/> Submissions ({submissions.length})</div>
            {submissions.length === 0 && <div className="text-center p-10 bg-white border border-slate-200 rounded-lg text-slate-400 italic">No submissions yet.</div>}
            
            <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
                {submissions.map(sub => (
                    <div key={sub.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 text-sm relative group">
                         <button 
                            onClick={() => deleteSubmission(sub.id)} 
                            className="absolute top-4 right-4 p-2 bg-white text-slate-300 border rounded hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition"
                            title="Reset Attempt (Delete Submission)"
                        >
                            <RefreshCw className="w-4 h-4"/>
                        </button>

                        <div className="flex justify-between items-start mb-4 border-b border-slate-50 pb-3 pr-10">
                            <div>
                                <div className="font-bold text-slate-800 text-lg">{sub.studentName}</div>
                                <div className="text-slate-400 text-xs">{sub.email}</div>
                            </div>
                            <span className="text-slate-400 font-mono text-xs bg-slate-50 px-2 py-1 rounded">{new Date(sub.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div className="space-y-4">
                            {activeQuiz.questions.map((q, i) => {
                                const grade = sub.grading?.evaluations?.[q.id] || sub.grading?.[q.id];
                                return (
                                    <div key={q.id} className="border-l-2 border-slate-100 pl-3">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-bold text-slate-400">Q{i+1}</span>
                                            {grade && (
                                              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${grade.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {grade.isCorrect ? 'Correct' : 'Check Work'}
                                              </span>
                                            )}
                                        </div>
                                        
                                        <div className="bg-slate-50 p-2 rounded mb-1">
                                            <MathRenderer text={sub.answers[q.id] || ""} />
                                        </div>

                                        {grade?.feedback && (
                                            <div className="text-xs text-slate-500 italic mt-1">
                                                <span className="font-bold text-indigo-400 not-italic mr-1">AI:</span> 
                                                {grade.feedback}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>
          </div>
       </div>
    </div>
  );

  if (view === 'student-select') return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center">
        <div className="w-full max-w-md space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <h1 className="text-lg font-bold text-slate-800">Available Quizzes</h1>
                <button onClick={() => signOut(auth)} className="text-xs font-bold text-slate-500 hover:text-red-600">Log Out</button>
            </div>
            
            <div className="space-y-3">
                {quizzes.map(q => (
                    <button key={q.id} onClick={() => enterQuiz(q)} className="w-full bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:border-indigo-500 hover:shadow-md text-left transition group">
                        <div className="flex justify-between items-center">
                            <h2 className="font-bold text-lg text-slate-800 group-hover:text-indigo-700">{q.title}</h2>
                            <span className="bg-slate-100 text-slate-500 text-xs px-2 py-1 rounded-full group-hover:bg-indigo-50 group-hover:text-indigo-600 transition">{q.questions.length} Qs</span>
                        </div>
                    </button>
                ))}
                {quizzes.length === 0 && <div className="text-center py-10 text-slate-400 italic">No quizzes available right now.</div>}
            </div>
        </div>
    </div>
  );

  // Student Quiz View
  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-24">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between mb-4">
                <h1 className="text-2xl font-bold text-slate-800">{activeQuiz.title}</h1>
                <button onClick={() => setView('student-select')} className="text-xs font-bold text-slate-400 hover:text-indigo-600">EXIT</button>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 p-2 rounded-lg justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    Logged in as <b>{user.displayName}</b>
                </div>
                <div className="text-xs font-mono bg-slate-200 px-2 py-1 rounded text-slate-600">
                     Attempt {attemptsCount} / {activeQuiz.maxAttempts || 1}
                </div>
            </div>
            {alreadyTaken && <div className="mt-4 p-4 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl flex items-start gap-3">
                <Lock className="w-5 h-5 mt-0.5 shrink-0"/> 
                <div className="text-sm">
                    <div className="font-bold">Quiz Submitted</div>
                    <div>You have reached the maximum attempts for this quiz. Your previous result is shown below.</div>
                </div>
            </div>}
        </div>

        {studentQuestions.map((q, i) => {
             const result = aiResult?.evaluations?.[q.id] || aiResult?.[q.id];
             return (
                <div key={q.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
                    <div className="border-b border-slate-100 pb-4">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Question {i+1}</span>
                        <MathRenderer text={q.text} />
                    </div>
                    
                    <textarea 
                        className="w-full p-3 border border-slate-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none disabled:bg-slate-50 disabled:text-slate-500 transition" 
                        rows={2} 
                        placeholder="Type your answer here (LaTeX allowed)..." 
                        value={studentAnswers[q.id] || ''} 
                        onChange={e => setStudentAnswers({...studentAnswers, [q.id]: e.target.value})} 
                        disabled={alreadyTaken} 
                    />
                    
                    {!alreadyTaken && studentAnswers[q.id] && (
                        <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                            <span className="text-[10px] uppercase font-bold text-indigo-400 block mb-1">Live Preview</span>
                            <MathRenderer text={studentAnswers[q.id]} />
                        </div>
                    )}
                    
                    {alreadyTaken && result && q.showFeedback && (
                        <div className={`p-4 rounded-xl flex gap-3 items-start animate-in fade-in slide-in-from-top-2 ${result.isCorrect ? "bg-green-50 text-green-800 border border-green-100" : "bg-red-50 text-red-800 border border-red-100"}`}>
                            {result.isCorrect ? <CheckCircle className="w-5 h-5 mt-0.5 shrink-0"/> : <XCircle className="w-5 h-5 mt-0.5 shrink-0"/>}
                            <div className="text-sm">
                                <div className="font-bold">{result.isCorrect ? "Correct" : "Needs Review"}</div>
                                <div className="opacity-90 mt-1">{result.feedback}</div>
                            </div>
                        </div>
                    )}
                </div>
             )
        })}

        {!alreadyTaken && (
            <button onClick={submitQuiz} disabled={isSubmitting} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-xl hover:-translate-y-0.5 transition flex justify-center items-center gap-2 disabled:opacity-70 disabled:translate-y-0 disabled:shadow-none">
                {isSubmitting ? <Loader2 className="animate-spin w-5 h-5"/> : <CheckCircle className="w-5 h-5"/>} 
                {isSubmitting ? "Grading..." : "Submit Quiz"}
            </button>
        )}
      </div>
    </div>
  );
}