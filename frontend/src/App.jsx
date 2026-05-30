import { useState, useRef, useEffect } from "react";

const BASE = "http://localhost:8080";

function App() {
  const [tab, setTab] = useState("upload");
  const [sessionId] = useState(() => {
    const saved = sessionStorage.getItem("rag_sid");
    if (saved) return saved;
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem("rag_sid", id);
    return id;
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">

        <header className="flex items-center justify-between border-b border-slate-800 pb-5">
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-400 bg-clip-text text-transparent">
              RAG ENGINE
            </h1>
            <p className="text-slate-500 text-xs mt-1 font-mono">Spring AI · Chroma · OpenAI · React</p>
          </div>
          <span className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-xs font-mono text-cyan-400">
            {sessionId.slice(0, 12)}...
          </span>
        </header>

        {/* Navigation */}
        <nav className="flex bg-slate-800 border border-slate-700 rounded-xl p-1 gap-1">
          {[
            { id: "upload",   label: "Upload" },
            { id: "stream",   label: "Stream" },
            { id: "precise",  label: "Precise" },
            { id: "compare",  label: "Compare" },
            { id: "chat",     label: "Chat" },
            { id: "evaluate", label: "Evaluate" },
            { id: "manage",   label: "Manage" },
            { id: "metrics", label: "Metrics" }
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                tab === t.id
                  ? "bg-slate-700 text-white"
                  : "text-slate-500 hover:text-slate-300"
              }`}>{t.label}</button>
          ))}
        </nav>

        {tab === "upload"   && <UploadPanel />}
        {tab === "stream"   && <StreamPanel sessionId={sessionId} />}
        {tab === "precise"  && <PrecisePanel />}
        {tab === "compare"  && <ComparePanel sessionId={sessionId} />}
        {tab === "chat"     && <ChatPanel sessionId={sessionId} />}
        {tab === "evaluate" && <EvaluatePanel />}
        {tab === "manage"   && <ManagePanel sessionId={sessionId} />}
        {tab === "metrics" && <MetricsPanel />}
      </div>
    </div>
  );
}

// ── Shared helpers ──────────────────────────────────────────
function Card({ children, className = "" }) {
  return (
    <div className={`bg-slate-800 border border-slate-700 rounded-2xl p-5 ${className}`}>
      {children}
    </div>
  );
}

function EndpointTag({ method, path }) {
  const colors = {
    GET:    "bg-amber-900 text-amber-300",
    POST:   "bg-green-900 text-green-300",
    DELETE: "bg-red-900 text-red-300",
  };
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className={`text-xs font-mono px-2 py-0.5 rounded ${colors[method]}`}>{method}</span>
      <span className="text-xs font-mono text-slate-400">{path}</span>
    </div>
  );
}

function ResultBox({ content, mono = false }) {
  return (
    <div className={`bg-slate-900 rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap text-slate-200 min-h-[60px] ${mono ? "font-mono text-xs" : ""}`}>
      {content || <span className="text-slate-600">Response appears here...</span>}
    </div>
  );
}

function StatusBadge({ status }) {
  if (!status) return null;
  const colors = {
    ok:      "bg-green-900 text-green-300",
    error:   "bg-red-900 text-red-300",
    loading: "bg-amber-900 text-amber-300",
  };
  return (
    <span className={`text-xs px-2 py-1 rounded-lg ${colors[status.type]} mt-2 inline-block`}>
      {status.msg}
    </span>
  );
}

function Metric({ value, label }) {
  return (
    <div className="bg-slate-900 rounded-xl p-4 text-center">
      <div className="text-2xl font-medium text-slate-100">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  );
}

async function readStream(res, onChunk) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let acc = "", buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      if (line.startsWith("data:")) acc += line.slice(5);
    }
    onChunk(acc);
  }
  return acc;
}

// ── Upload Panel ─────────────────────────────────────────────
function UploadPanel() {
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState("");
  const [file, setFile] = useState(null);

  const upload = async () => {
    if (!file) { setStatus({ type: "error", msg: "Select a PDF first" }); return; }
    setStatus({ type: "loading", msg: "Uploading and vectorizing..." });
    setResult("");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`${BASE}/upload`, { method: "POST", body: fd });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
      setStatus({ type: "ok", msg: `Ingested successfully` });
    } catch (e) {
      setStatus({ type: "error", msg: e.message });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <EndpointTag method="POST" path="/upload" />
        <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-slate-600 rounded-xl cursor-pointer hover:border-cyan-500 hover:bg-slate-900 transition-all mb-4">
          <span className="text-2xl mb-2">📄</span>
          <span className="text-xs text-slate-500">{file ? file.name : "Click to select PDF"}</span>
          <input type="file" accept=".pdf" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
        </label>
        <button onClick={upload}
          className="w-full py-3 bg-cyan-700 hover:bg-cyan-600 text-white rounded-xl text-sm font-medium transition-all">
          Upload &amp; vectorize
        </button>
        <StatusBadge status={status} />
        {result && <ResultBox content={result} mono />}
      </Card>
    </div>
  );
}

// ── Stream Panel ──────────────────────────────────────────────
function StreamPanel({ sessionId }) {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState("");
  const [latency, setLatency] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const ask = async () => {
    if (!q.trim()) return;
    setLoading(true); setAnswer(""); setSources(""); setLatency(null);
    setStatus({ type: "loading", msg: "Streaming..." });
    const t0 = Date.now();
    try {
      const res = await fetch(`${BASE}/api/ai/stream?q=${encodeURIComponent(q)}&chatId=${sessionId}`);
      await readStream(res, (acc) => {
        if (acc.includes("Sources:")) {
          const [m, s] = acc.split("Sources:");
          setAnswer(m.trim()); setSources(s);
        } else { setAnswer(acc); }
      });
      const lat = ((Date.now() - t0) / 1000).toFixed(1) + "s";
      setLatency(lat);
      setStatus({ type: "ok", msg: `Done in ${lat}` });
    } catch (e) { setStatus({ type: "error", msg: e.message }); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <EndpointTag method="GET" path="/api/ai/stream?q=...&chatId=..." />
        <p className="text-xs text-slate-500 mb-3">Fast SSE streaming with LLM reranker.</p>
        <div className="flex gap-2 mb-3">
          <input value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
            placeholder="Ask about your documents..."
            className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40"/>
          <button onClick={ask} disabled={loading}
            className="px-5 py-3 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-all">
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Ask"}
          </button>
        </div>
        <StatusBadge status={status} />
        <div className="mt-3">
          <ResultBox content={answer} />
          {sources && (
            <div className="mt-3 pt-3 border-t border-slate-700">
              <p className="text-xs text-cyan-400 font-medium uppercase tracking-widest mb-1">Verified sources</p>
              <p className="text-xs text-slate-500 italic">{sources}</p>
            </div>
          )}
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-4">
        <Metric value={latency ?? "—"} label="Latency" />
        <Metric value="5" label="Chunks retrieved" />
      </div>
    </div>
  );
}

// ── Precise Panel ─────────────────────────────────────────────
function PrecisePanel() {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState("");
  const [latency, setLatency] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const ask = async () => {
    if (!q.trim()) return;
    setLoading(true); setAnswer(""); setSources(""); setLatency(null);
    setStatus({ type: "loading", msg: "Processing with reranker + judge..." });
    const t0 = Date.now();
    try {
      const res = await fetch(`${BASE}/api/ai/precise?q=${encodeURIComponent(q)}`);
      const text = await res.text();
      const lat = ((Date.now() - t0) / 1000).toFixed(1) + "s";
      if (text.includes("Sources:")) {
        const [m, s] = text.split("Sources:");
        setAnswer(m.trim()); setSources(s);
      } else { setAnswer(text); }
      setLatency(lat);
      setStatus({ type: "ok", msg: `Done in ${lat}` });
    } catch (e) { setStatus({ type: "error", msg: e.message }); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <EndpointTag method="GET" path="/api/ai/precise?q=..." />
        <p className="text-xs text-slate-500 mb-3">Reranker + LLM judge. Slower, more grounded.</p>
        <div className="flex gap-2 mb-3">
          <input value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
            placeholder="Ask about your documents..."
            className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40"/>
          <button onClick={ask} disabled={loading}
            className="px-5 py-3 bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-all">
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Ask"}
          </button>
        </div>
        <StatusBadge status={status} />
        <div className="mt-3">
          <ResultBox content={answer} />
          {sources && (
            <div className="mt-3 pt-3 border-t border-slate-700">
              <p className="text-xs text-purple-400 font-medium uppercase tracking-widest mb-1">Verified sources</p>
              <p className="text-xs text-slate-500 italic">{sources}</p>
            </div>
          )}
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-4">
        <Metric value={latency ?? "—"} label="Latency" />
        <Metric value="3" label="Reranked chunks" />
      </div>
    </div>
  );
}

// ── Compare Panel ─────────────────────────────────────────────
function ComparePanel({ sessionId }) {
  const [q, setQ] = useState("");
  const [sAnswer, setSAnswer] = useState("");
  const [pAnswer, setPAnswer] = useState("");
  const [sLat, setSLat] = useState(null);
  const [pLat, setPLat] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const compare = async () => {
    if (!q.trim()) return;
    setLoading(true); setSAnswer(""); setPAnswer(""); setSLat(null); setPLat(null);
    setStatus({ type: "loading", msg: "Running both endpoints simultaneously..." });

    const streamProm = (async () => {
      const t0 = Date.now();
      try {
        const res = await fetch(`${BASE}/api/ai/stream?q=${encodeURIComponent(q)}&chatId=${sessionId}`);
        await readStream(res, (acc) => setSAnswer(acc.split("Sources:")[0].trim()));
        setSLat(((Date.now() - t0) / 1000).toFixed(1) + "s");
      } catch (e) { setSAnswer("Error: " + e.message); }
    })();

    const preciseProm = (async () => {
      const t0 = Date.now();
      try {
        const res = await fetch(`${BASE}/api/ai/precise?q=${encodeURIComponent(q)}`);
        const text = await res.text();
        setPAnswer(text.split("Sources:")[0].trim());
        setPLat(((Date.now() - t0) / 1000).toFixed(1) + "s");
      } catch (e) { setPAnswer("Error: " + e.message); }
    })();

    await Promise.all([streamProm, preciseProm]);
    setStatus({ type: "ok", msg: "Both responses received" });
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-xs text-slate-500 mb-3">Calls both endpoints simultaneously via Promise.all.</p>
        <div className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && compare()}
            placeholder="Ask the same question to both endpoints..."
            className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none"/>
          <button onClick={compare} disabled={loading}
            className="px-5 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-all">
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Compare"}
          </button>
        </div>
        <StatusBadge status={status} />
      </Card>
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs text-cyan-400 font-medium uppercase tracking-widest">Stream</span>
            {sLat && <span className="text-xs font-mono text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded">{sLat}</span>}
          </div>
          <ResultBox content={sAnswer} />
        </Card>
        <Card>
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs text-purple-400 font-medium uppercase tracking-widest">Precise</span>
            {pLat && <span className="text-xs font-mono text-purple-300 bg-purple-950 px-2 py-0.5 rounded">{pLat}</span>}
          </div>
          <ResultBox content={pAnswer} />
        </Card>
      </div>
    </div>
  );
}

// ── Chat Panel ────────────────────────────────────────────────
function ChatPanel({ sessionId }) {
  const [q, setQ] = useState("");
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history]);

  const send = async () => {
    if (!q.trim()) return;
    const userMsg = q;
    setQ("");
    setHistory(h => [...h, { role: "user", text: userMsg }]);
    setLoading(true);
    setStatus({ type: "loading", msg: "Thinking..." });
    setHistory(h => [...h, { role: "ai", text: "" }]);
    try {
      const res = await fetch(`${BASE}/api/ai/chat?q=${encodeURIComponent(userMsg)}&chatId=${sessionId}`);
      await readStream(res, (acc) => {
        setHistory(h => {
          const updated = [...h];
          updated[updated.length - 1] = { role: "ai", text: acc };
          return updated;
        });
      });
      setStatus(null);
    } catch (e) { setStatus({ type: "error", msg: e.message }); }
    finally { setLoading(false); }
  };

  const clear = async () => {
    await fetch(`${BASE}/api/ai/chat/${sessionId}`, { method: "DELETE" }).catch(() => {});
    setHistory([]);
    setStatus({ type: "ok", msg: "Session cleared" });
  };

  return (
    <div className="space-y-4">
      <Card>
        <EndpointTag method="GET" path="/api/ai/chat?q=...&chatId=..." />
        <p className="text-xs text-slate-500 mb-3">Multi-turn conversation with memory. Session: <span className="font-mono">{sessionId.slice(0,16)}...</span></p>
        <div className="bg-slate-900 rounded-xl p-4 min-h-[200px] max-h-[360px] overflow-y-auto mb-3 space-y-3">
          {history.length === 0 && <p className="text-slate-600 text-sm">Start a conversation...</p>}
          {history.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-cyan-800 text-cyan-50 rounded-br-sm"
                  : "bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-sm"
              }`}>
                {msg.text || <span className="opacity-50 animate-pulse">•••</span>}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask a follow-up question..."
            className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40"/>
          <button onClick={send} disabled={loading}
            className="px-5 py-3 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-all">
            Send
          </button>
          <button onClick={clear}
            className="px-4 py-3 bg-red-900 hover:bg-red-800 text-red-200 rounded-xl text-sm font-medium transition-all">
            Clear
          </button>
        </div>
        <StatusBadge status={status} />
      </Card>
      <Metric value={history.filter(m => m.role === "user").length} label="Turns in session" />
    </div>
  );
}

// ── Evaluate Panel ────────────────────────────────────────────
function EvaluatePanel() {
  const [q, setQ] = useState("");
  const [ctx, setCtx] = useState("");
  const [ans, setAns] = useState("");
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState(null);

  const evaluate = async () => {
    if (!q || !ctx || !ans) { setStatus({ type: "error", msg: "Fill in all three fields" }); return; }
    setStatus({ type: "loading", msg: "Evaluating groundedness..." });
    setResult(null);
    try {
      const url = `${BASE}/api/ai/evaluate?q=${encodeURIComponent(q)}&answer=${encodeURIComponent(ans)}&context=${encodeURIComponent(ctx)}`;
      const res = await fetch(url);
      const data = await res.json();
      setResult(data);
      setStatus({ type: "ok", msg: "Evaluation complete" });
    } catch (e) { setStatus({ type: "error", msg: e.message }); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <EndpointTag method="GET" path="/api/ai/evaluate?q=...&answer=...&context=..." />
        <p className="text-xs text-slate-500 mb-4">LLM judge scores an answer for groundedness. Score ≥ 0.8 = PASS.</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">Question</label>
            <input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="What is Apple's organizational structure?"
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none"/>
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">Context (document text)</label>
            <textarea value={ctx} onChange={(e) => setCtx(e.target.value)} rows={3}
              placeholder="Apple is organized as a functional organization where experts lead experts..."
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none resize-y"/>
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">Answer to evaluate</label>
            <textarea value={ans} onChange={(e) => setAns(e.target.value)} rows={3}
              placeholder="Apple uses a functional organizational structure..."
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none resize-y"/>
          </div>
          <button onClick={evaluate}
            className="w-full py-3 bg-green-800 hover:bg-green-700 text-green-100 rounded-xl text-sm font-medium transition-all">
            Evaluate groundedness
          </button>
          <StatusBadge status={status} />
        </div>
      </Card>
      {result && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Metric value={result.score ?? "—"} label="Groundedness score" />
            <div className="bg-slate-900 rounded-xl p-4 text-center">
              <div className={`text-2xl font-medium ${result.grade === "PASS" ? "text-green-400" : "text-red-400"}`}>
                {result.grade ?? "—"}
              </div>
              <div className="text-xs text-slate-500 mt-1">Grade</div>
            </div>
          </div>
          <Card>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Full response</p>
            <ResultBox content={JSON.stringify(result, null, 2)} mono />
          </Card>
        </>
      )}
    </div>
  );
}

// ── Manage Panel ──────────────────────────────────────────────
function ManagePanel({ sessionId }) {
  const [clearStatus, setClearStatus] = useState(null);
  const [sessionStatus, setSessionStatus] = useState(null);
  const [customSession, setCustomSession] = useState(sessionId);

  const clearAll = async () => {
    if (!window.confirm("Delete ALL documents from Chroma? Cannot be undone.")) return;
    setClearStatus({ type: "loading", msg: "Clearing..." });
    try {
      const res = await fetch(`${BASE}/upload/clear`, { method: "DELETE" });
      const data = await res.json();
      setClearStatus({ type: "ok", msg: `Cleared ${data.deleted ?? 0} documents` });
    } catch (e) { setClearStatus({ type: "error", msg: e.message }); }
  };

  const clearSession = async () => {
    if (!customSession) return;
    try {
      await fetch(`${BASE}/api/ai/chat/${customSession}`, { method: "DELETE" });
      setSessionStatus({ type: "ok", msg: "Session cleared: " + customSession.slice(0, 16) });
    } catch (e) { setSessionStatus({ type: "error", msg: e.message }); }
  };

  const endpoints = [
    { method: "POST",   path: "/upload",              desc: "Upload & ingest PDF" },
    { method: "GET",    path: "/api/ai/stream",        desc: "Fast SSE streaming RAG" },
    { method: "GET",    path: "/api/ai/precise",       desc: "Reranker + judge RAG" },
    { method: "GET",    path: "/api/ai/chat",          desc: "Chat with memory" },
    { method: "DELETE", path: "/api/ai/chat/{id}",     desc: "Clear chat session" },
    { method: "GET",    path: "/api/ai/evaluate",      desc: "Score answer groundedness" },
    { method: "DELETE", path: "/upload/clear",         desc: "Clear vector database" },
    { method: "GET",    path: "/actuator/metrics",     desc: "Observability metrics" },
    { method: "GET",    path: "/actuator/prometheus",  desc: "Prometheus metrics" },
  ];

  const methodColors = {
    GET:    "bg-amber-900 text-amber-300",
    POST:   "bg-green-900 text-green-300",
    DELETE: "bg-red-900 text-red-300",
  };

  return (
    <div className="space-y-4">
      <Card>
        <EndpointTag method="DELETE" path="/upload/clear" />
        <p className="text-xs text-slate-500 mb-3">Removes all vectors from Chroma. Cannot be undone.</p>
        <button onClick={clearAll}
          className="px-5 py-2 bg-red-900 hover:bg-red-800 text-red-200 rounded-xl text-sm font-medium transition-all">
          Clear all documents
        </button>
        <StatusBadge status={clearStatus} />
      </Card>

      <Card>
        <EndpointTag method="DELETE" path="/api/ai/chat/{sessionId}" />
        <div className="flex gap-2">
          <input value={customSession} onChange={(e) => setCustomSession(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-2 text-sm font-mono focus:outline-none"/>
          <button onClick={clearSession}
            className="px-4 py-2 bg-red-900 hover:bg-red-800 text-red-200 rounded-xl text-sm font-medium transition-all">
            Clear session
          </button>
        </div>
        <StatusBadge status={sessionStatus} />
      </Card>

      <Card>
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">All endpoints</p>
        <div className="space-y-2">
          {endpoints.map((ep, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-700 last:border-0">
              <span className={`text-xs font-mono px-2 py-0.5 rounded shrink-0 ${methodColors[ep.method]}`}>{ep.method}</span>
              <span className="text-xs font-mono text-slate-300 flex-1">{ep.path}</span>
              <span className="text-xs text-slate-500">{ep.desc}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function MetricsPanel() {
  const [metrics, setMetrics] = useState({});
  const [status, setStatus] = useState(null);

  const fetchMetric = async (name) => {
    const res = await fetch(`${BASE}/actuator/metrics/${name}`);
    const data = await res.json();
    return data.measurements?.[0]?.value ?? 0;
  };

  const loadMetrics = async () => {
    setStatus({ type: "loading", msg: "Loading metrics..." });

    try {
      const [
        total,
        stream,
        precise,
        uploads,
        chunks,
        latencyStream,
        latencyPrecise
      ] = await Promise.all([
        fetchMetric("rag.queries.total"),
        fetchMetric("rag.queries.stream"),
        fetchMetric("rag.queries.precise"),
        fetchMetric("rag.uploads.total"),
        fetchMetric("rag.chunks.indexed"),
        fetchMetric("rag.latency.stream"),
        fetchMetric("rag.latency.precise"),
      ]);

      setMetrics({
        total,
        stream,
        precise,
        uploads,
        chunks,
        latencyStream,
        latencyPrecise,
      });

      setStatus({ type: "ok", msg: "Metrics updated" });

    } catch (e) {
      setStatus({ type: "error", msg: e.message });
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <EndpointTag method="GET" path="/actuator/metrics/*" />
        <p className="text-xs text-slate-500 mb-3">
          Live Micrometer metrics from backend.
        </p>

        <button
          onClick={loadMetrics}
          className="mb-4 px-4 py-2 bg-cyan-700 hover:bg-cyan-600 text-white rounded-lg text-xs"
        >
          Refresh
        </button>

        <StatusBadge status={status} />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
          <Metric value={metrics.total ?? 0} label="Total Queries" />
          <Metric value={metrics.stream ?? 0} label="Stream Queries" />
          <Metric value={metrics.precise ?? 0} label="Precise Queries" />
          <Metric value={metrics.uploads ?? 0} label="Uploads" />
          <Metric value={metrics.chunks ?? 0} label="Chunks Indexed" />
          <Metric value={(metrics.latencyStream ?? 0).toFixed(2)} label="Stream Latency" />
          <Metric value={(metrics.latencyPrecise ?? 0).toFixed(2)} label="Precise Latency" />
        </div>
      </Card>
    </div>
  );
}

export default App;