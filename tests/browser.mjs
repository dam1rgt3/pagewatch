import assert from "node:assert/strict";
import {pathToFileURL} from "node:url";
const { chromium }=await import(pathToFileURL(process.env.PLAYWRIGHT_PATH).href);
const url=new URL(process.env.SITE_URL);
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH});
try {
  const page=await browser.newPage({viewport:{width:1280,height:850}});
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  const res=await page.goto(new URL("careers.html",url).href);
  assert.equal(res.status(),200);
  const watch=await page.request.get(new URL("data/watch.json",url).href);
  assert.equal(watch.status(),200);
  const snapshot=await watch.json();
  assert.equal(Object.keys(snapshot.boards).length,3);
  const sources=Object.entries(snapshot.boards);
  const good=sources.filter(([,v])=>v.lastSuccess);
  assert.ok(good.length,"At least one board must have a successful baseline");
  await page.getByRole("button",{name:"Open roles",exact:true}).click();
  const item=good.find(([,v])=>v.roles.length)?.[1];
  if(item){
    await page.getByRole("button",{name:new RegExp(item.name)}).click();
    const input=page.locator("#query");
    await input.fill(item.roles[0].title);
    await page.locator("#results .posting").first().waitFor();
    const urls=await page.locator("#results .posting").evaluateAll(elements=>elements.map(e=>e.href));
    assert.ok(urls.some(u=>item.roles.some(r=>r.url===u)));
    await input.fill("nosuchposting-231fda98");
    await page.getByText("No matches.",{exact:false}).waitFor();
    await input.fill("");
  }
  await page.getByRole("button",{name:"Changes",exact:true}).click();
  await page.getByRole("button",{name:"View an example",exact:false}).click();
  await page.getByText("Fictional example",{exact:true}).waitFor();
  await page.getByRole("button",{name:"Close example"}).click();
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({ checkedUrl:url.href, boards:Object.fromEntries(sources.map(([k,b])=>[k,{roles:b.roles.length,lastSuccess:b.lastSuccess,error:b.error}])), events:snapshot.events.length }));
  // Replay a synthetic change at the HTTP boundary to exercise the comparison before a live edit exists.
  const sample=structuredClone(snapshot), first=good[0][0];
  const role={id:"42",title:"Fixture designer",location:"Hybrid",url:"https://example.org/jobs/42"};
  sample.events=[{key:first,at:"2026-01-02T12:00:00Z",type:"updated",before:{...role,location:"Remote"},after:role}];
  await page.route("**/data/watch.json",route=>route.fulfill({json:sample}));
  await page.reload();
  const results=page.locator("#results");
  await results.getByText("Previous location",{exact:true}).waitFor();
  await results.getByText("Updated location",{exact:true}).waitFor();
  assert.deepEqual(await results.locator(".comparison strong").allTextContents(),["Remote","Hybrid"]);
  console.log("Passed live feed, search, source selection, example, mobile width and comparison rendering.");
} finally {await browser.close();}
