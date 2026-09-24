(() => {
  const $ = (id) => document.getElementById(id);
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
      drawImage();
      wrap.classList.remove('hidden');
      ocrBtn.disabled = false;
      angleBtn.disabled = false;
      invertBtn.disabled = false;
      setStatus(sourceLabel + ' carregado. Clique em “Ler números do print” ou meça o ângulo da seta.', 'good');
      URL.revokeObjectURL(url);
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

    // Wind speed: single digit near the wind indicator, usually right/lower HUD.
    const windCandidates = words.map(w => ({...w, val:n(w.text)}))
      .filter(w => w.val !== null && Number.isInteger(w.val) && w.val >= 0 && w.val <= 9 && w.x > .58 && w.y > .45)
      .sort((a,b) => ((1-a.x)+(1-a.y)) - ((1-b.x)+(1-b.y)));
    if (windCandidates[0]) detected.wind = windCandidates[0].val;

    // Fallback patterns from the full text.
    const text = data.text || '';
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

  ocrBtn.addEventListener('click', async () => {
    if (!originalImage) return;
    if (!window.Tesseract) {
      setStatus('O módulo de OCR não carregou. Confira sua conexão e tente novamente.', 'warn');
      return;
    }
    ocrBtn.disabled = true;
    try {
      setStatus('Lendo o print… isso pode levar alguns segundos.');
      const source = preprocessForOCR();
      const result = await Tesseract.recognize(source, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text' && Number.isFinite(m.progress)) {
            setStatus('Lendo o print… ' + Math.round(m.progress*100) + '%');
          }
        }
      });
      ocrText.textContent = result.data.text || '(nenhum texto detectado)';
      const d = parseOCR(result.data);
      const applied = [];
      for (const key of ['distance','height','wind','ground']) {
        if (d[key] != null && $(key)) {
          $(key).value = d[key];
          applied.push(key);
        }
      }
      if (applied.length) {
        setStatus('Leitura concluída. Preenchi: ' + applied.join(', ') + '. Revise os números e meça o ângulo da seta.', 'good');
      } else {
        setStatus('O OCR rodou, mas não encontrei campos confiáveis. Você pode preencher manualmente e usar o print para medir o ângulo.', 'warn');
      }
    } catch (err) {
      console.error(err);
      setStatus('Falha ao analisar o print. Tente outro print em PNG/JPG ou preencha manualmente.', 'warn');
    } finally {
      ocrBtn.disabled = false;
    }
  });

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
    try {
      // The original engine writes its formatted result into #result.
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