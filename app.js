const quizData = await (await fetch("./data_quiz_1.json")).json();

// Ranking lokalny: zapisywany wyłącznie w pamięci przeglądarki tego urządzenia.
const SCORE_STORAGE_KEY = "netlab-quiz-1-scores";

const $=id=>document.getElementById(id);
let mode="test", sequence=[], index=0, answers={}, checked={}, startedAt=0, activeQuestion=null, resultPercent=0, correctCount=0;
const shuffle=a=>{const x=[...a];for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]]}return x};
const clean=s=>String(s??"").trim().replace(/\s+/g," ");
const normalize=s=>clean(s).toLocaleLowerCase("pl").replace(/[.,;:!?]/g,"");
const imageFallback=q=>q.image ? q.image : null;
$("total-count").textContent=quizData.questions.length;
let seconds=0;setInterval(()=>{seconds++;$("clock").textContent=String(Math.floor(seconds/60)).padStart(2,"0")+":"+String(seconds%60).padStart(2,"0")},1000);

document.querySelectorAll("[data-mode]").forEach(b=>b.addEventListener("click",()=>start(b.dataset.mode)));
$("exit").addEventListener("click",()=>{show("home");});
$("check").addEventListener("click",checkAnswer);
$("next").addEventListener("click",nextQuestion);
$("again").addEventListener("click",()=>show("home"));
$("refresh-board").addEventListener("click",loadBoard);
$("publish").addEventListener("click",publishScore);

function show(id){["home","quiz","results"].forEach(x=>$(x).classList.toggle("hidden",x!==id));window.scrollTo({top:0,behavior:"smooth"})}
function start(nextMode){
 mode=nextMode; const all=shuffle(quizData.questions);
 sequence=mode==="random"?[all[0]]:mode==="test"?all.slice(0,20):[...quizData.questions];
 index=0;answers={};checked={};startedAt=Date.now();show("quiz");
 $("session-label").textContent=mode==="random"?"QUICK PRACTICE":mode==="test"?"EXAM SIMULATION":"STUDY MODE";
 renderQuestion();
}
function renderQuestion(){
 activeQuestion=sequence[index];const q=activeQuestion;const saved=answers[q.id];
 $("counter").textContent=`QUESTION ${String(index+1).padStart(2,"0")} / ${sequence.length}`;
 $("progress").style.width=`${(index/sequence.length)*100}%`;
 $("question-id").textContent=`QUESTION #${q.id}`;
 $("question-title").textContent=q.question;
 $("question-category").textContent=q.type==="open"?"OPEN RESPONSE":q.type==="matching"?"MATCHING":q.question.toLowerCase().includes("ipv6")||q.question.includes("IPv6")?"IPV6":"ADDRESSING";
 $("question-hint").textContent=q.type==="multi"?"Wybierz wszystkie poprawne odpowiedzi. Liczba poprawnych odpowiedzi jest taka jak w materiale źródłowym.":q.type==="matching"?"Dopasuj elementy zgodnie z ilustracją.":q.type==="open"?"Wpisz odpowiedź w polu poniżej.":"Wybierz jedną odpowiedź.";
 const iw=$("question-image-wrap"),img=$("question-image");if(q.image){iw.classList.remove("hidden");img.src=q.image;img.onerror=()=>{iw.classList.add("hidden")}}else iw.classList.add("hidden");
 const area=$("answer-area");area.innerHTML="";
 if(q.type==="open"){
  const input=document.createElement("textarea");input.className="open-answer";input.placeholder="Wpisz odpowiedź…";input.value=saved?.text||"";input.addEventListener("input",()=>answers[q.id]={text:input.value});area.append(input);
 }else if(q.type==="matching"){
  const pairs=q.matching?.pairs||[];
  if(!pairs.length){const note=document.createElement("div");note.className="board-empty";note.textContent="Ilustracja zawiera elementy do dopasowania. Użyj listy wyboru przy każdym wierszu.";area.append(note);(q.matching?.leftItems||[]).forEach(()=>{});}
  const choices=q.matching?.choices?.length?q.matching.choices:[...new Set(pairs.map(p=>p.right))];
  pairs.forEach((pair,i)=>{const row=document.createElement("div");row.className="matching-row";const left=document.createElement("div");left.textContent=pair.left;const label=document.createElement("label");label.textContent="Dopasuj:";const select=document.createElement("select");select.innerHTML='<option value="">Wybierz odpowiedź…</option>'+choices.map(c=>`<option>${escapeHtml(c)}</option>`).join("");select.value=saved?.matches?.[pair.left]||"";select.addEventListener("change",()=>{answers[q.id]??={matches:{}};answers[q.id].matches[pair.left]=select.value});row.append(left,select);area.append(row)});
 }else{
  const opts=shuffle(q.options||[]);opts.forEach((opt,i)=>{const label=document.createElement("label");label.className="answer-option";const inp=document.createElement("input");inp.type=q.type==="multi"?"checkbox":"radio";inp.name="answer";inp.value=opt;inp.checked=q.type==="multi"?(saved?.selected||[]).includes(opt):saved?.selected===opt;inp.addEventListener("change",()=>{if(q.type==="multi"){let cur=answers[q.id]?.selected||[];cur=inp.checked?[...cur,opt]:cur.filter(x=>x!==opt);answers[q.id]={selected:cur};$("select-note").textContent=`Zaznaczono ${cur.length} / ${q.correctAnswers.length}`;}else answers[q.id]={selected:opt};});const letter=document.createElement("span");letter.className="option-letter";letter.textContent=String.fromCharCode(65+i);const text=document.createElement("span");text.textContent=opt;label.append(inp,letter,text);area.append(label)});
 }
 $("select-note").textContent=q.type==="multi"?`Wybierz ${q.correctAnswers.length} odpowiedzi`:"";
 $("feedback").className="feedback hidden";$("feedback").textContent="";
 $("check").classList.toggle("hidden",!!checked[q.id]);$("next").classList.toggle("hidden",!checked[q.id]);
 $("question-panel")?.classList.remove("reviewed");
 if(checked[q.id])showReview(q);
 renderNav();
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function isCorrect(q){
 const a=answers[q.id];
 if(q.type==="open")return (q.acceptedAnswers||q.correctAnswers).some(x=>normalize(x)===normalize(a?.text));
 if(q.type==="matching"){const correct=q.matching?.correct||[];return correct.length>0&&correct.every(([l,r])=>a?.matches?.[l]===r)}
 const chosen=q.type==="multi"?(a?.selected||[]):a?.selected?[a.selected]:[];
 return chosen.length===q.correctAnswers.length&&chosen.every(x=>q.correctAnswers.some(c=>normalize(c)===normalize(x)));
}
function checkAnswer(){
 const q=activeQuestion;const a=answers[q.id];
 if(q.type==="multi"&&(a?.selected||[]).length!==q.correctAnswers.length){$("feedback").className="feedback bad";$("feedback").textContent=`Zaznacz dokładnie ${q.correctAnswers.length} odpowiedzi.`;return}
 if(q.type==="matching"&&!q.matching?.pairs?.length){$("feedback").className="feedback bad";$("feedback").textContent="Brakuje danych tekstowych do sprawdzenia tego dopasowania. Ilustracja jest widoczna, ale odpowiedzi nie zostały odczytane w strukturze JSON.";return}
 if(q.type==="open"&&!clean(a?.text)){ $("feedback").className="feedback bad";$("feedback").textContent="Wpisz odpowiedź przed sprawdzeniem.";return}
 checked[q.id]=isCorrect(q);showReview(q);
 $("check").classList.add("hidden");$("next").classList.remove("hidden");$("progress").style.width=`${((index+1)/sequence.length)*100}%`;renderNav();
}
function showReview(q){
 const ok=checked[q.id];const f=$("feedback");f.className="feedback "+(ok?"good":"bad");f.textContent=ok?"Poprawna odpowiedź.":`Niepoprawna odpowiedź. ${q.type==="open"?"Sprawdź format odpowiedzi.":"Poprawna odpowiedź: "+(q.correctAnswers||[]).join(", ")}`;
 document.querySelectorAll(".answer-option").forEach(el=>{const t=el.querySelector("span:last-child")?.textContent;if(q.correctAnswers?.some(c=>normalize(c)===normalize(t)))el.classList.add("correct");else if(checked[q.id]&&!ok)el.classList.add("incorrect")});
}
function nextQuestion(){if(index<sequence.length-1){index++;renderQuestion()}else finish()}
function renderNav(){const nav=$("question-nav");nav.innerHTML="";sequence.forEach((q,i)=>{const b=document.createElement("button");b.className="nav-dot"+(i===index?" current":"")+(checked[q.id]?" done":"");b.textContent=String(i+1);b.title=`Pytanie ${q.id}`;b.addEventListener("click",()=>{index=i;renderQuestion()});nav.append(b)})}
function finish(){
 correctCount=sequence.filter(q=>checked[q.id]===true).length;resultPercent=Math.round(correctCount/sequence.length*100);
 $("result-percent").textContent=resultPercent+"%";$("result-correct").textContent=`${correctCount} / ${sequence.length}`;
 const passed=mode!=="test"||resultPercent>=70;$("result-status").textContent=passed?(mode==="test"?"ZALICZONY":"GOTOWE"):"NIEZALICZONY";
 $("result-status").style.color=passed?"var(--green)":"var(--red)";$("result-symbol").classList.toggle("fail",!passed);$("result-symbol").textContent=passed?"✓":"×";
 $("result-title").textContent=mode==="random"?"Pytanie zakończone":mode==="study"?"Sesja nauki zakończona":passed?"Gratulacje, test zaliczony.":"Tym razem poniżej progu.";
 $("result-desc").textContent=`Ukończono ${sequence.length} pytań. Twój wynik to ${resultPercent}%. Próg zaliczenia testu wynosi 70%.`;
 show("results");$("publish-status").textContent="";$("nickname").value="";loadBoard();
}
const profanity=["kurwa","chuj","pizda","jebac","jebać","pierdol","spierdal","suka","cipa","fuck","shit","bitch","asshole","cunt","nigger","nigga"];
function safeNickname(s){const n=normalize(s).replace(/[^a-z0-9ąćęłńóśźż]/gi,"");return n.length>=2&&n.length<=18&&!profanity.some(w=>n.includes(w))}
function readScores(){
 try { const value=JSON.parse(localStorage.getItem(SCORE_STORAGE_KEY)||"[]"); return Array.isArray(value)?value:[]; }
 catch { return []; }
}
function publishScore(){
 const name=clean($("nickname").value);const status=$("publish-status");
 if(!safeNickname(name)){status.textContent="Wpisz pseudonim 2–18 znaków bez wulgaryzmów.";return}
 const btn=$("publish");btn.disabled=true;
 try {
  const rows=readScores();
  rows.push({nickname:name,score:resultPercent,correct:correctCount,total:sequence.length,mode,createdAt:Date.now()});
  rows.sort((a,b)=>(Number(b.score)||0)-(Number(a.score)||0));
  localStorage.setItem(SCORE_STORAGE_KEY,JSON.stringify(rows.slice(0,25)));
  status.textContent="Wynik zapisany w rankingu tej przeglądarki.";loadBoard();
 } catch(e) { console.error(e);status.textContent="Nie udało się zapisać wyniku. Sprawdź ustawienia pamięci przeglądarki."; }
 finally {btn.disabled=false}
}
function loadBoard(){
 const el=$("leaderboard-list");
 const rows=readScores().sort((a,b)=>(Number(b.score)||0)-(Number(a.score)||0)).slice(0,25);
 if(!rows.length){el.innerHTML='<div class="board-empty">Brak zapisanych wyników. Bądź pierwszy!</div>';return}
 el.innerHTML=rows.map((r,i)=>`<div class="board-row"><span class="board-rank">${String(i+1).padStart(2,"0")}</span><strong>${escapeHtml(r.nickname||"Anonim")}</strong><span class="board-score">${Number(r.score)||0}%</span><span class="board-date">${Number(r.correct)||0}/${Number(r.total)||0} pkt</span></div>`).join("");
}
