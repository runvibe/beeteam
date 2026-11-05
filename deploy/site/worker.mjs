// Public static site only. Local API URLs and permission handling belong to the UI.
export default {
  async fetch(request,env) {
    if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, HEAD'}});
    const url=new URL(request.url),path=url.pathname;
    if(path==='/install'||path==='/install/') {
      const guide=await env.ASSETS.fetch(new Request(new URL('/install/index.html',url),request));
      return new Response(request.method==='HEAD'?null:guide.body,{status:guide.status,headers:guide.headers});
    }
    if(/^\/(api|mcp)(\/|$)/.test(path))return new Response(null,{status:404});
    let response=await env.ASSETS.fetch(request);
    if(path==='/install.json') {
      if(response.status!==304&&(!response.ok||!response.headers.get('content-type')?.includes('application/json')))return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
      const headers=new Headers(response.headers);headers.set('Cache-Control','public, max-age=60, must-revalidate');
      return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers});
    }
    if(response.status===404&&/^\/(?:$|(?:app\/?)?$|(?:app\/)?(?:home|boards|tasks|teams|agents|settings|demo)(?:\/[^.]*)?\/?$)/.test(path)) {
      const index=new URL('/index.html',url);
      response=await env.ASSETS.fetch(new Request(index,request));
    }
    const headers=new Headers(response.headers);
    headers.set('Cache-Control',response.status===404?'no-store':/^\/assets\/.+-[\w-]{8,}\.[\w.]+$/.test(path)?'public, max-age=31536000, immutable':'no-cache');
    return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers});
  }
};
