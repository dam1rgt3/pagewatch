export const MAX_TEXT = 1600;
const modes = new Set(["title", "heading", "element"]);
const headings = "h1,h2,h3,h4,h5,h6";
const blocks = new Set("ADDRESS ARTICLE ASIDE BLOCKQUOTE BR DD DIV DL DT FIGCAPTION FIGURE FOOTER FORM H1 H2 H3 H4 H5 H6 HEADER HR LI MAIN NAV OL P PRE SECTION TABLE TD TH TR UL".split(" "));
const ignored = "script,style,noscript,template,svg,canvas,[hidden],[aria-hidden='true']";
export const tidy = text => String(text ?? "").normalize("NFC").replace(/\s+/gu, " ").trim();

export function normalize(input) {
  const url = new URL(String(input.url).trim());
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.port ||
      !url.hostname.includes(".") || /(?:^|\.)(localhost|local|internal|test|invalid)$/i.test(url.hostname) ||
      /^[\d.]+$/.test(url.hostname) || url.href.length > 1800) {
    throw Error("Enter a public HTTP or HTTPS website on its standard port.");
  }
  url.hash = "";
  if (!modes.has(input.mode)) throw Error("Choose a supported selection.");
  const target = input.mode === "title" ? "" : tidy(input.target);
  if (input.mode !== "title" && (!target || target.length > 160)) throw Error("Enter a heading or selector of up to 160 characters.");
  // One ordinary element selector keeps selection unambiguous and bounded on untrusted HTML.
  if (input.mode === "element" && !/^(?:[a-z][a-z0-9-]*)?(?:[#.][a-z_][\w-]*|\[(?:id|class|itemprop|name|data-[\w-]+)=(?:"[\w .:-]+"|'[\w .:-]+')\])$/i.test(target)) {
    throw Error('Use one ID, class or attribute, for example #price, .deadline or [itemprop="price"].');
  }
  return {url:url.href, mode:input.mode, target};
}

export function identity(config) { return JSON.stringify([config.url, config.mode, config.target]); }

function textOf(el) {
  function visit(node) {
    if (node.nodeType === 3) return node.nodeValue;
    if (node.nodeType !== 1 || node.matches(ignored)) return "";
    const inner = Array.from(node.childNodes, visit).join("");
    return blocks.has(node.tagName.toUpperCase()) ? " " + inner + " " : inner;
  }
  return tidy(visit(el));
}

function unique(nodes) {
  if (!nodes.length) throw Error("The selected part was not found in the page HTML.");
  if (nodes.length !== 1) throw Error("The selection matches several parts. Choose a unique heading or element.");
  return nodes[0];
}

export function listHeadings(root) {
  return [...new Set([...root.querySelectorAll(headings)].map(textOf).filter(Boolean))].slice(0,100);
}

export function extract(root, config) {
  for (const item of root.querySelectorAll(ignored)) item.remove();
  let value;
  if (config.mode === "heading") {
    const start = unique([...root.querySelectorAll(headings)].filter(h => textOf(h).toLowerCase() === config.target.toLowerCase()));
    const rank = Number(start.tagName.slice(1));
    const boundary = start.closest("section,article,main,body") || root;
    const parts = [];
    // Tree order also covers headings nested in header/wrapper elements.
    let node = start;
    function after(current) {
      while (current && current !== boundary && !current.nextSibling) current = current.parentNode;
      return current && current !== boundary ? current.nextSibling : null;
    }
    node = after(node);
    while (node) {
      if (node.nodeType === 1) {
        if (/^H[1-6]$/i.test(node.tagName) && Number(node.tagName.slice(1)) <= rank) break;
        if (blocks.has(node.tagName.toUpperCase())) parts.push(" ");
      } else if (node.nodeType === 3) {
        parts.push(node.nodeValue);
      }
      if (node.firstChild) { node = node.firstChild; continue; }
      while (node && node !== boundary && !node.nextSibling) {
        if (node.nodeType === 1 && blocks.has(node.tagName.toUpperCase())) parts.push(" ");
        node = node.parentNode;
      }
      if (node?.nodeType === 1 && blocks.has(node.tagName.toUpperCase())) parts.push(" ");
      node = node && node !== boundary ? node.nextSibling : null;
    }
    value = tidy(parts.join(""));
  } else {
    const el = unique([...root.querySelectorAll(config.mode === "title" ? "title" : config.target)]);
    value = el.tagName.toUpperCase() === "META" ? tidy(el.getAttribute("content")) : textOf(el);
  }
  if (!value) throw Error("The selection contains no readable text.");
  if (value.length > MAX_TEXT) throw Error("The selected text is too long. Select a smaller section or element.");
  return value;
}

export function record(previous, config, result, at) {
  const same = previous && identity(previous.config) === identity(config);
  const item = same ? {...previous} : { config, value:null, changes:[], firstSeen:null, lastSuccess:null };
  item.lastAttempt = at;
  item.error = result.error || null;
  if (item.error) return item;
  if (item.value !== null && item.value !== result.value) {
    item.changes = [{at, before:item.value, after:result.value}, ...item.changes].slice(0,10);
  }
  item.firstSeen ||= at;
  item.lastSuccess = at;
  item.value = result.value;
  return item;
}

// Longest common subsequence of tokens preserves unchanged words between separate edits.
export function wordDiff(before, after) {
  const tokens = s => s.match(/[\p{L}\p{N}\p{M}]+|\s+|[^\s\p{L}\p{N}\p{M}]/gu) || [];
  const a=tokens(before), b=tokens(after), width=b.length+1;
  const matrix = new Uint16Array((a.length+1)*width);
  for (let i=a.length-1;i>=0;i--) for (let j=b.length-1;j>=0;j--) {
    matrix[i*width+j]=a[i]===b[j]?1+matrix[(i+1)*width+j+1]:Math.max(matrix[(i+1)*width+j],matrix[i*width+j+1]);
  }
  const old=[], current=[];
  let i=0,j=0;
  while (i<a.length || j<b.length) {
    if (i<a.length && j<b.length && a[i]===b[j]) {old.push([a[i++],false]);current.push([b[j++],false]);}
    else if (i<a.length && (j===b.length || matrix[(i+1)*width+j]>=matrix[i*width+j+1])) old.push([a[i++],true]);
    else current.push([b[j++],true]);
  }
  return {old, current};
}
