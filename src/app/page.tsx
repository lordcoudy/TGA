"use client";

import TooltipPortal from "@/components/TooltipPortal";
import type { AnalysisResult, ChatStats } from "@/lib/telegram";
import { useEffect, useMemo, useRef, useState } from "react";

type Status = {
  state: "idle" | "loading" | "error" | "success";
  message?: string;
};

type MtprotoState = {
  phone: string;
  code: string;
  password: string;
  session: string;
  chat: string;
  limit: number;
  testDc: boolean;
};

const STORAGE_KEYS = {
  analysis: "tga:analysis",
  selectedChatId: "tga:selectedChatId",
  wordQuery: "tga:wordQuery",
  quickWindow: "tga:quickWindow",
  mtproto: "tga:mtproto",
} as const;

function safeParseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export default function Home() {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [wordQuery, setWordQuery] = useState("");
  const [authStatus, setAuthStatus] = useState<Status>({ state: "idle" });
  const [exportStatus, setExportStatus] = useState<Status>({ state: "idle" });
  const [quickWindow, setQuickWindow] = useState(15);
  const [exportingImage, setExportingImage] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const analyticsRef = useRef<HTMLDivElement>(null);
  const [mtproto, setMtproto] = useState<MtprotoState>({
    phone: "",
    code: "",
    password: "",
    session: "",
    chat: "",
    limit: 500,
    testDc: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedAnalysis = safeParseJson<AnalysisResult | null>(
      window.localStorage.getItem(STORAGE_KEYS.analysis),
      null,
    );
    if (storedAnalysis?.chats?.length) {
      setAnalysis(storedAnalysis);
    }

    const storedChatId = window.localStorage.getItem(STORAGE_KEYS.selectedChatId);
    if (storedChatId) setSelectedChatId(storedChatId);

    const storedWordQuery = window.localStorage.getItem(STORAGE_KEYS.wordQuery);
    if (storedWordQuery !== null) setWordQuery(storedWordQuery);

    const storedQuickWindow = Number(window.localStorage.getItem(STORAGE_KEYS.quickWindow));
    if (Number.isFinite(storedQuickWindow) && storedQuickWindow > 0) {
      setQuickWindow(storedQuickWindow);
    }

    const storedMtproto = safeParseJson<
      Pick<MtprotoState, "phone" | "session" | "chat" | "limit" | "testDc">
    >(window.localStorage.getItem(STORAGE_KEYS.mtproto), {
      phone: "",
      session: "",
      chat: "",
      limit: 500,
      testDc: false,
    });

    setMtproto((prev) => ({
      ...prev,
      phone: storedMtproto.phone || "",
      session: storedMtproto.session || "",
      chat: storedMtproto.chat || "",
      limit: Number.isFinite(storedMtproto.limit) ? storedMtproto.limit : prev.limit,
      testDc: Boolean(storedMtproto.testDc),
      code: "",
      password: "",
    }));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!analysis) {
      window.localStorage.removeItem(STORAGE_KEYS.analysis);
      return;
    }
    window.localStorage.setItem(STORAGE_KEYS.analysis, JSON.stringify(analysis));
  }, [analysis]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!selectedChatId) {
      window.localStorage.removeItem(STORAGE_KEYS.selectedChatId);
      return;
    }
    window.localStorage.setItem(STORAGE_KEYS.selectedChatId, selectedChatId);
  }, [selectedChatId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.wordQuery, wordQuery);
  }, [wordQuery]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.quickWindow, String(quickWindow));
  }, [quickWindow]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const persistable = {
      phone: mtproto.phone,
      session: mtproto.session,
      chat: mtproto.chat,
      limit: mtproto.limit,
      testDc: mtproto.testDc,
    };
    window.localStorage.setItem(STORAGE_KEYS.mtproto, JSON.stringify(persistable));
  }, [mtproto.phone, mtproto.session, mtproto.chat, mtproto.limit, mtproto.testDc]);

  const selectedChat = useMemo<ChatStats | null>(() => {
    if (!analysis?.chats?.length) return null;
    const active = analysis.chats.find((chat) => chat.chatId === selectedChatId);
    return active || analysis.chats[0];
  }, [analysis, selectedChatId]);

  const totalParticipants = useMemo(() => {
    if (!analysis) return 0;
    return analysis.chats.reduce((sum, chat) => sum + chat.participantCount, 0);
  }, [analysis]);

  const wordFrequency = useMemo(() => {
    if (!selectedChat || !wordQuery.trim()) return null;
    const key = wordQuery.trim().toLowerCase();
    return selectedChat.wordFrequencies[key] || 0;
  }, [selectedChat, wordQuery]);

  async function handleFileUpload(file: File) {
    setStatus({ state: "loading" });

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ export: parsed, options: { quickReplyMinutes: quickWindow } }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to analyze export." }));
        setStatus({ state: "error", message: error.error || "Unable to analyze export." });
        return;
      }

      const payload: AnalysisResult = await res.json();
      setAnalysis(payload);
      setSelectedChatId(payload.chats[0]?.chatId ?? null);
      setStatus({ state: "success", message: "Analysis ready." });
    } catch (error) {
      console.error(error);
      setStatus({ state: "error", message: "Invalid JSON or file could not be read." });
    }
  }

  async function requestCode() {
    setAuthStatus({ state: "loading" });
    try {
      const res = await fetch("/api/mtproto/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: mtproto.phone, testDc: mtproto.testDc }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to send code." }));
        setAuthStatus({ state: "error", message: error.error });
        return;
      }
      setAuthStatus({ state: "success", message: "Code sent. Check Telegram." });
    } catch (error) {
      console.error(error);
      setAuthStatus({ state: "error", message: "Unable to send code." });
    }
  }

  async function completeSignIn() {
    setAuthStatus({ state: "loading" });
    try {
      const res = await fetch("/api/mtproto/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: mtproto.phone,
          code: mtproto.code,
          password: mtproto.password || undefined,
        }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to sign in." }));
        setAuthStatus({ state: "error", message: error.error });
        return;
      }

      const payload = await res.json();
      setMtproto((prev) => ({ ...prev, session: payload.session || prev.session }));
      setAuthStatus({ state: "success", message: "Signed in. Session saved locally." });
    } catch (error) {
      console.error(error);
      setAuthStatus({ state: "error", message: "Sign-in failed." });
    }
  }

  async function exportChat() {
    setExportStatus({ state: "loading" });
    try {
      const res = await fetch("/api/mtproto/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: mtproto.phone,
          session: mtproto.session || undefined,
          chat: mtproto.chat,
          limit: Number(mtproto.limit) || 500,
          testDc: mtproto.testDc,
          quickReplyMinutes: quickWindow,
        }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to export chat." }));
        setExportStatus({ state: "error", message: error.error });
        return;
      }

      const payload = await res.json();
      const nextAnalysis: AnalysisResult = payload.analysis;
      setAnalysis(nextAnalysis);
      setSelectedChatId(nextAnalysis.chats[0]?.chatId ?? null);
      setExportStatus({ state: "success", message: "Chat exported and analyzed." });
    } catch (error) {
      console.error(error);
      setExportStatus({ state: "error", message: "Export failed." });
    }
  }

  async function exportAsImage() {
    if (!analysis) return;
    if (!analyticsRef.current) return;
    setExportingImage(true);
    try {
      // Ensure fonts are loaded to avoid text fallback/layout shifts during capture
      await document.fonts.ready;
      const html2canvas = (await import("html2canvas")).default;
      const scale = Math.max(2, Math.round(window.devicePixelRatio || 1));
      const canvas = await html2canvas(analyticsRef.current, {
        backgroundColor: "#ffffff",
        scale,
        useCORS: true,
        onclone: (doc) => {
          const originalRoot = analyticsRef.current;
          if (!originalRoot) return;
          const clonedRoot = doc.querySelector("[data-export-root=\"true\"]") as HTMLElement | null;
          if (!clonedRoot) return;

          // Debug scan for advanced color functions and gradients (helps find remaining issues)
          try {
            const colorRegex = /(lab\(|lch\(|color\(|oklab\()/i;
            const gradientRegex = /(gradient\(|linear-gradient\(|radial-gradient\()/i;
            const found: Array<{ tag: string; prop: string; value: string }> = [];
            const originalNodes = [originalRoot, ...Array.from(originalRoot.querySelectorAll("*"))] as HTMLElement[];

            for (const n of originalNodes) {
              const styles = window.getComputedStyle(n);
              for (let i = 0; i < styles.length; i++) {
                const prop = styles[i];
                const val = styles.getPropertyValue(prop);
                if (!val) continue;
                if (colorRegex.test(val) || gradientRegex.test(val)) {
                  found.push({ tag: n.tagName, prop, value: val.slice(0, 200) });
                  break;
                }
              }
            }

            if (found.length) {
              console.debug("html2canvas export: elements with advanced color/gradient functions:", found.slice(0, 20));
            } else {
              console.debug("html2canvas export: no advanced color/gradient functions found");
            }
          } catch (e) {
            console.debug("html2canvas export debug scan failed", e);
          }
          const originalNodes = [originalRoot, ...Array.from(originalRoot.querySelectorAll("*"))] as HTMLElement[];
          const clonedNodes = [clonedRoot, ...Array.from(clonedRoot.querySelectorAll("*"))] as HTMLElement[];

          const properties = [
            "color",
            "backgroundColor",
            "borderColor",
            "borderTopColor",
            "borderRightColor",
            "borderBottomColor",
            "borderLeftColor",
            "outlineColor",
            "textDecorationColor",
          ];

          // Convert CSS lab(...) color function to rgb() because html2canvas cannot parse lab().
          const replaceLabFunctions = (s: string) => {
            return s.replace(/lab\(([^)]+)\)/gi, (_match, inner) => {
              try {
                const parts = inner.trim().split(/\s*\/\s*|\s+/).filter(Boolean);
                // parts: [L, a, b, maybe alpha]
                let L = parts[0];
                const a = parseFloat(parts[1]);
                const b = parseFloat(parts[2]);
                let alphaStr = parts[3];
                let alpha: number | undefined = undefined;

                // L might be a percent like '94.9004%'
                if (typeof L === "string" && L.endsWith("%")) {
                  L = parseFloat(L.slice(0, -1));
                } else {
                  L = parseFloat(L as unknown as string);
                }

                // Parse alpha which may be a percentage
                if (alphaStr !== undefined) {
                  alphaStr = alphaStr.trim();
                  if (alphaStr.endsWith("%")) {
                    alpha = parseFloat(alphaStr.slice(0, -1)) / 100;
                  } else {
                    alpha = parseFloat(alphaStr);
                  }
                }

                // Convert Lab to XYZ (D65)
                const labL = Number(L);
                const laba = Number(a);
                const labb = Number(b);

                let y = (labL + 16) / 116;
                let x = laba / 500 + y;
                let z = y - labb / 200;

                const f = (t: number) => (Math.pow(t, 3) > 0.008856 ? Math.pow(t, 3) : (t - 16 / 116) / 7.787);

                const Xn = 95.047,
                  Yn = 100.0,
                  Zn = 108.883;

                const X = Xn * f(x);
                const Y = Yn * f(y);
                const Z = Zn * f(z);

                // XYZ to linear RGB
                let r = X * 0.4124564 + Y * 0.3575761 + Z * 0.1804375;
                let g = X * 0.2126729 + Y * 0.7151522 + Z * 0.072175;
                let bl = X * 0.0193339 + Y * 0.119192 + Z * 0.9503041;

                // Normalize
                r = r / 100;
                g = g / 100;
                bl = bl / 100;

                const gamma = (u: number) => (u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(u, 1 / 2.4) - 0.055);

                r = Math.min(1, Math.max(0, gamma(r)));
                g = Math.min(1, Math.max(0, gamma(g)));
                bl = Math.min(1, Math.max(0, gamma(bl)));

                const R = Math.round(r * 255);
                const G = Math.round(g * 255);
                const B = Math.round(bl * 255);

                if (alpha === undefined || Number.isNaN(alpha)) alpha = 1;
                alpha = Math.max(0, Math.min(1, alpha));

                return alpha >= 1 ? `rgb(${R}, ${G}, ${B})` : `rgba(${R}, ${G}, ${B}, ${alpha})`;
              } catch (e) {
                return _match;
              }
            });
          };

          clonedNodes.forEach((node, index) => {
            const source = originalNodes[index];
            if (!source) return;

            // Replace lab() occurrences in computed styles (covers many properties incl. background-image, border, etc.)
            const styles = window.getComputedStyle(source);
            for (let i = 0; i < styles.length; i++) {
              const prop = styles[i];
              try {
                const value = styles.getPropertyValue(prop);
                if (!value) continue;
                if (/lab\(/i.test(value)) {
                  node.style.setProperty(prop, replaceLabFunctions(value));
                }
              } catch (e) {
                // ignore any read-only or proprietary properties
              }
            }

            // Ensure box-shadow is handled (some browsers expose it differently)
            try {
              const shadow = styles.getPropertyValue("box-shadow");
              if (shadow && shadow !== "none" && /lab\(/i.test(shadow)) {
                node.style.setProperty("box-shadow", replaceLabFunctions(shadow));
              }
            } catch (e) {
              /* ignore */
            }

            // Replace lab() in inline style attribute if present
            try {
              const inline = source.getAttribute && source.getAttribute("style");
              if (inline && /lab\(/i.test(inline)) {
                node.setAttribute("style", replaceLabFunctions(inline));
              }
            } catch (e) {
              /* ignore */
            }

            // Replace lab() in attributes (SVG fill/stroke/stop-color etc.)
            try {
              if ((node as Element).getAttributeNames) {
                const names = (node as Element).getAttributeNames();
                for (const name of names) {
                  const val = (node as Element).getAttribute(name);
                  if (!val) continue;
                  if (/lab\(/i.test(val)) {
                    (node as Element).setAttribute(name, replaceLabFunctions(val));
                  }
                }
              }
            } catch (e) {
              /* ignore */
            }

            // Copy pseudo-elements ::before and ::after into the cloned node so decorative chips/badges render
            try {
              const copyPseudo = (sourceEl: HTMLElement, targetEl: HTMLElement, marker: '::before' | '::after') => {
                const ps = window.getComputedStyle(sourceEl, marker);
                const content = ps.getPropertyValue('content');
                const hasVisual = (content && content !== 'none' && content !== 'normal' && content !== '""') ||
                  ps.getPropertyValue('background-image') !== 'none' ||
                  ps.getPropertyValue('box-shadow') !== 'none' ||
                  ps.getPropertyValue('border-top-width') !== '0px' ||
                  ps.getPropertyValue('width') !== '0px' ||
                  ps.getPropertyValue('height') !== '0px';
                if (!hasVisual) return;

                const pseudo = doc.createElement('span');
                pseudo.setAttribute('data-export-pseudo', marker === '::before' ? 'before' : 'after');

                // If pseudo is absolutely positioned, ensure parent has positioning context
                try {
                  const parentPos = window.getComputedStyle(targetEl).position;
                  if (ps.getPropertyValue('position') === 'absolute' && parentPos === 'static') {
                    targetEl.style.setProperty('position', 'relative');
                  }
                } catch (e) {
                  /* ignore */
                }

                const propsToCopy = ['display', 'position', 'left', 'right', 'top', 'bottom', 'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'background', 'background-image', 'background-color', 'background-size', 'background-position', 'background-repeat', 'border', 'border-radius', 'border-top', 'border-right', 'border-bottom', 'border-left', 'box-shadow', 'transform', 'opacity', 'z-index', 'color', 'font', 'font-size', 'font-family', 'font-weight', 'line-height', 'padding', 'margin', 'text-align', 'vertical-align', 'white-space', 'pointer-events'];

                for (const p of propsToCopy) {
                  try {
                    const v = ps.getPropertyValue(p);
                    if (!v) continue;
                    let out = v;
                    if (/lab\(/i.test(out)) out = replaceLabFunctions(out);
                    pseudo.style.setProperty(p, out);
                  } catch (e) {
                    /* ignore individual property failures */
                  }
                }

                // Set text content from CSS content if present (strip surrounding quotes)
                if (content && content !== 'none' && content !== 'normal' && content !== '""') {
                  const text = content.replace(/^['"]|['"]$/g, '');
                  pseudo.textContent = text;
                }

                // Ensure it's visible and non-interactive in the cloned tree
                if (!pseudo.style.display) pseudo.style.display = 'block';
                pseudo.style.pointerEvents = 'none';

                if (marker === '::before') {
                  targetEl.insertBefore(pseudo, targetEl.firstChild);
                } else {
                  targetEl.appendChild(pseudo);
                }
              };

              copyPseudo(source as HTMLElement, node as HTMLElement, '::before');
              copyPseudo(source as HTMLElement, node as HTMLElement, '::after');
            } catch (e) {
              /* ignore */
            }
          });

          // Replace lab() inside any inline SVG <style> blocks or gradient stops
          try {
            const svgs = clonedRoot.querySelectorAll("svg");
            svgs.forEach((svg) => {
              const styleBlocks = svg.querySelectorAll("style");
              styleBlocks.forEach((s) => {
                if (s.textContent && /lab\(/i.test(s.textContent)) {
                  s.textContent = replaceLabFunctions(s.textContent);
                }
              });

              const stops = svg.querySelectorAll("stop");
              stops.forEach((stop) => {
                const color = stop.getAttribute("stop-color");
                if (color && /lab\(/i.test(color)) {
                  stop.setAttribute("stop-color", replaceLabFunctions(color));
                }
              });
            });
          } catch (e) {
            /* ignore */
          }
        },
      });
      const url = canvas.toDataURL("image/png");
      triggerDownload(url, `telegram-analytics-${selectedChat?.title || "dashboard"}.png`);
    } catch (error) {
      console.error(error);
      setStatus({ state: "error", message: "Could not export image." });
    } finally {
      setExportingImage(false);
    }
  }

  function exportAsCsv() {
    if (!analysis || !selectedChat) return;
    setExportingCsv(true);
    try {
      const csv = buildChatCsv(selectedChat);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `telegram-analytics-${selectedChat.title}.csv`);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (error) {
      console.error(error);
      setStatus({ state: "error", message: "Could not export CSV." });
    } finally {
      setExportingCsv(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 pb-16 pt-10 md:px-8">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-6">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Telegram Intelligence
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
            Chat analytics with search and infographics
          </h1>
          <p className="max-w-3xl text-base leading-7 text-slate-600">
            Upload your Telegram JSON export, pick a chat, and explore message activity, word usage, emojis, and participant patterns. Everything runs through the built-in API.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-[2fr,3fr]">
          <UploadCard status={status} onFile={handleFileUpload} />
          <SummaryBar analysis={analysis} totalParticipants={totalParticipants} />
        </section>

        <SettingsBar quickWindow={quickWindow} setQuickWindow={setQuickWindow} />

        <ExportActions
          disabled={!analysis}
          onExportImage={exportAsImage}
          onExportCsv={exportAsCsv}
          exportingImage={exportingImage}
          exportingCsv={exportingCsv}
        />

        <MtprotoPanel
          mtproto={mtproto}
          setMtproto={setMtproto}
          authStatus={authStatus}
          exportStatus={exportStatus}
          onSendCode={requestCode}
          onSignIn={completeSignIn}
          onExport={exportChat}
        />

        {analysis && (
          <section
            ref={analyticsRef}
            data-export-root="true"
            className="grid gap-6 lg:grid-cols-[1.1fr,2fr]"
          >
            <ChatList
              chats={analysis.chats}
              selectedId={selectedChat?.chatId || null}
              onSelect={setSelectedChatId}
            />

            {selectedChat ? (
              <div className="flex flex-col gap-6">
                <SearchCard
                  chatTitle={selectedChat.title}
                  wordQuery={wordQuery}
                  setWordQuery={setWordQuery}
                  count={wordFrequency}
                />

                <StatsGrid chat={selectedChat} />
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm text-slate-500">Select a chat to see its analytics.</p>
              </div>
            )}
          </section>
        )}

        {!analysis && status.state === "idle" && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-8 text-center text-slate-600 shadow-sm">
            Upload a Telegram JSON export to begin. You can export chats from Telegram Settings → Advanced → Export Data → JSON.
          </div>
        )}

        {status.state === "error" && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {status.message || "Something went wrong. Please retry."}
          </div>
        )}
      </div>
    </main>
  );
}

function UploadCard({ status, onFile }: { status: Status; onFile: (file: File) => void }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">Upload Telegram export</h2>
          <p className="text-sm text-slate-600">
            Accepts the JSON export file. Data is processed through the local API and not stored.
          </p>
        </div>
        <StatusPill status={status} />
      </div>
      <label className="mt-4 flex h-32 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:border-slate-400">
        <input
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
          }}
        />
        <div className="text-sm font-medium text-slate-800">Drop JSON file or click to browse</div>
        <div className="text-xs text-slate-500">Telegram export → JSON</div>
      </label>
    </div>
  );
}

function SettingsBar({
  quickWindow,
  setQuickWindow,
}: {
  quickWindow: number;
  setQuickWindow: (value: number) => void;
}) {
  return (
    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 lg:grid-cols-3">
      <div className="flex flex-col gap-1">
        <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Analysis settings</div>
        <div className="text-sm text-slate-700">Tune quick-reply detection; weekly buckets auto-apply on long timelines.</div>
      </div>
      <div className="flex items-end gap-3">
        <LabeledInput
          label="Quick reply window (minutes)"
          value={String(quickWindow)}
          type="number"
          onChange={(val) => setQuickWindow(Math.max(1, Number(val) || 1))}
        />
        <div className="text-xs text-slate-500 pb-2">Applied on next analyze/export</div>
      </div>
    </div>
  );
}

function ExportActions({
  disabled,
  onExportImage,
  onExportCsv,
  exportingImage,
  exportingCsv,
}: {
  disabled: boolean;
  onExportImage: () => void;
  onExportCsv: () => void;
  exportingImage: boolean;
  exportingCsv: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold text-slate-900">Export</div>
      <div className="text-xs text-slate-500">Download current dashboard as PNG or CSV (per selected chat).</div>
      <div className="flex gap-2">
        <InlineButton label={exportingImage ? "Exporting…" : "Export PNG"} disabled={disabled || exportingImage} onClick={onExportImage} />
        <InlineButton label={exportingCsv ? "Exporting…" : "Export CSV"} disabled={disabled || exportingCsv} onClick={onExportCsv} />
      </div>
    </div>
  );
}

function MtprotoPanel({
  mtproto,
  setMtproto,
  authStatus,
  exportStatus,
  onSendCode,
  onSignIn,
  onExport,
}: {
  mtproto: MtprotoState;
  setMtproto: React.Dispatch<React.SetStateAction<MtprotoState>>;
  authStatus: Status;
  exportStatus: Status;
  onSendCode: () => Promise<void>;
  onSignIn: () => Promise<void>;
  onExport: () => Promise<void>;
}) {
  return (
    <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2">
        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
          MTProto fetcher
        </div>
        <p className="text-sm text-slate-600">
          Sign in with your Telegram account (code + optional 2FA), capture the session, and export a chat directly by username/link/id. Sessions are kept in-memory unless you copy them out.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Sign-in</h3>
          <LabeledInput
            label="Phone"
            value={mtproto.phone}
            placeholder="+123456789"
            onChange={(phone) => setMtproto((p) => ({ ...p, phone }))}
          />
          <LabeledInput
            label="Code"
            value={mtproto.code}
            placeholder="12345"
            onChange={(code) => setMtproto((p) => ({ ...p, code }))}
          />
          <LabeledInput
            label="Password (2FA, optional)"
            value={mtproto.password}
            type="password"
            onChange={(password) => setMtproto((p) => ({ ...p, password }))}
          />
          <div className="flex items-center gap-3 text-sm text-slate-700">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={mtproto.testDc}
                onChange={(e) => setMtproto((p) => ({ ...p, testDc: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              Use test DC
            </label>
            <StatusPill status={authStatus} />
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton label="Send code" onClick={onSendCode} disabled={!mtproto.phone} />
            <ActionButton label="Sign in" onClick={onSignIn} disabled={!mtproto.phone || !mtproto.code} />
          </div>
          {mtproto.session && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 break-all">
              Session: {mtproto.session}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Export & analyze</h3>
          <LabeledInput
            label="Chat (username/link/id)"
            value={mtproto.chat}
            placeholder="t.me/somechat or @name or numeric id"
            onChange={(chat) => setMtproto((p) => ({ ...p, chat }))}
          />
          <LabeledInput
            label="Limit"
            value={String(mtproto.limit)}
            type="number"
            onChange={(limit) => setMtproto((p) => ({ ...p, limit: Number(limit) || 0 }))}
          />
          <div className="flex items-center gap-2">
            <ActionButton
              label="Export & analyze"
              onClick={onExport}
              disabled={!mtproto.phone || !mtproto.session || !mtproto.chat}
            />
            <StatusPill status={exportStatus} />
          </div>
          <p className="text-xs text-slate-500">
            Requires a valid session (sign in first). Results load into the dashboard below.
          </p>
        </div>
      </div>
    </section>
  );
}

function SummaryBar({
  analysis,
  totalParticipants,
}: {
  analysis: AnalysisResult | null;
  totalParticipants: number;
}) {
  const items = [
    {
      label: "Chats",
      value: analysis ? formatNumber(analysis.chatCount) : "—",
    },
    {
      label: "Messages",
      value: analysis ? formatNumber(analysis.totalMessages) : "—",
    },
    {
      label: "Participants (sum)",
      value: analysis ? formatNumber(totalParticipants) : "—",
    },
  ];

  return (
    <div className="grid h-full grid-cols-3 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl bg-slate-50 px-4 py-3">
          <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{item.label}</div>
          <div className="text-2xl font-semibold text-slate-900">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function ChatList({
  chats,
  selectedId,
  onSelect,
}: {
  chats: ChatStats[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Chats</h3>
        <div className="text-xs text-slate-500">{chats.length} loaded</div>
      </div>
      <div className="flex max-h-[480px] flex-col gap-2 overflow-y-auto pr-2">
        {chats.map((chat) => (
          <button
            key={chat.chatId}
            onClick={() => onSelect(chat.chatId)}
            className={`flex flex-col gap-1 rounded-xl border px-3 py-2 text-left transition ${selectedId === chat.chatId
              ? "border-blue-500 bg-blue-50"
              : "border-slate-200 hover:border-slate-300"
              }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-900">{chat.title}</span>
              <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{chat.type}</span>
            </div>
            <div className="text-xs text-slate-600">
              {formatNumber(chat.messageCount)} msgs · {chat.participantCount} participants
            </div>
            <div className="text-[11px] text-slate-500">
              {chat.dateRange.start || "—"} → {chat.dateRange.end || "—"}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function SearchCard({
  chatTitle,
  wordQuery,
  setWordQuery,
  count,
}: {
  chatTitle: string;
  wordQuery: string;
  setWordQuery: (value: string) => void;
  count: number | null;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Search</div>
          <div className="text-sm font-semibold text-slate-900">Word frequency in {chatTitle}</div>
        </div>
        {count !== null && (
          <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            {count} hits
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          value={wordQuery}
          onChange={(e) => setWordQuery(e.target.value)}
          placeholder="Type a word"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-2 ring-transparent transition focus:border-blue-500 focus:ring-blue-100"
        />
        <div className="text-xs text-slate-500">Exact word match (links are filtered out)</div>
      </div>
    </div>
  );
}

function StatsGrid({ chat }: { chat: ChatStats }) {
  const maxWord = chat.topWords[0]?.count || 1;
  const maxEmoji = chat.topEmojis[0]?.count || 1;
  const maxUser = chat.perUser[0]?.count || 1;
  const dayWindow = chat.perDayGranularity === "day" ? chat.perDay.slice(-90) : chat.perDay;
  const maxDay = dayWindow.length ? Math.max(...dayWindow.map((d) => d.count)) : 1;
  const maxHour = Math.max(...chat.perHour.map((d) => d.count), 1);
  const maxWeekday = Math.max(...chat.perWeekday.map((d) => d.count), 1);
  const totalWords = chat.totals.words || 0;
  const totalEmojis = chat.totals.emojis || 0;
  const totalStickers = chat.totals.stickers || 0;
  const topics = chat.topics;
  const perUserTopics = chat.perUserTopics.slice(0, 6);
  const quickReplies = chat.perUserQuickReplies.slice(0, 6);
  const hasStickers = chat.topStickers.length > 0 && totalStickers > 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Card title="Topics" hint="Top recurring keywords (links removed)">
        {topics.length === 0 ? (
          <div className="text-sm text-slate-500">No topics extracted</div>
        ) : (
          <TopicRow topics={topics} />
        )}
      </Card>

      <Card title="Top words" hint="Filtered common stop words">
        <BarList
          items={chat.topWords.map((item) => ({ label: item.word, count: item.count }))}
          max={maxWord}
          total={totalWords}
          emptyText="No word data"
        />
      </Card>

      <Card title="Top emojis" hint="Emoji frequency">
        <BarList
          items={chat.topEmojis.map((item) => ({ label: item.emoji, count: item.count }))}
          max={maxEmoji}
          total={totalEmojis}
          emptyText="No emoji data"
        />
      </Card>

      {hasStickers && (
        <Card title="Top stickers" hint="Sticker emoji frequency">
          <BarList
            items={chat.topStickers.map((item) => ({ label: item.sticker, count: item.count }))}
            max={chat.topStickers[0]?.count || 1}
            total={totalStickers}
            emptyText="No sticker data"
          />
        </Card>
      )}

      <Card title="Per-user topics" hint="Top 6 authors with topic slices">
        {perUserTopics.length === 0 ? (
          <div className="text-sm text-slate-500">No per-user topics yet</div>
        ) : (
          <div className="flex flex-col gap-3">
            {perUserTopics.map((user) => (
              <UserTopicRow key={user.name} user={user} />
            ))}
          </div>
        )}
      </Card>

      <Card title="Quick reply hour" hint="Avg hour of replies within configured window (UTC)">
        {quickReplies.length === 0 ? (
          <div className="text-sm text-slate-500">No quick replies detected</div>
        ) : (
          <QuickReplyList items={quickReplies} />
        )}
      </Card>

      <Card title="Participants" hint="Messages per author">
        <BarList
          items={chat.perUser.map((item) => ({ label: item.name, count: item.count }))}
          max={maxUser}
          total={chat.messageCount}
          emptyText="No participants data"
        />
      </Card>

      <Card
        title={chat.perDayGranularity === "week" ? "Weekly trend" : "Daily trend"}
        hint={chat.perDayGranularity === "week" ? "Auto-aggregated weeks (UTC)" : "Messages per day (recent)"}
      >
        {dayWindow.length === 0 ? (
          <div className="text-sm text-slate-500">No day-level data</div>
        ) : (
          <SparklineBars
            points={dayWindow.map((d) => ({ label: d.date, value: d.count }))}
            max={maxDay}
            height={96}
          />
        )}
      </Card>

      <Card title="Hourly rhythm" hint="UTC hours">
        <InlineBarChart
          items={chat.perHour.map((h) => ({ label: `${h.hour}`, count: h.count }))}
          max={maxHour}
          formatter={(label) => `${label}h`}
        />
      </Card>

      <Card title="Weekday pattern" hint="UTC">
        <InlineBarChart
          items={chat.perWeekday.map((d) => ({ label: d.weekday, count: d.count }))}
          max={maxWeekday}
          formatter={(label) => label}
        />
      </Card>

    </div>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        {hint && <div className="text-[11px] text-slate-500">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function BarList({
  items,
  max,
  total,
  emptyText,
}: {
  items: { label: string; count: number }[];
  max: number;
  total?: number;
  emptyText: string;
}) {
  if (items.length === 0) {
    return <div className="text-sm text-slate-500">{emptyText}</div>;
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div key={item.label} className="grid grid-cols-[140px,1fr] items-center gap-3 text-xs">
          <div className="truncate font-medium text-slate-800" title={item.label}>
            {item.label}
          </div>
          <div className="flex items-center gap-2">
            <div
              className="h-2 rounded-full bg-slate-900"
              style={{ width: `${Math.max(8, (item.count / max) * 100)}%` }}
            />
            <span className="text-slate-500">
              {item.count}
              {total && total > 0 ? ` (${Math.round((item.count / total) * 100)}%)` : ""}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function SparklineBars({
  points,
  max,
  height,
}: {
  points: { label: string; value: number }[];
  max: number;
  height: number;
}) {
  const [tooltip, setTooltip] = useState<{ content: string; rect: DOMRect | null } | null>(null);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-end gap-1 overflow-x-auto overflow-y-visible rounded-xl bg-slate-50 p-2" style={{ height }}>
        {points.map((point) => (
          <div key={point.label} className="relative h-full w-3 flex-shrink-0">
            <div
              role="button"
              tabIndex={0}
              aria-label={`${point.label}: ${point.value}`}
              className="group relative h-full w-3 rounded-full bg-slate-200"
              onMouseEnter={(e) => setTooltip({ content: `${point.label}: ${point.value}`, rect: e.currentTarget.getBoundingClientRect() })}
              onMouseLeave={() => setTooltip(null)}
              onFocus={(e) => setTooltip({ content: `${point.label}: ${point.value}`, rect: e.currentTarget.getBoundingClientRect() })}
              onBlur={() => setTooltip(null)}
            >
              <div
                className="absolute bottom-0 left-0 right-0 rounded-full bg-blue-500"
                style={{ height: `${(point.value / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {tooltip && <TooltipPortal visible={!!tooltip} content={tooltip.content} anchorRect={tooltip.rect} />}

      <div className="flex justify-between text-[11px] text-slate-500">
        <span>{points[0]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
    </div>
  );
}

function InlineBarChart({
  items,
  max,
  formatter,
}: {
  items: { label: string; count: number }[];
  max: number;
  formatter: (label: string) => string;
}) {
  const [tooltip, setTooltip] = useState<{ content: string; rect: DOMRect | null } | null>(null);

  return (
    <div className="flex items-end gap-1 overflow-x-auto overflow-y-visible">
      {items.map((item) => (
        <div
          key={item.label}
          role="button"
          tabIndex={0}
          aria-label={`${formatter(item.label)}: ${item.count}`}
          className="group relative flex flex-col items-center gap-1 text-[10px] text-slate-500"
          onMouseEnter={(e) => setTooltip({ content: `${formatter(item.label)}: ${item.count}`, rect: e.currentTarget.getBoundingClientRect() })}
          onMouseLeave={() => setTooltip(null)}
          onFocus={(e) => setTooltip({ content: `${formatter(item.label)}: ${item.count}`, rect: e.currentTarget.getBoundingClientRect() })}
          onBlur={() => setTooltip(null)}
        >
          <div className="relative h-24 w-3 rounded-full bg-slate-200">
            <div
              className="absolute bottom-0 left-0 right-0 rounded-full bg-emerald-500"
              style={{ height: `${(item.count / max) * 100}%` }}
            />
          </div>

          <span>{formatter(item.label)}</span>
          <span className="text-[10px] text-slate-400">{item.count}</span>
        </div>
      ))}

      {tooltip && <TooltipPortal visible={!!tooltip} content={tooltip.content} anchorRect={tooltip.rect} />}
    </div>
  );
}

function UserTopicRow({ user }: { user: ChatStats["perUserTopics"][number] }) {
  const palette = ["#2563eb", "#22c55e", "#f97316", "#a855f7", "#0ea5e9", "#f59e0b"];
  const segments = user.topics.slice(0, 3);
  const total = segments.reduce((sum, t) => sum + t.count, 0) || 1;

  let start = 0;
  const gradients = segments.map((seg, idx) => {
    const pct = (seg.count / total) * 100;
    const slice = `${palette[idx % palette.length]} ${start}% ${start + pct}%`;
    start += pct;
    return slice;
  });

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <div
        className="relative h-14 w-14 flex-shrink-0 rounded-full"
        style={{ backgroundImage: gradients.length ? `conic-gradient(${gradients.join(", ")})` : "none", backgroundColor: gradients.length ? undefined : "#e2e8f0" }}
      >
        <div className="absolute inset-[22%] rounded-full bg-white" />
      </div>
      <div className="flex flex-col gap-1 text-sm text-slate-800">
        <div className="font-semibold">{user.name}</div>
        <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
          {segments.map((seg, idx) => (
            <span key={seg.label} className="inline-flex items-center gap-1">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: palette[idx % palette.length] }}
              />
              <span>{seg.label}</span>
              <span className="text-slate-500">{seg.count}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuickReplyList({ items }: { items: ChatStats["perUserQuickReplies"] }) {
  return (
    <div className="flex flex-col gap-2 text-sm text-slate-800">
      {items.map((item) => (
        <div key={item.name} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex flex-col">
            <span className="font-semibold">{item.name}</span>
            <span className="text-[11px] text-slate-500">{item.count} quick replies</span>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <span className="text-[11px] text-slate-500">avg</span>
            <span>{formatHourMinutes(item.avgHour)} UTC</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatHourMinutes(value: number): string {
  if (!Number.isFinite(value)) return "00:00";
  const normalized = ((value % 24) + 24) % 24;
  let hours = Math.floor(normalized);
  let minutes = Math.round((normalized - hours) * 60);
  if (minutes === 60) {
    minutes = 0;
    hours = (hours + 1) % 24;
  }
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return `${hh}:${mm}`;
}

function TopicRow({ topics }: { topics: ChatStats["topics"] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {topics.map((topic) => (
        <span
          key={topic.label}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-800"
        >
          <span>{topic.label}</span>
          <span className="rounded-full bg-slate-900 px-2 py-[2px] text-[10px] font-semibold text-white">
            {topic.count}
          </span>
        </span>
      ))}
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  const map = {
    idle: { label: "Idle", className: "bg-slate-100 text-slate-700" },
    loading: { label: "Analyzing", className: "bg-blue-100 text-blue-700" },
    success: { label: "Ready", className: "bg-emerald-100 text-emerald-700" },
    error: { label: "Error", className: "bg-rose-100 text-rose-700" },
  } as const;

  const variant = map[status.state];

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${variant.className}`}>
      {variant.label}
    </span>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-slate-700">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-2 ring-transparent transition focus:border-blue-500 focus:ring-blue-100"
      />
    </label>
  );
}

function ActionButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${disabled ? "bg-slate-300" : "bg-slate-900 hover:bg-slate-800"
        }`}
    >
      {label}
    </button>
  );
}

function InlineButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${disabled ? "border-slate-200 bg-slate-100 text-slate-400" : "border-slate-300 bg-slate-50 text-slate-800 hover:border-slate-400"}`}
    >
      {label}
    </button>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en").format(value);
}

function triggerDownload(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
}

function buildChatCsv(chat: ChatStats): string {
  const lines: string[] = [];
  const push = (row: string[]) => lines.push(row.map(csvValue).join(","));

  push(["Section", "Label", "Value"]);
  push(["Meta", "Title", chat.title]);
  push(["Meta", "Type", chat.type]);
  push(["Meta", "Messages", String(chat.messageCount)]);
  push(["Meta", "Participants", String(chat.participantCount)]);
  push(["Meta", "Date range", `${chat.dateRange.start || ""} -> ${chat.dateRange.end || ""}`]);
  push(["Meta", "Day granularity", chat.perDayGranularity]);
  lines.push("");

  push(["Top words", "word", "count"]);
  chat.topWords.forEach((w) => push(["Top words", w.word, String(w.count)]));
  lines.push("");

  push(["Topics", "label", "count"]);
  chat.topics.forEach((t) => push(["Topics", t.label, String(t.count)]));
  lines.push("");

  push(["Participants", "name", "count"]);
  chat.perUser.forEach((u) => push(["Participants", u.name, String(u.count)]));
  lines.push("");

  push(["Per-day/weekly", "date", "count"]);
  chat.perDay.forEach((d) => push(["Per-day/weekly", d.date, String(d.count)]));
  lines.push("");

  push(["Per-hour", "hour", "count"]);
  chat.perHour.forEach((h) => push(["Per-hour", String(h.hour), String(h.count)]));
  lines.push("");

  push(["Per-weekday", "weekday", "count"]);
  chat.perWeekday.forEach((d) => push(["Per-weekday", d.weekday, String(d.count)]));
  lines.push("");

  push(["Links", "link", "count"]);
  chat.topLinks.forEach((l) => push(["Links", l.link, String(l.count)]));
  lines.push("");

  push(["Domains", "domain", "count"]);
  chat.topDomains.forEach((d) => push(["Domains", d.domain, String(d.count)]));
  lines.push("");

  push(["Stickers", "sticker", "count"]);
  chat.topStickers.forEach((s) => push(["Stickers", s.sticker, String(s.count)]));

  return lines.join("\n");
}

function csvValue(value: string) {
  const needsQuote = /[",\n]/.test(value);
  if (needsQuote) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
