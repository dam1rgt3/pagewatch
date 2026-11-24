import test from "node:test";
import assert from "node:assert/strict";
import {parseHTML} from "linkedom/worker";
import {normalize, extract, record, wordDiff} from "../site/watch-core.js";
import {fromIssue,collect} from "../src/page-collector.mjs";
import {isPublic} from "../src/public-html.mjs";

const sample="https://example.org/workshop";
const selected=normalize({url:sample,mode:"heading",target:"Registration"});
const page=(amount,footer="A")=>"<html><head><title>Workshop</title></head><body><main><header><h2>Registration</h2></header><p>Cost: <strong>"+amount+"</strong> per person.</p><h2>Venue</h2><p>Hall 4</p></main><footer>"+footer+"</footer></body></html>";
const read=(html,config=selected)=>extract(parseHTML(html).document,config);
const configIssue=(config,number=1)=>({title:"[PageWatch] Example",state:"open",number,body:"\x60\x60\x60json\n"+JSON.stringify(config)+"\n\x60\x60\x60"});

test("heading snapshots contain the selected text through the next same-level heading",()=>{
  assert.equal(read(page("$25")),"Cost: $25 per person.");
  assert.equal(read(page("$25","new footer")),"Cost: $25 per person.");
  assert.equal(read(page("$25"),{...selected,target:"Venue"}),"Hall 4");
});
test("reads the title and a unique element, strips hidden nodes and decodes entities",()=>{
  assert.equal(read(page("$25"),{url:sample,mode:"title"}),"Workshop");
  const byId=normalize({url:sample,mode:"element",target:"#price"});
  assert.equal(read('<div id="price">A &amp; B <script>bad()</script><b hidden>draft</b></div>',byId),"A & B");
  assert.throws(()=>read('<b id="price">A</b><b id="price">B</b>',byId),/several/);
  assert.throws(()=>read("<body></body>",byId),/not found/);
});
test("does not silently truncate a broad selection or accept empty text",()=>{
  assert.throws(()=>read('<p id="price">'+"x".repeat(1601)+"</p>",{mode:"element",target:"#price"}),/too long/);
  assert.throws(()=>read('<p id="price"> </p>',{mode:"element",target:"#price"}),/no readable/);
});
test("private addresses and ambiguous selectors are excluded",()=>{
  for(const ip of ["127.0.0.1","10.1.2.3","169.254.169.254","192.168.1.1","100.64.0.1","::1","192.0.2.1","168.63.129.16"]) assert.equal(isPublic(ip),false);
  assert.equal(isPublic("1.1.1.1"),true);
  for(const url of ["file:///etc/passwd","http://127.0.0.1/x","https://intranet.local","https://example.org:8081"]) assert.throws(()=>normalize({url,mode:"title"}));
  assert.throws(()=>normalize({url:sample,mode:"element",target:"div + span"}));
});
test("collector preserves the last good value, ignores unrelated changes and records recovery",async()=>{
  const issues=[configIssue(selected)], initial={version:1,watches:{}};
  assert.deepEqual(fromIssue(issues[0]),selected);
  let state=await collect(issues,initial,"2026-11-01",async()=>page("$25"));
  state=await collect(issues,state,"2026-11-02",async()=>page("$25","revised"));
  state=await collect(issues,state,"2026-11-03",async()=>"<html>missing</html>");
  assert.equal(state.watches["1"].lastSuccess,"2026-11-02");
  assert.ok(state.watches["1"].error);
  state=await collect(issues,state,"2026-11-04",async()=>page("$20"));
  assert.deepEqual(state.watches["1"].changes,[{at:"2026-11-04",before:"Cost: $25 per person.",after:"Cost: $20 per person."}]);
  state=await collect([configIssue({...selected,mode:"title",target:""})],state,"2026-11-05",async()=>page("$20"));
  assert.equal(state.watches["1"].value,"Workshop");assert.deepEqual(state.watches["1"].changes,[]);
  assert.deepEqual((await collect([{...issues[0],state:"closed"}],state,"2026-11-06")).watches,{});
});
test("multiple word edits can be reconstructed exactly without highlighting unchanged middle words",()=>{
  const {old,current}=wordDiff("May 7, room A","June 14, room B");
  assert.equal(old.map(x=>x[0]).join(""),"May 7, room A");
  assert.equal(current.map(x=>x[0]).join(""),"June 14, room B");
  assert.ok(current.some(([token,changed])=>token==="room"&&!changed));
  assert.ok(current.some(([token,changed])=>token==="14"&&changed));
});
test("stores ten real changes and rotates the hosted queue",async()=>{
  let watch=null;
  for(let i=0;i<18;i++) watch=record(watch,selected,{value:String(i)},String(i));
  assert.equal(watch.changes.length,10);assert.equal(watch.changes[0].after,"17");
  const issues=Array.from({length:26},(_,i)=>configIssue(selected,i+1));
  const first=await collect(issues,{watches:{}},"2026-01-01",async()=>page("1"));
  assert.equal(Object.values(first.watches).filter(w=>w.lastSuccess).length,24);
  const second=await collect(issues,first,"2026-01-02",async()=>page("1"));
  assert.equal(second.watches["26"].lastSuccess,"2026-01-02");
});
