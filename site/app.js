const get = id => document.getElementById(id);
const counts = new Intl.NumberFormat("en");
const dateTime = new Intl.DateTimeFormat("en", { month:"short", day:"numeric", hour:"numeric", minute:"2-digit", timeZoneName:"short" });
let history, company = "all", view = "changes", limit = 20;
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function link(text, url) {
  const a = el("a", text, "posting");
  if (typeof url === "string" && url.startsWith("https://")) a.href = url;
  return a;
}
function displayDate(value) { return value ? dateTime.format(new Date(value)) : "Awaiting first check"; }
function sources() {
  const nav = get("sources");
  nav.replaceChildren();
  const boards = Object.entries(history.boards);
  const entries = [["all","All companies",boards.reduce((sum,[,b])=>sum+b.roles.length,0)],
    ...boards.map(([key,b])=>[key,b.name,b.roles.length])];
  for (const [key,name,count] of entries) {
    const b=el("button",undefined,"company"); b.type="button";
    b.setAttribute("aria-pressed",String(company===key));
    b.append(el("span",name),el("span",counts.format(count))); 
    b.onclick=()=>{company=key;limit=20;render();get("sources").querySelector('[aria-pressed="true"]').focus();};
    nav.append(b);
  }
}
function comparison(label, before, after) {
  const box=el("div",undefined,"comparison");
  for (const [name, value] of [["Previous "+label,before],["Updated "+label,after]]) {
    const cell=el("div");cell.append(el("small",name),el("strong",value||"Unspecified"));box.append(cell);
  }
  return box;
}
function roleRow(key, role, event) {
  const board=history.boards[key], row=el("article",undefined,"result-row");
  const head=el("div",undefined,"rowhead");
  const meta=el("small",board.name+(event?" · "+displayDate(event.at):""));
  head.append(meta);
  if(event) head.append(el("span",({added:"Added",updated:"Updated",removed:"Removed"})[event.type],"kind "+event.type));
  const title=el("h3");
  if(event?.type==="removed") title.textContent=role.title;
  else title.append(link(role.title+" ↗",role.url));
  row.append(head,title);
  if(event?.type==="updated"){
    for(const field of ["title","location"]) if(event.before[field]!==event.after[field])
      row.append(comparison(field,event.before[field],event.after[field]));
  }else{
    row.append(el("p",role.location||"Location unspecified"));
  }
  if(event?.type==="removed") row.append(link("Company careers page ↗",board.careers));
  return row;
}
function render(){
  sources();
  const selected=Object.entries(history.boards).filter(([k])=>company==="all"||company===k);
  const dated=selected.map(([,b])=>b.lastAttempt).filter(Boolean).sort();
  get("checked").textContent=displayDate(dated.at(-1));
  const warnings=selected.filter(([,b])=>b.error).map(([,b])=>b.name+
    (b.lastSuccess?" · last successful check "+displayDate(b.lastSuccess):" · awaiting a successful check"));
  get("board-status").hidden=!warnings.length;
  get("board-status").textContent=warnings.length?"Latest check unavailable: "+warnings.join("; "):"";
  const isFeed=view==="changes";
  get("changes").setAttribute("aria-pressed",String(isFeed));
  get("roles").setAttribute("aria-pressed",String(!isFeed));
  const term=get("query").value.toLowerCase().trim();
  const rows=isFeed?history.events.filter(e=>company==="all"||company===e.key)
    .map(e=>({key:e.key,role:e.after||e.before,event:e})):
    selected.flatMap(([key,b])=>b.roles.map(role=>({key,role})))
      .sort((a,b)=>a.role.title.localeCompare(b.role.title)||a.key.localeCompare(b.key));
  const visible=rows.filter(({key,role,event})=>[history.boards[key].name,role.title,role.location,
    event?.before?.title,event?.before?.location].filter(Boolean).join(" ").toLowerCase().includes(term));
  const list=get("results");list.replaceChildren();
  get("result-count").textContent=counts.format(visible.length)+" "+(isFeed?(visible.length===1?"change":"changes"):(visible.length===1?"open role":"open roles"));
  get("period").textContent=isFeed?"Last 90 days":"Latest successful checks";
  for(const item of visible.slice(0,limit)) list.append(roleRow(item.key,item.role,item.event));
  if(!visible.length) list.append(el("p",term?"No matches. Try a different role or location.":
    isFeed?(selected.some(([,b])=>b.lastSuccess)?"No changes recorded for this selection yet. Open roles shows the current listings.":"The first check is pending."):
    "No listings are available for this selection.","empty"));
  get("more").hidden=visible.length<=limit;
}
get("roles").onclick=()=>{view="roles";limit=20;render();};
get("changes").onclick=()=>{view="changes";limit=20;render();};
get("query").oninput=()=>{limit=20;if(history)render();};
get("more").onclick=()=>{limit+=20;render();};
get("example").onclick=()=>get("example-dialog").showModal();
get("dismiss").onclick=()=>get("example-dialog").close();
try {
  const response=await fetch("data/watch.json",{cache:"no-cache"});
  if(!response.ok) throw Error("Snapshot unavailable");
  history=await response.json();
  get("roles").disabled=false;
  get("changes").disabled=false;
  view=history.events.length?"changes":"roles";
  render();
} catch {
  get("results").textContent="The saved snapshot could not be loaded. Refresh this page to try again.";
  get("checked").textContent="Unavailable";
  for(const id of ["roles","changes","query"]) get(id).disabled=true;
}
