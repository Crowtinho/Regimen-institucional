'use strict';
import { QUESTION_BANK } from "./questionBank.js";
import { DEFAULT_LAW_CATALOG } from "./lawCatalog.js";
/* =====================================================================

/* 3. DATOS Y PERSISTENCIA · versión del almacenamiento independiente del banco. */
const STORAGE_KEY = 'reto-2196-custom-v1';
const $ = (id) => document.getElementById(id);
const BASE_QUESTIONS = $('QUESTION_BANK') ? JSON.parse($('QUESTION_BANK').textContent) : QUESTION_BANK;
const LAW_CATALOG = $('LAW_CATALOG') ? JSON.parse($('LAW_CATALOG').textContent) : DEFAULT_LAW_CATALOG;
// Compatibilidad: las preguntas antiguas sin law pertenecen a Ley 2196.
function questionLaw(q){
  return q.law || 'Ley 2196';
} function topicKey(law,topic){
  return JSON.stringify([law,topic]);
} function questionKey(q){
  return topicKey(questionLaw(q),q.topic);
} function validQuestion(q) {
  return q && (q.law === undefined || (typeof q.law === 'string' && q.law.trim().length > 0 && q.law.length <= 100)) && ['id','topic','question','reference','explanation','hint'].every(k => typeof q[k] === 'string' && q[k].trim().length > 0 && q[k].length <= 5000)     && Array.isArray(q.options) && q.options.length === 4 && q.options.every(o => typeof o === 'string' && o.trim() && o.length <= 1000)     && new Set(q.options.map(o=>o.trim().toLowerCase())).size === 4 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4;
} function loadCustom() {
  try {
    const data=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');
    return Array.isArray(data)?data.filter(validQuestion):[];
  } catch {
    return [];
  }
} let customQuestions=loadCustom();
function getBank() {
  const map=new Map(BASE_QUESTIONS.map(q=>[q.id,q]));
  customQuestions.forEach(q=>{
    if(!map.has(q.id))map.set(q.id,q)
  });
  return [...map.values()];
} function persistCustom() {
  try {
    localStorage.setItem(STORAGE_KEY,JSON.stringify(customQuestions));
    return true;
  } catch {
    toast('Guardada en esta sesión. Descarga el HTML para conservarla.');
    return false;
  }
} function shuffleArray(items) {
  const copy=[...items];
  for(let i=copy.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [copy[i],copy[j]]=[copy[j],copy[i]]
  }return copy;
}
/* 4. ESTADO DE RONDA · Cada respuesta se registra una sola vez. */
let state={
  questions:[],index:0,answers:[],mode:'study',finished:false
};
function startRound(explicitQuestions) {
  let pool=explicitQuestions || getBank().filter(q=>selectedTopics.has(questionKey(q)));
  if(!pool.length){
    toast('Selecciona al menos un tema con preguntas.');
    return;
  }   if($('shuffle').checked)pool=shuffleArray(pool);
  if(!explicitQuestions&&$('limit').value!=='all')pool=pool.slice(0,Number($('limit').value));
  state={
    questions:pool,index:0,answers:[],mode:$('mode').value,finished:false
  };
  render();
} function metrics(){
  let hits=0,streak=0;
  state.answers.forEach((a,i)=>{
    if(a===state.questions[i].answer){
      hits++;streak++
    }else streak=0
  });
  return{
    hits,streak
  };
} function updateStats(){
  const n=state.questions.length,done=state.answers.length,{
    hits,streak
  }=metrics();
  $('answered').textContent=`${done} / ${n}`;
  const hide=state.mode==='exam'&&!state.finished;
  $('points').textContent=hide?'—':hits;
  $('streak').textContent=hide?'—':streak;
  $('pointsLabel').textContent=hide?'Resultado al finalizar':'Aciertos';
  $('streakLabel').textContent=hide?'Simulacro en curso':'Racha actual';
  const p=n?Math.round(done/n*100):0;
  $('bar').style.width=p+'%';
  document.querySelector('[role=progressbar]').setAttribute('aria-valuenow',p);
}
/* 5. RENDER · textContent protege el contenido añadido o importado. */
function el(tag,text,className){
  const node=document.createElement(tag);
  if(text!==undefined)node.textContent=text;
  if(className)node.className=className;
  return node;
} function action(text,className,handler){
  const node=el('button',text,'btn '+className);
  node.type='button';
  node.addEventListener('click',handler);
  return node;
} function render(){
  updateStats();
  const game=$('game');
  game.replaceChildren();
  if(state.finished){
    renderResults();
    return
  }if(!state.questions.length){
    game.append(el('h2','No hay preguntas para esta selección.','empty'));
    return
  }  const q=state.questions[state.index],answered=state.answers[state.index]!==undefined,selected=state.answers[state.index],showSolution=answered&&state.mode==='study';
  const wrap=el('div',undefined,'animate');
  const top=el('div',undefined,'question-top');
  top.append(el('span',questionLaw(q)+' · '+q.topic.replace(/^Normativa · /,''),'tag'),el('span',`Pregunta ${state.index+1} de ${state.questions.length}`,'counter'));
  wrap.append(top,el('div',state.mode==='exam'?'SIMULACRO':'CASO PARA RESOLVER','case-label'));
  const title=el('h2',q.question);
  title.tabIndex=-1;
  title.id='currentQuestion';
  wrap.append(title);
  const list=el('div',undefined,'answers');
  list.setAttribute('role','group');
  list.setAttribute('aria-labelledby','currentQuestion');
  q.options.forEach((option,i)=>{
    const button=el('button',undefined,'answer');button.type='button';button.append(el('span',String.fromCharCode(65+i),'letter'),el('span',option));button.disabled=answered;if(showSolution&&i===q.answer){
      button.classList.add('correct');button.append(el('span','✓ Correcta','status'))
    }else if(showSolution&&i===selected){
      button.classList.add('wrong');button.append(el('span','✕ Tu elección','status'))
    }else if(answered&&i===selected)button.classList.add('selected');button.addEventListener('click',()=>answerQuestion(i));list.append(button)
  });
  wrap.append(list);
  const hint=el('div',q.hint,'hint');
  hint.hidden=true;
  hint.id='hintText';
  const tools=el('div',undefined,'tools');
  if(state.mode==='study'){
    const hb=action('Consultar pista','hintbtn',()=>{
      hint.hidden=!hint.hidden;hb.textContent=hint.hidden?'Consultar pista':'Ocultar pista';hb.setAttribute('aria-expanded',String(!hint.hidden))
    });
    hb.setAttribute('aria-controls','hintText');
    hb.setAttribute('aria-expanded','false');
    tools.append(hb)
  }else tools.append(el('span','Sin pistas · corrección al final','ref'));
  const next=action(state.index===state.questions.length-1?'Ver resultado':'Siguiente caso','primary',nextQuestion);
  next.id='next';
  next.disabled=!answered;
  tools.append(next);
  wrap.append(hint);
  if(showSolution){
    const ok=selected===q.answer;
    const feedback=el('div',undefined,'feedback'+(ok?'':' error'));
    feedback.setAttribute('role','status');
    feedback.append(el('strong',ok?'Bien resuelto.':'Vamos a reforzarlo.'),el('p',q.explanation),el('span',q.reference,'ref'));
    if(!ok)feedback.append(el('p',`Tu elección: ${q.options[selected]}. La respuesta del caso es: ${q.options[q.answer]}.`));
    wrap.append(feedback)
  }else if(answered){
    wrap.append(el('p','Respuesta registrada. Continúa para completar el simulacro.','hint'))
  }wrap.append(tools);
  game.append(wrap);
} function answerQuestion(index){
  if(state.finished||state.answers[state.index]!==undefined)return;
  state.answers[state.index]=index;
  render();
  if(state.mode==='study'&&index===state.questions[state.index].answer)$('game').classList.add('correctflash');
  setTimeout(()=>$('game').classList.remove('correctflash'),300);
  $('next')?.focus({
    preventScroll:true
  });
} function nextQuestion(){
  if(state.finished||state.answers[state.index]===undefined)return;
  if(state.index+1>=state.questions.length){
    state.finished=true;
    render();
    if(metrics().hits/state.questions.length>=.9)celebrate()
  }else{
    state.index++;
    render();
    $('currentQuestion')?.focus({
      preventScroll:true
    })
  }
} function renderResults(){
  const game=$('game'),{
    hits
  }=metrics(),total=state.questions.length,percent=total?Math.round(hits/total*100):0;
  const box=el('div',undefined,'results animate');
  box.append(el('div','RONDA COMPLETADA','eyebrow'),el('div',`${percent} %`,'score-circle'),el('h2',percent>=90?'Buen dominio de estos casos.':percent>=75?'Vas avanzando. Refuerza los detalles.':'Cada error te muestra qué repasar.'),el('p',`${hits} aciertos de ${total} preguntas · ${total-hits} por reforzar`));
  const wrong=state.questions.filter((q,i)=>state.answers[i]!==q.answer);
  const actions=el('div',undefined,'result-actions');
  if(wrong.length)actions.append(action(`Repasar ${wrong.length} errores`,'primary',()=>{
    $('mode').value='study';startRound(wrong)
  }));
  actions.append(action('Nueva ronda','light',()=>startRound()));
  box.append(actions);
  const review=el('div',undefined,'review');
  review.append(el('h3','Tu revisión de respuestas'));
  state.questions.forEach((q,i)=>{
    const ok=state.answers[i]===q.answer,item=el('div',undefined,'review-item');item.append(el('span',ok?'✓ Acierto':'✕ Por reforzar','pill'),el('p',`${i+1}. ${q.question}`),el('p',`Tu respuesta: ${q.options[state.answers[i]]}`),el('p',`Respuesta correcta: ${q.options[q.answer]}`),el('p',q.explanation),el('span',q.reference,'ref'));review.append(item)
  });
  box.append(review);
  game.append(box);
}
/* 6. BANCO AMPLIABLE · formulario, importación validada y exportación portable. */
// 6A. MENÚ JERÁRQUICO: claves compuestas para no mezclar subtemas de leyes distintas.
let selectedTopics = new Set();
let knownTopics = new Set();
const collapsedLaws = new Set();
function getLawGroups(){
  const groups=new Map(LAW_CATALOG.map(group=>[group.law,new Set(group.topics)]));
  getBank().forEach(q=>{
    const law=questionLaw(q);if(!groups.has(law))groups.set(law,new Set());groups.get(law).add(q.topic)
  });
  return [...groups].map(([law,topics])=>({
    law,topics:[...topics]
  }));
} function updateTopicSummary(){
  const bank=getBank(),count=bank.filter(q=>selectedTopics.has(questionKey(q))).length;
  const laws=new Set([...selectedTopics].map(key=>JSON.parse(key)[0]));
  $('topicSummary').textContent=count ? `${laws.size} leyes · ${selectedTopics.size} subtemas · ${count} preguntas disponibles` : selectedTopics.size ? 'Los subtemas seleccionados aún no tienen preguntas' : 'Selecciona al menos un subtema';
  $('topicSummary').classList.toggle('empty-selection',count===0);
  $('start').disabled=count===0;
} function refreshBankUI(){
  const bank=getBank(),groups=getLawGroups();
  const keys=groups.flatMap(group=>group.topics.map(topic=>topicKey(group.law,topic)));
  // Al iniciar, selecciona solamente subtemas con preguntas; conserva los elegidos después.
  keys.forEach(key=>{
    if(!knownTopics.has(key)&&bank.some(q=>questionKey(q)===key))selectedTopics.add(key)
  });
  selectedTopics=new Set([...selectedTopics].filter(key=>keys.includes(key)));
  knownTopics=new Set(keys);
  $('topicChecks').replaceChildren();
  groups.forEach((group,groupIndex)=>{
    const section=el('section',undefined,'law-group');
    const header=el('div',undefined,'law-heading'),parentLabel=el('label',undefined,'law-label'),parent=el('input');
    const groupKeys=group.topics.map(topic=>topicKey(group.law,topic));
    const chosen=groupKeys.filter(key=>selectedTopics.has(key)).length;
    parent.type='checkbox';parent.id='law-'+groupIndex;parent.checked=chosen===groupKeys.length&&chosen>0;parent.indeterminate=chosen>0&&chosen<groupKeys.length;     parent.setAttribute('aria-label','Seleccionar todos los subtemas de '+group.law);     parent.addEventListener('change',()=>{
      groupKeys.forEach(key=>{
        if(parent.checked)selectedTopics.add(key);else selectedTopics.delete(key)
      });refreshBankUI();$('law-'+groupIndex)?.focus({
        preventScroll:true
      })
    });     parentLabel.append(parent,el('strong',group.law),el('small',String(bank.filter(q=>questionLaw(q)===group.law).length)));     const toggle=el('button',collapsedLaws.has(group.law)?'+':'−','law-toggle');toggle.type='button';toggle.id='fold-'+groupIndex;toggle.setAttribute('aria-label','Mostrar u ocultar subtemas de '+group.law);toggle.setAttribute('aria-expanded',String(!collapsedLaws.has(group.law)));toggle.setAttribute('aria-controls','law-topics-'+groupIndex);     toggle.addEventListener('click',()=>{
      if(collapsedLaws.has(group.law))collapsedLaws.delete(group.law);else collapsedLaws.add(group.law);refreshBankUI();$('fold-'+groupIndex)?.focus({
        preventScroll:true
      })
    });     header.append(parentLabel,toggle);section.append(header);     const children=el('div',undefined,'law-children');children.id='law-topics-'+groupIndex;children.hidden=collapsedLaws.has(group.law);     group.topics.forEach((topic,topicIndex)=>{
      const key=topicKey(group.law,topic),count=bank.filter(q=>questionKey(q)===key).length;
      const label=el('label',undefined,'topic-check'),checkbox=el('input');checkbox.type='checkbox';checkbox.id=`subtopic-${groupIndex}-${topicIndex}`;checkbox.checked=selectedTopics.has(key);
      checkbox.addEventListener('change',()=>{
        if(checkbox.checked)selectedTopics.add(key);else selectedTopics.delete(key);refreshBankUI();$(checkbox.id)?.focus({
          preventScroll:true
        })
      });       label.append(checkbox,el('span',topic.replace(/^Normativa · /,'')),el('small',count?String(count):'Sin preguntas'));children.append(label);
    });     section.append(children);$('topicChecks').append(section);
  });
  const lawSelect=$('questionLaw'),previous=lawSelect.value;
  lawSelect.replaceChildren(...groups.map(group=>{
    const option=el('option',group.law);option.value=group.law;return option
  }));
  if(groups.some(group=>group.law===previous))lawSelect.value=previous;
  $('bankCount').textContent=`${bank.length} preguntas disponibles`;
  updateTopicSummary();
} $('selectAllTopics').addEventListener('click',()=>{
  selectedTopics=new Set(knownTopics);refreshBankUI()
});
$('clearTopics').addEventListener('click',()=>{
  selectedTopics.clear();refreshBankUI()
});
let toastTimer;
function toast(message){
  $('toast').textContent=message;
  $('toast').hidden=false;
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>$('toast').hidden=true,4000)
} function download(content,filename,type){
  const blob=new Blob([content],{
    type
  }),url=URL.createObjectURL(blob),link=el('a');
  link.href=url;
  link.download=filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500)
} $('questionForm').addEventListener('submit',event=>{
  event.preventDefault();const f=new FormData(event.target);const question={
    id:'custom-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),law:f.get('law'),topic:f.get('topic').trim(),question:f.get('question').trim(),options:[0,1,2,3].map(i=>f.get('option'+i).trim()),answer:Number(f.get('answer')),reference:f.get('reference').trim(),explanation:f.get('explanation').trim(),hint:f.get('hint').trim()
  };if(!validQuestion(question)){
    $('formMessage').textContent='Completa todos los campos y utiliza cuatro opciones distintas.';return
  }customQuestions.push(question);const saved=persistCustom();refreshBankUI();event.target.reset();$('formMessage').textContent=saved?'Pregunta guardada. Estará disponible al comenzar una nueva ronda.':'Pregunta añadida a la sesión; descarga el HTML para conservarla.';toast('Nuevo caso añadido al banco.');
});
$('exportBank').addEventListener('click',()=>download(JSON.stringify(getBank(),null,2),'preguntas-ley2196.json','application/json'));
$('downloadHtml').addEventListener('click',()=>{
  const clone=document.documentElement.cloneNode(true);let bankNode=clone.querySelector('#QUESTION_BANK');
  if(!bankNode){
    bankNode=document.createElement('script');bankNode.id='QUESTION_BANK';bankNode.type='application/json';clone.querySelector('body').append(bankNode);
  } bankNode.textContent=JSON.stringify(getBank(),null,2).replace(/</g,'\\u003c'); let catalogNode=clone.querySelector('#LAW_CATALOG'); if(!catalogNode){
    catalogNode=document.createElement('script');catalogNode.id='LAW_CATALOG';catalogNode.type='application/json';clone.querySelector('body').append(catalogNode);
  } catalogNode.textContent=JSON.stringify(getLawGroups(),null,2).replace(/</g,'\\u003c');clone.querySelector('#game').replaceChildren();clone.querySelector('#editor').removeAttribute('open');clone.querySelector('#confetti').replaceChildren();clone.querySelector('#toast').hidden=true;clone.querySelector('#questionForm').reset?.();download('<!DOCTYPE html>\n'+clone.outerHTML,'index.html','text/html;charset=utf-8');toast('Index actualizado descargado. Conserva styles.css y app.js en la misma carpeta.');
});
$('importBank').addEventListener('click',()=>$('jsonFile').click());
$('jsonFile').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;try{
    if(file.size>2000000)throw Error('El archivo supera 2 MB.');const data=JSON.parse(await file.text());if(!Array.isArray(data)||!data.length||data.length>2000||!data.every(validQuestion))throw Error('Formato inválido: usa una lista de preguntas con cuatro opciones y answer de 0 a 3.');if(new Set(data.map(q=>q.id)).size!==data.length)throw Error('El archivo contiene identificadores repetidos.');const ids=new Set(getBank().map(q=>q.id));const fresh=data.filter(q=>!ids.has(q.id));customQuestions.push(...fresh);persistCustom();refreshBankUI();toast(`${fresh.length} preguntas nuevas importadas; ${data.length-fresh.length} ya estaban en el banco.`);
  }catch(error){
    toast(error.message||'No se pudo importar el archivo.')
  }finally{
    event.target.value='';
  }
});
/* 7. EVENTOS Y ANIMACIONES · Respeta la preferencia de movimiento reducido. */
$('openEditor').addEventListener('click',()=>$('editor').showModal());
$('closeEditor').addEventListener('click',()=>$('editor').close());
$('start').addEventListener('click',()=>{
  if(state.answers.length&&!state.finished&&!confirm('¿Comenzar una nueva ronda? El avance de la ronda actual se reiniciará.'))return;startRound()
});
document.addEventListener('keydown',event=>{
  if($('editor').open||event.ctrlKey||event.altKey||event.metaKey||['INPUT','TEXTAREA','SELECT','A'].includes(document.activeElement?.tagName)||(event.key==='Enter'&&document.activeElement?.tagName==='BUTTON'))return;if(/^[1-4]$/.test(event.key)){
    event.preventDefault();answerQuestion(Number(event.key)-1)
  }else if(event.key==='Enter'){
    event.preventDefault();nextQuestion()
  }
});
function celebrate(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const container=$('confetti');
  container.replaceChildren();
  for(let i=0;i<35;i++){
    const p=el('div',undefined,'particle');
    p.style.left=Math.random()*100+'%';
    p.style.background=['#ccf26e','#68beba','#f6d16d'][i%3];
    p.style.animationDelay=Math.random()*.5+'s';
    container.append(p)
  }setTimeout(()=>container.replaceChildren(),2600);
}
/* 8. INICIO · Abre directamente en el juego, sin pantalla de marketing. */
refreshBankUI();
startRound();
