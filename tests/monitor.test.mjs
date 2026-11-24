import {test} from "node:test";
import assert from "node:assert/strict";
import {blankHistory, parseBoard, applyCheck, trimHistory} from "../src/monitor.mjs";

const A={id:"17",title:"Designer",location:"Remote, US",url:"https://example.org/jobs/17"};
const B={id:"18",title:"Engineer",location:"Paris",url:"https://example.org/jobs/18"};
function fixture() {
  const state=blankHistory();
  let day=0;
  function tick(roles, key="demo") {
    const result=Array.isArray(roles)?{roles}:{error:"Unavailable"};
    applyCheck(state,key,result,new Date(Date.UTC(2026,0,++day)).toISOString());
  }
  return {state,tick};
}
test("a first observation establishes a baseline, including after an outage",()=>{
  const {state,tick}=fixture();tick(null);tick([A,B]);
  assert.deepEqual(state.events,[]);assert.equal(state.boards.demo.roles.length,2);
});
test("a board reordering, refreshed source URL or tracking parameter creates no event",()=>{
  const {state,tick}=fixture();tick([A,B]);tick([B,{...A,url:A.url+"?ref=new"}]);assert.deepEqual(state.events,[]);
});
test("an addition and a location edit show the right posting and original wording",()=>{
  const {state,tick}=fixture();tick([A]);tick([{...A,location:"Hybrid, San Francisco"},B]);
  assert.deepEqual(state.events.map(e=>e.type),["updated","added"]);
  assert.equal(state.events[0].before.location,"Remote, US");assert.equal(state.events[0].after.location,"Hybrid, San Francisco");
});
test("the same ID on two boards represents two independent postings",()=>{
  const {state,tick}=fixture();tick([A],"first");tick([A],"second");tick([{...A,title:"Lead Designer"}],"second");
  assert.equal(state.events.length,1);assert.equal(state.events[0].key,"second");assert.equal(state.boards.first.roles[0].title,A.title);
});
test("an outage retains the snapshot and never counts as a missing observation",()=>{
  const {state,tick}=fixture();tick([A]);tick(null);assert.equal(state.boards.demo.roles.length,1);
  tick([]);tick(null);assert.equal(state.events.length,0);tick([]);
  assert.deepEqual(state.events.map(e=>e.type),["removed"]);tick([]);assert.equal(state.events.length,1);
});
test("a temporarily missing posting returns without a false addition or removal",()=>{
  const {state,tick}=fixture();tick([A]);tick([]);tick([A]);assert.deepEqual(state.events,[]);
  tick([]);tick([{...A,title:"Staff Designer"}]);assert.deepEqual(state.events.map(e=>e.type),["updated"]);
});
test("normalization keeps HTTPS links, cleans spaces and skips prospect posts",()=>{
  const raw={id:17,title:" Designer   II ",location:{name:" New York "},absolute_url:A.url};
  assert.deepEqual(parseBoard({jobs:[raw,{internal_job_id:null}],meta:{total:2}}),[{...A,title:"Designer II",location:"New York"}]);
  for (const data of [{jobs:[raw],meta:{total:2}}, {jobs:[raw,raw],meta:{total:2}},
    {jobs:[{...raw,absolute_url:"javascript:void(0)"}],meta:{total:1}},{error:"service unavailable"}])
    assert.throws(()=>parseBoard(data));
});
test("history retains only the last ninety days of observed changes",()=>{
  const {state,tick}=fixture();tick([]);tick([A]);trimHistory(state,"2026-05-01T12:00:00Z");
  assert.deepEqual(state.events,[]);assert.equal(state.boards.demo.roles.length,1);
});
