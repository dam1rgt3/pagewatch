import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, extname, sep } from "node:path";
const root = fileURLToPath(new URL("../site/", import.meta.url));
const types = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".svg":"image/svg+xml", ".json":"application/json" };
const server=createServer(async (req,res)=>{
  try {
    if (!["GET","HEAD"].includes(req.method)) { res.writeHead(405).end(); return; }
    const path=decodeURIComponent(new URL(req.url,"http://localhost").pathname);
    const file=resolve(root,"."+(path==="/"?"/index.html":path));
    if(!file.startsWith(resolve(root)+sep)) {res.writeHead(404).end();return;}
    const bytes=await readFile(file);
    res.writeHead(200,{"Content-Type":(types[extname(file)]||"application/octet-stream")+"; charset=utf-8","X-Content-Type-Options":"nosniff"});
    res.end(req.method==="HEAD"?undefined:bytes);
  } catch { res.writeHead(404).end(); }
});
server.listen(Number(process.env.PORT || 8783),"127.0.0.1",()=>console.log("PageWatch: http://127.0.0.1:"+server.address().port));
