import{c as ce,a as t,f as n,t as oe}from"../chunks/DOnliuDU.js";import{g as r,o as pe,x as g,p as Pe,f as o,a as we,k as x,s as a,l as _,t as q,m as ie,q as tt,y as K,n as Re,v as ut,$ as vt}from"../chunks/CFgyhC0k.js";import{d as rt,s as B}from"../chunks/gJHaaf1F.js";import{i as he}from"../chunks/CmveNPzD.js";import{e as ke,i as Te}from"../chunks/B_uLsca9.js";import{c as d,s as Se,r as Ee}from"../chunks/DKbCckBp.js";import{h as ft}from"../chunks/3ttVVIWh.js";import{f as mt,w as J,a as gt,g as _t,b as ht}from"../chunks/07hlaTIP.js";import{s as ye}from"../chunks/dvLlC6Iy.js";import{s as at}from"../chunks/CZOewAn3.js";import{B as ue}from"../chunks/B5FU3S3l.js";import{M as xt}from"../chunks/BcdaKZ7O.js";import{P as st}from"../chunks/Cfw7EB1O.js";import{C as ot,X as Be}from"../chunks/aS9PEXeo.js";import{C as We,B as qe,a as Ce}from"../chunks/BpXKJDiv.js";import{C as Ae,a as Ie}from"../chunks/WkhXOZeh.js";import{I as pt,A as Ge,a as Ke,d as Oe,b as Ve,c as Je,e as Ye,f as Xe,g as He}from"../chunks/3LAtGe08.js";import{P as nt}from"../chunks/DHZpDq10.js";import{P as $t}from"../chunks/DML_3Jmu.js";import{T as yt,a as Pt}from"../chunks/DJvuCMCO.js";import{T as wt}from"../chunks/B1ic_nC4.js";import{P as lt,C as bt,A as Qe}from"../chunks/Bs_zT0IU.js";import{s as Ne}from"../chunks/79oYwjcn.js";import{I as Me}from"../chunks/Dj-WRzyk.js";import{g as Le}from"../chunks/C7DBEK3C.js";import{C as Ze,T as St}from"../chunks/DRQEeh-t.js";import{S as kt}from"../chunks/O_oAVAbA.js";import{D as et}from"../chunks/BJgzN19e.js";import{C as Tt}from"../chunks/BClHtAZG.js";import{T as Wt}from"../chunks/D4g2SHsy.js";import{t as Ue}from"../chunks/BtFozdF8.js";const Fe="stronglifts-timer";function je(p,e){typeof sessionStorage<"u"&&sessionStorage.setItem(Fe,JSON.stringify({endsAt:p,duration:e}))}function ze(){typeof sessionStorage<"u"&&sessionStorage.removeItem(Fe)}function Ct(){if(typeof sessionStorage>"u")return null;const p=sessionStorage.getItem(Fe);if(!p)return null;try{return JSON.parse(p)}catch{return null}}function At(){let p=pe("idle"),e=pe(0),h=pe(0),f=pe(0),k=null;function Q(){if(ye.value.soundEnabled)try{const i=new AudioContext,U=i.createOscillator(),Y=i.createGain();U.connect(Y),Y.connect(i.destination),U.frequency.value=880,U.type="sine",Y.gain.setValueAtTime(.3,i.currentTime),Y.gain.exponentialRampToValueAtTime(.01,i.currentTime+.5),U.start(i.currentTime),U.stop(i.currentTime+.5)}catch{}}function E(){ye.value.vibrationEnabled&&"vibrate"in navigator&&navigator.vibrate([200,100,200,100,200])}function re(){k&&(clearInterval(k),k=null),g(e,0),g(p,"finished"),ze(),Q(),E()}function N(){const i=Math.ceil((r(h)-Date.now())/1e3);if(i<=0){re();return}g(e,i,!0)}function ne(i){xe(),g(f,i??ye.value.restTimerSeconds,!0),g(h,Date.now()+r(f)*1e3),g(e,r(f),!0),g(p,"running"),je(r(h),r(f)),k=setInterval(N,1e3)}function xe(){k&&(clearInterval(k),k=null),g(p,"idle"),ze()}function ge(){xe(),g(e,0)}function $e(i){r(p)==="running"?(g(h,r(h)+i*1e3),g(e,Math.ceil((r(h)-Date.now())/1e3),!0),je(r(h),r(f))):r(p)==="finished"&&(g(h,Date.now()+i*1e3),g(e,i,!0),g(p,"running"),je(r(h),r(f)),k=setInterval(N,1e3))}function O(){const i=Ct();if(!i)return;const U=Math.ceil((i.endsAt-Date.now())/1e3);U<=0?(ze(),g(e,0),g(p,"finished"),Q(),E()):(g(h,i.endsAt,!0),g(f,i.duration,!0),g(e,U,!0),g(p,"running"),k=setInterval(N,1e3))}return typeof document<"u"&&(document.addEventListener("visibilitychange",()=>{document.visibilityState==="visible"&&r(p)==="running"&&N()}),O()),{get state(){return r(p)},get secondsRemaining(){return r(e)},get formattedTime(){const i=Math.floor(r(e)/60),U=r(e)%60;return`${i}:${U.toString().padStart(2,"0")}`},start:ne,stop:xe,reset:ge,addTime:$e}}const se=At();var It=n('<div class="flex items-center gap-1.5 bg-secondary/50 rounded-lg px-2 py-1"><!> <span class="w-8 text-center text-lg font-bold tabular-nums"> </span> <!> <!> <!></div>'),Rt=n('<span class="text-muted-foreground"> </span>'),Et=n("<button><!></button>");function Nt(p,e){Pe(e,!0);let h=pe(!1),f=pe(0);const k=ie(()=>{var O;return((O=e.set)==null?void 0:O.reps)??e.targetReps});function Q(){e.set?(g(h,!0),g(f,e.set.reps,!0)):e.onLog(e.targetReps)}function E(O){g(f,Math.max(0,r(f)+O),!0)}function re(){e.set&&e.onUpdate?e.onUpdate(r(f)):e.onLog(r(f)),g(h,!1)}function N(){g(h,!1),g(f,r(k),!0)}var ne=ce(),xe=o(ne);{var ge=O=>{var i=It(),U=x(i);ue(U,{variant:"outline",size:"icon-sm",class:"h-8 w-8 rounded-full",onclick:()=>E(-1),children:(l,$)=>{xt(l,{class:"h-3 w-3"})},$$slots:{default:!0}});var Y=a(U,2),de=x(Y,!0);_(Y);var Z=a(Y,2);ue(Z,{variant:"outline",size:"icon-sm",class:"h-8 w-8 rounded-full",onclick:()=>E(1),children:(l,$)=>{st(l,{class:"h-3 w-3"})},$$slots:{default:!0}});var F=a(Z,2);ue(F,{variant:"ghost",size:"icon-sm",class:"text-green-400 hover:text-green-300",onclick:re,children:(l,$)=>{ot(l,{class:"h-4 w-4"})},$$slots:{default:!0}});var le=a(F,2);ue(le,{variant:"ghost",size:"icon-sm",class:"text-muted-foreground",onclick:N,children:(l,$)=>{Be(l,{class:"h-4 w-4"})},$$slots:{default:!0}}),_(i),q(()=>B(de,r(f))),t(O,i)},$e=O=>{var i=Et();i.__click=Q;var U=x(i);{var Y=Z=>{var F=oe();q(()=>B(F,e.set.reps)),t(Z,F)},de=Z=>{var F=Rt(),le=x(F,!0);_(F),q(()=>B(le,e.setNumber)),t(Z,F)};he(U,Z=>{e.set?Z(Y):Z(de,!1)})}_(i),q(()=>{var Z;return at(i,1,`relative flex h-12 w-12 items-center justify-center rounded-lg font-bold text-lg tabular-nums transition-all duration-200
			${(Z=e.set)!=null&&Z.completed?"bg-green-600 text-white shadow-sm shadow-green-600/25":e.set?"bg-red-600 text-white shadow-sm shadow-red-600/25":"bg-secondary text-secondary-foreground ring-1 ring-border hover:bg-accent hover:text-accent-foreground"}`)}),t(O,i)};he(xe,O=>{r(h)?O(ge):O($e,!1)})}t(p,ne),we()}rt(["click"]);var Mt=n(" <!>",1),Dt=n('<div class="flex items-center gap-2 mt-2"><span class="text-muted-foreground text-sm"> </span> <!> <span class="text-muted-foreground text-sm"> </span> <!> <!></div>'),Lt=n('<button class="text-muted-foreground text-sm hover:text-primary flex items-center gap-1 mt-1 transition-colors"> <!></button>'),Ut=n('<div class="flex items-center justify-between"><div class="flex-1"><!> <!></div></div>'),jt=n('<div class="space-y-1.5"><!> <p class="text-xs text-muted-foreground"> </p></div>'),zt=n('<div class="flex gap-2 flex-wrap"></div> <!>',1),qt=n("<!> <!>",1);function Bt(p,e){Pe(e,!0);let h=pe(!1),f=pe(tt(e.exercise.targetWeight_kg));const k=ie(()=>e.exercise.sets.filter(ge=>ge.completed).length),Q=ie(()=>r(k)>=e.exercise.targetSets),E=ie(()=>Math.round(e.exercise.sets.length/e.exercise.targetSets*100));function re(ge){e.onLogSet(e.exerciseIndex,ge),e.exercise.sets.length<e.exercise.targetSets&&se.start()}function N(){e.onUpdateWeight&&r(f)!==e.exercise.targetWeight_kg&&e.onUpdateWeight(e.exerciseIndex,r(f)),g(h,!1)}var ne=ce(),xe=o(ne);{let ge=ie(()=>r(Q)?"border-green-500/50 bg-green-500/5":"");d(xe,()=>Ce,($e,O)=>{O($e,{get class(){return r(ge)},children:(i,U)=>{var Y=qt(),de=o(Y);d(de,()=>Ae,(F,le)=>{le(F,{children:(l,$)=>{var G=Ut(),ee=x(G),ae=x(ee);d(ae,()=>Ie,(w,S)=>{S(w,{class:"text-base flex items-center gap-2",children:(c,j)=>{K();var T=Mt(),W=o(T),X=a(W);{var m=u=>{qe(u,{variant:"default",class:"bg-green-600 text-white text-xs",children:(s,I)=>{K();var v=oe("Done");t(s,v)},$$slots:{default:!0}})};he(X,u=>{r(Q)&&u(m)})}q(()=>B(W,`${e.exercise.name??""} `)),t(c,T)},$$slots:{default:!0}})});var _e=a(ae,2);{var ve=w=>{var S=Dt(),c=x(S),j=x(c);_(c);var T=a(c,2);pt(T,{type:"number",step:2.5,min:0,class:"w-20 h-8 text-sm",onkeydown:s=>s.key==="Enter"&&N(),get value(){return r(f)},set value(s){g(f,s,!0)}});var W=a(T,2),X=x(W,!0);_(W);var m=a(W,2);ue(m,{variant:"ghost",size:"icon-sm",onclick:N,class:"text-green-400 hover:text-green-300",children:(s,I)=>{ot(s,{class:"h-4 w-4"})},$$slots:{default:!0}});var u=a(m,2);ue(u,{variant:"ghost",size:"icon-sm",onclick:()=>g(h,!1),class:"text-muted-foreground",children:(s,I)=>{Be(s,{class:"h-4 w-4"})},$$slots:{default:!0}}),_(S),q(()=>{B(j,`${e.exercise.targetSets??""}×${e.exercise.targetReps??""} @`),B(X,ye.value.weightUnit)}),t(w,S)},fe=w=>{var S=Lt();S.__click=()=>{g(f,e.exercise.targetWeight_kg,!0),g(h,!0)};var c=x(S),j=a(c);$t(j,{class:"h-3 w-3 opacity-0 group-hover:opacity-100"}),_(S),q(T=>B(c,`${e.exercise.targetSets??""}×${e.exercise.targetReps??""} @ ${T??""} `),[()=>mt(e.exercise.sets,e.exercise.targetWeight_kg,ye.value.weightUnit)]),t(w,S)};he(_e,w=>{r(h)?w(ve):w(fe,!1)})}_(ee),_(G),t(l,G)},$$slots:{default:!0}})});var Z=a(de,2);d(Z,()=>We,(F,le)=>{le(F,{class:"space-y-3",children:(l,$)=>{var G=zt(),ee=o(G);ke(ee,21,()=>Array(e.exercise.targetSets),Te,(ve,fe,w)=>{Nt(ve,{setNumber:w+1,get targetReps(){return e.exercise.targetReps},get set(){return e.exercise.sets[w]},onLog:re,onUpdate:S=>e.onUpdateSet(e.exerciseIndex,w,S)})}),_(ee);var ae=a(ee,2);{var _e=ve=>{var fe=jt(),w=x(fe);nt(w,{get value(){return r(E)},max:100,class:"h-1.5"});var S=a(w,2),c=x(S);_(S),_(fe),q(()=>B(c,`${r(k)??""}/${e.exercise.targetSets??""} sets completed`)),t(ve,fe)};he(ae,ve=>{e.exercise.sets.length>0&&ve(_e)})}t(l,G)},$$slots:{default:!0}})}),t(i,Y)},$$slots:{default:!0}})})}t(p,ne),we()}rt(["click"]);function Ft(p,e){Pe(e,!0);/**
 * @license @lucide/svelte v0.563.1 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2026 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2026.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * ---
 *
 * The MIT License (MIT) (for portions derived from Feather)
 *
 * Copyright (c) 2013-2026 Cole Bemis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */let h=Ee(e,["$$slots","$$events","$$legacy"]);const f=[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2"}]];Me(p,Se({name:"square"},()=>h,{get iconNode(){return f},children:(k,Q)=>{var E=ce(),re=o(E);Ne(re,()=>e.children??Re),t(k,E)},$$slots:{default:!0}})),we()}function Gt(p,e){Pe(e,!0);/**
 * @license @lucide/svelte v0.563.1 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2026 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2026.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * ---
 *
 * The MIT License (MIT) (for portions derived from Feather)
 *
 * Copyright (c) 2013-2026 Cole Bemis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */let h=Ee(e,["$$slots","$$events","$$legacy"]);const f=[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"}],["path",{d:"M3 3v5h5"}]];Me(p,Se({name:"rotate-ccw"},()=>h,{get iconNode(){return f},children:(k,Q)=>{var E=ce(),re=o(E);Ne(re,()=>e.children??Re),t(k,E)},$$slots:{default:!0}})),we()}var Kt=n("<!> Rest Timer",1),Ot=n('<p class="text-green-400 font-semibold mt-2 animate-pulse text-sm">Rest Complete!</p>'),Vt=n("<!> Start Rest",1),Jt=n("<!> Stop",1),Yt=n("<!> 30s",1),Xt=n("<!> <!>",1),Ht=n("<!> Restart",1),Qt=n("<!> Dismiss",1),Zt=n("<!> <!>",1),er=n('<div class="text-center"><div> </div> <!></div> <div class="flex gap-2 justify-center"><!></div> <div class="flex justify-center"><!></div>',1),tr=n("<!> <!>",1);function rr(p,e){Pe(e,!0);const h=[60,90,120,180];function f(N){return`${Math.floor(N/60)}:${(N%60).toString().padStart(2,"0")}`}let k=pe(tt(String(ye.value.restTimerSeconds)));function Q(N){if(N){const ne=Number(N);g(k,N,!0),ye.update({restTimerSeconds:ne}),se.state==="idle"&&se.start(ne)}}var E=ce(),re=o(E);d(re,()=>Ce,(N,ne)=>{ne(N,{children:(xe,ge)=>{var $e=tr(),O=o($e);d(O,()=>Ae,(U,Y)=>{Y(U,{class:"pb-2",children:(de,Z)=>{var F=ce(),le=o(F);d(le,()=>Ie,(l,$)=>{$(l,{class:"text-sm font-medium flex items-center gap-2 text-muted-foreground",children:(G,ee)=>{var ae=Kt(),_e=o(ae);wt(_e,{class:"h-4 w-4"}),K(),t(G,ae)},$$slots:{default:!0}})}),t(de,F)},$$slots:{default:!0}})});var i=a(O,2);d(i,()=>We,(U,Y)=>{Y(U,{class:"space-y-4",children:(de,Z)=>{var F=er(),le=o(F),l=x(le),$=x(l,!0);_(l);var G=a(l,2);{var ee=c=>{var j=Ot();t(c,j)};he(G,c=>{se.state==="finished"&&c(ee)})}_(le);var ae=a(le,2),_e=x(ae);{var ve=c=>{ue(c,{onclick:()=>se.start(),children:(j,T)=>{var W=Vt(),X=o(W);lt(X,{class:"mr-2 h-4 w-4"}),K(),t(j,W)},$$slots:{default:!0}})},fe=c=>{var j=ce(),T=o(j);{var W=m=>{var u=Xt(),s=o(u);ue(s,{variant:"destructive",onclick:()=>se.stop(),children:(v,C)=>{var b=Jt(),y=o(b);Ft(y,{class:"mr-2 h-4 w-4"}),K(),t(v,b)},$$slots:{default:!0}});var I=a(s,2);ue(I,{variant:"secondary",onclick:()=>se.addTime(30),children:(v,C)=>{var b=Yt(),y=o(b);st(y,{class:"mr-1 h-4 w-4"}),K(),t(v,b)},$$slots:{default:!0}}),t(m,u)},X=m=>{var u=Zt(),s=o(u);ue(s,{onclick:()=>se.start(),children:(v,C)=>{var b=Ht(),y=o(b);Gt(y,{class:"mr-2 h-4 w-4"}),K(),t(v,b)},$$slots:{default:!0}});var I=a(s,2);ue(I,{variant:"secondary",onclick:()=>se.reset(),children:(v,C)=>{var b=Qt(),y=o(b);Be(y,{class:"mr-2 h-4 w-4"}),K(),t(v,b)},$$slots:{default:!0}}),t(m,u)};he(T,m=>{se.state==="running"?m(W):m(X,!1)},!0)}t(c,j)};he(_e,c=>{se.state==="idle"?c(ve):c(fe,!1)})}_(ae);var w=a(ae,2),S=x(w);d(S,()=>yt,(c,j)=>{j(c,{type:"single",get value(){return r(k)},onValueChange:Q,variant:"outline",size:"sm",children:(T,W)=>{var X=ce(),m=o(X);ke(m,17,()=>h,Te,(u,s)=>{var I=ce(),v=o(I);{let C=ie(()=>String(r(s)));d(v,()=>Pt,(b,y)=>{y(b,{get value(){return r(C)},class:"text-xs px-3",children:(A,D)=>{K();var V=oe();q(R=>B(V,R),[()=>f(r(s))]),t(A,V)},$$slots:{default:!0}})})}t(u,I)}),t(T,X)},$$slots:{default:!0}})}),_(w),q(()=>{at(l,1,`text-6xl font-mono font-bold tabular-nums transition-colors duration-300
					${se.state==="finished"?"text-green-400":""}
					${se.state==="running"?"text-yellow-400":""}
					${se.state==="idle"?"text-muted-foreground":""}`),B($,se.formattedTime)}),t(de,F)},$$slots:{default:!0}})}),t(xe,$e)},$$slots:{default:!0}})}),t(p,E),we()}function ar(p,e){Pe(e,!0);/**
 * @license @lucide/svelte v0.563.1 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2026 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2026.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * ---
 *
 * The MIT License (MIT) (for portions derived from Feather)
 *
 * Copyright (c) 2013-2026 Cole Bemis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */let h=Ee(e,["$$slots","$$events","$$legacy"]);const f=[["path",{d:"M21.801 10A10 10 0 1 1 17 3.335"}],["path",{d:"m9 11 3 3L22 4"}]];Me(p,Se({name:"circle-check-big"},()=>h,{get iconNode(){return f},children:(k,Q)=>{var E=ce(),re=o(E);Ne(re,()=>e.children??Re),t(k,E)},$$slots:{default:!0}})),we()}function sr(p,e){Pe(e,!0);/**
 * @license @lucide/svelte v0.563.1 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2026 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2026.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * ---
 *
 * The MIT License (MIT) (for portions derived from Feather)
 *
 * Copyright (c) 2013-2026 Cole Bemis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */let h=Ee(e,["$$slots","$$events","$$legacy"]);const f=[["circle",{cx:"12",cy:"12",r:"10"}],["path",{d:"m15 9-6 6"}],["path",{d:"m9 9 6 6"}]];Me(p,Se({name:"circle-x"},()=>h,{get iconNode(){return f},children:(k,Q)=>{var E=ce(),re=o(E);Ne(re,()=>e.children??Re),t(k,E)},$$slots:{default:!0}})),we()}var or=n('<div class="flex items-center justify-between"><div class="flex items-center gap-3"><div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><!></div> <div><!> <!></div></div> <!></div>'),nr=n('<!> <div class="flex items-center justify-between py-1"><div class="flex items-center gap-3"><div class="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-secondary-foreground text-xs font-bold"></div> <span class="font-medium"> </span></div> <!></div>',1),lr=n("<!> ",1),ir=n("<!> <!> <!>",1),dr=n("<!> ",1),cr=n("<!> ",1),ur=n('<div class="flex items-center justify-between"><div><!> <!></div> <div class="text-right"><div class="text-3xl font-bold tabular-nums text-primary"> </div></div></div>'),vr=n('<span class="flex items-center gap-1 text-green-400"><!> All exercises done!</span>'),fr=n('<!> <div class="flex justify-between mt-2 text-xs text-muted-foreground"><span class="flex items-center gap-1"><!> </span> <!></div>',1),mr=n("<!> <!>",1),gr=n("<!> ",1),_r=n("<!> <!>",1),hr=n("<!> <!>",1),xr=n("<!> <!>",1),pr=n("<!> <!>",1),$r=n("<!> <!>",1),yr=n("<!> <!>",1),Pr=n("<!> <!>",1),wr=n("<!> <!>",1),br=n('<!> <!> <div class="space-y-4"></div> <div class="flex gap-3 pt-2 pb-4"><!> <!></div>',1),Sr=n('<div class="p-4 space-y-4"><!></div>');function aa(p,e){Pe(e,!0);let h=pe(!1),f=pe(!1);const k=ie(()=>ht(ye.value.program)),Q=ie(()=>_t(J.history.lastWorkoutType,ye.value.program)),E=ie(()=>r(k).workouts[r(Q)]);function re(){J.startWorkout(r(Q)),Ue.success("Workout started! Let's go!"),Le("/workout")}const N=ie(()=>{var l;return((l=J.current)==null?void 0:l.exercises.every($=>$.sets.length>=$.targetSets))??!1}),ne=ie(()=>()=>{if(!J.current)return 0;const l=J.current.exercises.reduce((G,ee)=>G+ee.targetSets,0),$=J.current.exercises.reduce((G,ee)=>G+ee.sets.length,0);return Math.round($/l*100)}),xe=ie(()=>()=>J.current?J.current.exercises.reduce((l,$)=>l+$.targetSets,0):0),ge=ie(()=>()=>J.current?J.current.exercises.reduce((l,$)=>l+$.sets.length,0):0);function $e(l,$){J.logSet(l,$)}function O(l,$,G){J.updateSetReps(l,$,G)}function i(l,$){J.updateExerciseWeight(l,$)}function U(){J.completeWorkout(),se.reset(),Ue.success("Workout complete! Great job!"),Le("/")}function Y(){J.cancelWorkout(),se.reset(),Ue("Workout discarded"),Le("/")}var de=Sr();ft("1iztl5s",l=>{ut(()=>{vt.title="Workout - StrongLifts"})});var Z=x(de);{var F=l=>{var $=ce(),G=o($);d(G,()=>Ce,(ee,ae)=>{ae(ee,{children:(_e,ve)=>{var fe=ir(),w=o(fe);d(w,()=>Ae,(j,T)=>{T(j,{children:(W,X)=>{var m=or(),u=x(m),s=x(u),I=x(s);et(I,{class:"h-5 w-5 text-primary"}),_(s);var v=a(s,2),C=x(v);d(C,()=>Ie,(A,D)=>{D(A,{class:"text-lg",children:(V,R)=>{K();var P=oe("Next Workout");t(V,P)},$$slots:{default:!0}})});var b=a(C,2);d(b,()=>Ze,(A,D)=>{D(A,{children:(V,R)=>{K();var P=oe();q(()=>B(P,r(E).name)),t(V,P)},$$slots:{default:!0}})}),_(v),_(u);var y=a(u,2);qe(y,{variant:"secondary",children:(A,D)=>{K();var V=oe();q(()=>B(V,r(Q))),t(A,V)},$$slots:{default:!0}}),_(m),t(W,m)},$$slots:{default:!0}})});var S=a(w,2);d(S,()=>We,(j,T)=>{T(j,{class:"space-y-3",children:(W,X)=>{var m=ce(),u=o(m);ke(u,17,()=>r(E).exercises,Te,(s,I,v)=>{var C=nr(),b=o(C);{var y=M=>{kt(M,{})};he(b,M=>{v>0&&M(y)})}var A=a(b,2),D=x(A),V=x(D);V.textContent=v+1;var R=a(V,2),P=x(R,!0);_(R),_(D);var H=a(D,2);qe(H,{variant:"outline",children:(M,z)=>{K();var L=oe();q(me=>B(L,`${r(I).sets??""}×${r(I).reps??""} @ ${me??""}`),[()=>gt(J.getNextExerciseWeight(r(I).name),ye.value.weightUnit)]),t(M,L)},$$slots:{default:!0}}),_(A),q(()=>B(P,r(I).name)),t(s,C)}),t(W,m)},$$slots:{default:!0}})});var c=a(S,2);d(c,()=>bt,(j,T)=>{T(j,{children:(W,X)=>{ue(W,{class:"w-full h-12 text-base font-semibold",onclick:re,children:(m,u)=>{var s=lr(),I=o(s);lt(I,{class:"mr-2 h-5 w-5"});var v=a(I);q(()=>B(v,` Start Workout ${r(Q)??""}`)),t(m,s)},$$slots:{default:!0}})},$$slots:{default:!0}})}),t(_e,fe)},$$slots:{default:!0}})}),t(l,$)},le=l=>{var $=br(),G=o($);d(G,()=>Ce,(w,S)=>{S(w,{children:(c,j)=>{var T=mr(),W=o(T);d(W,()=>Ae,(m,u)=>{u(m,{class:"pb-2",children:(s,I)=>{var v=ur(),C=x(v),b=x(C);d(b,()=>Ie,(R,P)=>{P(R,{class:"text-xl flex items-center gap-2",children:(H,M)=>{var z=dr(),L=o(z);et(L,{class:"h-5 w-5"});var me=a(L);q(()=>B(me,` ${J.current.activity??""}`)),t(H,z)},$$slots:{default:!0}})});var y=a(b,2);d(y,()=>Ze,(R,P)=>{P(R,{class:"flex items-center gap-1 mt-1",children:(H,M)=>{var z=cr(),L=o(z);Tt(L,{class:"h-3 w-3"});var me=a(L);q(()=>B(me,` Started at ${J.current.time??""}`)),t(H,z)},$$slots:{default:!0}})}),_(C);var A=a(C,2),D=x(A),V=x(D);_(D),_(A),_(v),q(R=>B(V,`${R??""}%`),[()=>r(ne)()]),t(s,v)},$$slots:{default:!0}})});var X=a(W,2);d(X,()=>We,(m,u)=>{u(m,{children:(s,I)=>{var v=fr(),C=o(v);{let P=ie(()=>r(ne)());nt(C,{get value(){return r(P)},max:100,class:"h-2.5"})}var b=a(C,2),y=x(b),A=x(y);Wt(A,{class:"h-3 w-3"});var D=a(A);_(y);var V=a(y,2);{var R=P=>{var H=vr(),M=x(H);St(M,{class:"h-3 w-3"}),K(),_(H),t(P,H)};he(V,P=>{r(N)&&P(R)})}_(b),q((P,H)=>B(D,` ${P??""}/${H??""} sets`),[()=>r(ge)(),()=>r(xe)()]),t(s,v)},$$slots:{default:!0}})}),t(c,T)},$$slots:{default:!0}})});var ee=a(G,2);rr(ee,{});var ae=a(ee,2);ke(ae,21,()=>J.current.exercises,Te,(w,S,c)=>{Bt(w,{get exercise(){return r(S)},exerciseIndex:c,onLogSet:$e,onUpdateSet:O,onUpdateWeight:i})}),_(ae);var _e=a(ae,2),ve=x(_e);d(ve,()=>He,(w,S)=>{S(w,{get open(){return r(h)},set open(c){g(h,c,!0)},children:(c,j)=>{var T=pr(),W=o(T);{const m=(u,s)=>{let I=()=>s==null?void 0:s().props;{let v=ie(()=>r(N)?"":"opacity-60");ue(u,Se(I,{get class(){return`flex-1 h-12 text-base font-semibold ${r(v)??""}`},children:(C,b)=>{var y=gr(),A=o(y);ar(A,{class:"mr-2 h-5 w-5"});var D=a(A);q(()=>B(D,` ${r(N)?"Complete Workout":"Finish Early"}`)),t(C,y)},$$slots:{default:!0}}))}};d(W,()=>Qe,(u,s)=>{s(u,{child:m,$$slots:{child:!0}})})}var X=a(W,2);d(X,()=>Ge,(m,u)=>{u(m,{children:(s,I)=>{var v=xr(),C=o(v);d(C,()=>Ke,(y,A)=>{A(y,{children:(D,V)=>{var R=_r(),P=o(R);d(P,()=>Oe,(M,z)=>{z(M,{children:(L,me)=>{K();var te=oe();q(()=>B(te,r(N)?"Complete Workout?":"Finish Early?")),t(L,te)},$$slots:{default:!0}})});var H=a(P,2);d(H,()=>Ve,(M,z)=>{z(M,{children:(L,me)=>{var te=ce(),it=o(te);{var dt=be=>{var De=oe("All exercises are done. Save this workout to your history.");t(be,De)},ct=be=>{var De=oe(`You haven't finished all exercises yet. Save what you've
                completed so far?`);t(be,De)};he(it,be=>{r(N)?be(dt):be(ct,!1)})}t(L,te)},$$slots:{default:!0}})}),t(D,R)},$$slots:{default:!0}})});var b=a(C,2);d(b,()=>Je,(y,A)=>{A(y,{children:(D,V)=>{var R=hr(),P=o(R);d(P,()=>Ye,(M,z)=>{z(M,{children:(L,me)=>{K();var te=oe("Keep Going");t(L,te)},$$slots:{default:!0}})});var H=a(P,2);d(H,()=>Xe,(M,z)=>{z(M,{onclick:U,children:(L,me)=>{K();var te=oe();q(()=>B(te,r(N)?"Save Workout":"Save & Finish")),t(L,te)},$$slots:{default:!0}})}),t(D,R)},$$slots:{default:!0}})}),t(s,v)},$$slots:{default:!0}})}),t(c,T)},$$slots:{default:!0}})});var fe=a(ve,2);d(fe,()=>He,(w,S)=>{S(w,{get open(){return r(f)},set open(c){g(f,c,!0)},children:(c,j)=>{var T=wr(),W=o(T);{const m=(u,s)=>{ue(u,Se(()=>s==null?void 0:s().props,{variant:"destructive",size:"icon",class:"h-12 w-12",children:(v,C)=>{sr(v,{class:"h-5 w-5"})},$$slots:{default:!0}}))};d(W,()=>Qe,(u,s)=>{s(u,{child:m,$$slots:{child:!0}})})}var X=a(W,2);d(X,()=>Ge,(m,u)=>{u(m,{children:(s,I)=>{var v=Pr(),C=o(v);d(C,()=>Ke,(y,A)=>{A(y,{children:(D,V)=>{var R=$r(),P=o(R);d(P,()=>Oe,(M,z)=>{z(M,{children:(L,me)=>{K();var te=oe("Discard Workout?");t(L,te)},$$slots:{default:!0}})});var H=a(P,2);d(H,()=>Ve,(M,z)=>{z(M,{children:(L,me)=>{K();var te=oe(`This will delete all progress from this session. This can't be
              undone.`);t(L,te)},$$slots:{default:!0}})}),t(D,R)},$$slots:{default:!0}})});var b=a(C,2);d(b,()=>Je,(y,A)=>{A(y,{children:(D,V)=>{var R=yr(),P=o(R);d(P,()=>Ye,(M,z)=>{z(M,{children:(L,me)=>{K();var te=oe("Keep Workout");t(L,te)},$$slots:{default:!0}})});var H=a(P,2);d(H,()=>Xe,(M,z)=>{z(M,{onclick:Y,children:(L,me)=>{K();var te=oe("Discard");t(L,te)},$$slots:{default:!0}})}),t(D,R)},$$slots:{default:!0}})}),t(s,v)},$$slots:{default:!0}})}),t(c,T)},$$slots:{default:!0}})}),_(_e),t(l,$)};he(Z,l=>{J.current?l(le,!1):l(F)})}_(de),t(p,de),we()}export{aa as component};
