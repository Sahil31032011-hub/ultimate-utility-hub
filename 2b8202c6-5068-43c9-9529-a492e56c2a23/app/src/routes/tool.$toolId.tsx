import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import jsQR from "jsqr";
import { ArrowLeft, ArrowRight, Check, Copy, Download, ExternalLink, FileImage, LoaderCircle, QrCode, Sparkles, X, Mic, Square, Play, Pause, RotateCcw, Volume2 } from "lucide-react";
import { performTool, tools, type Tool, type ToolResult } from "./index";

export const Route = createFileRoute("/tool/$toolId")({
  head: ({ params }) => ({ meta: [{ title: `${tools.find((tool) => tool.id === params.toolId)?.name ?? "Utility tool"} | Ultimate Utility Hub` }, { name: "description", content: "A focused, free utility workspace from Ultimate Utility Hub." }] }),
  component: ToolPage,
});

function ToolPage() {
  const { toolId } = Route.useParams();
  const tool = useMemo(() => tools.find((item) => item.id === toolId), [toolId]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [secondary, setSecondary] = useState("");
  const [output, setOutput] = useState<ToolResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fileData, setFileData] = useState<{url:string;name:string;type:string}|undefined>();
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [speechVoices, setSpeechVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [listening, setListening] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const speechDownloadStreamRef = useRef<MediaStream | null>(null);
  const speechDownloadRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<{start:()=>void;stop:()=>void;onresult:((event:any)=>void)|null;onerror:((event:any)=>void)|null;onend:(()=>void)|null}|null>(null);
  const [clockMode, setClockMode] = useState<"stopwatch"|"timer">("stopwatch");
  const [clockRunning, setClockRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [timerMinutes, setTimerMinutes] = useState("1");
  const [timerSeconds, setTimerSeconds] = useState("0");
  const [remaining, setRemaining] = useState(60);
  const [qrType, setQrType] = useState<"Website"|"Text"|"Wi-Fi"|"Email"|"Contact"|"Barcode">("Website");
  const [qrExtra, setQrExtra] = useState("");
  const [qrSecurity, setQrSecurity] = useState("WPA");
  const [qrForeground, setQrForeground] = useState("111827");
  const [qrBackground, setQrBackground] = useState("FFFFFF");
  const [qrSize, setQrSize] = useState("360");
  const [qrMargin, setQrMargin] = useState("12");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopScanRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const loadVoices = () => setSpeechVoices(window.speechSynthesis.getVoices());
    loadVoices(); window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => { window.speechSynthesis.removeEventListener("voiceschanged", loadVoices); window.speechSynthesis.cancel(); };
  }, []);
  useEffect(() => {
    if (!clockRunning) return;
    const id = window.setInterval(() => {
      if (clockMode === "stopwatch") setElapsed(value => value + 1);
      else setRemaining(value => { if (value <= 1) { window.clearInterval(id); setClockRunning(false); return 0; } return value - 1; });
    }, 1000);
    return () => window.clearInterval(id);
  }, [clockRunning, clockMode]);
  useEffect(() => { if (clockMode === "timer") setRemaining(Math.max(0, Number(timerMinutes || 0) * 60 + Number(timerSeconds || 0))); }, [timerMinutes, timerSeconds, clockMode]);
  useEffect(() => () => { recognitionRef.current?.stop(); if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel(); }, []);
  useEffect(() => { if (!localStorage.getItem("uuh-profile")) { window.location.replace(`/?login=required&tool=${encodeURIComponent(toolId)}`); return; } const id = window.setTimeout(() => setLoading(false), 620); return () => window.clearTimeout(id); }, [toolId]);
  const stopCamera = () => { stopScanRef.current = true; streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setCameraOn(false); };
  useEffect(() => () => { stopScanRef.current = true; streamRef.current?.getTracks().forEach((track) => track.stop()); if (fileData?.url) URL.revokeObjectURL(fileData.url); }, [fileData?.url]);
  const onFile = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const url = URL.createObjectURL(file); setFileData({url,name:file.name,type:file.type}); setInput(file.name); setOutput(null); setError(""); event.target.value = ""; };
  const scanImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return; setCameraError("");
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Could not read this image. Try another image.");
      context.drawImage(bitmap, 0, 0); bitmap.close();
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const found = jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: "attemptBoth" });
      if (!found) throw new Error("No QR code found. Try a clearer image with the whole code visible.");
      setInput(found.data); setOutput({text:`Decoded QR content:\n${found.data}\n\nFormat: QR Code`});
    } catch (e) { setCameraError(e instanceof Error ? e.message : "Could not scan this image."); }
    event.target.value = "";
  };
  const startCamera = async () => {
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) { setCameraError("Camera access is unavailable. Open this site in a browser with camera permission, or upload a QR image."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});
      streamRef.current = stream; stopScanRef.current = false;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setCameraOn(true);
      const canvas = document.createElement("canvas"); const context = canvas.getContext("2d", {willReadFrequently:true});
      if (!context) throw new Error("Could not start the scanner. Please upload a QR image instead.");
      const scan = () => {
        const video = videoRef.current;
        if (stopScanRef.current || !video || video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) { if (!stopScanRef.current) window.setTimeout(scan, 180); return; }
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        if (canvas.width && canvas.height) {
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
          const found = jsQR(pixels.data, pixels.width, pixels.height, {inversionAttempts:"attemptBoth"});
          if (found) { setInput(found.data); setOutput({text:`Decoded QR content:\n${found.data}\n\nFormat: QR Code`}); stopCamera(); return; }
        }
        if (!stopScanRef.current) window.setTimeout(scan, 180);
      };
      window.setTimeout(scan, 200);
    } catch (e) { stopCamera(); setCameraError(e instanceof Error ? `Camera could not start: ${e.message}. You can upload a QR image instead.` : "Please allow camera access and try again."); }
  };
  const startAudioRecording = async () => {
    try { if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setError("Audio recording is not supported here. Try an updated browser over HTTPS."); return; }
      const stream = await navigator.mediaDevices.getUserMedia({audio:true}); const recorder = new MediaRecorder(stream); recordedChunksRef.current = [];
      recorder.ondataavailable = event => { if(event.data.size) recordedChunksRef.current.push(event.data); };
      recorder.onstop = () => { const blob = new Blob(recordedChunksRef.current,{type:recorder.mimeType || "audio/webm"}); const url=URL.createObjectURL(blob); setRecordedAudioUrl(old=>{if(old)URL.revokeObjectURL(old);return url;}); stream.getTracks().forEach(track=>track.stop()); };
      mediaRecorderRef.current=recorder; recorder.start(); setRecording(true); setError("");
    } catch { setError("Microphone permission was denied or the microphone is unavailable."); }
  };
  const stopAudioRecording = () => { if(mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop(); setRecording(false); };
  const chooseAudioFile = (event:ChangeEvent<HTMLInputElement>) => { const file=event.target.files?.[0]; if(!file)return; if(!file.type.startsWith("audio/")){setError("Please select an audio file.");return;} setAudioFile(file);setAudioPreviewUrl(old=>{if(old)URL.revokeObjectURL(old);return URL.createObjectURL(file);});setError(""); };
  const downloadSpeechText = () => { if(!input.trim()){setError("Type the text you want to save first.");return;} const url=URL.createObjectURL(new Blob([input],{type:"text/plain;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="speech-text.txt";a.click();URL.revokeObjectURL(url); };
  const startDictation = () => {
    const speechWindow = window as Window & {SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any};
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      const ua = navigator.userAgent;
      const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua));
      const isFirefox = /firefox/i.test(ua);
      setError(isMobile
        ? `Live speech recognition is not available in this browser. On your phone, tap the text box and use the microphone on your on-screen keyboard (Gboard or your device keyboard). You can also try Chrome on Android or Safari on iPhone. Record audio saves a recording only; it does not transcribe it.`
        : isFirefox
          ? "Firefox does not support this site's live speech recognition. Try the latest Chrome or Edge, or click the text box and use your computer's built-in dictation. Audio recording works separately and does not automatically create a transcript."
          : "This browser does not support live speech recognition. Try the latest Chrome or Edge, or use your device's built-in dictation in the text box. Audio recording works separately and does not automatically create a transcript.");
      return;
    }
    setError("");
    try { const recognition = new Recognition(); recognition.lang = navigator.language || "en-US"; recognition.continuous = true; recognition.interimResults = true;
      recognition.onresult = (event:any) => { let transcript = ""; for (let i=0;i<event.results.length;i++) transcript += event.results[i][0].transcript + (event.results[i].isFinal ? " " : ""); setInput(transcript.trim()); };
      recognition.onerror = (event:any) => {
        const reason = event.error || "unknown error";
        setError(reason === "not-allowed" || reason === "service-not-allowed"
          ? "Microphone or speech-recognition permission was blocked. Allow microphone access in your browser settings, then try again."
          : reason === "no-speech"
            ? "No speech was detected. Check the microphone, then tap Start listening and speak clearly."
            : reason === "network"
              ? "The browser's speech service needs a network connection. Check your internet and try again."
              : `Speech recognition could not start (${reason}). Try Chrome or Edge and check microphone permission.`);
      };
      recognition.onend = () => setListening(false); recognitionRef.current = recognition; recognition.start(); setListening(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not start speech recognition."); }
  };
  const makeSpeechUtterance = () => { const utterance = new SpeechSynthesisUtterance(input.trim()); const voice = speechVoices.find(item => item.name === selectedVoice); if (voice) utterance.voice = voice; utterance.rate = 1; return utterance; };
  const speakText = () => { if (!input.trim()) { setError("Enter a sentence to speak first."); return; } if (!window.speechSynthesis) { setError("Text-to-speech is not supported in this browser."); return; } window.speechSynthesis.cancel(); const utterance=makeSpeechUtterance(); utterance.onstart=()=>setError(""); utterance.onerror=()=>setError("Voice playback could not start. Try another voice or check your device audio."); window.speechSynthesis.speak(utterance); };
  const downloadSpeechVoice = async () => {
    if (!input.trim()) { setError("Enter a sentence to speak first."); return; }
    if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === "undefined" || !window.speechSynthesis) { setError("Voice download needs a browser that supports tab-audio capture. Try the latest Chrome or Edge on desktop."); return; }
    let stream: MediaStream | null = null;
    try {
      setError("In the sharing window, choose this browser tab and enable tab audio.");
      stream = await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});
      const audioTracks=stream.getAudioTracks();
      if (!audioTracks.length) { stream.getTracks().forEach(track=>track.stop()); setError("No tab audio was shared. Try again and enable Share tab audio in the browser picker."); return; }
      const audioStream = new MediaStream(audioTracks); speechDownloadStreamRef.current=stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const recorder = new MediaRecorder(audioStream,{mimeType}); const chunks:BlobPart[]=[];
      recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
      recorder.onerror=()=>setError("The voice recording failed. Try again in Chrome or Edge.");
      recorder.onstop=()=>{const blob=new Blob(chunks,{type:recorder.mimeType||"audio/webm"}); if(blob.size){const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="text-to-speech-voice.webm";a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);setError("Voice downloaded as a WebM audio file.");}stream?.getTracks().forEach(track=>track.stop());speechDownloadStreamRef.current=null;speechDownloadRecorderRef.current=null;};
      speechDownloadRecorderRef.current=recorder; recorder.start(); window.speechSynthesis.cancel(); const utterance=makeSpeechUtterance(); utterance.onend=()=>{if(recorder.state!=="inactive")recorder.stop();}; utterance.onerror=()=>{if(recorder.state!=="inactive")recorder.stop();setError("Speech playback failed. Please try again.");}; window.speechSynthesis.speak(utterance);
      stream.getVideoTracks().forEach(track=>track.addEventListener("ended",()=>{if(recorder.state!=="inactive")recorder.stop();},{once:true}));
    } catch (e) { stream?.getTracks().forEach(track=>track.stop()); speechDownloadStreamRef.current=null; setError(e instanceof Error && e.name==="NotAllowedError" ? "Tab sharing was cancelled. Allow tab sharing to download the generated voice." : "Could not capture tab audio. Try the latest Chrome or Edge on desktop and enable tab audio."); }
  };
  const runQrMaker = async () => {
    if (!tool) return;
    let payload = input.trim();
    if (qrType === "Wi-Fi") { if (!payload) {setError("Enter the Wi-Fi network name (SSID).");return;} const esc=(v:string)=>v.replace(/[\\;,:"]/g,"\\$&"); payload = "WIFI:T:"+qrSecurity+";S:"+esc(payload)+";P:"+esc(qrExtra)+";;"; }
    else if (qrType === "Email") { if (!payload || !payload.includes("@")) {setError("Enter a valid email address.");return;} payload = "mailto:"+payload+(qrExtra.trim()?"?subject="+encodeURIComponent(qrExtra.trim()):""); }
    else if (qrType === "Contact") { if (!payload) {setError("Enter the contact name.");return;} const lines=payload.split(/\r?\n/); payload="BEGIN:VCARD\nVERSION:3.0\nFN:"+lines[0]+(lines[1]?"\nTEL:"+lines[1]:"")+(qrExtra.trim()?"\nEMAIL:"+qrExtra.trim():"")+"\nEND:VCARD"; }
    else if (qrType === "Barcode") { if (!/^[A-Za-z0-9 .\-$/+%]+$/.test(payload) || !payload) {setError("Code 39 supports A–Z, 0–9, spaces and - . $ / + % only.");return;} }
    else if (qrType === "Website" && payload && !/^https?:\/\//i.test(payload)) payload = "https://"+payload;
    if (!payload) {setError("Enter content to encode.");return;}
    setBusy(true);setError("");setOutput(null);
    try { if (qrType === "Barcode") { const result=await performTool({...tool,id:"barcode",name:"Barcode"},payload,"");setOutput(result); }
      else { const fg=qrForeground.replace(/^#/,'').toUpperCase(), bg=qrBackground.replace(/^#/,'').toUpperCase(); if(!/^[0-9A-F]{6}$/.test(fg)||!/^[0-9A-F]{6}$/.test(bg)) throw new Error("Choose valid foreground and background colours."); const size=Math.max(160,Math.min(1000,Number(qrSize)||360)); const margin=Math.max(0,Math.min(40,Number(qrMargin)||0)); setOutput({text:"https://api.qrserver.com/v1/create-qr-code/?size="+size+"x"+size+"&margin="+margin+"&color="+fg+"&bgcolor="+bg+"&data="+encodeURIComponent(payload),kind:"image"}); }
    } catch(e) {setError(e instanceof Error?e.message:"Could not create the code.");} finally {setBusy(false);}
  };
  const run = async () => { if (!tool) return; if (!localStorage.getItem("uuh-profile")) { window.location.replace(`/?login=required&tool=${encodeURIComponent(toolId)}`); return; } setBusy(true); setError(""); setOutput(null); try { const result = await performTool(tool,input,secondary,fileData); setOutput(result); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong. Check your input and try again."); } finally { setBusy(false); } };
  const copy = async () => { if (!output) return; try { await navigator.clipboard.writeText(output.text); setCopied(true); window.setTimeout(() => setCopied(false), 1400); } catch { setError("Clipboard access was blocked. Select the result and copy it manually."); } };
  const download = () => { if (!output) return; const anchor = document.createElement("a"); anchor.href = output.text.startsWith("data:") || output.text.startsWith("blob:") ? output.text : URL.createObjectURL(new Blob([output.text],{type:"text/plain;charset=utf-8"})); anchor.download = output.filename || "utility-result.txt"; anchor.click(); if (!output.text.startsWith("data:") && !output.text.startsWith("blob:")) URL.revokeObjectURL(anchor.href); };
  if (!tool) return <main className="tool-page"><div className="tool-page-not-found"><QrCode size={40}/><h1>Tool not found</h1><p>This tool may have moved. Head back to the library to choose another one.</p><Link to="/" className="tool-back-link"><ArrowLeft size={16}/> Back to all tools</Link></div></main>;
  const isScanner = tool.mode === "scanner";
  return <main className="tool-page">
    {loading && <div className="tool-page-loader" role="status" aria-live="polite"><div className="loader-emblem"><span/><span/><QrCode size={36}/></div><p>SETTING UP YOUR WORKSPACE</p><strong>{tool.name}</strong><div className="loader-track"><i/></div><span className="loader-caption">Getting your tools ready…</span></div>}
    <header className="tool-page-header"><Link to="/" className="tool-back-link"><ArrowLeft size={16}/> All tools</Link><Link to="/" className="tool-page-brand"><span className="brand-mark"><span/></span><span className="brand-name">ultimate<span>utility</span><b>hub</b></span></Link><span className="tool-header-status"><i/> READY TO WORK</span></header>
    <div className="tool-page-layout"><aside className="tool-page-aside"><div className={`tool-hero-art art-${tool.category.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`}><div className="hero-art-ring ring-one"/><div className="hero-art-ring ring-two"/><span className="hero-art-spark spark-one">✳</span><span className="hero-art-spark spark-two">✦</span>{isScanner ? <QrCode size={66} strokeWidth={1.2}/> : <Sparkles size={66} strokeWidth={1.2}/>}<span className="hero-art-floor"/></div><span className="tool-page-eyebrow">UTILITY / {tool.category.toUpperCase()}</span><h1>{tool.name}</h1><p className="tool-page-description">{tool.desc}</p><div className="tool-page-meta"><span><Check size={14}/> Free to use</span></div><div className="aside-note"><span className="aside-note-icon"><Sparkles size={16}/></span><p><strong>One task. One clean workspace.</strong><br/>Your input stays in this page for quick, focused work.</p></div></aside>
      <section className="tool-studio"><div className="studio-topline"><div><span className="studio-kicker">WORKSPACE / 01</span><h2>Let’s get it done.</h2></div><span className="studio-live"><i/> LOCAL TOOL</span></div>
        {tool.id === "qr" ? <div className="studio-form">
          <div className="qr-type-grid" role="group" aria-label="Choose code type">{([ ["Website","↗"],["Text","✎"],["Wi-Fi","⌁"],["Email","✉"],["Contact","♙"],["Barcode","▥"]] as const).map(([label,icon])=><button key={label} className={qrType===label?"active":""} onClick={()=>{setQrType(label);setOutput(null);setError("");}}><span>{icon}</span>{label}</button>)}</div>
          <label className="studio-field"><span>{qrType==="Website"?"WEBSITE URL":qrType==="Text"?"TEXT TO ENCODE":qrType==="Wi-Fi"?"WI-FI NETWORK NAME (SSID)":qrType==="Email"?"EMAIL ADDRESS":qrType==="Contact"?"CONTACT NAME (PHONE ON NEXT LINE)":"BARCODE CONTENT"}</span><textarea rows={qrType==="Contact"?4:3} value={input} onChange={e=>setInput(e.target.value)} placeholder={qrType==="Website"?"https://example.com":qrType==="Text"?"Type your message…":qrType==="Wi-Fi"?"Wi-Fi network name":qrType==="Email"?"name@example.com":qrType==="Contact"?"Name\nPhone number":"Example: ITEM-123"}/></label>
          {qrType==="Wi-Fi"&&<><label className="studio-field"><span>WI-FI PASSWORD</span><input type="password" value={qrExtra} onChange={e=>setQrExtra(e.target.value)} placeholder="Network password (if required)"/></label><label className="studio-field"><span>SECURITY TYPE</span><select value={qrSecurity} onChange={e=>setQrSecurity(e.target.value)}><option value="WPA">WPA / WPA2 / WPA3</option><option value="WEP">WEP</option><option value="nopass">No password</option></select></label><p className="studio-hint">The QR includes your Wi-Fi details. Share it only with people you want to connect.</p></>}
          {qrType==="Email"&&<label className="studio-field"><span>EMAIL SUBJECT (OPTIONAL)</span><input value={qrExtra} onChange={e=>setQrExtra(e.target.value)} placeholder="Message subject"/></label>}
          {qrType==="Contact"&&<label className="studio-field"><span>CONTACT EMAIL (OPTIONAL)</span><input value={qrExtra} onChange={e=>setQrExtra(e.target.value)} placeholder="name@example.com"/></label>}
          {qrType!=="Barcode"&&<div className="qr-design-panel"><div className="qr-design-heading"><strong>QR DESIGN</strong><span>Custom colours & size</span></div><div className="qr-colour-row"><label className="studio-field"><span>CODE COLOUR</span><div className="qr-colour-control"><input type="color" value={"#"+qrForeground} onChange={e=>setQrForeground(e.target.value.slice(1).toUpperCase())}/><input aria-label="Code hex colour" value={qrForeground} maxLength={6} onChange={e=>setQrForeground(e.target.value.replace(/[^0-9a-f]/gi,"").slice(0,6).toUpperCase())}/></div></label><label className="studio-field"><span>BACKGROUND</span><div className="qr-colour-control"><input type="color" value={"#"+qrBackground} onChange={e=>setQrBackground(e.target.value.slice(1).toUpperCase())}/><input aria-label="Background hex colour" value={qrBackground} maxLength={6} onChange={e=>setQrBackground(e.target.value.replace(/[^0-9a-f]/gi,"").slice(0,6).toUpperCase())}/></div></label></div><div className="qr-colour-row"><label className="studio-field"><span>IMAGE SIZE</span><select value={qrSize} onChange={e=>setQrSize(e.target.value)}><option value="240">240 × 240</option><option value="360">360 × 360</option><option value="600">600 × 600</option><option value="1000">1000 × 1000</option></select></label><label className="studio-field"><span>QUIET ZONE / MARGIN</span><select value={qrMargin} onChange={e=>setQrMargin(e.target.value)}><option value="0">Compact</option><option value="8">Small</option><option value="12">Standard</option><option value="24">Wide</option></select></label></div><div className="qr-mini-preview"><span style={{backgroundColor:"#"+qrBackground,color:"#"+qrForeground}}><QrCode size={54}/></span><p>Use a high-contrast code and background for easier scanning.</p></div></div>}
          {qrType==="Barcode"&&<p className="studio-hint">Creates a Code 39 barcode. Use A–Z, numbers, spaces and supported punctuation.</p>}
          <div className="studio-action-row"><button className="studio-primary" onClick={runQrMaker} disabled={busy}>{busy?<><LoaderCircle size={16} className="spin-icon"/> Creating…</>:<>Create {qrType} <ArrowRight size={16}/></>}</button><button className="studio-secondary" onClick={()=>{setInput("");setQrExtra("");setOutput(null);setError("");}}><X size={15}/> Clear</button></div>{error&&<p className="studio-error" role="alert">{error}</p>}
        </div> : tool.id === "stopwatch-timer" ? <div className="studio-form">
          <div className="clock-mode-tabs"><button className={clockMode === "stopwatch" ? "active" : ""} onClick={() => {setClockRunning(false);setClockMode("stopwatch");setElapsed(0);}}>Stopwatch</button><button className={clockMode === "timer" ? "active" : ""} onClick={() => {setClockRunning(false);setClockMode("timer");setRemaining(Math.max(0,Number(timerMinutes||0)*60+Number(timerSeconds||0)));}}>Timer</button></div>
          {clockMode === "timer" && <div className="clock-inputs"><label className="studio-field"><span>MINUTES</span><input type="number" min="0" max="999" value={timerMinutes} onChange={e=>setTimerMinutes(e.target.value)}/></label><label className="studio-field"><span>SECONDS</span><input type="number" min="0" max="59" value={timerSeconds} onChange={e=>setTimerSeconds(e.target.value)}/></label></div>}
          <div className="clock-display" role="timer">{String(Math.floor((clockMode === "stopwatch" ? elapsed : remaining)/3600)).padStart(2,"0")}:{String(Math.floor(((clockMode === "stopwatch" ? elapsed : remaining)%3600)/60)).padStart(2,"0")}:{String((clockMode === "stopwatch" ? elapsed : remaining)%60).padStart(2,"0")}</div>
          {clockMode === "timer" && remaining === 0 && <p className="studio-hint" role="status">Timer complete.</p>}
          <div className="studio-action-row"><button className="studio-primary" onClick={()=>{if(clockMode === "timer" && remaining === 0) setRemaining(Math.max(0,Number(timerMinutes||0)*60+Number(timerSeconds||0)));setClockRunning(value=>!value);}} disabled={clockMode === "timer" && remaining === 0 && Number(timerMinutes||0)*60+Number(timerSeconds||0)===0}>{clockRunning?<><Pause size={16}/> Pause</>:<><Play size={16}/> Start</>}</button><button className="studio-secondary" onClick={()=>{setClockRunning(false);if(clockMode === "stopwatch")setElapsed(0);else setRemaining(Math.max(0,Number(timerMinutes||0)*60+Number(timerSeconds||0)));}}><RotateCcw size={15}/> Reset</button></div>
        </div> : tool.id === "speech-to-text" ? <div className="studio-form"><div className="speech-section-title">OPTION 1 · LIVE DICTATION</div><label className="studio-field"><span>DICTATED TEXT</span><textarea rows={7} value={input} onChange={e=>setInput(e.target.value)} placeholder="If supported, your speech appears here while you talk…"/></label><div className="studio-action-row"><button className="studio-primary" onClick={listening ? ()=>{recognitionRef.current?.stop();setListening(false);} : startDictation}>{listening?<><Square size={15}/> Stop listening</>:<><Mic size={16}/> Start listening</>}</button><button className="studio-secondary" onClick={()=>{setInput("");setError("");}}><X size={15}/> Clear text</button></div><div className="speech-section-title">OPTION 2 · RECORD OR SELECT AUDIO</div><div className="studio-action-row"><button className="studio-primary" onClick={recording?stopAudioRecording:startAudioRecording}>{recording?<><Square size={15}/> Stop recording</>:<><Mic size={15}/> Record audio</>}</button><label className="studio-secondary upload-action"><FileImage size={15}/> Select recorded audio<input type="file" accept="audio/*" onChange={chooseAudioFile}/></label></div>{audioFile&&<p className="studio-hint">Selected recording: {audioFile.name}</p>}{audioPreviewUrl&&<audio className="speech-audio-player" controls src={audioPreviewUrl}/ >}{recordedAudioUrl&&<div className="speech-recorded-result"><audio className="speech-audio-player" controls src={recordedAudioUrl}/><a className="studio-secondary speech-download-link" href={recordedAudioUrl} download="recording.webm"><Download size={15}/> Download recording</a></div>}<p className="studio-hint">On phones, if Start listening is unsupported, tap the text box and use the microphone on your on-screen keyboard (Gboard/device keyboard). On desktop, try Chrome or Edge. Audio recording saves sound only; it does not automatically transcribe it.</p>{error&&<p className="studio-error" role="alert">{error}</p>}</div> : tool.id === "text-to-speech" ? <div className="studio-form"><label className="studio-field"><span>SENTENCE OR TEXT TO SPEAK</span><textarea rows={7} value={input} onChange={e=>setInput(e.target.value)} placeholder="Type a sentence here and choose a voice…"/></label><label className="studio-field"><span>VOICE OPTIONS ({speechVoices.length} AVAILABLE)</span><select value={selectedVoice} onChange={e=>setSelectedVoice(e.target.value)}><option value="">Default device voice</option>{speechVoices.map(voice=><option key={`${voice.name}-${voice.lang}`} value={voice.name}>{voice.name} — {voice.lang}{voice.default ? " (default)" : ""}</option>)}</select></label><div className="studio-action-row"><button className="studio-primary" onClick={speakText}><Volume2 size={16}/> Speak sentence</button><button className="studio-secondary" onClick={()=>window.speechSynthesis?.cancel()}><Square size={15}/> Stop voice</button><button className="studio-secondary" onClick={downloadSpeechVoice}><Download size={15}/> Download voice</button></div><p className="studio-hint">Download voice records the generated speech as a WebM audio file. When prompted, choose this browser tab and turn on Share tab audio. Desktop Chrome/Edge works best; browser support varies.</p>{error&&<p className="studio-error" role="alert">{error}</p>}</div> : isScanner ? <div className="scanner-page-panel"><div className="scanner-page-preview"><video ref={videoRef} className={cameraOn?"scanner-video-live":"scanner-video-idle"} muted playsInline aria-label="Live QR code camera preview"/>{!cameraOn&&<div className="scanner-page-placeholder"><span className="scanner-corners"><QrCode size={54}/></span><strong>Ready when you are</strong><small>Point your camera at a QR code or upload an image.</small></div>}</div><div className="scanner-page-actions"><button className="studio-primary" onClick={cameraOn?stopCamera:startCamera}>{cameraOn?"Stop camera":"Open camera"}<ArrowRight size={16}/></button><label className="studio-secondary upload-action"><FileImage size={16}/> Upload QR image<input type="file" accept="image/*" onChange={scanImage}/></label></div>{cameraError&&<p className="studio-error" role="alert">{cameraError}</p>}<label className="studio-field"><span>SCANNED CONTENT</span><textarea rows={4} value={input} onChange={(e)=>setInput(e.target.value)} placeholder="Your decoded QR content will appear here…"/></label>{output&&<div className="studio-output"><div className="studio-output-head"><span>SCAN RESULT</span><button onClick={copy}><Copy size={14}/>{copied?"Copied":"Copy"}</button></div><pre>{output.text}</pre></div>}</div> : <div className="studio-form">
          {tool.mode === "file" ? <label className="studio-file-drop"><input type="file" accept="image/*" onChange={onFile}/><span className="file-drop-art"><FileImage size={27}/></span><strong>{fileData?.name || "Choose a file to get started"}</strong><small>Click to browse files from your device</small></label> : <label className="studio-field"><span>{tool.mode === "date" ? "DATE OR VALUES" : tool.mode === "color" ? "COLOUR VALUE(S)" : tool.id === "bmi" ? "HEIGHT IN CENTIMETRES" : tool.id === "password" ? "PASSWORD LENGTH (8–128)" : tool.mode === "numbers" ? "FIRST VALUE OR NUMBER LIST" : "YOUR INPUT"}</span><textarea rows={tool.id.includes("json") || tool.id==="regex" || tool.id.includes("csv") ? 8 : 6} value={input} onChange={(e)=>setInput(e.target.value)} placeholder={tool.id === "json-format" ? '{\n  "hello": "world"\n}' : tool.id === "bmi" ? "Height in centimetres (e.g. 170)" : tool.id === "password" ? "Password length (8–128, default 20)" : tool.id === "percentage" ? "Example: 240" : tool.id === "qr" ? "Paste a URL or short text…" : tool.id === "qr-scanner" ? "Scan or upload a QR code…" : "Type or paste your input here…"}/></label>}
          {tool.mode === "numbers" && <label className="studio-field"><span>{tool.id === "bmi" ? "WEIGHT IN KILOGRAMS" : tool.id === "percentage" ? "PERCENTAGE (%)" : tool.id === "percentage-change" ? "NEW VALUE" : tool.id === "ratio" ? "SECOND NUMBER" : tool.id === "split-bill" ? "NUMBER OF PEOPLE" : tool.id === "discount" ? "DISCOUNT (%)" : tool.id === "sales-tax" ? "TAX (%)" : tool.id === "tip" ? "TIP (%)" : "SECOND VALUE"}</span><input value={secondary} onChange={(e)=>setSecondary(e.target.value)} placeholder="Enter a value"/></label>}
          {tool.id === "contrast" && <label className="studio-field"><span>SECOND HEX COLOUR</span><input value={secondary} onChange={(e)=>setSecondary(e.target.value)} placeholder="Enter the second colour"/></label>}
          {tool.id === "color-mix" && <label className="studio-field"><span>SECOND HEX COLOUR</span><input value={secondary} onChange={(e)=>setSecondary(e.target.value)} placeholder="Enter the second colour"/></label>}
          {tool.id === "regex" && <label className="studio-field"><span>TEXT TO TEST</span><textarea rows={4} value={secondary} onChange={(e)=>setSecondary(e.target.value)} placeholder="Enter sample text…"/></label>}
          {tool.id === "password" && <p className="studio-hint">Enter a length from 8 to 128 in the input above, or leave it blank for a 20-character password. Password generation uses browser cryptographic randomness; copy it somewhere safe before leaving.</p>}
          {tool.id === "bmi" && <p className="studio-hint">This calculator is intended for adults. For children and teens, BMI is interpreted with age- and sex-specific growth charts; this number alone is not a diagnosis.</p>}
          {tool.id === "qr" && <p className="studio-hint">QR image creation uses an external QR service. Avoid encoding passwords or private information.</p>}
          <div className="studio-action-row"><button className="studio-primary" onClick={run} disabled={busy}>{busy?<><LoaderCircle size={16} className="spin-icon"/> Working…</>:<>Run tool <ArrowRight size={16}/></>}</button><button className="studio-secondary" onClick={()=>{setInput("");setSecondary("");setOutput(null);setError("");setFileData(undefined)}}><X size={15}/> Clear</button></div>
          {error&&<p className="studio-error" role="alert">{error}</p>}
          {output&&<div className="studio-output"><div className="studio-output-head"><span>RESULT / COMPLETE</span><div>{output.kind === "download" && <button onClick={download}><Download size={14}/> Download</button>}<button onClick={copy}><Copy size={14}/>{copied?"Copied":"Copy result"}</button></div></div>{output.kind === "image" ? <div className="studio-result-image"><img src={output.text} alt={`${tool.name} result`}/><a href={output.text} target="_blank" rel="noreferrer">Open image <ExternalLink size={14}/></a></div> : output.kind === "download" && output.text.startsWith("data:") ? <div className="studio-result-image"><img src={output.text} alt="Processed image preview"/></div> : <pre>{output.text}</pre>}</div>}
        </div>}
        <div className="studio-footer-note"><span><Check size={14}/> Sign-in required</span><span>Ultimate Utility Hub <span className="footer-dot">·</span> Free utilities</span></div>
      </section></div>
    <footer className="tool-page-footer"><Link to="/" className="tool-back-link"><ArrowLeft size={15}/> Back to the full tool library</Link><span>Built for small wins, every day.</span></footer>
  </main>;
}
