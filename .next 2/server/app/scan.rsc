1:"$Sreact.fragment"
2:I[71007,["/_next/static/chunks/00.k66k_.mdq7.js","/_next/static/chunks/11zyvwqchze4..js","/_next/static/chunks/0~2zi2kxayi_f.js","/_next/static/chunks/14o.09ligv9ve.js","/_next/static/chunks/0u8q67q6axtj9.js"],"AppProviders"]
3:I[2063,["/_next/static/chunks/00.k66k_.mdq7.js","/_next/static/chunks/11zyvwqchze4..js","/_next/static/chunks/0~2zi2kxayi_f.js","/_next/static/chunks/14o.09ligv9ve.js","/_next/static/chunks/0u8q67q6axtj9.js"],"default"]
4:I[59666,["/_next/static/chunks/00.k66k_.mdq7.js","/_next/static/chunks/11zyvwqchze4..js","/_next/static/chunks/0~2zi2kxayi_f.js","/_next/static/chunks/14o.09ligv9ve.js","/_next/static/chunks/0u8q67q6axtj9.js"],"default"]
5:I[3839,["/_next/static/chunks/00.k66k_.mdq7.js","/_next/static/chunks/11zyvwqchze4..js","/_next/static/chunks/0~2zi2kxayi_f.js","/_next/static/chunks/14o.09ligv9ve.js","/_next/static/chunks/0u8q67q6axtj9.js"],"BottomNav"]
c:I[14743,["/_next/static/chunks/00.k66k_.mdq7.js","/_next/static/chunks/11zyvwqchze4..js","/_next/static/chunks/0~2zi2kxayi_f.js","/_next/static/chunks/14o.09ligv9ve.js","/_next/static/chunks/0u8q67q6axtj9.js"],"default",1]
:HL["/_next/static/chunks/0x.pxwmy6tt~x.css","style"]
:HL["/_next/static/chunks/0ts6egz9.abcb.css","style"]
:HL["/_next/static/media/797e433ab948586e-s.p.0.q-h669a_dqa.woff2","font",{"crossOrigin":"","type":"font/woff2"}]
:HL["/_next/static/media/caa3a2e1cccd8315-s.p.16t1db8_9y2o~.woff2","font",{"crossOrigin":"","type":"font/woff2"}]
6:T5d4,
              document.body.classList.remove('modal-open', 'mobile-form-open');
              window.addEventListener('pageshow', () => {
                document.body.classList.remove('modal-open', 'mobile-form-open');
              });
              document.addEventListener('visibilitychange', () => {
                if (!document.hidden) {
                  const hasModal = document.querySelector('[data-app-modal="true"]');
                  if (!hasModal) {
                    document.body.classList.remove('modal-open', 'mobile-form-open');
                  }
                }
              });
              const clearStaleLocks = () => {
                const hasModal = document.querySelector('[data-app-modal="true"]');
                if (!hasModal) {
                  document.body.classList.remove('modal-open', 'mobile-form-open');
                }
              };
              if ('requestIdleCallback' in window) {
                window.requestIdleCallback(clearStaleLocks, { timeout: 1200 });
              } else {
                setTimeout(clearStaleLocks, 300);
              }

              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/service-worker.js')
                  .then(reg => {
                    reg.update();
                    console.log('SW registered:', reg.scope);
                  })
                  .catch(err => console.log('SW registration failed:', err));
              }
            0:{"P":null,"c":["","scan"],"q":"","i":false,"f":[[["",{"children":["scan",{"children":["__PAGE__",{}]}]},"$undefined","$undefined",16],[["$","$1","c",{"children":[[["$","link","0",{"rel":"stylesheet","href":"/_next/static/chunks/0x.pxwmy6tt~x.css","precedence":"next","crossOrigin":"$undefined","nonce":"$undefined"}],["$","link","1",{"rel":"stylesheet","href":"/_next/static/chunks/0ts6egz9.abcb.css","precedence":"next","crossOrigin":"$undefined","nonce":"$undefined"}],["$","script","script-0",{"src":"/_next/static/chunks/00.k66k_.mdq7.js","async":true,"nonce":"$undefined"}],["$","script","script-1",{"src":"/_next/static/chunks/11zyvwqchze4..js","async":true,"nonce":"$undefined"}],["$","script","script-2",{"src":"/_next/static/chunks/0~2zi2kxayi_f.js","async":true,"nonce":"$undefined"}],["$","script","script-3",{"src":"/_next/static/chunks/14o.09ligv9ve.js","async":true,"nonce":"$undefined"}],["$","script","script-4",{"src":"/_next/static/chunks/0u8q67q6axtj9.js","async":true,"nonce":"$undefined"}]],["$","html",null,{"lang":"es","className":"bg-background","children":[["$","head",null,{"children":[["$","meta",null,{"name":"apple-mobile-web-app-capable","content":"yes"}],["$","meta",null,{"name":"mobile-web-app-capable","content":"yes"}],["$","meta",null,{"name":"apple-mobile-web-app-status-bar-style","content":"black-translucent"}],["$","meta",null,{"name":"theme-color","content":"#000000"}]]}],["$","body",null,{"className":"font-sans antialiased","children":[["$","$L2",null,{"children":[["$","$L3",null,{"parallelRouterKey":"children","error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L4",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":[[["$","title",null,{"children":"404: This page could not be found."}],["$","div",null,{"style":{"fontFamily":"system-ui,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif,\"Apple Color Emoji\",\"Segoe UI Emoji\"","height":"100vh","textAlign":"center","display":"flex","flexDirection":"column","alignItems":"center","justifyContent":"center"},"children":["$","div",null,{"children":[["$","style",null,{"dangerouslySetInnerHTML":{"__html":"body{color:#000;background:#fff;margin:0}.next-error-h1{border-right:1px solid rgba(0,0,0,.3)}@media (prefers-color-scheme:dark){body{color:#fff;background:#000}.next-error-h1{border-right:1px solid rgba(255,255,255,.3)}}"}}],["$","h1",null,{"className":"next-error-h1","style":{"display":"inline-block","margin":"0 20px 0 0","padding":"0 23px 0 0","fontSize":24,"fontWeight":500,"verticalAlign":"top","lineHeight":"49px"},"children":404}],["$","div",null,{"style":{"display":"inline-block"},"children":["$","h2",null,{"style":{"fontSize":14,"fontWeight":400,"lineHeight":"49px","margin":0},"children":"This page could not be found."}]}]]}]}]],[]],"forbidden":"$undefined","unauthorized":"$undefined"}],["$","$L5",null,{}]]}],["$","script",null,{"dangerouslySetInnerHTML":{"__html":"$6"}}],"$L7"]}]]}]]}],{"children":["$L8",{"children":["$L9",{},null,false,null]},null,false,"$@a"]},null,false,null],"$Lb",false]],"m":"$undefined","G":["$c",["$Ld","$Le"]],"S":true,"h":null,"s":"$undefined","l":"$undefined","p":"$undefined","d":"$undefined","b":"Hes1DxY-9tfSlPeLa4pEV"}
f:I[85164,["/_next/static/chunks/00.k66k_.mdq7.js","/_next/static/chunks/11zyvwqchze4..js","/_next/static/chunks/0~2zi2kxayi_f.js","/_next/static/chunks/14o.09ligv9ve.js","/_next/static/chunks/0u8q67q6axtj9.js"],"Analytics"]
10:I[87919,["/_next/static/chunks/00.k66k_.mdq7.js","/_next/static/chunks/11zyvwqchze4..js","/_next/static/chunks/0~2zi2kxayi_f.js","/_next/static/chunks/14o.09ligv9ve.js","/_next/static/chunks/0u8q67q6axtj9.js"],"ClientPageRoot"]
11:I[86384,["/_next/static/chunks/00.k66k_.mdq7.js","/_next/static/chunks/11zyvwqchze4..js","/_next/static/chunks/0~2zi2kxayi_f.js","/_next/static/chunks/14o.09ligv9ve.js","/_next/static/chunks/0u8q67q6axtj9.js","/_next/static/chunks/0r2i-58dt.5cc.js"],"default"]
14:I[62711,["/_next/static/chunks/00.k66k_.mdq7.js","/_next/static/chunks/11zyvwqchze4..js","/_next/static/chunks/0~2zi2kxayi_f.js","/_next/static/chunks/14o.09ligv9ve.js","/_next/static/chunks/0u8q67q6axtj9.js"],"OutletBoundary"]
15:"$Sreact.suspense"
18:I[62711,["/_next/static/chunks/00.k66k_.mdq7.js","/_next/static/chunks/11zyvwqchze4..js","/_next/static/chunks/0~2zi2kxayi_f.js","/_next/static/chunks/14o.09ligv9ve.js","/_next/static/chunks/0u8q67q6axtj9.js"],"ViewportBoundary"]
1a:I[62711,["/_next/static/chunks/00.k66k_.mdq7.js","/_next/static/chunks/11zyvwqchze4..js","/_next/static/chunks/0~2zi2kxayi_f.js","/_next/static/chunks/14o.09ligv9ve.js","/_next/static/chunks/0u8q67q6axtj9.js"],"MetadataBoundary"]
7:["$","$Lf",null,{}]
8:["$","$1","c",{"children":[null,["$","$L3",null,{"parallelRouterKey":"children","error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L4",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":"$undefined","forbidden":"$undefined","unauthorized":"$undefined"}]]}]
9:["$","$1","c",{"children":[["$","$L10",null,{"Component":"$11","serverProvidedParams":{"searchParams":{},"params":{},"promises":["$@12","$@13"]}}],[["$","script","script-0",{"src":"/_next/static/chunks/0r2i-58dt.5cc.js","async":true,"nonce":"$undefined"}]],["$","$L14",null,{"children":["$","$15",null,{"name":"Next.MetadataOutlet","children":"$@16"}]}]]}]
17:[]
a:"$W17"
b:["$","$1","h",{"children":[null,["$","$L18",null,{"children":"$L19"}],["$","div",null,{"hidden":true,"children":["$","$L1a",null,{"children":["$","$15",null,{"name":"Next.Metadata","children":"$L1b"}]}]}],["$","meta",null,{"name":"next-size-adjust","content":""}]]}]
d:["$","link","0",{"rel":"stylesheet","href":"/_next/static/chunks/0x.pxwmy6tt~x.css","precedence":"next","crossOrigin":"$undefined","nonce":"$undefined"}]
e:["$","link","1",{"rel":"stylesheet","href":"/_next/static/chunks/0ts6egz9.abcb.css","precedence":"next","crossOrigin":"$undefined","nonce":"$undefined"}]
12:{}
13:"$9:props:children:0:props:serverProvidedParams:params"
19:[["$","meta","0",{"charSet":"utf-8"}],["$","meta","1",{"name":"viewport","content":"width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"}],["$","meta","2",{"name":"theme-color","content":"#000000"}]]
1c:I[19772,["/_next/static/chunks/00.k66k_.mdq7.js","/_next/static/chunks/11zyvwqchze4..js","/_next/static/chunks/0~2zi2kxayi_f.js","/_next/static/chunks/14o.09ligv9ve.js","/_next/static/chunks/0u8q67q6axtj9.js"],"IconMark"]
16:null
1b:[["$","title","0",{"children":"MiCuadre - Tus finanzas simplificadas"}],["$","meta","1",{"name":"description","content":"App de finanzas personales en pesos dominicanos"}],["$","meta","2",{"name":"application-name","content":"MiCuadre"}],["$","link","3",{"rel":"manifest","href":"/manifest.json","crossOrigin":"$undefined"}],["$","meta","4",{"name":"generator","content":"v0.app"}],["$","meta","5",{"name":"format-detection","content":"telephone=no"}],["$","meta","6",{"name":"mobile-web-app-capable","content":"yes"}],["$","meta","7",{"name":"apple-mobile-web-app-title","content":"MiCuadre"}],["$","link","8",{"href":"/apple-icon.png","media":"(device-width: 768px)","rel":"apple-touch-startup-image"}],["$","meta","9",{"name":"apple-mobile-web-app-status-bar-style","content":"black-translucent"}],["$","link","10",{"rel":"icon","href":"/icon-light-32x32.png","media":"(prefers-color-scheme: light)"}],["$","link","11",{"rel":"icon","href":"/icon-dark-32x32.png","media":"(prefers-color-scheme: dark)"}],["$","link","12",{"rel":"icon","href":"/icon.svg","type":"image/svg+xml"}],["$","link","13",{"rel":"apple-touch-icon","href":"/apple-icon.png"}],["$","link","14",{"rel":"icon","href":"/apple-icon.png","sizes":"180x180","type":"image/png"}],["$","link","15",{"rel":"icon","href":"/icon-light-32x32.png","sizes":"32x32","type":"image/png"}],["$","$L1c","16",{}]]
