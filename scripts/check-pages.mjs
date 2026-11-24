import {readFile,writeFile} from "node:fs/promises";
import {collect} from "../src/page-collector.mjs";

const [issuesFile,historyFile,output]=process.argv.slice(2);
const pages=JSON.parse(await readFile(issuesFile,"utf8"));
let previous;
try { previous=JSON.parse(await readFile(historyFile,"utf8")); }
catch(error) { if(error.code!=="ENOENT") throw error; previous={version:1,watches:{}}; }
if(previous.version!==1 || !previous.watches) throw Error("Unrecognized page history");
const result=await collect(pages.flat(),previous,new Date().toISOString());
await writeFile(output,JSON.stringify(result)+"\n");
const values=Object.values(result.watches);
console.log("Public watches: "+values.length+"; readable: "+values.filter(w=>w.lastSuccess&&!w.error).length);
