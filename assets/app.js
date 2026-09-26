const root=document.querySelector("#tool-app");
const slug=document.body.dataset.tool||"";
const locale=document.body.dataset.locale||"ru";
const tr=(ru,en)=>locale==="ru"?ru:en;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=n=>n<1024?n+" B":n<1048576?(n/1024).toFixed(1)+" KB":(n/1048576).toFixed(2)+" MB";
function download(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500)}
function status(msg,type="ok"){const el=document.querySelector("#status");if(el){el.textContent=msg;el.className="status "+type}}
function uploader({accept,multiple=false,label}){return `<label class="drop"><input id="file" type="file" accept="${accept}" ${multiple?"multiple":""}><span class="dropIcon">＋</span><strong>${label}</strong><small>${tr("Перетащите файл сюда или нажмите для выбора","Drop a file here or click to browse")}</small></label>`}
async function imageToBlob(file,type="image/webp",quality=.82,size=null){
  const img=await createImageBitmap(file); let w=img.width,h=img.height;
  if(size){const k=Math.min(1,size/Math.max(w,h));w=Math.round(w*k);h=Math.round(h*k)}
  const c=document.createElement("canvas");c.width=w;c.height=h;const ctx=c.getContext("2d");
  if(type==="image/jpeg"){ctx.fillStyle="#fff";ctx.fillRect(0,0,w,h)} ctx.drawImage(img,0,0,w,h);
  return await new Promise(resolve=>c.toBlob(resolve,type,quality));
}
function renderPdfToJpg(){
  root.innerHTML=uploader({accept:"application/pdf",label:tr("Выберите PDF","Choose a PDF")})+'<div id="status" class="status"></div><div id="results" class="results"></div>';
  file.onchange=async()=>{const f=file.files[0];if(!f)return;status(tr("Читаю PDF…","Reading PDF…"));
    try{
      const pdfjs=await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc="https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
      const pdf=await pdfjs.getDocument({data:await f.arrayBuffer()}).promise; results.innerHTML="";
      for(let i=1;i<=pdf.numPages;i++){status(tr(`Страница ${i} из ${pdf.numPages}…`,`Page ${i} of ${pdf.numPages}…`));
        const p=await pdf.getPage(i),v=p.getViewport({scale:1.7}),c=document.createElement("canvas");c.width=v.width;c.height=v.height;
        await p.render({canvasContext:c.getContext("2d"),viewport:v}).promise;
        const b=await new Promise(r=>c.toBlob(r,"image/jpeg",.9));const card=document.createElement("div");card.className="resultCard";
        card.innerHTML=`<span>JPG</span><div><strong>${tr("Страница","Page")} ${i}</strong><small>${fmt(b.size)}</small></div><button>${tr("Скачать","Download")}</button>`;
        card.querySelector("button").onclick=()=>download(b,`page-${i}.jpg`);results.append(card);
      } status(tr("Готово","Done"));
    }catch(e){status(e.message||String(e),"bad")}
  }
}
function renderMergePdf(){
  root.innerHTML=uploader({accept:"application/pdf",multiple:true,label:tr("Выберите 2 или больше PDF","Choose 2 or more PDFs")})+'<div id="filelist"></div><button id="run" class="runBtn" disabled>'+tr("Объединить PDF","Merge PDFs")+'</button><div id="status" class="status"></div>';
  file.onchange=()=>{const fs=[...file.files];run.disabled=fs.length<2;filelist.innerHTML=fs.map((f,i)=>`<div class="miniFile"><b>${i+1}</b><span>${esc(f.name)}</span><small>${fmt(f.size)}</small></div>`).join("")};
  run.onclick=async()=>{try{status(tr("Объединяю…","Merging…"));const {PDFDocument}=await import("https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm");const out=await PDFDocument.create();
    for(const f of [...file.files]){const doc=await PDFDocument.load(await f.arrayBuffer());const pages=await out.copyPages(doc,doc.getPageIndices());pages.forEach(p=>out.addPage(p))}
    const bytes=await out.save();download(new Blob([bytes],{type:"application/pdf"}),"toolnest-merged.pdf");status(tr("Готово — файл скачан","Done — file downloaded"));
  }catch(e){status(e.message||String(e),"bad")}}
}
function renderImageTool(kind){
  const isWebp=kind==="webp-converter"; root.innerHTML=uploader({accept:"image/jpeg,image/png,image/webp",label:tr("Выберите изображение","Choose an image")})+
  `<div class="control"><label>${tr("Качество","Quality")} <b id="qv">82%</b></label><input id="quality" type="range" min="35" max="100" value="82"></div><button id="run" class="runBtn" disabled>${isWebp?tr("Конвертировать в WebP","Convert to WebP"):tr("Сжать изображение","Compress image")}</button><div id="status" class="status"></div><div id="preview"></div>`;
  quality.oninput=()=>qv.textContent=quality.value+"%"; file.onchange=()=>{run.disabled=!file.files[0];if(file.files[0])status(tr("Исходный размер: ","Original size: ")+fmt(file.files[0].size))};
  run.onclick=async()=>{try{const f=file.files[0];status(tr("Обрабатываю…","Processing…"));const type=isWebp?"image/webp":(f.type==="image/jpeg"?"image/jpeg":"image/webp");const b=await imageToBlob(f,type,+quality.value/100);
    const ext=type==="image/webp"?"webp":"jpg";preview.innerHTML=`<div class="resultSummary"><strong>${fmt(f.size)} → ${fmt(b.size)}</strong><span>${Math.max(0,Math.round((1-b.size/f.size)*100))}% ${tr("меньше","smaller")}</span><button id="save">${tr("Скачать","Download")}</button></div>`;save.onclick=()=>download(b,f.name.replace(/\.[^.]+$/,"")+"."+ext);status(tr("Готово","Done"));
  }catch(e){status(e.message||String(e),"bad")}}
}
function renderFavicon(){
  root.innerHTML=uploader({accept:"image/*",label:tr("Выберите логотип или изображение","Choose a logo or image")})+'<button id="run" class="runBtn" disabled>'+tr("Создать favicon","Generate favicons")+'</button><div id="status" class="status"></div><div id="results" class="results"></div>';
  file.onchange=()=>run.disabled=!file.files[0];run.onclick=async()=>{try{results.innerHTML="";for(const size of [32,180]){const b=await imageToBlob(file.files[0],"image/png",1,size);const c=document.createElement("div");c.className="resultCard";c.innerHTML=`<span>PNG</span><div><strong>${size}×${size}</strong><small>${fmt(b.size)}</small></div><button>${tr("Скачать","Download")}</button>`;c.querySelector("button").onclick=()=>download(b,size===32?"favicon.png":"apple-touch-icon.png");results.append(c)}status(tr("Готово","Done"))}catch(e){status(e.message||String(e),"bad")}}
}
function renderJson(){
  root.innerHTML=`<textarea id="input" class="editor" spellcheck="false" placeholder='{"hello":"world"}'></textarea><div class="buttonRow"><button id="pretty" class="runBtn">${tr("Форматировать","Format")}</button><button id="minify" class="softBtn">${tr("Минифицировать","Minify")}</button><button id="copy" class="softBtn">${tr("Копировать","Copy")}</button></div><div id="status" class="status"></div>`;
  const parse=space=>{try{input.value=JSON.stringify(JSON.parse(input.value),null,space);status(tr("JSON корректный","Valid JSON"))}catch(e){status(e.message,"bad")}};pretty.onclick=()=>parse(2);minify.onclick=()=>parse(0);copy.onclick=async()=>{await navigator.clipboard.writeText(input.value);status(tr("Скопировано","Copied"))}
}
function renderUtm(){
  const fields=[["url",tr("Ссылка","URL")],["utm_source","utm_source"],["utm_medium","utm_medium"],["utm_campaign","utm_campaign"],["utm_term","utm_term"],["utm_content","utm_content"]];
  root.innerHTML='<div class="formGrid">'+fields.map(([id,l])=>`<label><span>${l}</span><input id="${id}" placeholder="${id==="url"?"https://example.com":""}"></label>`).join("")+'</div><button id="run" class="runBtn">'+tr("Собрать ссылку","Build URL")+'</button><div id="status" class="status"></div><div id="output"></div>';
  run.onclick=()=>{try{const u=new URL(url.value);fields.slice(1).forEach(([id])=>{const v=document.getElementById(id).value.trim();if(v)u.searchParams.set(id,v)});output.innerHTML=`<div class="copyBox"><code>${esc(u.toString())}</code><button id="copy">${tr("Копировать","Copy")}</button></div>`;copy.onclick=()=>navigator.clipboard.writeText(u.toString());status(tr("Готово","Done"))}catch{status(tr("Введите корректный URL","Enter a valid URL"),"bad")}}
}
function renderRobots(){
  root.innerHTML=`<div class="formGrid"><label><span>${tr("Адрес сайта","Website URL")}</span><input id="site" placeholder="https://example.com"></label><label><span>${tr("Закрыть путь (необязательно)","Disallow path (optional)")}</span><input id="disallow" placeholder="/admin/"></label></div><button id="run" class="runBtn">${tr("Создать robots.txt","Generate robots.txt")}</button><div id="output"></div>`;
  run.onclick=()=>{try{const u=new URL(site.value);const txt=`User-agent: *\nAllow: /\n${disallow.value.trim()?"Disallow: "+disallow.value.trim()+"\n":""}Sitemap: ${u.origin}/sitemap.xml\n`;output.innerHTML=`<textarea class="editor small" id="robots">${txt}</textarea><button class="softBtn" id="save">${tr("Скачать robots.txt","Download robots.txt")}</button>`;save.onclick=()=>download(new Blob([txt],{type:"text/plain"}),"robots.txt")}catch{output.innerHTML=`<div class="status bad">${tr("Введите корректный URL","Enter a valid URL")}</div>`}}
}
function parseSitemap(xml){const loc=[...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map(m=>m[1].trim()),unique=new Set(loc);return {count:loc.length,unique:unique.size,duplicates:loc.length-unique.size}}
function renderSitemap(){
  root.innerHTML=`<div class="formGrid"><label><span>Sitemap URL</span><input id="url" placeholder="https://example.com/sitemap.xml"></label></div><button id="run" class="runBtn">${tr("Проверить URL","Check URL")}</button><div id="status" class="status"></div><div id="output"></div><div class="separator"><span>${tr("или вставьте XML","or paste XML")}</span></div><textarea id="xml" class="editor small" placeholder="<urlset>…"></textarea><button id="parse" class="softBtn">${tr("Проверить XML","Check XML")}</button>`;
  const show=r=>output.innerHTML=`<div class="stats"><div><b>${r.count}</b><span>URL</span></div><div><b>${r.unique}</b><span>${tr("уникальных","unique")}</span></div><div><b>${r.duplicates}</b><span>${tr("дублей","duplicates")}</span></div></div>`;
  parse.onclick=()=>{show(parseSitemap(xml.value));status(tr("XML разобран","XML parsed"))};
  run.onclick=async()=>{try{status(tr("Загружаю sitemap…","Loading sitemap…"));const res=await fetch(url.value);if(!res.ok)throw new Error("HTTP "+res.status);const text=await res.text();show(parseSitemap(text));status(tr("Готово","Done"))}catch(e){status(tr("Браузер не дал загрузить sitemap. Вставьте XML ниже.","Browser blocked cross-site loading. Paste the XML below."),"bad")}}
}
function renderWordCounter(){
  root.innerHTML=`<textarea id="input" class="editor tall" placeholder="${tr("Вставьте текст…","Paste text…")}"></textarea><div id="stats" class="stats"></div>`;
  const calc=()=>{const text=input.value.trim(),words=text?text.split(/\s+/).length:0,chars=input.value.length,sent=text?(text.match(/[.!?]+(?=\s|$)/g)||[]).length:0,min=words?Math.max(1,Math.ceil(words/220)):0;stats.innerHTML=`<div><b>${words}</b><span>${tr("слов","words")}</span></div><div><b>${chars}</b><span>${tr("символов","characters")}</span></div><div><b>${sent}</b><span>${tr("предложений","sentences")}</span></div><div><b>${min}</b><span>${tr("мин чтения","min read")}</span></div>`};input.oninput=calc;calc()
}
if(root){
  ({ "pdf-to-jpg":renderPdfToJpg,"merge-pdf":renderMergePdf,"compress-image":()=>renderImageTool(slug),"webp-converter":()=>renderImageTool(slug),"favicon-generator":renderFavicon,"json-formatter":renderJson,"utm-builder":renderUtm,"robots-generator":renderRobots,"sitemap-checker":renderSitemap,"word-counter":renderWordCounter }[slug]||(()=>root.innerHTML="<p>Tool not found.</p>"))();
}
