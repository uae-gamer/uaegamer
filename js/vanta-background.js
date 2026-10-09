window.VantaBackground = {
  effect: null,
  loadedScripts: new Map(),

  loadScript(src) {
    if (this.loadedScripts.has(src)) return this.loadedScripts.get(src);

    const promise = new Promise((resolve, reject) => {
      let script = document.querySelector(`script[src="${src}"]`);
      if (script?.dataset.loaded === '1') return resolve();
      const isNew = !script;
      if (!script) {script=document.createElement('script');script.src=src;script.async=true;}
      const cleanup=()=>{clearTimeout(timer);script.removeEventListener('load',loaded);script.removeEventListener('error',failed);};
      const loaded=()=>{cleanup();script.dataset.loaded='1';resolve();};
      const failed=()=>{cleanup();script.remove();reject(new Error(`Unable to load ${src}`));};
      const timer=setTimeout(failed,15000);
      script.addEventListener('load',loaded,{once:true});script.addEventListener('error',failed,{once:true});
      if(isNew)document.head.appendChild(script);
    });
    const retryable=promise.catch(error=>{this.loadedScripts.delete(src);throw error;});
    this.loadedScripts.set(src,retryable);
    return retryable;
  },

  ensureHost() {
    let host = document.getElementById('vanta-background');
    if (!host) {
      host = document.createElement('div');
      host.id = 'vanta-background';
      host.setAttribute('aria-hidden','true');
      document.body.prepend(host);
    }
    return host;
  },

  destroy() {
    this.generation=(this.generation||0)+1;
    this.activeKey=null;
    if (this.effect?.destroy) {
      try { this.effect.destroy(); } catch (_) {}
    }
    this.effect = null;
    document.body.classList.remove('vanta-active');
    document.getElementById('vanta-background')?.replaceChildren();
  },

  hex(value, fallback) {
    const v = /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : fallback;
    return parseInt(v.slice(1), 16);
  },

  optionsFor(effectName, settings, host) {
    const primary = this.hex(settings.vanta_primary_color, '#0066cc');
    const background = this.hex(settings.vanta_background_color, '#101827');

    const base = {
      el: host,
      mouseControls: settings.vanta_mouse_controls !== false,
      touchControls: settings.vanta_touch_controls !== false,
      gyroControls: false,
      minHeight: 200,
      minWidth: 200,
      scale: 1.0,
      scaleMobile: 1.0
    };

    switch (effectName) {
      case 'birds':
        return { ...base, backgroundColor: background, color1: primary, color2: primary, quantity: 3.0 };
      case 'clouds':
        return { ...base, backgroundColor: background, skyColor: background, cloudColor: primary, cloudShadowColor: background, sunColor: primary, sunGlareColor: primary, sunlightColor: primary };
      case 'fog':
        return { ...base, highlightColor: primary, midtoneColor: primary, lowlightColor: background, baseColor: background, blurFactor: 0.65, speed: 1.0, zoom: 0.8 };
      case 'net':
        return { ...base, color: primary, backgroundColor: background, points: 10.0, maxDistance: 22.0, spacing: 18.0 };
      case 'cells':
        return { ...base, color1: primary, color2: background, size: 1.5, speed: 1.0 };
      case 'dots':
        return { ...base, color: primary, backgroundColor: background, size: 3.0, spacing: 35.0, showLines: false };
      case 'waves':
      default:
        return { ...base, color: primary, backgroundColor: background, shininess: 35, waveHeight: 16, waveSpeed: 0.8, zoom: 0.85 };
    }
  },

  async apply(settings) {
    const s = {...(settings || {})};
    this.settings=s;
    if(!this.listenersInstalled){
      this.listenersInstalled=true;
      const refresh=()=>this.apply(this.settings).catch(error=>console.error('Vanta background failed:',error));
      for(const query of ['(max-width: 768px)','(prefers-reduced-motion: reduce)']){
        const media=window.matchMedia(query);
        if(media.addEventListener)media.addEventListener('change',refresh);
        else media.addListener?.(refresh);
      }
    }
    const isMobile=window.matchMedia('(max-width: 768px)').matches;
    const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(s.vanta_enabled!==true || (isMobile && s.vanta_mobile_enabled!==true) || reduceMotion){this.destroy();return;}
    const effectName=['waves','birds','clouds','fog','net','cells','dots'].includes(s.vanta_effect)?s.vanta_effect:'waves';
    const key=JSON.stringify([effectName,...Object.keys(s).filter(k=>k.startsWith('vanta_')).sort().map(k=>[k,s[k]])]);
    if(this.effect && key===this.activeKey){this.effect.resize?.();return;}
    this.destroy();
    const generation=this.generation;
    const host=this.ensureHost();
    try {
      if(!window.THREE)await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js');
      if(generation!==this.generation)return;
      if(!window.VANTA?.[effectName.toUpperCase()])await this.loadScript(`https://cdn.jsdelivr.net/npm/vanta@0.5.24/dist/vanta.${effectName}.min.js`);
      if(generation!==this.generation)return;
      const factory=window.VANTA?.[effectName.toUpperCase()];
      if(typeof factory!=='function')throw new Error(`Vanta effect ${effectName} is unavailable.`);
      this.effect=factory({...this.optionsFor(effectName,s,host),THREE:window.THREE});
      const canvas=host.querySelector('canvas');
      if(!canvas || !this.effect)throw new Error('WebGL background could not initialize.');
      canvas.style.pointerEvents='none';
      canvas.addEventListener('webglcontextlost',()=>{if(generation===this.generation)this.destroy();},{once:true});
      this.activeKey=key;
      document.body.classList.add('vanta-active');
    } catch(error) {
      if(generation===this.generation)this.destroy();
      throw error;
    }
  }
};
