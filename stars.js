(function(){
	// substitui a implementação por uma versão otimizada com camada estática + poucas estrelas animadas

	const canvas = document.getElementById('stars');
	const ctx = canvas.getContext('2d', { alpha: true });

	let w = 0, h = 0;
	let DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));
	// offscreen canvas para estrelas estáticas (pré-render)
	let staticCanvas = document.createElement('canvas');
	let staticCtx = staticCanvas.getContext('2d');
	let staticCount = 0;

	// estrelas animadas (muito menos que as estáticas)
	let animStars = [];
	let animCount = 120; // valor base; será ajustado no resize

	// debounce resize
	let resizeTimer = null;

	function rand(min,max){ return Math.random()*(max-min)+min }

	function buildStaticLayer(){
		staticCanvas.width = Math.max(1, Math.round(w * DPR));
		staticCanvas.height = Math.max(1, Math.round(h * DPR));
		staticCtx.clearRect(0,0,staticCanvas.width, staticCanvas.height);
		// escala para DPR
		staticCtx.save();
		staticCtx.scale(DPR, DPR);

		// calcula contagem estática proporcional à área, mas com cap
		staticCount = Math.min(1400, Math.round((w*h)/4500));
		for(let i=0;i<staticCount;i++){
			const x = Math.random()*w;
			const y = Math.random()*h;
			const r = (Math.random() < 0.92) ? rand(0.3,0.9) : rand(1.2,2.6);
			const a = (Math.random()*0.7 + 0.2) * (r>1?0.9:1);
			// cor ligeiramente azulada
			const hue = rand(190,210);
			staticCtx.beginPath();
			staticCtx.fillStyle = `hsla(${hue},80%,88%,${a})`;
			// desenha sem shadow (muito mais rápido)
			staticCtx.arc(x, y, r, 0, Math.PI*2);
			staticCtx.fill();
			staticCtx.closePath();
		}

		// algumas nebulosas/soft blobs discretas (poucas)
		for(let b=0;b<6;b++){
			const bx = Math.random()*w;
			const by = Math.random()*h;
			const br = rand(Math.min(w,h)*0.06, Math.min(w,h)*0.18);
			let g = staticCtx.createRadialGradient(bx,by,0,bx,by,br);
			g.addColorStop(0, 'rgba(120,150,255,0.06)');
			g.addColorStop(1, 'rgba(0,0,0,0)');
			staticCtx.fillStyle = g;
			staticCtx.beginPath();
			staticCtx.arc(bx,by,br,0,Math.PI*2);
			staticCtx.fill();
			staticCtx.closePath();
		}

		staticCtx.restore();
	}

	function createAnimStar(){
		const z = Math.pow(Math.random(),2)*0.9 + 0.1;
		return {
			x: Math.random()*w,
			y: Math.random()*h,
			r: rand(0.6,1.8) * (1 + (1-z)*1.5),
			z,
			speed: rand(0.02,0.18) * (1 + (1-z)*2),
			phase: Math.random()*Math.PI*2,
			hue: rand(185,210)
		};
	}

	function rebuildAnimStars(){
		animStars.length = 0;
		// animCount proporcional à área, com limites
		animCount = Math.min(220, Math.max(30, Math.round((w*h)/90000)));
		for(let i=0;i<animCount;i++) animStars.push(createAnimStar());
	}

	function resize(){
		// tamanho CSS (1x) e canvas pixel size será ajustado no offscreen and main
		w = canvas.clientWidth = innerWidth;
		h = canvas.clientHeight = innerHeight;
		// ajusta DPR (limita para evitar muito custo em displays super-densos)
		DPR = Math.max(1, Math.min(2, Math.floor(window.devicePixelRatio || 1)));

		// ajusta canvas real pixels
		canvas.width = Math.round(w * DPR);
		canvas.height = Math.round(h * DPR);
		canvas.style.width = w + 'px';
		canvas.style.height = h + 'px';
		ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

		buildStaticLayer();
		rebuildAnimStars();
	}

	function scheduleResize(){
		if(resizeTimer) clearTimeout(resizeTimer);
		resizeTimer = setTimeout(() => { resizeTimer = null; resize(); }, 140);
	}

	// animação leve
	function draw(){
		const warp = isWarp();
		// quando em warp, preservamos um pouco do frame anterior para trails; caso contrário fazemos clear
		if(warp){
			// desenha camada estática
			ctx.drawImage(staticCanvas, 0, 0, staticCanvas.width/DPR, staticCanvas.height/DPR);
			// aplica uma leve camada sem apagar totalmente para gerar rastro (valor baixo para não acumular muito)
			ctx.fillStyle = 'rgba(2,4,8,0.12)';
			ctx.fillRect(0,0,w,h);
		} else {
			// normal: limpa totalmente e desenha estático
			ctx.clearRect(0,0,w,h);
			ctx.drawImage(staticCanvas, 0, 0, staticCanvas.width/DPR, staticCanvas.height/DPR);
		}

		// animação das estrelas
		const now = Date.now();
		const speedMul = warp ? 4.5 : 1; // acelera bastante em warp, mas mantém limite
		for(let i=0;i<animStars.length;i++){
			const s = animStars[i];
			// movimento simples com multiplicador
			const drift = Math.sin((s.phase + now*0.00005)*(1+s.z)) * 0.02 * (1+s.z);
			s.y += s.speed * speedMul;
			s.x += drift * speedMul;
			s.phase += 0.01 + s.z*0.02;

			if(s.y > h + 6) s.y = -6;
			if(s.x > w + 10) s.x = -10;
			if(s.x < -10) s.x = w + 10;

			// twinkle
			const tw = 0.5 + 0.5*Math.sin(s.phase*1.5 + s.x*0.001);
			const alpha = 0.35 + 0.65*tw * (0.4 + 0.6*s.z);

			// núcleo (sempre desenha)
			ctx.beginPath();
			ctx.fillStyle = `rgba(255,255,255,${Math.min(1,0.6*tw)})`;
			ctx.arc(s.x, s.y, s.r*0.45, 0, Math.PI*2);
			ctx.fill();
			ctx.closePath();

			// glow leve (mais intenso em warp)
			if(s.r > 1.1){
				ctx.save();
				ctx.globalAlpha = Math.min(0.35, alpha*0.6) * (warp?1.1:1);
				ctx.fillStyle = `hsla(${s.hue},85%,88%,1)`;
				ctx.beginPath();
				ctx.arc(s.x, s.y, s.r*1.8, 0, Math.PI*2);
				ctx.fill();
				ctx.closePath();
				ctx.restore();
			}

			// se em warp, desenha um streak rápido baseado na direção — usa fillRect (barato)
			if(warp){
				const dx = drift;
				const dy = s.speed;
				const len = Math.min(32, 8 + s.r * 12);
				ctx.save();
				ctx.globalAlpha = 0.06 + 0.12 * (s.z); // mais visível para estrelas próximas
				ctx.fillStyle = 'rgba(200,230,255,1)';
				// pequeno retângulo alongado na direção do movimento
				ctx.translate(s.x, s.y);
				const angle = Math.atan2(dy, dx || 0.0001);
				ctx.rotate(angle);
				ctx.fillRect(-len*0.9, -Math.max(0.6, s.r*0.4), len, Math.max(1, s.r*0.9));
				ctx.restore();
			}
		}

		// poucas estrelas grandes com glow (atualiza posição com o tempo)
		for(let k=0, K=6;k<K;k++){
			const x = (k*97 + (now*0.015*k)) % w;
			const y = (h*0.12 + Math.sin((now*0.0004)+k)*h*0.045);
			const radius = Math.min(w,h)*0.04;
			ctx.save();
			const gg = ctx.createRadialGradient(x,y,0,x,y,radius);
			const alpha = warp ? 0.12 : 0.08;
			gg.addColorStop(0, `rgba(180,220,255,${alpha})`);
			gg.addColorStop(1, 'rgba(0,0,0,0)');
			ctx.fillStyle = gg;
			ctx.beginPath();
			ctx.arc(x,y,radius,0,Math.PI*2);
			ctx.fill();
			ctx.closePath();
			ctx.restore();
		}

		requestAnimationFrame(draw);
	}

	// adiciona utilitário para detectar warp
	function isWarp(){ return !!(document && document.body && document.body.classList && document.body.classList.contains('warp')); }

	// inicializa
	window.addEventListener('resize', scheduleResize);
	// chamada inicial com debounce para evitar problemas
	resize();

	// começar animação
	requestAnimationFrame(draw);

})();
