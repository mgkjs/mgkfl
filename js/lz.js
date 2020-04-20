/*

Responsive Mobile 
Plugin URI: mangaku.web.id

Author: Fandy


License: http://mangaku.web.id

*/

(function(e,h){var d,f=h.documentElement,k=e.addEventListener,t=e.setTimeout,Q=e.requestAnimationFrame||t,U=/^picture$/i,M=["load","error","lazyincluded","_lazyloaded"],H=function(a,c){return a.className.match(c)},q=function(a,c){H(a,c)||(a.className+=" "+c)},N=function(a,c){var d;if(d=H(a,c))a.className=a.className.replace(d," ")},D=function(a,c,d){var l=d?"addEventListener":"removeEventListener";d&&D(a,c);M.forEach(function(d){a[l](d,c)})},R=function(a,d,m,l,e){var n=h.createEvent("CustomEvent");
n.initCustomEvent(d,!l,!e,m);n.details=n.detail;a.dispatchEvent(n);return n},S=function(a,c){var m;e.HTMLPictureElement||((m=e.picturefill||e.respimage||d.pf)?m({reevaluate:!0,reparse:!0,elements:[a]}):c&&c.src&&(a.src=c.src))},F=function(a){a=h.querySelectorAll("[data-lazy-src]:not(.lazyload),[data-lazy-original]:not(.lazyload)");for(var c=0;c<a.length;c++)q(a[c],d.lazyClass)},V=function(a){var c,m=0,l=e.Date,h=function(){c=!1;m=l.now();a()},n=function(){t(h)},f=function(){Q(n)};return function(a){if(!c){var e=
d.throttle-(l.now()-m);c=!0;4>e&&(e=4);!0===a?f():t(f,e)}}},L=function(){var a,c,m,l,E,n,y,z,A,B,C,I,O,L=/^img$/i,M=/^iframe$/i,W="onscroll"in e&&!/glebot/.test(navigator.userAgent),G=0,v=0,u=0,J=function(b){u--;b&&b.target&&D(b.target,J);if(!b||0>u||!b.target)u=0},g=V(function(){var b,r,e,l,h,w,g,f,t;if((E=d.loadMode)&&8>u&&(b=a.length)){r=0;v++;G<O&&1>u&&4<v&&2<E?(G=O,v=0):G=G!=I&&1<E&&3<v?I:0;for(;r<b;r++)if(a[r]&&!a[r]._lazyRace)if(W){(f=a[r].getAttribute("data-expand"))&&(w=1*f)||(w=G);t!==w&&
(n=innerWidth+w,y=innerHeight+w,g=-1*w,t=w);e=a[r].getBoundingClientRect();var p;if((p=(C=e.bottom)>=g&&(z=e.top)<=y&&(B=e.right)>=g&&(A=e.left)<=n&&(C||B||A||z))&&!(p=m&&3>u&&4>v&&!f&&2<E)){var x=a[r];p=w;var k=void 0,q=x,x="hidden"!=getComputedStyle(x,null).visibility;z-=p;C+=p;A-=p;for(B+=p;x&&(q=q.offsetParent);)(x=0<(getComputedStyle(q,null).opacity||1))&&"visible"!=getComputedStyle(q,null).overflow&&(k=q.getBoundingClientRect(),x=B>k.left&&A<k.right&&C>k.top-1&&z<k.bottom+1);p=x}p?(K(a[r],!1,
e.width),h=!0):!h&&m&&!l&&3>u&&4>v&&2<E&&(c[0]||d.preloadAfterLoad)&&(c[0]||!f&&(C||B||A||z))&&(l=c[0]||a[r])}else K(a[r]);l&&!h&&K(l)}}),P=function(b){q(b.target,d.loadedClass);N(b.target,d.loadingClass);D(b.target,P)},X=function(){var b,a=[],d=function(){for(;a.length;)a.shift()();b=!1};return function(c){a.push(c);b||(b=!0,Q(d))}}(),K=function(b,a,c){var e,h,g,f,k,n=b.currentSrc||b.src,p=L.test(b.nodeName);if(m||!p||!n||b.complete||H(b,d.errorClass))b._lazyRace=!0,u++,X(function(){b._lazyRace&&
delete b._lazyRace;N(b,d.lazyClass);if(!(f=R(b,"lazybeforeunveil",{force:!!a})).defaultPrevented){e=b.getAttribute("data-lazy-src")||b.getAttribute("data-lazy-original");p&&(g=(h=b.parentNode)&&U.test(h.nodeName||""));k=f.detail.firesLoad||"src"in b&&(e||g);f={target:b};k&&(D(b,J,!0),clearTimeout(l),l=t(J,2500),q(b,d.loadingClass),D(b,P,!0));if(e)if(M.test(b.nodeName)){var c=e;b.getAttribute("src")!=c&&b.setAttribute("src",c)}else b.setAttribute("src",e);g&&S(b,{src:e})}if(!k||b.complete&&n==(b.currentSrc||
b.src))k?J(f):u--,P(f)})},T=function(){var a,c=function(){d.loadMode=3;g()};m=!0;v+=8;d.loadMode=3;k("scroll",function(){3==d.loadMode&&(d.loadMode=2);clearTimeout(a);a=t(c,99)},!0)};return{_:function(){a=h.getElementsByClassName(d.lazyClass);c=h.getElementsByClassName(d.lazyClass+" "+d.preloadClass);I=d.expand;O=Math.round(I*d.expFactor);k("scroll",g,!0);k("resize",g,!0);e.MutationObserver?((new MutationObserver(F)).observe(f,{childList:!0,subtree:!0,attributes:!0}),(new MutationObserver(g)).observe(f,
{childList:!0,subtree:!0,attributes:!0})):(f.addEventListener("DOMNodeInserted",F,!0),f.addEventListener("DOMAttrModified",F,!0),setInterval(F,999),f.addEventListener("DOMNodeInserted",g,!0),f.addEventListener("DOMAttrModified",g,!0),setInterval(g,999));k("hashchange",F,!0);"focus mouseover click load transitionend animationend webkitAnimationEnd".split(" ").forEach(function(a){h.addEventListener(a,g,!0)});(m=/d$|^c/.test(h.readyState))?T():(k("load",T),h.addEventListener("DOMContentLoaded",g));g(0<
a.length)},checkElems:g,unveil:K}}(),y=function(){y.i||(y.i=!0,L._())};(function(){var a,c={lazyClass:"lazyload",loadedClass:"lazyloaded",loadingClass:"lazyloading",preloadClass:"lazypreload",errorClass:"lazyerror",autosizesClass:"lazyautosizes",init:!0,expFactor:2,expand:359,loadMode:2,throttle:99};d=e.lazyRocketsConfig||e.lazyRocketsConfig||{};for(a in c)a in d||(d[a]=c[a]);e.lazyRocketsConfig=d;t(function(){if(d.init){for(var a=h.querySelectorAll("[data-lazy-src],[data-lazy-original]"),c=0;c<a.length;c++)q(a[c],
d.lazyClass);y()}})})();return{cfg:d,loader:L,init:y,uP:S,aC:q,rC:N,hC:H,fire:R}})(window,document);