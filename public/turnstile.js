/* Shared browser protection: source copied to each site's public directory. */
(() => {
  const originalFetch = window.fetch.bind(window);
  let configPromise, scriptPromise;
  function action(method, path) {
    if (method === 'GET' && (path === '/api/verify' || path.startsWith('/api/invoices/'))) return 'lookup';
    if (path.startsWith('/api/signer/')) return '';
    if (!['POST','PUT','PATCH','DELETE'].includes(method)) return '';
    if (path.startsWith('/api/admin/')) return 'admin_write';
    if (path.startsWith('/api/briefs/')) return 'brief_write';
    if (['/api/leads','/api/web-inquiries'].includes(path)) return 'inquiry';
    if (path === '/api/verify') return 'verify';
    return '';
  }
  function config() {
    if (!configPromise) configPromise = originalFetch('/api/turnstile-config', {cache:'no-store'})
      .then(async r => {
        if (!r.ok) {
          if (['localhost','127.0.0.1'].includes(location.hostname)) return {enabled:false};
          throw new Error('Security configuration unavailable');
        }
        return r.json();
      }).catch(e => {configPromise = null; throw e;});
    return configPromise;
  }
  function load() {
    if (!scriptPromise) scriptPromise = new Promise((resolve,reject) => {
      const s = document.createElement('script');
      const timer = setTimeout(()=>reject(new Error('Security check timed out')),15000);
      s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.onload=()=>{clearTimeout(timer);resolve();};s.onerror=()=>{clearTimeout(timer);reject(new Error('Security check unavailable'));};document.head.append(s);
    }).catch(e=>{scriptPromise=null;throw e;});
    return scriptPromise;
  }
  async function token(sitekey, purpose) {
    await load();
    return new Promise((resolve,reject)=>{
      const container=document.createElement('div');document.body.append(container);
      let id, finished=false;
      const done=(error,value)=>{if(finished)return;finished=true;clearTimeout(timer);if(id!==undefined)window.turnstile.remove(id);container.remove();error?reject(error):resolve(value);};
      const timer=setTimeout(()=>done(new Error('Security check timed out')),15000);
      try {
        id=window.turnstile.render(container,{sitekey,action:purpose,execution:'execute','response-field':false,
          callback:value=>done(null,value),'error-callback':()=>done(new Error('Security check failed')),
          'expired-callback':()=>done(new Error('Security check expired'))});
        window.turnstile.execute(id);
      } catch(e) {done(e);}
    });
  }
  window.fetch=async (input, init={})=>{
    const url=new URL(input instanceof Request ? input.url : input,location.href);
    const method=(init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const purpose=url.origin===location.origin ? action(method,url.pathname) : '';
    if (!purpose) return originalFetch(input,init);
    const settings=await config();
    if (!settings.enabled) return originalFetch(input,init);
    if (!settings.siteKey) throw new Error('Security check is not configured');
    const value=await token(settings.siteKey,purpose);
    const headers=new Headers(init.headers || (input instanceof Request ? input.headers : undefined));headers.set('X-Turnstile-Token',value);
    return originalFetch(input,{...init,headers});
  };
})();
