import {normalize, identity, extract, listHeadings, record, wordDiff} from "./watch-core.js";

const get = id => document.getElementById(id);
const repository = "https://github.com/dam1rgt3/pagewatch";
const storageKey = "pagewatch.private.v1";
const date = new Intl.DateTimeFormat("en", {dateStyle:"medium",timeStyle:"short"});
const when = value => value ? date.format(new Date(value)) : "Awaiting first check";
let tab = "public", publicItems = {}, publicStatus = "Loading scheduled watches…";
let generation = 0, preview = null, cachedPage = null, listTicket = 0;
const checking = new Set();
function make(tag, text, className) {
  const el=document.createElement(tag);
  if(text!==undefined) el.textContent=text;
  if(className) el.className=className;
  return el;
}
function action(text, fn) {
  const el=make("button",text,"plain");el.type="button";el.addEventListener("click",fn);return el;
}
function anchor(text, href) {
  const el=make("a",text);el.href=href;return el;
}
function feedback(message, error=false) {
  get("preview-status").textContent=message;
  get("preview-status").dataset.error=String(error);
}
function saved() {
  const raw=localStorage.getItem(storageKey);
  return raw ? JSON.parse(raw) : {};
}
function saveAll(items) {
  localStorage.setItem(storageKey, JSON.stringify(items));
}
function privateItems() {
  try {return saved();} catch {return {};}
}
function selection() {
  return normalize({url:get("address").value,mode:get("mode").value,target:get("target").value});
}
function invalidate() {
  generation++;
  preview=null;get("preview-panel").hidden=true;feedback("");
}
function fields() {
  const mode=get("mode").value;
  get("target-fields").hidden=mode==="title";
  get("discovered").hidden=true;
  get("target-label").textContent=mode==="heading"?"Heading on the page":"Element selector";
  get("target").placeholder=mode==="heading"?"e.g. Registration deadline":"e.g. #price";
  get("target-hint").textContent=mode==="heading"?"Copy the heading from the page, or preview to discover available headings.":
    'Use a unique ID, class or attribute, such as #price, .ticket-price or [itemprop="price"].';
}
async function readPage(url) {
  let res;
  try {
    res=await fetch(url,{credentials:"omit",referrerPolicy:"no-referrer",cache:"no-store",signal:AbortSignal.timeout(14000)});
  } catch { throw Error("This browser could not read the page. You can still set up a scheduled public watch on GitHub."); }
  if (!res.ok) throw Error("Page returned HTTP "+res.status+".");
  const type=res.headers.get("content-type") || "";
  if(!/^(text\/html|application\/xhtml\+xml)(?:;|$)/i.test(type)) throw Error("Choose an HTML page.");
  const reader=res.body.getReader(), limit=2*1024*1024;
  const decoder=new TextDecoder(type.match(/charset\s*=\s*["']?([\w.-]+)/i)?.[1] || "utf-8");
  let text="", size=0;
  try {
    for(;;) {
      const {done,value}=await reader.read();
      if(done) break;
      size+=value.byteLength;
      if(size>limit) {await reader.cancel();throw Error("Page exceeds the 2 MiB limit.");}
      text+=decoder.decode(value,{stream:true});
    }
    return text+decoder.decode();
  } finally { reader.releaseLock(); }
}
function inert(html) {
  const template=document.createElement("template");
  template.innerHTML=html;
  return template.content;
}
get("address").addEventListener("input",()=>{invalidate();cachedPage=null;get("discovered").hidden=true;get("heading-list").replaceChildren();});
get("target").addEventListener("input",invalidate);
get("mode").addEventListener("change",()=>{invalidate();get("target").value="";fields();});
get("sample").onclick=()=>{
  get("address").value=location.hostname.endsWith(".github.io")?new URL("workshop.html",location.href).href:"https://dam1rgt3.github.io/pagewatch/workshop.html";
  get("mode").value="heading";get("target").value="Registration deadline";
  invalidate();fields();get("watch-form").requestSubmit();
};
get("found-headings").onchange=()=>{
  const chosen=get("found-headings").value;
  if(chosen){get("target").value=chosen;get("watch-form").requestSubmit();}
};
get("watch-form").onsubmit=async event=>{
  event.preventDefault();invalidate();const ticket=generation;
  try {
    const url=normalize({url:get("address").value,mode:"title"}).url;
    feedback("Reading page…");
    const html=cachedPage?.url===url && Date.now()-cachedPage.at<30000 ? cachedPage.html : await readPage(url);
    if(ticket!==generation) return;
    cachedPage={url,html,at:Date.now()};
    const root=inert(html);
    const options=listHeadings(root).map(h=>{const o=make("option");o.value=h;return o;});
    get("heading-list").replaceChildren(...options);
    const chooser=get("found-headings");
    const prompt=make("option","Choose a heading…");prompt.value="";
    chooser.replaceChildren(prompt,...options.map(o=>{const item=make("option",o.value);item.value=o.value;return item;}));
    chooser.value=get("target").value;
    get("discovered").hidden=get("mode").value!=="heading"||!options.length;
    if(get("mode").value==="heading"&&!get("target").value.trim()){
      get("target").focus();
      feedback(options.length?"Choose one of the headings, then preview again.":"No headings found. Try Page title or Specific page element.");
      return;
    }
    const config=selection(), value=extract(root,config);
    preview={config,value};get("preview-value").textContent=value;
    get("preview-panel").hidden=false;feedback("");
  } catch(error) {if(ticket===generation) feedback(error.message,true);}
};
get("save").onclick=()=>{
  if(!preview) return;
  try {
    const items=saved(), id=identity(preview.config);
    items[id]=record(items[id],preview.config,{value:preview.value},new Date().toISOString());
    saveAll(items);tab="private";render();feedback("Saved in this browser.");
  } catch {feedback("Browser storage is unavailable. Check your browser settings.",true);}
};
get("schedule").onclick=()=>{
  try {
    const config=selection(), host=new URL(config.url).hostname;
    const target=config.mode==="title"?"Page title":config.target;
    const newIssue=new URL(repository+"/issues/new");
    newIssue.searchParams.set("title","[PageWatch] "+host+" · "+target);
    newIssue.searchParams.set("body","Public page watch. Close this issue to stop future checks.\n\n"+String.fromCharCode(96).repeat(3)+"json\n"+JSON.stringify(config,null,2)+"\n"+String.fromCharCode(96).repeat(3));
    const a=anchor("Continue to GitHub",newIssue.href);
    a.target="_blank";a.rel="noopener noreferrer";document.body.append(a);a.click();a.remove();
    feedback("Submit the issue in GitHub. Your watch appears in Scheduled after the next publication.");
  } catch(error){feedback(error.message,true);}
};
async function refreshPrivate(id) {
  if(checking.has(id)) return;
  checking.add(id);render();
  try {
    const previous=saved()[id];
    if(!previous) return;
    const config=previous.config;
    let result;
    try {result={value:extract(inert(await readPage(config.url)),config)};}
    catch(error){result={error:error.message};}
    const items=saved();
    if(items[id]) {items[id]=record(items[id],config,result,new Date().toISOString());saveAll(items);}
  } catch {feedback("Could not update browser storage.",true);}
  finally {checking.delete(id);render();}
}
function diffView(change) {
  const diff=wordDiff(change.before,change.after);
  const row=make("div",undefined,"diff");
  for(const [title,tokens,tag] of [["Previous",diff.old,"del"],["Current",diff.current,"ins"]]){
    const cell=make("section"), p=make("p");cell.append(make("h4",title),p);
    for(const [token,marked] of tokens) p.append(marked?make(tag,token):document.createTextNode(token));
    row.append(cell);
  }
  return row;
}
function card(id,w,isPublic) {
  const section=make("article",undefined,"watch-item");
  const heading=make("div",undefined,"item-heading"), title=make("h3");
  title.append(anchor(w.config.mode==="title"?"Page title":w.config.target,w.config.url));
  heading.append(title,make("span",new URL(w.config.url).hostname,"host"));section.append(heading);
  section.append(make("p","Last successful check · "+when(w.lastSuccess),"watch-meta"));
  if(w.error){const error=make("p",w.error,"feedback");error.dataset.error="true";section.append(error);}
  if(w.value!==null) section.append(make("blockquote",w.value,"current-value"));
  if(w.changes.length) {
    w.changes.forEach((change,i)=>{
      const details=make("details");details.open=i===0;
      details.append(make("summary","Change observed "+when(change.at)),diffView(change));section.append(details);
    });
  } else if(w.lastSuccess) section.append(make("p","Baseline saved. No changes observed yet.","watch-meta"));
  const actions=make("div",undefined,"watch-actions");
  if(isPublic) actions.append(anchor("Watch settings on GitHub ↗",repository+"/issues/"+id));
  else {
    const check=action(checking.has(id)?"Checking…":"Check now",()=>refreshPrivate(id));check.disabled=checking.has(id);
    actions.append(check,action("Remove",()=>{
      try {const items=saved();delete items[id];saveAll(items);render();} catch {feedback("Could not update browser storage.",true);}
    }));
  }
  section.append(actions);return section;
}
function render() {
  const isPublic=tab==="public";
  get("public-tab").setAttribute("aria-pressed",String(isPublic));
  get("private-tab").setAttribute("aria-pressed",String(!isPublic));
  const items=isPublic?publicItems:privateItems();
  get("list-status").textContent=isPublic?publicStatus:"Manually checked and stored on this device.";
  const rows=Object.entries(items).sort(([,a],[,b])=>(b.changes[0]?.at||b.lastSuccess||"").localeCompare(a.changes[0]?.at||a.lastSuccess||""));
  const list=get("watch-list");
  list.replaceChildren(...rows.map(([id,w])=>card(id,w,isPublic)));
  if(!rows.length) list.append(make("p",isPublic?"No scheduled watches to show yet.":"Preview a selection and save it here to start a private watch.","watch-empty"));
}
async function reload() {
  const ticket=++listTicket;
  try {
    const res=await fetch("data/pages.json",{cache:"no-cache"});
    if(!res.ok) throw Error();
    const data=await res.json();
    if(ticket!==listTicket) return;
    publicItems=data.watches;
    publicStatus=data.checkedAt?"Last collection · "+when(data.checkedAt):"Awaiting the first collection.";
  } catch {if(ticket!==listTicket)return;publicStatus="Scheduled watch data is currently unavailable.";}
  render();
}
get("reload").onclick=reload;
get("public-tab").onclick=()=>{tab="public";render();};
get("private-tab").onclick=()=>{tab="private";render();};
window.addEventListener("storage",e=>{if(e.key===storageKey)render();});
fields();render();void reload();
