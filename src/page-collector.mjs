import {parseHTML} from "linkedom/worker";
import {normalize, extract, record} from "../site/watch-core.js";
import {publicHTML} from "./public-html.mjs";

export const issuePrefix="[PageWatch] ";
export function fromIssue(issue) {
  if (issue.pull_request || issue.state!=="open" || !issue.title.startsWith(issuePrefix)) return null;
  const json=issue.body?.match(/^\x60\x60\x60json\s*\n([\s\S]*?)\n\x60\x60\x60\s*$/m)?.[1];
  if (!json || json.length>3500) throw Error("Invalid watch configuration. Use the PageWatch form.");
  return normalize(JSON.parse(json));
}
export async function collect(issues, previous, at, download=publicHTML) {
  const entries=[];
  for(const issue of issues) {
    let config;
    try { config=fromIssue(issue); } catch { continue; }
    if (!config) continue;
    const id=String(issue.number);
    const old=previous.watches[id];
    entries.push({id,config,old});
  }
  // Rotate through busy queues without permanently excluding newer watches.
  entries.sort((a,b)=>(a.old?.lastAttempt || "").localeCompare(b.old?.lastAttempt || "") || Number(a.id)-Number(b.id));
  const watches={};
  for(let i=0;i<entries.length;i+=4) {
    await Promise.all(entries.slice(i,i+4).map(async ({id,config,old},offset)=>{
      if(i+offset>=24) {
        watches[id]=old && JSON.stringify(config)===JSON.stringify(old.config) ? old :
          {config,value:null,changes:[],lastAttempt:null,lastSuccess:null,firstSeen:null,error:null};
        return;
      }
      let result;
      try {
        const html=await download(config.url);
        result={value:extract(parseHTML(html).document,config)};
      } catch(err) {
        const expected=/^(Source returned HTTP|This URL|The select|The site|This host|Page exceeds|Unsupported response)/;
        result={error:expected.test(err.message)?err.message:"Could not read the public HTML. The site may be unavailable or block automated access."};
      }
      watches[id]=record(old,config,result,at);
    }));
  }
  return {version:1,checkedAt:at,watches};
}
