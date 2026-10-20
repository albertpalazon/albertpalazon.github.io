(() => {
  const language = document.querySelector('#language');
  let lang = 'es';
  try { lang = localStorage.getItem('ap-language') === 'en' ? 'en' : 'es'; } catch {}
  const originals = new Map();
  document.querySelectorAll('[data-en]').forEach(el => originals.set(el, el.innerHTML));
  const topics = {
    osint:{num:'01',es:['OSINT & fuentes de inteligencia','Fuentes abiertas y plataformas de inteligencia para investigar infraestructura, enriquecer indicadores y contrastar hipótesis.','FQDN · IP · ASN · URL','DNS · TLS · contexto','Relaciones de infraestructura','Pivotar por dominio e IP y contrastar las relaciones con varias fuentes.'],en:['OSINT & intelligence sources','Open sources and intelligence platforms for infrastructure research, indicator enrichment and hypothesis validation.','FQDN · IP · ASN · URL','DNS · TLS · context','Infrastructure relationships','Pivot on domains and IPs and compare relationships across multiple sources.']},
    analysis:{num:'02',es:['Análisis de amenazas','Seguimiento de actores y campañas. Análisis técnico de vulnerabilidades, requisitos de explotación y posible exposición de activos.','Campañas · IOC · CVE','Fuente · fecha · confianza','Contexto de amenaza','Separar hechos observados, atribuciones de terceros e hipótesis pendientes de validar.'],en:['Threat analysis','Following actors and campaigns. Technical vulnerability analysis, exploitation prerequisites and potential asset exposure.','Campaigns · IOC · CVE','Source · date · confidence','Threat context','Separate observed facts, third-party attribution and hypotheses requiring validation.']},
    detection:{num:'03',es:['Validación en SIEM y endpoints','Consultas y revisión de eventos, procesos e indicadores con telemetría SIEM y Microsoft Defender, CrowdStrike y Cortex XDR.','Logs · procesos · eventos','SPL · Elastic KQL · EDR','Hallazgos y limitaciones','Comprobar coincidencias, resultado de autenticación, ventana temporal y contexto del activo.'],en:['SIEM and endpoint validation','Queries and review of events, processes and indicators with SIEM telemetry and Microsoft Defender, CrowdStrike and Cortex XDR.','Logs · processes · events','SPL · Elastic KQL · EDR','Findings and limitations','Check matches, authentication outcome, time windows and asset context.']},
    report:{num:'04',es:['Informes y seguimiento','Documentación de evidencias, alcance, impacto potencial y acciones de seguimiento.','Evidencias · cronología','Contraste · revisión','Informe técnico','Explicar qué se observa, qué implica, qué no se ha confirmado y qué se recomienda revisar.'],en:['Reporting and follow-up','Documenting evidence, scope, potential impact and follow-up actions.','Evidence · chronology','Cross-check · review','Technical report','Explain what is observed, its implications, remaining uncertainty and recommended checks.']}
  };
  let currentTopic = 'osint';
  function renderTopic(){
    if(!document.querySelector('#topic-title')) return;
    const t=topics[currentTopic];
    document.querySelector('#topic-title').textContent=t[lang][0];
    document.querySelector('#topic-copy').textContent=t[lang][1];
    document.querySelector('#topic-num').textContent=t.num;
    ['input','checks','output','method'].forEach((field,i)=>{const el=document.querySelector('#topic-'+field);if(el)el.textContent=t[lang][i+2];});
    document.querySelectorAll('[data-topic]').forEach(b => {const selected=b.dataset.topic===currentTopic;b.classList.toggle('selected', selected);b.setAttribute('aria-pressed',String(selected));});
  }
  function setLanguage(){
    document.documentElement.lang=lang;
    originals.forEach((original,el)=>el.innerHTML=lang==='en'?el.dataset.en:original);
    if(language){language.textContent=lang==='en'?'ES':'EN';language.setAttribute('aria-label',lang==='en'?'Cambiar a español':'Switch to English');}
    const menu=document.querySelector('#menu');
    if(menu)menu.setAttribute('aria-label',lang==='en'?'Toggle menu':'Abrir menú');
    renderTopic();
    window.dispatchEvent(new CustomEvent('languagechange',{detail:lang}));
  }
  language?.addEventListener('click',()=>{lang=lang==='en'?'es':'en';try{localStorage.setItem('ap-language',lang);}catch{}setLanguage();});
  document.querySelectorAll('[data-topic]').forEach(b=>b.addEventListener('click',()=>{currentTopic=b.dataset.topic;renderTopic();}));
  const pause=document.querySelector('#tools-pause'),tools=document.querySelector('.tools-section');
  let paused=false;
  function renderPause(){if(pause){pause.textContent=paused?(lang==='en'?'Play ▶':'Reanudar ▶'):(lang==='en'?'Pause ⏸':'Pausar ⏸');pause.setAttribute('aria-pressed',String(paused));}}
  pause?.addEventListener('click',()=>{paused=!paused;tools.classList.toggle('paused',paused);renderPause();});
  window.addEventListener('languagechange',renderPause);
  const menu=document.querySelector('#menu'),nav=document.querySelector('.header nav');
  menu?.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));menu.textContent=open?'×':'☰';});
  nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');if(menu){menu.setAttribute('aria-expanded','false');menu.textContent='☰';}}));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav?.classList.contains('open')){nav.classList.remove('open');menu?.setAttribute('aria-expanded','false');if(menu)menu.textContent='☰';menu?.focus();}});
  if(document.querySelector('#year')) document.querySelector('#year').textContent=new Date().getFullYear();
  const contactForm=document.querySelector('#contact-form');
  contactForm?.addEventListener('submit',event=>{
    event.preventDefault();
    if(!contactForm.reportValidity())return;
    const fields=new FormData(contactForm);
    const name=String(fields.get('name')||'').trim();
    const email=String(fields.get('email')||'').trim();
    const subject=String(fields.get('subject')||'').replace(/[\r\n]/g,' ').trim();
    const message=String(fields.get('message')||'').trim();
    const body=message+'\n\n'+(lang==='en'?'From: ':'De: ')+name+'\nEmail: '+email;
    window.location.href='mailto:albertpalazon97@gmail.com?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
    document.querySelector('#contact-status').textContent=lang==='en'?'Your email app handles the next step. If it did not open, use the Email card or LinkedIn.':'El siguiente paso se completa en tu aplicación de correo. Si no se ha abierto, usa la tarjeta de correo o LinkedIn.';
  });
  const ambient=document.querySelector('.ambient-background');
  const backgroundMotion=document.querySelector('#background-motion');
  let backgroundPaused=false;
  function renderBackgroundMotion(){
    if(!backgroundMotion)return;
    backgroundMotion.textContent=backgroundPaused?(lang==='en'?'Play background':'Reanudar fondo'):(lang==='en'?'Pause background':'Pausar fondo');
    backgroundMotion.setAttribute('aria-pressed',String(backgroundPaused));
  }
  backgroundMotion?.addEventListener('click',()=>{
    backgroundPaused=!backgroundPaused;
    ambient?.classList.toggle('paused',backgroundPaused);
    renderBackgroundMotion();
  });
  window.addEventListener('languagechange',renderBackgroundMotion);
  setLanguage();
})();
