// Public documents are pre-rendered. Only app navigation uses the SPA shell.
const appRoute = /^\/(?:app\/?$|(?:app\/)?(?:home|boards|tasks|teams|agents|settings)(?:\/[^.]*)?\/?$)/;
export default {
  async fetch(request, env) {
    if (!['GET','HEAD'].includes(request.method)) return new Response(null,{status:405,headers:{Allow:'GET, HEAD'}});
    const url=new URL(request.url), path=url.pathname;
    if(path.split('/').some(part=>part.startsWith('.beeteam-')))return new Response(null,{status:404});
    if (/^\/(api|mcp|docs|openapi|health)(\/|$)/.test(path)) return new Response(null,{status:404});
    let response=await env.ASSETS.fetch(request);
    if(path==='/install.json') {
      if(response.status!==304&&(!response.ok||!response.headers.get('content-type')?.includes('application/json')))return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
      const headers=new Headers(response.headers);headers.set('Cache-Control','public, max-age=60, must-revalidate');
      return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers});
    }
    if(response.status===404 && !path.split('/').at(-1).includes('.')) {
      const document=new URL(path.replace(/\/$/,'')+'/index.html',url);
      response=await env.ASSETS.fetch(new Request(document,request));
    }
    if(response.status===404&&appRoute.test(path))response=await env.ASSETS.fetch(new Request(new URL('/app/index.html',url),request));
    const headers=new Headers(response.headers);
    headers.set('Cache-Control',response.status===404?'no-store':/^\/(?:app\/assets|site-assets|assets)\/.+-[\w-]{8,}\.[\w.]+$/.test(path)?'public, max-age=31536000, immutable':'no-cache');
    return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers});
  }
};
