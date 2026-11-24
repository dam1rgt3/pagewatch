import {lookup} from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import {createGunzip, createBrotliDecompress, createInflate} from "node:zlib";
import ipaddr from "ipaddr.js";
import {normalize} from "../site/watch-core.js";

const limit = 2 * 1024 * 1024;
export function isPublic(address) {
  try {
    const ip=ipaddr.parse(address);
    return ip.kind()==="ipv4" && ip.range()==="unicast" &&
      !ip.match(ipaddr.IPv4.parse("192.0.0.0"),24) && address!=="168.63.129.16";
  } catch { return false; }
}
async function get(url, signal) {
  const addresses=await lookup(url.hostname,{family:4,all:true});
  if (!addresses.length || addresses.some(a=>!isPublic(a.address))) throw Error("This host is not a public website.");
  signal.throwIfAborted();
  const transport=url.protocol==="https:" ? https : http;
  return new Promise((resolve,reject)=>{
    const request=transport.get(url,{
      family:4,agent:false,signal,
      lookup:(_name, opts, done)=>opts.all ? done(null,[addresses[0]]) : done(null,addresses[0].address,4),
      headers:{"User-Agent":"PageWatch/1.0 (public page change monitor)","Accept":"text/html, application/xhtml+xml","Accept-Encoding":"gzip, br"},
    },resolve);
    request.on("error",reject);
  });
}
export async function publicHTML(input) {
  const signal=AbortSignal.timeout(14000);
  let next=input;
  for(let hop=0;hop<=4;hop++) {
    const url=new URL(normalize({url:next,mode:"title"}).url);
    const res=await get(url,signal);
    if([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
      res.destroy();next=new URL(res.headers.location,url).href;continue;
    }
    if (res.statusCode<200 || res.statusCode>=300) {res.destroy();throw Error("Source returned HTTP "+res.statusCode+".");}
    const type=res.headers["content-type"] || "";
    if (!/^(text\/html|application\/xhtml\+xml)(?:;|$)/i.test(type)) {res.destroy();throw Error("This URL does not serve HTML.");}
    const encoding=(res.headers["content-encoding"] || "identity").trim().toLowerCase();
    const decoder=new Map([["gzip",createGunzip],["br",createBrotliDecompress],["deflate",createInflate]]).get(encoding);
    if (encoding!=="identity" && typeof decoder!=="function") {res.destroy();throw Error("Unsupported response encoding.");}
    const stream=decoder ? res.pipe(decoder()) : res;
    if(stream!==res) res.on("error",err=>stream.destroy(err));
    let total=0;const chunks=[];
    try {
      for await (const chunk of stream) {
        total+=chunk.length;
        if(total>limit) throw Error("Page exceeds the 2 MiB limit.");
        chunks.push(chunk);
      }
      const charset=type.match(/charset\s*=\s*["']?([\w.-]+)/i)?.[1] || "utf-8";
      return new TextDecoder(charset).decode(Buffer.concat(chunks));
    } finally {res.destroy();stream.destroy();}
  }
  throw Error("The site redirects too many times.");
}
