(() => {
  const $ = (id) => document.getElementById(id);
  // Season 4: a Tomahawk requires a Power Shot.
  // Normal Toma = +10y; Power Toma = +20y.
  setTimeout(() => {
    if ($('shot')) $('shot').value='1';
    if ($('power_shot') && $('power_shot').value === '0') $('power_shot').value='1';
  }, 0);
  const input = $('screenshotInput');
  const canvas = $('shotCanvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const wrap = $('canvasWrap');
  const ocrBtn = $('ocrBtn');
  const angleBtn = $('angleBtn');
  const invertBtn = $('invertAngleBtn');
  const status = $('ocrStatus');
  const ocrText = $('ocrText');
  let originalImage = null;
  let clickMode = false;
  let anglePoints = [];

  function setStatus(message, type='') {
    status.textContent = message;
    status.className = 'status' + (type ? ' ' + type : '');
  }

  function n(v) {
    const x = Number(String(v).replace(',', '.').replace(/[^0-9.+-]/g,''));
    return Number.isFinite(x) ? x : null;
  }

  function normalizeAngle(deg) {
    return ((deg % 360) + 360) % 360;
  }

  function drawImage() {
    if (!originalImage) return;
    const maxW = 1280;
    const scale = Math.min(1, maxW / originalImage.naturalWidth);
    canvas.width = Math.round(originalImage.naturalWidth * scale);
    canvas.height = Math.round(originalImage.naturalHeight * scale);
    ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
    drawAngleOverlay();
  }

  function detectWindAngleFromPixels() {
    if (!originalImage || !canvas.width || !canvas.height) return null;

    // Proven S4 HUD geometry (640x480 reference):
    // crop x = width-83, y = height-91, size = 68.
    // Scale proportionally for 800x600 and other 4:3 sizes.
    const sx=canvas.width/640;
    const sy=canvas.height/480;
    const scale=(sx+sy)/2;
    const x0=Math.max(0,Math.round(canvas.width-83*sx));
    const y0=Math.max(0,Math.round(canvas.height-91*sy));
    const size=Math.max(40,Math.round(68*scale));
    const x1=Math.min(canvas.width,x0+size);
    const y1=Math.min(canvas.height,y0+size);
    const w=x1-x0,h=y1-y0;
    if(w<20||h<20)return null;

    const id=ctx.getImageData(x0,y0,w,h);
    const mask=new Uint8Array(w*h);

    // Isolate the cyan wind-arrow sprite.
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const p=y*w+x,i=p*4;
      const R=id.data[i],G=id.data[i+1],B=id.data[i+2];
      mask[p]=(B>105 && G>75 && B>R+45 && G>R+18)?1:0;
    }

    // Connected components; keep the large component closest to dial center.
    const seen=new Uint8Array(mask.length), comps=[];
    const dirs=[-1,1,-w,w,-w-1,-w+1,w-1,w+1];
    for(let p=0;p<mask.length;p++){
      if(!mask[p]||seen[p])continue;
      const st=[p];seen[p]=1;const pts=[];
      while(st.length){
        const q=st.pop(),yy=Math.floor(q/w),xx=q-yy*w;
        pts.push([xx,yy]);
        for(const d of dirs){
          const nq=q+d;
          if(nq<0||nq>=mask.length||seen[nq]||!mask[nq])continue;
          const ny=Math.floor(nq/w),nx=nq-ny*w;
          if(Math.abs(nx-xx)>1||Math.abs(ny-yy)>1)continue;
          seen[nq]=1;st.push(nq);
        }
      }
      if(pts.length>=25){
        let mx=0,my=0;for(const p2 of pts){mx+=p2[0];my+=p2[1];}
        mx/=pts.length;my/=pts.length;
        const dc=Math.hypot(mx-w/2,my-h/2);
        comps.push({pts,mx,my,dc});
      }
    }
    if(!comps.length)return null;
    comps.sort((a,b)=>(b.pts.length-a.pts.length) || (a.dc-b.dc));
    let comp=comps.find(c=>c.dc<size*.25) || comps[0];
    const pts=comp.pts;
    if(pts.length<60)return null;

    let mx=0,my=0;
    for(const p of pts){mx+=p[0];my+=p[1];}
    mx/=pts.length;my/=pts.length;

    let sxx=0,syy=0,sxy=0;
    for(const p of pts){
      const dx=p[0]-mx,dy=p[1]-my;
      sxx+=dx*dx;syy+=dy*dy;sxy+=dx*dy;
    }
    const tr=sxx+syy;
    const disc=Math.sqrt(Math.max(0,(sxx-syy)*(sxx-syy)+4*sxy*sxy));
    const lambda=(tr+disc)/2;
    let ex,ey;
    if(Math.abs(sxy)>1e-9){ex=lambda-syy;ey=sxy;}
    else if(sxx>=syy){ex=1;ey=0;}else{ex=0;ey=1;}
    const len=Math.hypot(ex,ey)||1;ex/=len;ey/=len;

    const projected=pts.map(p=>{
      const dx=p[0]-mx,dy=p[1]-my;
      return {x:p[0],y:p[1],p:dx*ex+dy*ey};
    });
    let pmin=Infinity,pmax=-Infinity;
    for(const v of projected){if(v.p<pmin)pmin=v.p;if(v.p>pmax)pmax=v.p;}
    const span=pmax-pmin;
    if(span<12)return null;

    // The PangYa arrowhead is the brighter cyan end in the S4 sprite.
    // Compare the outer 8% at both PCA ends to avoid choosing the tail.
    const edge=Math.max(2,span*.08);
    const ends=[
      projected.filter(v=>v.p<=pmin+edge),
      projected.filter(v=>v.p>=pmax-edge)
    ];
    if(!ends[0].length||!ends[1].length)return null;

    function endpointInfo(arr){
      let bx=0,by=0,lum=0;
      for(const v of arr){
        bx+=v.x;by+=v.y;
        const ix=Math.max(0,Math.min(w-1,Math.round(v.x)));
        const iy=Math.max(0,Math.min(h-1,Math.round(v.y)));
        const k=(iy*w+ix)*4;
        lum+=id.data[k]*.299+id.data[k+1]*.587+id.data[k+2]*.114;
      }
      return {x:bx/arr.length,y:by/arr.length,lum:lum/arr.length,n:arr.length};
    }
    const e0=endpointInfo(ends[0]),e1=endpointInfo(ends[1]);
    const tip=e1.lum>=e0.lum?e1:e0;
    const tail=e1.lum>=e0.lum?e0:e1;

    const dx=tip.x-tail.x,dy=tip.y-tail.y;
    const degree=normalizeAngle(Math.atan2(dx,-dy)*180/Math.PI);

    const anisotropy=disc/Math.max(1,tr);
    const brightDiff=Math.abs(e1.lum-e0.lum)/Math.max(1,Math.max(e1.lum,e0.lum));
    const confidence=Math.max(0,Math.min(1,.55*anisotropy+.45*brightDiff));

    return {degree,confidence,points:pts.length};
  }

  function drawAngleOverlay() {
    if (!anglePoints.length) return;
    ctx.save();
    ctx.lineWidth = Math.max(2, canvas.width / 500);
    ctx.strokeStyle = '#38bdf8';
    ctx.fillStyle = '#fbbf24';
    for (const p of anglePoints) {
      ctx.beginPath();
      ctx.arc(p.x,p.y,6,0,Math.PI*2);
      ctx.fill();
    }
    if (anglePoints.length === 2) {
      ctx.beginPath();
      ctx.moveTo(anglePoints[0].x, anglePoints[0].y);
      ctx.lineTo(anglePoints[1].x, anglePoints[1].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function loadImageBlob(blob, sourceLabel='print') {
    if (!blob || !/^image\//i.test(blob.type || '')) return false;
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      originalImage = img;
      anglePoints = [];
      clickMode = false;
      // Never keep numbers from a previous OCR attempt.
      $('distance').value = '';
      $('height').value = '';
      $('wind').value = '';
      $('degree').value = '';
      $('ground').value = '';
      // Preserve manual setup, but a Season 4 Tomahawk cannot be "Sem Power Shot".
      if ($('shot')?.value === '1' && $('power_shot')?.value === '0') $('power_shot').value='1';
      drawImage();
      wrap.classList.remove('hidden');
      ocrBtn.disabled = false;
      angleBtn.disabled = false;
      invertBtn.disabled = false;

      const autoAngle = detectWindAngleFromPixels();
      if (autoAngle && autoAngle.confidence >= 0.12) {
        $('degree').value = autoAngle.degree.toFixed(1);
      }

      const angleMsg = autoAngle && autoAngle.confidence >= 0.12
        ? ' Ângulo do vento detectado: ' + autoAngle.degree.toFixed(1) + '°.'
        : ' Não consegui confirmar o ângulo automaticamente; use “Medir ângulo da seta”.';

      setStatus(sourceLabel + ' carregado.' + angleMsg + (sourceLabel.includes('Ctrl+V') ? ' Lendo os números automaticamente…' : ''), 'good');
      URL.revokeObjectURL(url);
      if (sourceLabel.includes('Ctrl+V')) setTimeout(() => runOCR(), 50);
    };
    img.onerror = () => {
      setStatus('Não consegui abrir essa imagem.', 'warn');
      URL.revokeObjectURL(url);
    };
    img.src = url;
    return true;
  }

  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    if (!file) return;
    loadImageBlob(file, 'Print');
  });

  document.addEventListener('paste', (ev) => {
    const items = Array.from(ev.clipboardData?.items || []);
    const imageItem = items.find(item => /^image\//i.test(item.type || ''));
    if (!imageItem) return;
    const blob = imageItem.getAsFile();
    if (!blob) return;
    ev.preventDefault();
    loadImageBlob(blob, 'Imagem colada com Ctrl+V');
  });

  function buildHudOcrCanvas() {
    // Specialized mask for the S4 HUD. Generic OCR struggles with PangYa's
    // outlined fonts, while the important values use distinctive colors:
    // red = pin distance, cyan = wind speed.
    const source = ctx.getImageData(0,0,canvas.width,canvas.height);
    const out = document.createElement('canvas');
    const scale = 6;
    const blockW = Math.max(320, Math.round(canvas.width * 0.24 * scale));
    const blockH = Math.max(120, Math.round(canvas.height * 0.09 * scale));
    out.width = blockW;
    out.height = blockH * 2 + 70;
    const o = out.getContext('2d', {willReadFrequently:true});
    o.fillStyle='white'; o.fillRect(0,0,out.width,out.height);

    function paintRegion(rx0,ry0,rx1,ry1,destY,kind) {
      const x0=Math.floor(canvas.width*rx0), y0=Math.floor(canvas.height*ry0);
      const x1=Math.ceil(canvas.width*rx1), y1=Math.ceil(canvas.height*ry1);
      const rw=Math.max(1,x1-x0), rh=Math.max(1,y1-y0);
      const tmp=document.createElement('canvas');
      tmp.width=rw; tmp.height=rh;
      const t=tmp.getContext('2d');
      const id=t.createImageData(rw,rh);
      for(let yy=0;yy<rh;yy++){
        for(let xx=0;xx<rw;xx++){
          const si=((y0+yy)*canvas.width+(x0+xx))*4;
          const R=source.data[si], G=source.data[si+1], B=source.data[si+2];
          let hit=false;
          if(kind==='red') hit = R>115 && R>G*1.35 && R>B*1.35;
          if(kind==='cyan') hit = B>115 && G>70 && B>R+55 && G>R+20;
          const di=(yy*rw+xx)*4;
          const v=hit?0:255;
          id.data[di]=id.data[di+1]=id.data[di+2]=v; id.data[di+3]=255;
        }
      }
      t.putImageData(id,0,0);
      o.imageSmoothingEnabled=false;
      o.drawImage(tmp,0,0,rw,rh,20,destY,Math.round(rw*scale),Math.round(rh*scale));
    }

    // 228y-style pin distance at top/center.
    paintRegion(.43,.075,.57,.155,15,'red');
    // 6m-style wind badge in the lower-right.
    paintRegion(.91,.89,.995,.995,blockH+45,'cyan');
    return out;
  }

  function cropHud(rx0, ry0, rx1, ry1, mode='gray', scale=10) {
    const x0=Math.max(0,Math.floor(canvas.width*rx0));
    const y0=Math.max(0,Math.floor(canvas.height*ry0));
    const x1=Math.min(canvas.width,Math.ceil(canvas.width*rx1));
    const y1=Math.min(canvas.height,Math.ceil(canvas.height*ry1));
    const w=Math.max(1,x1-x0), h=Math.max(1,y1-y0);

    const raw=document.createElement('canvas');
    raw.width=w; raw.height=h;
    const rctx=raw.getContext('2d',{willReadFrequently:true});
    rctx.drawImage(canvas,x0,y0,w,h,0,0,w,h);

    const id=rctx.getImageData(0,0,w,h);
    const gray=new Uint8Array(w*h);
    const hist=new Uint32Array(256);
    for(let i=0,p=0;i<id.data.length;i+=4,p++){
      const g=Math.round(id.data[i]*0.299+id.data[i+1]*0.587+id.data[i+2]*0.114);
      gray[p]=g; hist[g]++;
    }

    let threshold=128;
    if(mode==='otsu'){
      const total=w*h;
      let sum=0; for(let i=0;i<256;i++) sum+=i*hist[i];
      let sumB=0,wB=0,maxVar=-1;
      for(let t=0;t<256;t++){
        wB+=hist[t]; if(!wB) continue;
        const wF=total-wB; if(!wF) break;
        sumB+=t*hist[t];
        const mB=sumB/wB, mF=(sum-sumB)/wF;
        const between=wB*wF*(mB-mF)*(mB-mF);
        if(between>maxVar){maxVar=between;threshold=t;}
      }
    }

    const bw=document.createElement('canvas');
    bw.width=w; bw.height=h;
    const bctx=bw.getContext('2d');
    const out=bctx.createImageData(w,h);
    for(let p=0;p<gray.length;p++){
      const v=mode==='otsu' ? (gray[p]>threshold?255:0) : gray[p];
      const i=p*4; out.data[i]=out.data[i+1]=out.data[i+2]=v; out.data[i+3]=255;
    }
    bctx.putImageData(out,0,0);

    const scaled=document.createElement('canvas');
    scaled.width=w*scale; scaled.height=h*scale;
    const sctx=scaled.getContext('2d');
    sctx.imageSmoothingEnabled = mode!=='otsu';
    sctx.drawImage(bw,0,0,scaled.width,scaled.height);
    return scaled;
  }

  async function recognizeHudCrop(worker, cropCanvas, whitelist) {
    await worker.setParameters({
      tessedit_char_whitelist: whitelist,
      tessedit_pageseg_mode: '7',
      preserve_interword_spaces: '0'
    });
    const {data}=await worker.recognize(cropCanvas);
    return {text:(data.text||'').trim(), confidence:Number(data.confidence)||0};
  }


  function colorComponents(rx0, ry0, rx1, ry1, kind) {
    const x0=Math.max(0,Math.floor(canvas.width*rx0));
    const y0=Math.max(0,Math.floor(canvas.height*ry0));
    const x1=Math.min(canvas.width,Math.ceil(canvas.width*rx1));
    const y1=Math.min(canvas.height,Math.ceil(canvas.height*ry1));
    const w=Math.max(1,x1-x0), h=Math.max(1,y1-y0);
    const data=ctx.getImageData(x0,y0,w,h).data;
    const mask=new Uint8Array(w*h);

    for(let p=0,i=0;p<mask.length;p++,i+=4){
      const R=data[i],G=data[i+1],B=data[i+2];
      let hit=false;
      if(kind==='red') hit=R>125 && R>G*1.35 && R>B*1.35;
      else if(kind==='cyan') hit=B>120 && G>70 && B>R+45 && G>R+18;
      else if(kind==='green') hit=G>105 && G>R*1.20 && G>B*0.72;
      mask[p]=hit?1:0;
    }

    const seen=new Uint8Array(mask.length);
    const comps=[];
    const dirs=[-1,1,-w,w,-w-1,-w+1,w-1,w+1];

    for(let p=0;p<mask.length;p++){
      if(!mask[p]||seen[p]) continue;
      const stack=[p]; seen[p]=1;
      let minX=w,minY=h,maxX=0,maxY=0,area=0;
      while(stack.length){
        const q=stack.pop(), y=Math.floor(q/w), x=q-y*w;
        area++; if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
        for(const d of dirs){
          const nq=q+d;
          if(nq<0||nq>=mask.length||seen[nq]||!mask[nq]) continue;
          const ny=Math.floor(nq/w), nx=nq-ny*w;
          if(Math.abs(nx-x)>1||Math.abs(ny-y)>1) continue;
          seen[nq]=1; stack.push(nq);
        }
      }
      comps.push({x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1,area});
    }
    return {mask,w,h,x0,y0,comps};
  }

  function holeInfo(region, comp) {
    const {mask,w}=region;
    const bw=comp.w+2, bh=comp.h+2;
    const local=new Uint8Array(bw*bh);
    for(let yy=0;yy<comp.h;yy++){
      for(let xx=0;xx<comp.w;xx++){
        if(mask[(comp.y+yy)*w+(comp.x+xx)]) local[(yy+1)*bw+(xx+1)]=1;
      }
    }

    const outside=new Uint8Array(local.length);
    const stack=[];
    for(let x=0;x<bw;x++){stack.push(x);stack.push((bh-1)*bw+x);}
    for(let y=0;y<bh;y++){stack.push(y*bw);stack.push(y*bw+bw-1);}
    while(stack.length){
      const p=stack.pop();
      if(p<0||p>=local.length||outside[p]||local[p]) continue;
      outside[p]=1;
      const y=Math.floor(p/bw),x=p-y*bw;
      if(x>0)stack.push(p-1);if(x<bw-1)stack.push(p+1);
      if(y>0)stack.push(p-bw);if(y<bh-1)stack.push(p+bw);
    }

    const seen=new Uint8Array(local.length);
    const holes=[];
    for(let p=0;p<local.length;p++){
      if(local[p]||outside[p]||seen[p])continue;
      const q=[p];seen[p]=1;let sumX=0,sumY=0,count=0;
      while(q.length){
        const v=q.pop(),y=Math.floor(v/bw),x=v-y*bw;
        sumX+=x;sumY+=y;count++;
        const ns=[];
        if(x>0)ns.push(v-1);if(x<bw-1)ns.push(v+1);
        if(y>0)ns.push(v-bw);if(y<bh-1)ns.push(v+bw);
        for(const nv of ns){
          if(!local[nv]&&!outside[nv]&&!seen[nv]){seen[nv]=1;q.push(nv);}
        }
      }
      if(count>=1)holes.push({x:sumX/count,y:sumY/count,count});
    }
    return holes;
  }

  function glyphCanvas(region, comp, scale=12) {
    const pad=3, w=comp.w+pad*2, h=comp.h+pad*2;
    const small=document.createElement('canvas');
    small.width=w;small.height=h;
    const s=small.getContext('2d');
    s.fillStyle='white';s.fillRect(0,0,w,h);
    s.fillStyle='black';
    for(let yy=0;yy<comp.h;yy++){
      for(let xx=0;xx<comp.w;xx++){
        if(region.mask[(comp.y+yy)*region.w+(comp.x+xx)])s.fillRect(xx+pad,yy+pad,1,1);
      }
    }
    const out=document.createElement('canvas');
    out.width=w*scale;out.height=h*scale;
    const o=out.getContext('2d');o.imageSmoothingEnabled=false;
    o.drawImage(small,0,0,out.width,out.height);
    return out;
  }

  async function readGlyph(worker, region, comp) {
    const holes=holeInfo(region,comp);
    if(holes.length>=2)return '8';
    if(comp.w/Math.max(1,comp.h)<0.34)return '1';

    await worker.setParameters({
      tessedit_char_whitelist:'0123456789',
      tessedit_pageseg_mode:'10'
    });
    const {data}=await worker.recognize(glyphCanvas(region,comp));
    let d=((data.text||'').match(/\d/)||[])[0]||'';

    if(holes.length===1){
      const hy=(holes[0].y-1)/Math.max(1,comp.h);
      if(!d || d==='5' || d==='3'){
        if(hy>0.57)d='6';
        else if(hy<0.43)d='9';
        else d='0';
      }
    }
    return d;
  }

  async function readDistanceFromHud(worker) {
    // S4 640x480/800x600: red pin distance is centered around x≈50%, y≈13%.
    // Read the whole token first ("232y"), then fall back to per-glyph reading.
    const x0=Math.floor(canvas.width*.445), y0=Math.floor(canvas.height*.105);
    const x1=Math.ceil(canvas.width*.565), y1=Math.ceil(canvas.height*.185);
    const w=Math.max(1,x1-x0), h=Math.max(1,y1-y0);

    const raw=document.createElement('canvas');
    raw.width=w;raw.height=h;
    const rr=raw.getContext('2d',{willReadFrequently:true});
    const src=ctx.getImageData(x0,y0,w,h);
    const out=rr.createImageData(w,h);

    for(let p=0,i=0;p<w*h;p++,i+=4){
      const R=src.data[i],G=src.data[i+1],B=src.data[i+2];
      const hit=R>115 && R>G*1.28 && R>B*1.28;
      const v=hit?0:255;
      out.data[i]=out.data[i+1]=out.data[i+2]=v;out.data[i+3]=255;
    }
    rr.putImageData(out,0,0);

    const big=document.createElement('canvas');
    big.width=w*10;big.height=h*10;
    const br=big.getContext('2d');
    br.imageSmoothingEnabled=false;
    br.fillStyle='white';br.fillRect(0,0,big.width,big.height);
    br.drawImage(raw,0,0,big.width,big.height);

    await worker.setParameters({
      tessedit_char_whitelist:'0123456789yY',
      tessedit_pageseg_mode:'7'
    });
    const {data}=await worker.recognize(big);
    const token=(data.text||'').replace(/\s+/g,'');
    const m=token.match(/(\d{2,3})/);
    if(m){
      const v=Number(m[1]);
      if(v>=20&&v<=500)return v;
    }

    // Fallback to connected red glyphs.
    const r=colorComponents(.445,.105,.565,.185,'red');
    const comps=r.comps
      .filter(x=>x.area>=8&&x.h>=6)
      .sort((a,b)=>a.x-b.x);
    const digits=[];
    for(const comp of comps){
      if(digits.length>=3)break;
      // Ignore the final "y" by accepting only OCR digits.
      const d=await readGlyph(worker,r,comp);
      if(d)digits.push(d);
    }
    const value=Number(digits.join(''));
    return Number.isFinite(value)&&value>=20&&value<=500?value:null;
  }

  async function readWindFromHud(worker) {
    const r=colorComponents(.952,.925,.995,.982,'cyan');
    const comps=r.comps
      .filter(x=>x.area>=10&&x.h>=7&&x.w/x.h<1.25)
      .sort((a,b)=>b.area-a.area);
    if(!comps.length)return null;
    const d=await readGlyph(worker,r,comps[0]);
    const value=Number(d);
    return Number.isFinite(value)&&value>=0&&value<=20?value:null;
  }

  function readGroundFromHud() {
    const r=colorComponents(.086,.875,.142,.925,'green');
    const comps=r.comps.filter(x=>x.area>=8&&x.h>=7).sort((a,b)=>a.x-b.x);
    // In this S4 HUD the 100% lie is partially covered by the power-bar frame,
    // but the leading "1" and first "0" remain stable.
    if(comps.length>=2){
      const first=comps[0], second=comps[1];
      const firstIsOne=first.w/Math.max(1,first.h)<0.45;
      const secondIsZero=holeInfo(r,second).length===1;
      if(firstIsOne&&secondIsZero)return 100;
    }
    return null;
  }

  function cropHudAdaptive(rx0,ry0,rx1,ry1,scale=12) {
    const x0=Math.max(0,Math.floor(canvas.width*rx0));
    const y0=Math.max(0,Math.floor(canvas.height*ry0));
    const x1=Math.min(canvas.width,Math.ceil(canvas.width*rx1));
    const y1=Math.min(canvas.height,Math.ceil(canvas.height*ry1));
    const w=Math.max(1,x1-x0),h=Math.max(1,y1-y0);

    const base=document.createElement('canvas');
    base.width=w*scale;base.height=h*scale;
    const b=base.getContext('2d',{willReadFrequently:true});
    b.imageSmoothingEnabled=true;
    b.drawImage(canvas,x0,y0,w,h,0,0,base.width,base.height);
    const id=b.getImageData(0,0,base.width,base.height);
    const W=base.width,H=base.height;
    const gray=new Uint8Array(W*H);
    for(let p=0,i=0;p<gray.length;p++,i+=4)
      gray[p]=Math.round(id.data[i]*.299+id.data[i+1]*.587+id.data[i+2]*.114);

    const integral=new Float64Array((W+1)*(H+1));
    for(let y=1;y<=H;y++){
      let row=0;
      for(let x=1;x<=W;x++){
        row+=gray[(y-1)*W+(x-1)];
        integral[y*(W+1)+x]=integral[(y-1)*(W+1)+x]+row;
      }
    }

    const out=b.createImageData(W,H),rad=15,C=5;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const ax=Math.max(0,x-rad),ay=Math.max(0,y-rad);
      const bx=Math.min(W-1,x+rad),by=Math.min(H-1,y+rad);
      const A=integral[ay*(W+1)+ax],B=integral[ay*(W+1)+(bx+1)];
      const D=integral[(by+1)*(W+1)+ax],E=integral[(by+1)*(W+1)+(bx+1)];
      const mean=(E-B-D+A)/((bx-ax+1)*(by-ay+1));
      const v=gray[y*W+x] > mean-C ? 255 : 0;
      const i=(y*W+x)*4;out.data[i]=out.data[i+1]=out.data[i+2]=v;out.data[i+3]=255;
    }
    b.putImageData(out,0,0);
    return base;
  }

  function heightIsNegative() {
    // The sign sits immediately before the height text near the top-center.
    const x0=Math.floor(canvas.width*.505),x1=Math.ceil(canvas.width*.535);
    const y0=Math.floor(canvas.height*.050),y1=Math.ceil(canvas.height*.090);
    const id=ctx.getImageData(x0,y0,Math.max(1,x1-x0),Math.max(1,y1-y0)).data;
    let dark=0;
    for(let i=0;i<id.length;i+=4){
      const g=id[i]*.299+id[i+1]*.587+id[i+2]*.114;
      if(g<105)dark++;
    }
    return dark>=10;
  }

  async function readHeightFromHud(worker) {
    // Expanded crop: the previous V6 crop cut off the lower part of "-7.53m"
    // on 640x480 Season 4 screenshots.
    const crop=cropHudAdaptive(.505,.045,.615,.105,12);
    await worker.setParameters({
      tessedit_char_whitelist:'-+0123456789.,mM',
      tessedit_pageseg_mode:'7'
    });
    const {data}=await worker.recognize(crop);
    const raw=(data.text||'').replace(/\s+/g,'');

    let value=null;
    let m=raw.match(/([+-]?)(\d{1,2})[.,](\d{1,2})/);
    if(m){
      value=Number(m[2]+'.'+m[3]);
      if(m[1]==='-')value*=-1;
    }else{
      const only=(raw.match(/\d+/)||[])[0]||'';
      if(only.length===3)value=Number(only[0]+'.'+only.slice(1));
      else if(only.length===4)value=Number(only.slice(0,2)+'.'+only.slice(2));
      if(value!==null&&heightIsNegative())value*=-1;
    }

    // If OCR got the magnitude but missed the minus glyph, use the HUD sign detector.
    if(value!==null && value>0 && !/^\+/.test(raw) && heightIsNegative()) value*=-1;

    return {
      value:Number.isFinite(value)&&Math.abs(value)<=100?value:null,
      raw,
      confidence:Number(data.confidence)||0
    };
  }

  function preprocessForOCR() {
    const temp = document.createElement('canvas');
    const scale = canvas.width < 1400 ? 2 : 1;
    temp.width = canvas.width * scale;
    temp.height = canvas.height * scale;
    const t = temp.getContext('2d', { willReadFrequently: true });
    t.imageSmoothingEnabled = true;
    t.drawImage(canvas,0,0,temp.width,temp.height);
    const image = t.getImageData(0,0,temp.width,temp.height);
    const d = image.data;
    for (let i=0;i<d.length;i+=4) {
      const lum = 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
      const v = lum > 155 ? 255 : lum < 70 ? 0 : Math.max(0,Math.min(255,(lum-70)*3));
      d[i]=d[i+1]=d[i+2]=v;
    }
    t.putImageData(image,0,0);
    return temp;
  }

  function parseOCR(data) {
    const words = (data.words || []).map(w => ({
      text: (w.text || '').trim(),
      x: ((w.bbox.x0 + w.bbox.x1)/2) / (data.imageSize?.width || 1),
      y: ((w.bbox.y0 + w.bbox.y1)/2) / (data.imageSize?.height || 1),
      conf: w.confidence || 0
    })).filter(w => w.text);

    const detected = {};

    // Pin distance usually appears in the upper/central area with a "y".
    const yd = words.map(w => ({...w, val:n(w.text)}))
      .filter(w => /y/i.test(w.text) && w.val !== null && w.val >= 20 && w.val <= 600)
      .sort((a,b) => ((Math.abs(a.x-.5)*1.5 + a.y) - (Math.abs(b.x-.5)*1.5 + b.y)));
    if (yd[0]) detected.distance = yd[0].val;

    // Height usually appears close to the pin distance, often signed and ending in m.
    const hm = words.map(w => ({...w, val:n(w.text)}))
      .filter(w => /m/i.test(w.text) && w.val !== null && Math.abs(w.val) <= 150 && w.y < .55)
      .sort((a,b) => ((Math.abs(a.x-.5)*1.5 + a.y) - (Math.abs(b.x-.5)*1.5 + b.y)));
    if (hm[0]) detected.height = hm[0].val;

    // Terrain % tends to be near the lower HUD.
    const pc = words.map(w => ({...w, val:n(w.text)}))
      .filter(w => /%/.test(w.text) && w.val !== null && w.val >= 60 && w.val <= 100)
      .sort((a,b) => b.y-a.y);
    if (pc[0]) detected.ground = pc[0].val;

    // Wind speed: in S4 the indicator lives near the lower-right corner.
    // Prefer values carrying the "m" suffix inside the expected HUD region.
    const lowerRightM = words.map(w => ({...w, val:n(w.text)}))
      .filter(w => /m/i.test(w.text) && w.val !== null && w.val >= 0 && w.val <= 9 && w.x > .72 && w.y > .55)
      .sort((a,b) => (Math.abs(a.x-.94)+Math.abs(a.y-.88)) - (Math.abs(b.x-.94)+Math.abs(b.y-.88)));
    const windCandidates = words.map(w => ({...w, val:n(w.text)}))
      .filter(w => w.val !== null && Number.isInteger(w.val) && w.val >= 0 && w.val <= 9 && w.x > .72 && w.y > .55)
      .sort((a,b) => (Math.abs(a.x-.94)+Math.abs(a.y-.88)) - (Math.abs(b.x-.94)+Math.abs(b.y-.88)));
    if (lowerRightM[0]) detected.wind = lowerRightM[0].val;
    else if (windCandidates[0]) detected.wind = windCandidates[0].val;

    // Club / special shot text can also be present in the lower HUD.
    const text = data.text || '';
    const upperText = text.toUpperCase();
    if (/\b1\s*W\b/.test(upperText)) detected.club = '0';
    else if (/\b2\s*W\b/.test(upperText)) detected.club = '1';
    else if (/\b3\s*W\b/.test(upperText)) detected.club = '2';

    if (/TOMA(?:HAWK)?/.test(upperText)) detected.shot = '1';
    else if (/SPIKE/.test(upperText)) detected.shot = '2';
    else if (/COBRA/.test(upperText)) detected.shot = '3';

    // Fallback patterns from the full text.
    if (detected.distance == null) {
      const m = text.match(/(?:^|\s)(\d{2,3}(?:[.,]\d+)?)\s*y\b/i);
      if (m) detected.distance = n(m[1]);
    }
    if (detected.height == null) {
      const m = text.match(/([+-]?\d{1,3}(?:[.,]\d+)?)\s*m\b/i);
      if (m) detected.height = n(m[1]);
    }
    if (detected.ground == null) {
      const m = text.match(/\b(100|9[0-9]|8[0-9]|7[0-9])\s*%/);
      if (m) detected.ground = n(m[1]);
    }
    return detected;
  }

  async function runOCR() {
    if (!originalImage) return;
    if (!window.Tesseract) {
      setStatus('O módulo de leitura não carregou. Confira sua conexão.', 'warn');
      return;
    }

    ocrBtn.disabled=true;
    let worker;
    try{
      setStatus('Lendo cada região do HUD do Season 4…');
      worker=await Tesseract.createWorker('eng',1,{
        logger:m=>{
          if(m.status==='recognizing text'&&Number.isFinite(m.progress))
            setStatus('Analisando HUD… '+Math.round(m.progress*100)+'%');
        }
      });

      const distance=await readDistanceFromHud(worker);
      const wind=await readWindFromHud(worker);
      const heightInfo=await readHeightFromHud(worker);
      const ground=readGroundFromHud();
      const autoAngle=detectWindAngleFromPixels();

      const applied=[],missing=[];
      if(distance!==null){$('distance').value=String(distance);applied.push('distância '+distance+'y');}
      else{$('distance').value='';missing.push('distância');}

      if(wind!==null){$('wind').value=String(wind);applied.push('vento '+wind+'m');}
      else{$('wind').value='';missing.push('vento');}

      if(heightInfo.value!==null){
        $('height').value=String(heightInfo.value).replace('.',',');
        applied.push('altura '+String(heightInfo.value).replace('.',',')+'m');
      }else{$('height').value='';missing.push('altura');}

      if(ground!==null){$('ground').value=String(ground);applied.push('terreno '+ground+'%');}
      else{$('ground').value='';missing.push('terreno');}

      if(autoAngle&&autoAngle.confidence>=.10){
        $('degree').value=autoAngle.degree.toFixed(1);
        applied.push('ângulo '+autoAngle.degree.toFixed(1)+'°');
      }else{$('degree').value='';missing.push('ângulo');}

      ocrText.textContent=[
        'Leitor S4 V4',
        'Distância: '+(distance??'não reconhecida'),
        'Altura OCR bruto: '+(heightInfo.raw||'—')+' -> '+(heightInfo.value??'não reconhecida'),
        'Vento: '+(wind??'não reconhecido'),
        'Ângulo: '+(autoAngle?autoAngle.degree.toFixed(1)+'°':'não reconhecido'),
        'Terreno: '+(ground??'não reconhecido')
      ].join('\n');

      if(missing.length===0)setStatus('HUD reconhecido automaticamente. Confira os valores e calcule.', 'good');
      else setStatus('Reconheci: '+applied.join(', ')+'. Faltou: '+missing.join(', ')+'.', 'warn');
    }catch(err){
      console.error(err);
      setStatus('Erro no leitor S4. Nenhum valor duvidoso será inventado.', 'warn');
    }finally{
      if(worker){try{await worker.terminate();}catch(_e){}}
      ocrBtn.disabled=false;
    }
  }

  ocrBtn.addEventListener('click', runOCR);

  angleBtn.addEventListener('click', () => {
    if (!originalImage) return;
    clickMode = true;
    anglePoints = [];
    drawImage();
    setStatus('Modo ângulo: clique primeiro no CENTRO do indicador de vento e depois na PONTA da seta.', 'warn');
  });

  canvas.addEventListener('click', (ev) => {
    if (!clickMode) return;
    const r = canvas.getBoundingClientRect();
    const x = (ev.clientX-r.left) * canvas.width/r.width;
    const y = (ev.clientY-r.top) * canvas.height/r.height;
    anglePoints.push({x,y});
    drawImage();
    if (anglePoints.length === 1) {
      setStatus('Centro marcado. Agora clique na PONTA da seta do vento.', 'warn');
      return;
    }
    const a = anglePoints[0], b = anglePoints[1];
    const dx = b.x-a.x;
    const dy = b.y-a.y;
    // 0° = para cima na tela, 90° = direita, 180° = baixo, 270° = esquerda.
    const deg = normalizeAngle(Math.atan2(dx, -dy) * 180/Math.PI);
    $('degree').value = deg.toFixed(1);
    clickMode = false;
    setStatus('Ângulo medido: ' + deg.toFixed(1) + '°. Se o sentido estiver invertido no jogo, use “Inverter 180°”.', 'good');
  });

  invertBtn.addEventListener('click', () => {
    const v = n($('degree').value);
    if (v == null) return;
    $('degree').value = normalizeAngle(v + 180).toFixed(1);
    setStatus('Ângulo invertido em 180°: ' + $('degree').value + '°.', 'good');
  });

  $('calculateBtn').addEventListener('click', () => {
    if ($('shot')?.value === '1' && $('power_shot')?.value === '0') {
      $('power_shot').value='1';
    }
    const vals={
      distance:n($('distance').value),
      height:n($('height').value),
      wind:n($('wind').value),
      degree:n($('degree').value),
      ground:n($('ground').value),
      spin:n($('spin').value),
      spinCap:n($('spin_cap')?.value)
    };
    const problems=[];
    if(vals.distance===null || vals.distance<20 || vals.distance>500) problems.push('distância');
    if(vals.height===null || vals.height<-100 || vals.height>100) problems.push('altura');
    if(vals.wind===null || vals.wind<0 || vals.wind>20) problems.push('vento');
    if(vals.degree===null || vals.degree<0 || vals.degree>=360) problems.push('ângulo');
    if(vals.ground===null || vals.ground<1 || vals.ground>100) problems.push('terreno');
    if(vals.spin===null || vals.spin<0 || vals.spin>30) problems.push('spin aplicado');
    if(vals.spinCap===null || vals.spinCap<0 || vals.spinCap>30) problems.push('spin máximo');
    if(vals.spin!==null && vals.spinCap!==null && vals.spin>vals.spinCap) problems.push('spin aplicado acima do máximo do personagem');

    if(problems.length){
      $('result').textContent='Preencha/corrija antes de calcular: '+problems.join(', ')+'.';
      $('result').style.color='#fbbf24';
      return;
    }

    try {
      calc($('calculateBtn'));
      const out = $('result').textContent || $('result').innerText;

      const warnings=[];
      if(vals.wind!==null && vals.wind>=5 && vals.degree!==null){
        const axisRisk=Math.min(
          Math.abs(vals.degree),
          Math.abs(vals.degree-180),
          Math.abs(vals.degree-360)
        );
        if(axisRisk<=20) warnings.push('vento forte em ângulo sensível: confirme o ângulo no pixel');
      }
      const slopeValue=n($('slope_break').value);
      if(slopeValue===0) warnings.push('slope 0 assumida: confirme se a bola está realmente reta');
      const warnEl=$('accuracyWarning');
      if(warnEl){
        warnEl.textContent=warnings.length ? '⚠ '+warnings.join(' · ') : '✓ Sem alerta crítico de entrada';
        warnEl.className='status '+(warnings.length?'warn':'good');
      }

      if (out && !/não conseguiu/i.test(out)) {
        $('result').closest('.result-box').scrollIntoView({behavior:'smooth',block:'nearest'});
      }
    } catch (e) {
      console.error(e);
      $('result').textContent = 'Erro ao calcular. Revise os campos numéricos.';
      $('result').style.color = '#fb7185';
    }
  });

  // Season 4 special-shot semantics.
  $('shot')?.addEventListener('change', () => {
    if ($('shot').value === '1' && $('power_shot')?.value === '0') {
      $('power_shot').value='1';
    }
  });

  // Do not change spin automatically when the club changes.
})();