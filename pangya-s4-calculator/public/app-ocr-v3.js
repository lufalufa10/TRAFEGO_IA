(() => {
  const $ = (id) => document.getElementById(id);
  // Primary calibration mode: Season 4 Tomahawk.
  setTimeout(() => {
    if ($('shot')) $('shot').value='1';
    if ($('spin')) $('spin').value='7';
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

    // Season 4 HUD: wind dial is anchored in the lower-right corner.
    // Restrict analysis to the inner dial so ocean/sky pixels cannot dominate.
    const cx = canvas.width * 0.94;
    const cy = canvas.height * 0.905;
    const radius = Math.min(canvas.width, canvas.height) * 0.062;
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pts = [];
    const r2 = radius * radius;

    for (let y=Math.max(0,Math.floor(cy-radius)); y<=Math.min(canvas.height-1,Math.ceil(cy+radius)); y++) {
      for (let x=Math.max(0,Math.floor(cx-radius)); x<=Math.min(canvas.width-1,Math.ceil(cx+radius)); x++) {
        const dx=x-cx, dy=y-cy;
        if (dx*dx+dy*dy > r2) continue;
        // Ignore the cyan "Xm" speed badge that overlaps the wind dial.
        if (x > cx + radius * 0.18 && y > cy + radius * 0.22) continue;
        const i=(y*canvas.width+x)*4;
        const R=image.data[i], G=image.data[i+1], B=image.data[i+2];
        // Blue/cyan arrow in the S4 wind dial.
        if (B > 125 && G > 70 && B > R + 70 && G > R + 25) pts.push([x,y]);
      }
    }

    if (pts.length < 120) return null;

    let mx=0,my=0;
    for (const p of pts){mx+=p[0];my+=p[1];}
    mx/=pts.length; my/=pts.length;

    let sxx=0,syy=0,sxy=0;
    for (const p of pts){
      const x=p[0]-mx,y=p[1]-my;
      sxx+=x*x; syy+=y*y; sxy+=x*y;
    }
    const tr=sxx+syy;
    const disc=Math.sqrt(Math.max(0,(sxx-syy)*(sxx-syy)+4*sxy*sxy));
    const lambda=(tr+disc)/2;
    let ex,ey;
    if (Math.abs(sxy)>1e-9){ex=lambda-syy;ey=sxy;}
    else if (sxx>=syy){ex=1;ey=0;} else {ex=0;ey=1;}
    const el=Math.hypot(ex,ey)||1; ex/=el; ey/=el;

    const projected=pts.map(p=>{
      const dx=p[0]-mx,dy=p[1]-my;
      return {p:dx*ex+dy*ey,q:-dx*ey+dy*ex};
    });
    let pmin=Infinity,pmax=-Infinity;
    for(const v of projected){if(v.p<pmin)pmin=v.p;if(v.p>pmax)pmax=v.p;}
    const span=pmax-pmin;
    if(span<18) return null;

    // The tail is a rectangle while the arrow tip converges to only a few
    // pixels. Count pixels in the outermost 5% of both ends to disambiguate
    // the direction of the PCA axis.
    const edge = span * 0.05;
    const countMin = projected.filter(v=>v.p>=pmin && v.p<=pmin+edge).length;
    const countMax = projected.filter(v=>v.p>=pmax-edge && v.p<=pmax).length;
    if (Math.min(countMin,countMax) < 2) return null;

    const tipSign = countMax < countMin ? 1 : -1;
    const vx=ex*tipSign, vy=ey*tipSign;
    const degree=normalizeAngle(Math.atan2(vx,-vy)*180/Math.PI);
    const confidence=Math.min(1,Math.abs(countMax-countMin)/Math.max(1,Math.max(countMax,countMin)));
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
      $('shot').value = '1';
      $('spin').value = '7';
      $('curve').value = '0';
      $('slope_break').value = '0';
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
      setStatus('O módulo de OCR não carregou. Confira sua conexão e tente novamente.', 'warn');
      return;
    }

    ocrBtn.disabled = true;
    let worker;
    try {
      setStatus('Lendo o HUD do Season 4…');
      worker = await Tesseract.createWorker('eng', 1, {
        logger: m => {
          if (m.status === 'recognizing text' && Number.isFinite(m.progress)) {
            setStatus('Lendo o HUD… ' + Math.round(m.progress*100) + '%');
          }
        }
      });

      // Crops calibrated against the 800x600 PangYa Brasil S4 screenshot.
      // Ratios keep the same positions when the screenshot is resized.
      const distanceCrop = cropHud(.472,.100,.532,.134,'otsu',10);
      const windCrop     = cropHud(.948,.918,1.000,.988,'gray',10);
      const maxPowerCrop = cropHud(.565,.888,.652,.952,'otsu',10);
      const heightCrop   = cropHud(.458,.035,.550,.090,'gray',12);
      const terrainCrop  = cropHud(.030,.845,.142,.955,'gray',10);

      const distanceRead = await recognizeHudCrop(worker,distanceCrop,'0123456789yY');
      const windRead     = await recognizeHudCrop(worker,windCrop,'0123456789mM');
      const powerRead    = await recognizeHudCrop(worker,maxPowerCrop,'0123456789yY');
      const heightRead   = await recognizeHudCrop(worker,heightCrop,'-+0123456789.,mM');
      const terrainRead  = await recognizeHudCrop(worker,terrainCrop,'0123456789%');

      const debug=[
        'Distância: '+distanceRead.text+' ('+distanceRead.confidence.toFixed(0)+'%)',
        'Vento: '+windRead.text+' ('+windRead.confidence.toFixed(0)+'%)',
        'Potência máx.: '+powerRead.text+' ('+powerRead.confidence.toFixed(0)+'%)',
        'Altura: '+heightRead.text+' ('+heightRead.confidence.toFixed(0)+'%)',
        'Terreno: '+terrainRead.text+' ('+terrainRead.confidence.toFixed(0)+'%)'
      ];
      ocrText.textContent=debug.join('\n');

      const applied=[], missing=[];

      const dm=distanceRead.text.match(/(\d{2,3})/);
      const dv=dm?Number(dm[1]):NaN;
      if(Number.isFinite(dv) && dv>=20 && dv<=500 && distanceRead.confidence>=25){
        $('distance').value=String(dv); applied.push('distância '+dv+'y');
      } else missing.push('distância');

      const wm=windRead.text.match(/(\d{1,2})/);
      const wv=wm?Number(wm[1]):NaN;
      if(Number.isFinite(wv) && wv>=0 && wv<=20 && windRead.confidence>=20){
        $('wind').value=String(wv); applied.push('vento '+wv+'m');
      } else missing.push('vento');

      const pm=powerRead.text.match(/(230|250|270)/);
      if(pm){
        const map={'270':'0','250':'1','230':'2'};
        $('club').value=map[pm[1]];
        applied.push('taco '+(pm[1]==='270'?'1W':pm[1]==='250'?'2W':'3W'));
      }

      const autoAngle=detectWindAngleFromPixels();
      if(autoAngle && autoAngle.confidence>=0.10){
        $('degree').value=autoAngle.degree.toFixed(1);
        applied.push('ângulo '+autoAngle.degree.toFixed(1)+'°');
      } else missing.push('ângulo');

      // Height: preserve the sign and decimal separator.
      // S4 commonly renders values such as -3,65m.
      const hm=heightRead.text.replace(/\s+/g,'').match(/([+-]?\d{1,2}(?:[.,]\d{1,2})?)/);
      let hv=hm ? Number(hm[1].replace(',','.')) : NaN;
      if(Number.isFinite(hv) && hv>=-100 && hv<=100 && heightRead.confidence>=18){
        $('height').value=String(hv).replace('.',',');
        applied.push('altura '+String(hv).replace('.',',')+'m');
      } else {
        $('height').value='';
        missing.push('altura');
      }

      // Terrain / lie percentage around the ball HUD. Accept only plausible lies.
      const tm=terrainRead.text.match(/(100|9[0-9]|8[0-9]|7[0-9]|6[0-9])/);
      const tv=tm ? Number(tm[1]) : NaN;
      if(Number.isFinite(tv) && tv>=60 && tv<=100 && terrainRead.confidence>=15){
        $('ground').value=String(tv);
        applied.push('terreno '+tv+'%');
      } else {
        // Most tee/green lies are 100%, but do not invent the value.
        $('ground').value='';
        missing.push('terreno');
      }

      // This calculator is being calibrated for Tomahawk first.
      $('shot').value='1';
      $('spin').value='7';

      if(applied.length){
        setStatus(
          'Reconheci: '+applied.join(', ')+
          '. Confira antes de calcular.'+
          (missing.length?' Ainda preciso de: '+missing.join(', ')+'.':''),
          missing.length?'warn':'good'
        );
      } else {
        setStatus('Não consegui reconhecer valores confiáveis. Nenhum número duvidoso foi preenchido.', 'warn');
      }
    } catch (err) {
      console.error(err);
      setStatus('Falha ao analisar o print. Nenhum valor duvidoso foi aplicado.', 'warn');
    } finally {
      if(worker){ try{ await worker.terminate(); }catch(_e){} }
      ocrBtn.disabled = false;
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
    const vals={
      distance:n($('distance').value),
      height:n($('height').value),
      wind:n($('wind').value),
      degree:n($('degree').value),
      ground:n($('ground').value)
    };
    const problems=[];
    if(vals.distance===null || vals.distance<20 || vals.distance>500) problems.push('distância');
    if(vals.height===null || vals.height<-100 || vals.height>100) problems.push('altura');
    if(vals.wind===null || vals.wind<0 || vals.wind>20) problems.push('vento');
    if(vals.degree===null || vals.degree<0 || vals.degree>=360) problems.push('ângulo');
    if(vals.ground===null || vals.ground<1 || vals.ground>100) problems.push('terreno');

    if(problems.length){
      $('result').textContent='Preencha/corrija antes de calcular: '+problems.join(', ')+'.';
      $('result').style.color='#fbbf24';
      return;
    }

    try {
      calc($('calculateBtn'));
      const out = $('result').textContent || $('result').innerText;
      if (out && !/não conseguiu/i.test(out)) {
        $('result').closest('.result-box').scrollIntoView({behavior:'smooth',block:'nearest'});
      }
    } catch (e) {
      console.error(e);
      $('result').textContent = 'Erro ao calcular. Revise os campos numéricos.';
      $('result').style.color = '#fb7185';
    }
  });

  // Friendly defaults for the 270/250/230 profile.
  $('club').addEventListener('change', () => {
    const club = Number($('club').value);
    if (club === 0) $('spin').value = '7';
    else if (club === 1) $('spin').value = '8';
    else $('spin').value = '9';
  });
})();