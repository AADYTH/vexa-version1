import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import emailjs from '@emailjs/browser';
import './styles.css';

/* ---------- VEXA's powers & abilities ---------- */
const POWERS=[
  {tag:'01',name:'Umbral Tether',desc:'Senses when someone nearby is quietly struggling, even before they say a word.'},
  {tag:'02',name:'Sanctum Sight',desc:'Can hold a space — physical or conversational — where a person feels safe enough to be honest.'},
  {tag:'03',name:'Dawnbreak',desc:'Turns a low moment into a starting point, without ever rushing the person through it.'},
  {tag:'04',name:'Grimoire Memory',desc:'Never forgets a story once it has been shared, and carries it with quiet, steady care.'}
];

/* ---------- how a visit actually unfolds, step by step ---------- */
const PROCESS=[
  {tag:'01',name:'You arrive',desc:'No forms, no waiting room. The moment you land here, VEXA is already present and speaking first.'},
  {tag:'02',name:'A real conversation',desc:'A few gentle questions — your name, age, where you\'re writing from, an email to reach you — asked one at a time, like a person would ask them.'},
  {tag:'03',name:'You\'re heard',desc:'Then the only question that matters: "So... tell me. How can I help you?" Whatever you share stays between you and VEXA.'},
  {tag:'04',name:'VEXA is notified',desc:'The moment you finish, a notification reaches VEXA directly, with everything needed to actually follow up — no one has to come check the site to know you were here.'}
];

/* ---------- fictional composite accounts, for tone/storytelling only ---------- */
const REPORTS=[
  {name:'A visitor, 2 a.m.',text:'I didn\'t think a website could feel like someone was actually listening. I typed until there was nothing left to say, and it never once rushed me.'},
  {name:'A visitor, first week of college',text:'I came here to ask something small and ended up telling VEXA the real thing underneath it. That part surprised me more than any of the animations did.'},
  {name:'A visitor, after a hard year',text:'What stayed with me wasn\'t the powers or the palace — it was that it asked how I was doing before it asked what I wanted.'}
];

/* ---------- automatic notification email ----------
   Sent the moment a visitor finishes describing their grievance, via
   EmailJS (client-side, no backend required). Configure the three
   VITE_EMAILJS_* values and VITE_HERO_EMAIL in .env - see .env.example.
   If unconfigured, this fails quietly and the app keeps working; the
   grievance is still saved to localStorage as a fallback. */
async function sendHelpRequestEmail(info){
  const serviceId=import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const templateId=import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
  const publicKey=import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
  const toEmail=import.meta.env.VITE_HERO_EMAIL;
  if(!serviceId||!templateId||!publicKey||!toEmail){
    console.warn('[VEXA] Email notification skipped: EmailJS is not configured. See .env.example.');
    return false;
  }
  const submittedAt=new Date().toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'});
  try{
    await emailjs.send(serviceId,templateId,{
      to_email:toEmail,
      visitor_name:info.name,
      visitor_age:info.age,
      visitor_location:info.location,
      visitor_email:info.email,
      grievance:info.grievance,
      submitted_at:submittedAt,
      subject:'Someone Needs Your Help!'
    },{publicKey});
    return true;
  }catch(err){
    console.error('[VEXA] Failed to send help-request email:',err);
    return false;
  }
}

const A={
  lightBg:'/assets/light-bg.png',
  darkBg:'/assets/dark-bg.png',
  lightChar:'/assets/light-character.png',
  darkChar:'/assets/dark-character.png',
  capeLight:'/video/cape-light-loop.mp4',
  capeDark:'/video/cape-dark-loop.mp4',
  toDark:'/video/transform-light-to-dark.mp4',
  toLight:'/video/transform-dark-to-light.mp4',
  palaceWideLight:'/assets/palace-wide-light.webp',
  palaceWideDark:'/assets/palace-wide-dark.webp',
  palaceGateLight:'/assets/palace-gate-light.webp',
  palaceGateDark:'/assets/palace-gate-dark.webp',
  sanctumLight:'/assets/sanctum-light.webp',
  sanctumDark:'/assets/sanctum-dark.webp',
  heroCutLight:'/assets/hero-cut-light.webp',
  heroCutDark:'/assets/hero-cut-dark.webp',
  bustLight:'/assets/bust-light.webp',
  bustDark:'/assets/bust-dark.webp'
};

/* ---------- VEXA's voice: real LLM chat via Gemini, with a persona that
   shifts with the theme - bold/powerful in light mode, grounded/
   comforting in dark mode. Streams tokens in as they arrive rather than
   waiting for a full response. Falls back gracefully (see `send()` in
   App) if no API key is configured, so the app still works out of the
   box without one. ----------
   Setup: create a `.env` file (see `.env.example`) with
     VITE_GEMINI_API_KEY=your_key_here
   NOTE ON SECURITY: Vite bakes VITE_ prefixed vars into the client bundle,
   so this key is visible to anyone who opens devtools once deployed. Fine
   for local development or a private/portfolio deploy; for a public site,
   proxy this same request through a tiny serverless function instead (e.g.
   a Vercel/Netlify function that holds the key server-side) and swap the
   fetch URL below to point at your own endpoint. */
const OPENROUTER_MODEL = 'nex-agi/nex-n2.5-pro:free';

async function askVexaStream(history, dark, onToken) {
  const key = import.meta.env.VITE_OPENROUTER_API_KEY;

  if (!key) {
    throw new Error('no-openrouter-api-key');
  }

  const persona = dark
    ? "You are VEXA, a powerful superhero guardian in her dark, comforting form. The user has come to you at a difficult moment. Be calm, grounded, warm and human. Validate their feelings before giving perspective. Never sound robotic, clinical, preachy or overly verbose. Keep replies to 2-4 sentences. If they mention immediate danger or self-harm, encourage them to contact someone they trust or emergency/crisis support."
    : "You are VEXA, a powerful superhero guardian in her radiant form. Speak with strength, conviction and energy. Reflect the user's strength back to them and push them toward action. Sound confident, heroic and human, never generic or cheesy. Keep replies to 2-4 sentences.";

  const messages = [
    {
      role: 'system',
      content: persona
    },
    ...history.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }))
  ];

  const res = await fetch(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'VEXA'
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages,
        stream: true,
        temperature: 0.85,
        max_tokens: 220
      })
    }
  );

  // IMPORTANT: read the error body before throwing
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');

    console.error(
      '[VEXA] OpenRouter HTTP ERROR:',
      res.status,
      errorText
    );

    throw new Error(`openrouter-http-${res.status}: ${errorText}`);
  }

  if (!res.body) {
    throw new Error('openrouter-no-stream-body');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  let buffer = '';
  let gotText = false;

  while (true) {
    const { value, done } = await reader.read();

    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');

    // Keep incomplete line for the next chunk
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) continue;

      // SSE comments
      if (trimmed.startsWith(':')) continue;

      if (!trimmed.startsWith('data:')) continue;

      const data = trimmed.slice(5).trim();

      if (!data || data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);

        // DEBUG — temporarily keep this
        console.log('[VEXA] Stream chunk:', parsed);

        const token =
          parsed?.choices?.[0]?.delta?.content;

        if (token) {
          gotText = true;
          onToken(token);
        }

      } catch (err) {
        console.warn(
          '[VEXA] Failed to parse stream chunk:',
          data
        );
      }
    }
  }

  // Sometimes the final incomplete SSE line is left in buffer
  if (buffer.trim().startsWith('data:')) {
    const data = buffer.trim().slice(5).trim();

    if (data && data !== '[DONE]') {
      try {
        const parsed = JSON.parse(data);

        const token =
          parsed?.choices?.[0]?.delta?.content;

        if (token) {
          gotText = true;
          onToken(token);
        }
      } catch (err) {
        console.warn(
          '[VEXA] Failed to parse final stream chunk:',
          data
        );
      }
    }
  }

  if (!gotText) {
    console.error(
      '[VEXA] Stream finished without text.'
    );

    throw new Error('empty-stream');
  }
}

/* ---------- realtime chroma-key video -> transparent canvas ----------
   Optimized to only do the (expensive) per-pixel keying work once per
   actual decoded video frame - via requestVideoFrameCallback where
   available, falling back to a currentTime-dedup on requestAnimationFrame -
   instead of redoing it 60x/sec regardless of the source's real frame rate.
   Processing also happens at a capped internal resolution to keep the
   per-frame pixel loop cheap on lower-powered devices. */
function ChromaVideo({src,className,rate=1,loop=true,onReady,onEnded,active=true}){
  const videoRef=useRef(null),canvasRef=useRef(null),rafRef=useRef(null),readyFired=useRef(false),lastT=useRef(-1);
  useEffect(()=>{
    readyFired.current=false;lastT.current=-1;
    const video=videoRef.current,canvas=canvasRef.current;
    if(!video||!canvas)return;
    const ctx=canvas.getContext('2d',{willReadFrequently:true,alpha:true});
    video.muted=true;video.playsInline=true;video.loop=loop;video.playbackRate=rate;
    // capped lower than before (was 360) - this is the expensive per-frame
    // pixel loop below, so halving the pixel count here roughly halves the
    // main-thread cost of every single keyed frame, on every ChromaVideo
    // instance running at once. 240px is still plenty sharp once scaled
    // back up by CSS for a figure that only occupies part of the frame.
    let w=180,h=320,scale=1;
    const size=()=>{
      const vw=video.videoWidth||360,vh=video.videoHeight||640;
      scale=vw>240?240/vw:1; // cap internal processing width at 240px
      w=Math.round(vw*scale);h=Math.round(vh*scale);
      canvas.width=w;canvas.height=h;
    };
    const key=()=>{
      ctx.drawImage(video,0,0,w,h);
      try{
        const frame=ctx.getImageData(0,0,w,h),d=frame.data;
        for(let i=0;i<d.length;i+=4){
          const r=d[i],g=d[i+1],b=d[i+2];
          const green=g-(r>b?r:b);
          if(green>55)d[i+3]=0;
          else if(green>12)d[i+3]=255-Math.round(255*(green-12)/43);
          if(g>(r+b)>>1)d[i+1]=((r+b)>>1)+((g-((r+b)>>1))>>2);
        }
        ctx.putImageData(frame,0,0);
      }catch(e){}
      if(!readyFired.current){readyFired.current=true;onReady&&onReady()}
    };
    // requestVideoFrameCallback path: fires exactly once per decoded frame
    let useRVFC=typeof video.requestVideoFrameCallback==='function';
    const vfcTick=()=>{
      if(video.readyState>=2)key();
      if(active)video.requestVideoFrameCallback(vfcTick);
    };
    // rAF fallback: skip re-keying if the video hasn't advanced
    const rafTick=()=>{
      if(video.readyState>=2&&video.currentTime!==lastT.current){lastT.current=video.currentTime;key()}
      rafRef.current=requestAnimationFrame(rafTick);
    };
    // only autoplay/reset when this instance is actually the one that should
    // be running - previously this fired regardless of `active`, so an
    // "inactive" ChromaVideo (e.g. the hero-loop hidden behind the
    // transformation overlay) kept decoding and restarting in the
    // background for no visible reason, competing for the same main
    // thread as the transition's own chroma-key loop.
    const onLoaded=()=>{
      size();
      if(active){video.currentTime=0;const p=video.play();if(p?.catch)p.catch(()=>{})}
    };
    video.addEventListener('loadedmetadata',onLoaded);
    if(video.readyState>=1)onLoaded();
    if(onEnded)video.addEventListener('ended',onEnded);
    if(active){
      if(useRVFC)video.requestVideoFrameCallback(vfcTick);
      else rafRef.current=requestAnimationFrame(rafTick);
    }else{
      video.pause();
    }
    return()=>{cancelAnimationFrame(rafRef.current);video.removeEventListener('loadedmetadata',onLoaded);if(onEnded)video.removeEventListener('ended',onEnded);video.pause()}
  },[src,rate,loop,active]);
  return <>
    <video ref={videoRef} src={active?src:undefined} style={{display:'none'}} preload={active?'auto':'none'} muted playsInline/>
    <canvas ref={canvasRef} className={className}/>
  </>;
}

/* ---------- scroll-reveal ---------- */
function useReveal(){
  useEffect(()=>{
    const els=document.querySelectorAll('.reveal');
    const io=new IntersectionObserver(entries=>{
      entries.forEach(en=>{if(en.isIntersecting){en.target.classList.add('in');io.unobserve(en.target)}})
    },{threshold:.18});
    els.forEach(el=>io.observe(el));
    return()=>io.disconnect();
  },[]);
}

/* ---------- swoosh zoom-in: each palace stage punches in with a fast
   scale+blur settle as it enters the viewport, retriggering each time you
   scroll past it (either direction) - this reads as a cut/zoom between
   distinct pages rather than a continuous scroll-tied drift. */
function useSwoosh(){
  useEffect(()=>{
    const els=document.querySelectorAll('.swoosh');
    const io=new IntersectionObserver(entries=>{
      entries.forEach(en=>en.target.classList.toggle('go',en.isIntersecting))
    },{threshold:.35});
    els.forEach(el=>io.observe(el));
    return()=>io.disconnect();
  },[]);
}

/* ---------- small standing character, centered in the scene ---------- */
function Standing({src}){
  return <div className="standing"><img src={src}/></div>;
}

/* ---------- cursor-reveal hover, scoped to a single portrait: the opposite
   theme's image is only visible in a soft circle following the cursor,
   confined to this element's own bounds. ---------- */
function HoverReveal({base,reveal,className}){
  const ref=useRef(null);
  const move=e=>{
    const el=ref.current;if(!el)return;
    const r=el.getBoundingClientRect();
    el.style.setProperty('--hx',((e.clientX-r.left)/r.width*100)+'%');
    el.style.setProperty('--hy',((e.clientY-r.top)/r.height*100)+'%');
    el.classList.add('hovering');
  };
  const leave=()=>ref.current?.classList.remove('hovering');
  return <div ref={ref} className={'hover-reveal '+(className||'')} onPointerMove={move} onPointerLeave={leave}>
   <img className="hr-base" src={base}/>
   <img className="hr-reveal" src={reveal}/>
  </div>;
}

/* ---------- drifting fog, for the sanctum hallway ---------- */
function Fog(){
  return <div className="fog">{Array.from({length:6},(_,i)=><span key={i} style={{'--i':i}}/>)}</div>;
}

/* ---------- cursor-follow glow ---------- */
function CursorGlow(){
  const ref=useRef(null);
  useEffect(()=>{
    const el=ref.current;if(!el)return;
    const move=e=>{el.style.setProperty('--gx',e.clientX+'px');el.style.setProperty('--gy',e.clientY+'px');el.classList.add('show')};
    const leave=()=>el.classList.remove('show');
    addEventListener('pointermove',move,{passive:true});
    addEventListener('pointerleave',leave);
    return()=>{removeEventListener('pointermove',move);removeEventListener('pointerleave',leave)}
  },[]);
  return <div ref={ref} className="cursor-glow"/>;
}

/* ---------- magnetic button interaction ---------- */
const magnetic=e=>{
  const el=e.currentTarget,r=el.getBoundingClientRect();
  el.style.setProperty('--mx',((e.clientX-r.left-r.width/2)*.28)+'px');
  el.style.setProperty('--my',((e.clientY-r.top-r.height/2)*.28)+'px');
};
const unmagnetic=e=>{e.currentTarget.style.setProperty('--mx','0px');e.currentTarget.style.setProperty('--my','0px')};

/* ---------- tilt interaction for power cards ---------- */
const tilt=e=>{
  const el=e.currentTarget,r=el.getBoundingClientRect();
  const px=(e.clientX-r.left)/r.width-.5,py=(e.clientY-r.top)/r.height-.5;
  el.style.setProperty('--rx',(-py*9)+'deg');
  el.style.setProperty('--ry',(px*13)+'deg');
  el.style.setProperty('--gx',(e.clientX-r.left)+'px');
  el.style.setProperty('--gy',(e.clientY-r.top)+'px');
};
const untilt=e=>{e.currentTarget.style.setProperty('--rx','0deg');e.currentTarget.style.setProperty('--ry','0deg')};

/* ---------- intro (book + sigil lock) ---------- */
function Video({src,onEnded,playKey}){
  const ref=useRef(null); const [needsPlay,setNeedsPlay]=useState(false);
  useEffect(()=>{const v=ref.current;if(!v)return; v.muted=true;v.playsInline=true;v.currentTime=0;setNeedsPlay(false); const p=v.play(); if(p?.catch)p.catch(()=>setNeedsPlay(true)); return()=>v.pause()},[src,playKey]);
  return <><video ref={ref} src={src} autoPlay muted playsInline preload="auto" onEnded={onEnded} onError={()=>setNeedsPlay(true)}/>{needsPlay&&<button className="begin" onClick={()=>{ref.current?.play().then(()=>setNeedsPlay(false)).catch(()=>{})}}>▶ Begin cinematic</button>}</>;
}
function Intro({onReveal,onComplete}){
  const SEAL_KEY='vexa-grimoire-seal-v1';
  const [saved]=useState(()=>{try{const arr=JSON.parse(localStorage.getItem(SEAL_KEY));return Array.isArray(arr)&&arr.length>=3?arr:null}catch{return null}});
  const mode=saved?'verify':'setup';
  const [stage,setStage]=useState('intro'),[locked,setLocked]=useState(false),[feedback,setFeedback]=useState(null),
    [path,setPath]=useState([]),[bad,setBad]=useState(false),[playKey]=useState(0),[leaving,setLeaving]=useState(false);
  // the handoff to the hero used to be an instant unmount the moment the
  // correct-password clip ended - since the hero page was already sitting
  // fully rendered underneath the whole time, that read as a hard "pop"
  // (and if the Cinzel webfont hadn't finished swapping in yet, the title
  // would visibly change font right as it appeared). Now: tell the parent
  // to start warming up the hero's live systems immediately, wait for
  // fonts to actually be ready (capped, so a slow network can't hang the
  // handoff forever), then crossfade this whole layer out - so the page
  // fades up already in its final font instead of snapping into place.
  const finish=()=>{
    onReveal&&onReveal();
    const ready=document.fonts?.ready?Promise.resolve(document.fonts.ready):Promise.resolve();
    Promise.race([ready,new Promise(r=>setTimeout(r,900))]).finally(()=>{
      setLeaving(true);
      setTimeout(()=>onComplete&&onComplete(),650);
    });
  };
  const nodes=Array.from({length:9},(_,i)=>({x:52+(i%3)*92,y:52+Math.floor(i/3)*92}));
  const point=e=>{const r=e.currentTarget.getBoundingClientRect();return{x:(e.clientX-r.left)*300/r.width,y:(e.clientY-r.top)*300/r.height}};
  const hit=p=>nodes.findIndex(n=>Math.hypot(n.x-p.x,n.y-p.y)<27);
  const down=e=>{e.currentTarget.setPointerCapture?.(e.pointerId);const i=hit(point(e));if(i>=0){setBad(false);setPath([i])}};
  const move=e=>{if(!e.currentTarget.hasPointerCapture?.(e.pointerId))return;const i=hit(point(e));if(i>=0)setPath(p=>p.includes(i)?p:[...p,i])};
  const up=e=>{
    if(!path.length)return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if(mode==='setup'){
      if(path.length<3){setBad(true);setPath([]);return}
      try{localStorage.setItem(SEAL_KEY,JSON.stringify(path))}catch{}
      setFeedback('correct');
    }else{
      const ok=path.length===saved.length&&path.every((n,i)=>n===saved[i]);
      if(ok)setFeedback('correct');else setFeedback('wrong');
    }
  };
  const resetSeal=()=>{try{localStorage.removeItem(SEAL_KEY)}catch{};location.reload()};
  return <div className={'intro-layer '+(leaving?'leaving':'')}>
    {stage==='intro'&&<div className="cinema"><Video src="/video/intro.mp4" playKey={playKey} onEnded={()=>setStage('book')}/><div className="cinema-vignette"/><div className="cinema-ui"><span>VEXA / PROLOGUE</span><span>01 — AWAKENING</span></div><button className="skip" onClick={()=>setStage('book')}>SKIP CINEMATIC ↗</button></div>}
    {stage==='book'&&<div className="cinema book-stage">
      <Video src="/video/bookslam.mp4" playKey={playKey} onEnded={()=>setLocked(true)}/>
      <div className="cinema-vignette"/>
      {!locked&&<><div className="cinema-ui"><span>THE GRIMOIRE</span><span>02 — SEALED</span></div><button className="skip" onClick={()=>setLocked(true)}>SKIP TO SEAL ↗</button></>}
      {locked&&<div className="sigil-overlay"><div className="lock-card">
        <div className="lock-top"><span>VEXA'S GRIMOIRE</span><i>{mode==='setup'?'UNSEALED':'SEALED'}</i></div>
        <h2>{mode==='setup'?'Draw your own sigil.':'Trace the ancient sigil.'}</h2>
        <p>{bad?(mode==='setup'?'Too short a mark — trace at least three points.':'The seal rejected your mark. The book remains closed.'):(mode==='setup'?'Draw it straight onto the page. This mark will bind itself to the book from now on.':'Follow the old path. Do not lift your finger.')}</p>
        <div className={'sigil '+(bad?'bad':'')} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>{<svg viewBox="0 0 300 300">{path.slice(1).map((idx,i)=>{const a=nodes[path[i]],b=nodes[idx];return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}/>})}{nodes.map((n,i)=><circle key={i} cx={n.x} cy={n.y} r={path.includes(i)?10:6} className={path.includes(i)?'on':''}/>)}</svg>}</div>
        {mode==='verify'&&bad&&<button className="retry" onClick={resetSeal}>Forgot the mark? Reset the seal</button>}
        <small>THE LIGHT NEVER LEAVES.</small>
      </div></div>}
    </div>}
    {feedback==='wrong'&&<div className="cinema result overlay"><Video src="/video/wrong_pass.mp4" playKey={playKey} onEnded={()=>{setFeedback(null);setBad(true);setPath([])}}/></div>}
    {feedback==='correct'&&<div className="cinema result overlay"><Video src="/video/correct_password.mp4" playKey={playKey} onEnded={finish}/><div className="handoff">THE STORY CONTINUES</div></div>}
  </div>
}

function Particles({dark}){return <div className="particles">{Array.from({length:44},(_,i)=><i key={i} style={{'--i':i,'--x':`${(i*47)%100}%`,'--y':`${(i*71)%100}%`,'--d':`${4+(i%8)}s`,'--delay':`${-(i%9)}s`}} className={dark?'p darkp':'p'}/>)}</div>}

/* ---------- cinematic world-flip transition ----------
   Only ever mounted while the hero (page 1) is in view - see toggleWorld().
   .flip-anchor reuses the exact same box (left/width/height/bottom) as the
   real .character-layer so the transforming figure sits pixel-for-pixel
   over the real one - same character, same spot, just mid-transformation. */
function WorldFlip({state,onDone}){
  if(!state)return null;
  const toDark=state==='toDark';
  return <div className={'world-flip '+(toDark?'to-dark':'to-light')}>
    <div className="flip-flash"/>
    <div className="flip-rings"/>
    <div className="flip-anchor">
      <ChromaVideo key={state} src={toDark?A.toDark:A.toLight} className="flip-char" rate={2.6} loop={false} onEnded={onDone}/>
    </div>
  </div>
}

/* ---------- rotate gate ----------
   The brief calls for a polished, cinematic, "feel like a real character"
   experience - the whole layout (wide hero stage, side-by-side chat panel,
   palace panoramas) is built for a landscape frame, so on phones/tablets
   held upright we now show a full-screen "rotate your device" gate instead
   of letting people scroll through a squeezed portrait version of a scene
   that was never designed for it. Landscape phones and all desktop/laptop
   browsers are unaffected - this only engages for touch devices that are
   currently taller than they are wide. */
function useRotateGate(){
  const [blocked,setBlocked]=useState(false);
  useEffect(()=>{
    const isTouch=('ontouchstart' in window)||navigator.maxTouchPoints>0||matchMedia('(pointer:coarse)').matches;
    if(!isTouch)return;
    const check=()=>setBlocked(innerHeight>innerWidth);
    check();
    addEventListener('resize',check);
    addEventListener('orientationchange',check);
    return()=>{removeEventListener('resize',check);removeEventListener('orientationchange',check)};
  },[]);
  return blocked;
}
function RotateGate(){
  return <div className="rotate-gate" role="alertdialog" aria-live="assertive">
   <div className="rotate-card">
    <div className="rotate-icon"><span/></div>
    <h2>Turn your device</h2>
    <p>VEXA's world is built for a wide, cinematic view. Rotate your phone to landscape to enter the site.</p>
   </div>
  </div>
}

function App(){
 const rotateBlocked=useRotateGate();
 const [intro,setIntro]=useState(true),[revealing,setRevealing]=useState(false),
  [dark,setDark]=useState(()=>{try{return localStorage.getItem('vexa-theme')==='dark'}catch{return false}}),
  [chat,setChat]=useState(false),[chatText,setChatText]=useState(''),
  [messages,setMessages]=useState(()=>{
   try{const raw=JSON.parse(localStorage.getItem('vexa-chat-history'));if(Array.isArray(raw)&&raw.length)return raw}catch{}
   return[{from:'vexa',text:'Hey! I\'m VEXA. I help people who need someone to listen. What\'s your name?'}];
  }),
  [mouse,setMouse]=useState({x:0,y:0}),[scroll,setScroll]=useState(0),[typing,setTyping]=useState(false),
  [transState,setTransState]=useState(null),[charReady,setCharReady]=useState(false),
  /* ---------- intake state ----------
     Walks every visitor through name -> age -> location -> email before
     the free-form supportive chat opens up, per the brief. Persisted so a
     refresh doesn't lose progress mid-conversation. */
  [intakeStage,setIntakeStage]=useState(()=>{try{return localStorage.getItem('vexa-intake-stage')||'name'}catch{return 'name'}}),
  [visitor,setVisitor]=useState(()=>{try{return JSON.parse(localStorage.getItem('vexa-visitor'))||{}}catch{return {}}}),
  [emailSent,setEmailSent]=useState(false);
 const stageRef=useRef(null);
 useReveal();
 useSwoosh();
 useEffect(()=>{const m=e=>setMouse({x:(e.clientX/innerWidth-.5),y:(e.clientY/innerHeight-.5)});const s=()=>setScroll(scrollY);addEventListener('pointermove',m,{passive:true});addEventListener('scroll',s,{passive:true});return()=>{removeEventListener('pointermove',m);removeEventListener('scroll',s)}},[]);
 useEffect(()=>{setCharReady(false)},[dark]);
 useEffect(()=>{try{localStorage.setItem('vexa-chat-history',JSON.stringify(messages.slice(-40)))}catch{}},[messages]);
 useEffect(()=>{try{localStorage.setItem('vexa-intake-stage',intakeStage)}catch{}},[intakeStage]);
 useEffect(()=>{try{localStorage.setItem('vexa-visitor',JSON.stringify(visitor))}catch{}},[visitor]);

 const toggleWorld=(force)=>{
  if(transState)return;
  const next=typeof force==='boolean'?force:!dark;
  if(next===dark)return;
  // the cinematic transformation only ever plays over the hero (page 1) -
  // where the real character it's overlapping actually lives. Anywhere
  // else on the page it's just an instant, quiet theme swap.
  const onPageOne=scrollY<innerHeight*0.6;
  if(!onPageOne){setDark(next);try{localStorage.setItem('vexa-theme',next?'dark':'light')}catch{}return}
  setTransState(next?'toDark':'toLight');
  // The whole-page morph (bg crossfade + --bg/--fg colour fade, both ~1.1-1.2s)
  // used to only start once the transformation clip's "ended" event fired -
  // i.e. after the full ~2.3s cinematic had already finished playing. That
  // left the rest of the page visibly lagging a beat behind the character.
  // Firing it here instead, timed to land under the flip-flash's brightest
  // moment (flipFlash peaks at 55% of its 2.4s run, ~1.3s in), means the
  // morph plays *during* the transformation - both wrapped up together,
  // with the flash masking the handoff instead of a bare pop afterwards.
  setTimeout(()=>{
   setDark(next);
   try{localStorage.setItem('vexa-theme',next?'dark':'light')}catch{}
  },900);
 };
 // the flip overlay (flash/rings/transforming character) itself still
 // waits for the clip's real "ended" event before unmounting, so it never
 // gets cut off mid-animation regardless of device/decoder speed.
 const onFlipDone=()=>{
  setTimeout(()=>setTransState(null),400);
 };

 /* ---------- intake step handling ----------
    name -> age -> location -> email -> grievance -> done. Each reply is
    validated and echoed with a short in-character line before the next
    question, so it reads as a conversation rather than a form. Once the
    grievance is captured, the help-request email fires automatically and
    every message after that goes to the free-form supportive LLM chat. */
 const vexaSay=text=>setMessages(m=>[...m,{from:'vexa',text}]);
 const runIntake=async t=>{
  if(intakeStage==='name'){
   const name=t.replace(/^i'?m\s+|^my name is\s+/i,'').trim();
   setVisitor(v=>({...v,name}));
   setIntakeStage('age');
   setTimeout(()=>vexaSay(`Good to meet you, ${name}. Mind if I ask — how old are you?`),350);
   return;
  }
  if(intakeStage==='age'){
   const digits=t.match(/\d{1,3}/);
   if(!digits){setTimeout(()=>vexaSay('Just a number is fine — how old are you?'),300);return}
   setVisitor(v=>({...v,age:digits[0]}));
   setIntakeStage('location');
   setTimeout(()=>vexaSay('Thank you. And where are you writing to me from — your city or town?'),350);
   return;
  }
  if(intakeStage==='location'){
   setVisitor(v=>({...v,location:t}));
   setIntakeStage('email');
   setTimeout(()=>vexaSay('Got it. Last thing — what\'s an email address where I can make sure your message actually reaches me?'),350);
   return;
  }
  if(intakeStage==='email'){
   const email=t.trim();
   if(!/^\S+@\S+\.\S+$/.test(email)){setTimeout(()=>vexaSay('That doesn\'t quite look like an email — could you type it again?'),300);return}
   setVisitor(v=>({...v,email}));
   setIntakeStage('grievance');
   setTimeout(()=>vexaSay('So... tell me. How can I help you?'),350);
   return;
  }
  if(intakeStage==='grievance'){
   const grievance=t;
   setVisitor(v=>{
    const full={...v,grievance};
    sendHelpRequestEmail(full).then(setEmailSent);
    return full;
   });
   setIntakeStage('done');
   setTimeout(()=>vexaSay('I hear you. That took something to say, and I\'m glad you did. I\'m right here with you — tell me more, whenever you\'re ready.'),400);
   return;
  }
 };
 const send=async()=>{
  const t=chatText.trim();if(!t)return;
  const withUser=[...messages,{from:'user',text:t}];
  setMessages(withUser);setChatText('');
  if(intakeStage!=='done'){await runIntake(t);return}
  const difficult=/sad|alone|lost|stress|stressed|hurt|pain|problem|difficult|worried|anxious|scared|fail|failure|depressed|cry|struggle/i.test(t);
  const happy=/happy|great|excited|amazing|awesome|proud|excellent|wonderful|joy|joyful|thrilled|glad|grateful|celebrat|accomplish|success|good news/i.test(t);
  // sad/concerning -> dark (comforting); happy/good news -> light (powerful).
  // difficult wins if a message somehow trips both.
  if(difficult)setTimeout(()=>toggleWorld(true),180);
  else if(happy)setTimeout(()=>toggleWorld(false),180);
  setTyping(true);
  const apiHistory=withUser.slice(-10).map(m=>({role:m.from==='user'?'user':'assistant',content:m.text}));
  let streamed='';
  setMessages(m=>[...m,{from:'vexa',text:''}]);
  try{
   await askVexaStream(apiHistory,dark,token=>{
    if(!streamed)setTyping(false);
    streamed+=token;
    setMessages(m=>{const c=[...m];c[c.length-1]={from:'vexa',text:streamed};return c});
   });
   if(!streamed)throw new Error('empty-stream');
  }catch(err){
   console.error('[VEXA] Gemini chat call failed:',err);
   setTyping(false);
   const fallback=difficult
    ?'Stay with me. You can tell me what is weighing on you, one piece at a time.'
    :(happy?'That\'s the energy. Keep going — tell me more, I want to hear it.':'I\'m listening. Tell me what is on your mind.');
   setMessages(m=>{const c=[...m];c[c.length-1]={from:'vexa',text:fallback};return c});
  }
 };
 const clearChat=()=>{
  const fresh=[{from:'vexa',text:'Hey! I\'m VEXA. I help people who need someone to listen. What\'s your name?'}];
  setMessages(fresh);setIntakeStage('name');setVisitor({});setEmailSent(false);
  try{localStorage.setItem('vexa-chat-history',JSON.stringify(fresh));localStorage.setItem('vexa-intake-stage','name');localStorage.setItem('vexa-visitor','{}')}catch{}
 };
 const jump=id=>document.getElementById(id)?.scrollIntoView({behavior:'smooth'});
 // parallax is suspended (snapped to neutral) for the duration of the
 // world-flip transition - .world's own transform-transition (.25s) and
 // character-layer's (1s) then ease it back to dead-centre *before* the
 // flip overlay takes over, so the real character settles into exactly
 // the same resting spot the overlay is anchored to instead of visibly
 // jumping there the instant the overlay appears/disappears.
 const mx=transState?0:mouse.x*28,my=transState?0:mouse.y*20;
 const maxScroll=typeof document!=='undefined'?document.documentElement.scrollHeight-innerHeight:0;
 const progress=maxScroll>0?Math.min(1,scroll/maxScroll):0;

 // "revealing" flips true a beat before the intro layer actually unmounts
 // (see Intro.finish) - it lets the hero's live systems start warming up
 // underneath the still-fading-out intro, instead of everything popping
 // in together the instant the intro disappears.
 const heroLive=revealing||!intro;
 return <div className={'app '+(dark?'dark':'light')} style={{'--mx':`${mx}px`,'--my':`${my}px`,'--scroll':scroll}}>
  {rotateBlocked&&<RotateGate/>}
  {intro&&<Intro onReveal={()=>setRevealing(true)} onComplete={()=>setIntro(false)}/>}
  {heroLive&&<>
   <WorldFlip state={transState} onDone={onFlipDone}/>
   <CursorGlow/>
   <Particles dark={dark}/><div className="aurora"/><div className="grain"/>
  </>}
  <header className="nav">
   <button className="brand" onClick={()=>jump('home')}><span className="mark">V</span>VEXA</button>
   <nav><button onClick={()=>jump('palace')}>Palace</button><button onClick={()=>jump('threshold')}>Threshold</button><button onClick={()=>jump('powers')}>Powers</button><button onClick={()=>jump('process')}>How It Works</button><button onClick={()=>jump('sanctum')}>Sanctum</button><button onClick={()=>jump('reports')}>Stories</button><button onClick={()=>jump('mission')}>Mission</button></nav>
   <button className="theme magnetic" onMouseMove={magnetic} onMouseLeave={unmagnetic} onClick={()=>toggleWorld()}><span>{dark?'◐':'☼'}</span>{dark?'DARK':'LIGHT'}</button>
   <div className="scroll-progress" style={{transform:`scaleX(${progress})`}}/>
  </header>
  <main>
   <section id="home" className={'hero '+(chat?'chat-open':'')} ref={stageRef}>
    <div className="hero-copy">
     <div className="kicker"><span/>01 / THE GUARDIAN</div>
     <h1>Not just a hero.<br/><em>A presence.</em></h1>
     <p>I'm VEXA — a guardian of hope, a listener, and a guide. When your world changes, I meet you where you are. No account, no waiting room, no script — just a conversation that starts the second you say hello, and stays open for as long as you need it.</p>
     <div className="actions">
      <button className="magnetic" onMouseMove={magnetic} onMouseLeave={unmagnetic} onClick={()=>setChat(true)}>Talk to VEXA <b>↗</b></button>
      <button className="quiet magnetic" onMouseMove={magnetic} onMouseLeave={unmagnetic} onClick={()=>jump('palace')}>Explore the story ↓</button>
     </div>
    </div>
    <div className="world" style={{transform:`translate3d(${mx}px,${my}px,0) rotateY(${transState?0:mouse.x*2}deg) rotateX(${transState?0:-mouse.y*1.5}deg)`}}>
     {/* crossfaded rather than swapped - both sit stacked and only trade
         opacity, so the backdrop actually morphs between light/dark in
         lockstep with the theme change instead of popping the instant
         the `dark` flag flips */}
     <div className="bg-layer far">
      <img className="bg-img bg-light" style={{opacity:dark?0:1}} src={A.lightBg}/>
      <img className="bg-img bg-dark" style={{opacity:dark?1:0}} src={A.darkBg}/>
     </div>
     <div className="mist mid"/><div className="rings mid"/><div className="beam front"/>
     <div className={'character-layer near '+(transState?'flipping':'')}>
      <img className={'character-poster '+(charReady?'hide':'')} src={dark?A.darkChar:A.lightChar}/>
      <ChromaVideo key={dark?'dark':'light'} src={dark?A.capeDark:A.capeLight} className="character" active={heroLive&&!transState} onReady={()=>setCharReady(true)}/>
      <div className="cape-sheen"/><div className="sigil-glow">V</div>
     </div>
     <div className="wind-lines front"/>
    </div>
    <div className="hero-meta"><span>SCROLL TO EXPLORE</span><i/><b>01</b><b>02</b><b>03</b><b>04</b><b>05</b><b>06</b><b>07</b><b>08</b></div>
    {chat&&<aside className="chat-panel">
     <div className="chat-top"><div><span className={'orb '+(typing?'thinking':'')}>V</span><div><b>VEXA</b><small>present · listening</small></div></div><div className="chat-top-actions"><button className="clear" title="Clear conversation" onClick={clearChat}>↺</button><button onClick={()=>setChat(false)}>×</button></div></div>
     <div className="chat-body">
      {messages.map((m,i)=><div key={i} className={'bubble '+m.from}>{m.text}</div>)}
      {typing&&<div className="bubble vexa typing"><span/><span/><span/></div>}
     </div>
     <div className="chat-input"><input value={chatText} onChange={e=>setChatText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Tell VEXA what's on your mind…"/><button onClick={send}>↑</button></div>
     <small className="chat-foot">{emailSent?'✓ VEXA has been notified of your message.':'Your world can change. VEXA stays.'}</small>
    </aside>}
   </section>

   <section id="palace" className="section palace">
    <span className="num">02</span>
    <img className="palace-bg far swoosh" src={dark?A.palaceWideDark:A.palaceWideLight}/>
    <div className="palace-veil"/>
    <div className="reveal palace-copy"><div className="kicker"><span/>THE ASCENT</div><h2>Somewhere above the storm.</h2><p>Beyond every low point, VEXA's palace waits above the clouds — a place built from every quiet victory. As you climb toward it, the world starts to feel a little more possible.</p></div>
    <HoverReveal className="bust-side" base={dark?A.bustDark:A.bustLight} reveal={dark?A.bustLight:A.bustDark}/>
   </section>

   <section id="threshold" className="section threshold">
    <span className="num">03</span>
    <img className="palace-bg near swoosh" src={dark?A.palaceGateDark:A.palaceGateLight}/>
    <div className="palace-veil"/>
    <div className="reveal palace-copy"><div className="kicker"><span/>THE THRESHOLD</div><h2>Every guardian was once someone standing at a door.</h2><p>The doors are open. Someone is waiting just inside.</p></div>
    <Standing src={dark?A.heroCutDark:A.heroCutLight}/>
   </section>

   <section id="powers" className="section power">
    <span className="num">04</span>
    <div className="reveal palace-copy"><div className="kicker"><span/>POWERS &amp; ABILITIES</div><h2>What I carry with me.</h2><p>None of this is about strength for its own sake. Every ability VEXA has exists for one purpose — noticing you, and staying.</p></div>
    <span className="ghost">V</span>
    <div className="power-grid reveal" style={{gridColumn:'1 / -1'}}>
     {POWERS.map(p=><article key={p.tag} onMouseMove={tilt} onMouseLeave={untilt}><span>{p.tag}</span><h3>{p.name}</h3><p>{p.desc}</p></article>)}
    </div>
   </section>

   <section id="process" className="section power">
    <span className="num">05</span>
    <div className="reveal palace-copy"><div className="kicker"><span/>HOW IT WORKS</div><h2>What happens when you say hello.</h2><p>No forms disguised as conversation, and nothing hidden about what happens with what you share. Here's the whole shape of a visit, start to finish.</p></div>
    <span className="ghost">?</span>
    <div className="power-grid reveal" style={{gridColumn:'1 / -1'}}>
     {PROCESS.map(p=><article key={p.tag} onMouseMove={tilt} onMouseLeave={untilt}><span>{p.tag}</span><h3>{p.name}</h3><p>{p.desc}</p></article>)}
    </div>
   </section>

   <section id="sanctum" className="section sanctum">
    <span className="num">06</span>
    <img className="palace-bg near swoosh" src={dark?A.sanctumDark:A.sanctumLight}/>
    <div className="palace-veil"/>
    <Fog/>
    <div className="reveal palace-copy"><div className="kicker"><span/>THE SANCTUM</div><h2>This is where you're heard.</h2><p>Inside, the noise quiets down. Whatever you're carrying, there's room here to set it down for a moment. There's no clock running, no queue behind you — just space, for as long as you need it.</p></div>
    <Standing src={dark?A.heroCutDark:A.heroCutLight}/>
   </section>

   <section id="reports" className="section power reports">
    <span className="num">07</span>
    <div className="reveal palace-copy"><div className="kicker"><span/>FIELD REPORTS</div><h2>What people bring here.</h2><p>Composite accounts, shared in spirit rather than exact word — the details change, but the feeling underneath usually doesn't.</p></div>
    <span className="ghost">"</span>
    <div className="power-grid reveal" style={{gridColumn:'1 / -1'}}>
     {REPORTS.map(r=><article key={r.name} onMouseMove={tilt} onMouseLeave={untilt}><span>{r.name}</span><p style={{marginTop:14,fontStyle:'italic'}}>&ldquo;{r.text}&rdquo;</p></article>)}
    </div>
   </section>

   <section id="mission" className="mission">
    <span className="num mission-num">08</span>
    <div className="reveal">
     <div className="kicker"><span/>MY MISSION</div><h2>You don't have to face it alone.</h2>
     <p>Whatever brought you here — a hard week, a hard year, or just a question you haven't said out loud yet — this is a safe place to start. Reach out. I'm here, and I stay.</p>
     <button className="magnetic" onMouseMove={magnetic} onMouseLeave={unmagnetic} onClick={()=>{setChat(true);jump('home')}}>Talk to VEXA ↗</button>
     <small className="mission-note">Every conversation is private between you and VEXA. Nothing is shared beyond what's needed to actually help you.</small>
    </div>
   </section>
  </main>
  <footer>
   <div className="foot-col"><span>VEXA</span><small>BECAUSE EVERY STORY MATTERS.</small></div>
   <div className="foot-col foot-links"><small>A guardian character created for the TechAscent machine test.</small><small>Available day or night — VEXA doesn't keep office hours.</small></div>
   <button className="magnetic" onMouseMove={magnetic} onMouseLeave={unmagnetic} onClick={()=>toggleWorld()}>CHANGE WORLD</button>
  </footer>
 </div>
}
createRoot(document.getElementById('root')).render(<App/>);
