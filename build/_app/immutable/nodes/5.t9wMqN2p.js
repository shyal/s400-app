import{f as _,c as q,t as ot,a as r}from"../chunks/DOnliuDU.js";import"../chunks/BcdtKRs7.js";import{p as V,k as a,f as T,l as e,s,y as Z,t as j,g as v,m as lt,a as E,n as it,v as Ct,$ as Pt,O as Mt}from"../chunks/CFgyhC0k.js";import{d as bt,s as h}from"../chunks/gJHaaf1F.js";import{i as L}from"../chunks/CmveNPzD.js";import{e as ft,i as _t}from"../chunks/B_uLsca9.js";import{h as Bt}from"../chunks/3ttVVIWh.js";import{i as Nt}from"../chunks/Dmb4I8nd.js";import{g as Tt}from"../chunks/C7DBEK3C.js";import{b as F}from"../chunks/Ba7p790M.js";import{c as nt,s as dt,r as ct,p as St}from"../chunks/DKbCckBp.js";import{C as gt,B as ht,a as pt}from"../chunks/BpXKJDiv.js";import{B as kt}from"../chunks/Cyn30W7T.js";import{T as wt}from"../chunks/B-6KfIJF.js";import{C as Ft}from"../chunks/BClHtAZG.js";import{s as jt}from"../chunks/CZOewAn3.js";import{P as At}from"../chunks/DHZpDq10.js";import{F as xt}from"../chunks/R6ZoDSfD.js";import{s as vt}from"../chunks/79oYwjcn.js";import{I as ut}from"../chunks/Dj-WRzyk.js";import{F as It}from"../chunks/BeRd1Mzx.js";import{Z as Ot}from"../chunks/QF-c5a0U.js";import{C as yt,a as $t}from"../chunks/WkhXOZeh.js";import{B as Lt}from"../chunks/B5FU3S3l.js";import{S as zt}from"../chunks/O_oAVAbA.js";import{P as Ht}from"../chunks/Cfw7EB1O.js";import{C as qt}from"../chunks/Cci1o-_5.js";var Dt=_('<span class="flex items-center gap-1 text-yellow-400"><!> </span>'),Rt=_('<span class="flex items-center gap-1"><!> </span>'),Zt=_("<span>Never tested</span>"),Vt=_('<div class="flex items-start justify-between mb-2"><div><h3 class="font-semibold text-sm"> </h3> <!></div> <!></div> <div class="flex items-baseline gap-2 mb-2"><span class="text-2xl font-bold font-mono tabular-nums"> </span> <span class="text-sm text-muted-foreground"> </span></div> <div class="flex items-center justify-between text-xs text-muted-foreground"><span> </span> <!></div>',1),Et=_('<button class="w-full text-left"><!></button>');function Gt(w,t){V(t,!0);const C={cardiovascular:"Cardio",metabolic:"Metabolic",inflammatory:"Inflammatory",cellular_aging:"Cellular",functional:"Functional",other:"Other"},P=lt(()=>t.biomarker.daysSinceTest!=null&&t.biomarker.daysSinceTest>t.biomarker.testFrequencyDays);function g(i,B){return i!=null&&B!=null?`${i}–${B}`:B!=null?`≤${B}`:i!=null?`≥${i}`:"—"}var x=Et();x.__click=function(...i){var B;(B=t.onclick)==null||B.apply(this,i)};var f=a(x);nt(f,()=>pt,(i,B)=>{B(i,{class:"transition-all hover:border-muted-foreground/30",children:(G,J)=>{var K=q(),et=T(K);nt(et,()=>gt,(at,Y)=>{Y(at,{class:"p-3",children:(Q,rt)=>{var U=Vt(),z=T(U),tt=a(z),D=a(tt),W=a(D,!0);e(D);var R=s(D,2);ht(R,{variant:"secondary",class:"text-[10px] mt-0.5 px-1.5 py-0",children:(l,u)=>{Z();var k=ot();j(()=>h(k,C[t.biomarker.category])),r(l,k)},$$slots:{default:!0}}),e(tt);var o=s(tt,2);kt(o,{get status(){return t.biomarker.status},get trend(){return t.biomarker.trend}}),e(z);var c=s(z,2),b=a(c),y=a(b,!0);e(b);var A=s(b,2),X=a(A,!0);e(A),e(c);var S=s(c,2),H=a(S),p=a(H);e(H);var N=s(H,2);{var I=l=>{var u=q(),k=T(u);{var O=n=>{var d=Dt(),M=a(d);wt(M,{class:"h-3 w-3"});var st=s(M);e(d),j(()=>h(st,` ${t.biomarker.daysSinceTest??""}d ago`)),r(n,d)},m=n=>{var d=Rt(),M=a(d);Ft(M,{class:"h-3 w-3"});var st=s(M);e(d),j(()=>h(st,` ${t.biomarker.daysSinceTest??""}d ago`)),r(n,d)};L(k,n=>{v(P)?n(O):n(m,!1)})}r(l,u)},$=l=>{var u=Zt();r(l,u)};L(N,l=>{t.biomarker.daysSinceTest!==null?l(I):l($,!1)})}e(S),j((l,u)=>{h(W,t.biomarker.name),h(y,l),h(X,t.biomarker.unit),h(p,`Optimal: ${u??""}
          ${t.biomarker.unit??""}`)},[()=>{var l;return((l=t.biomarker.latestMeasurement)==null?void 0:l.value.toFixed(1))??"—"},()=>g(t.biomarker.optimalMin,t.biomarker.optimalMax)]),r(Q,U)},$$slots:{default:!0}})}),r(G,K)},$$slots:{default:!0}})}),e(x),r(w,x),E()}bt(["click"]);function Jt(w,t){V(t,!0);/**
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
 */let C=ct(t,["$$slots","$$events","$$legacy"]);const P=[["path",{d:"M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"}],["path",{d:"M3.22 13H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"}]];ut(w,dt({name:"heart-pulse"},()=>C,{get iconNode(){return P},children:(g,x)=>{var f=q(),i=T(f);vt(i,()=>t.children??it),r(g,f)},$$slots:{default:!0}})),E()}function Kt(w,t){V(t,!0);/**
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
 */let C=ct(t,["$$slots","$$events","$$legacy"]);const P=[["path",{d:"m10 16 1.5 1.5"}],["path",{d:"m14 8-1.5-1.5"}],["path",{d:"M15 2c-1.798 1.998-2.518 3.995-2.807 5.993"}],["path",{d:"m16.5 10.5 1 1"}],["path",{d:"m17 6-2.891-2.891"}],["path",{d:"M2 15c6.667-6 13.333 0 20-6"}],["path",{d:"m20 9 .891.891"}],["path",{d:"M3.109 14.109 4 15"}],["path",{d:"m6.5 12.5 1 1"}],["path",{d:"m7 18 2.891 2.891"}],["path",{d:"M9 22c1.798-1.998 2.518-3.995 2.807-5.993"}]];ut(w,dt({name:"dna"},()=>C,{get iconNode(){return P},children:(g,x)=>{var f=q(),i=T(f);vt(i,()=>t.children??it),r(g,f)},$$slots:{default:!0}})),E()}function Qt(w,t){V(t,!0);/**
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
 */let C=ct(t,["$$slots","$$events","$$legacy"]);const P=[["path",{d:"M12.409 13.017A5 5 0 0 1 22 15c0 3.866-4 7-9 7-4.077 0-8.153-.82-10.371-2.462-.426-.316-.631-.832-.62-1.362C2.118 12.723 2.627 2 10 2a3 3 0 0 1 3 3 2 2 0 0 1-2 2c-1.105 0-1.64-.444-2-1"}],["path",{d:"M15 14a5 5 0 0 0-7.584 2"}],["path",{d:"M9.964 6.825C8.019 7.977 9.5 13 8 15"}]];ut(w,dt({name:"biceps-flexed"},()=>C,{get iconNode(){return P},children:(g,x)=>{var f=q(),i=T(f);vt(i,()=>t.children??it),r(g,f)},$$slots:{default:!0}})),E()}function Ut(w,t){V(t,!0);/**
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
 */let C=ct(t,["$$slots","$$events","$$legacy"]);const P=[["rect",{width:"7",height:"7",x:"3",y:"3",rx:"1"}],["rect",{width:"7",height:"7",x:"14",y:"3",rx:"1"}],["rect",{width:"7",height:"7",x:"14",y:"14",rx:"1"}],["rect",{width:"7",height:"7",x:"3",y:"14",rx:"1"}]];ut(w,dt({name:"layout-grid"},()=>C,{get iconNode(){return P},children:(g,x)=>{var f=q(),i=T(f);vt(i,()=>t.children??it),r(g,f)},$$slots:{default:!0}})),E()}var Wt=_('<span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-500"></span> <span class="text-emerald-400"> </span></span>'),Xt=_('<span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-yellow-500"></span> <span class="text-yellow-400"> </span></span>'),Yt=_('<span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-red-500"></span> <span class="text-red-400"> </span></span>'),te=_('<span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-muted-foreground"></span> <span class="text-muted-foreground"> </span></span>'),ee=_('<div class="flex items-center gap-2.5 mb-2.5"><div><!></div> <span class="font-semibold text-sm"> </span></div> <div class="flex items-center gap-2 text-xs mb-2"><!> <!> <!> <!></div> <div class="flex items-center gap-2"><!> <span class="text-[10px] text-muted-foreground tabular-nums"> </span></div>',1),ae=_('<button class="w-full text-left"><!></button>');function re(w,t){V(t,!0);let C=St(t,"selected",3,!1);const P={all:{label:"All Markers",icon:Ut,color:"text-sky-400",bg:"bg-sky-500/10"},cardiovascular:{label:"Cardiovascular",icon:Jt,color:"text-red-400",bg:"bg-red-500/10"},metabolic:{label:"Metabolic",icon:Ot,color:"text-amber-400",bg:"bg-amber-500/10"},inflammatory:{label:"Inflammatory",icon:It,color:"text-orange-400",bg:"bg-orange-500/10"},cellular_aging:{label:"Cellular/Aging",icon:Kt,color:"text-violet-400",bg:"bg-violet-500/10"},functional:{label:"Functional",icon:Qt,color:"text-emerald-400",bg:"bg-emerald-500/10"},other:{label:"Other",icon:xt,color:"text-cyan-400",bg:"bg-cyan-500/10"}},g=lt(()=>P[t.category]),x=lt(()=>t.stats.total-t.stats.unknown),f=lt(()=>t.stats.total>0?Math.round(v(x)/t.stats.total*100):0);var i=ae();i.__click=function(...G){var J;(J=t.onclick)==null||J.apply(this,G)};var B=a(i);{let G=lt(()=>C()?"ring-2 ring-primary":"hover:border-muted-foreground/30");nt(B,()=>pt,(J,K)=>{K(J,{get class(){return`transition-all ${v(G)??""}`},children:(et,at)=>{var Y=q(),Q=T(Y);nt(Q,()=>gt,(rt,U)=>{U(rt,{class:"p-3",children:(z,tt)=>{var D=ee(),W=T(D),R=a(W),o=a(R);nt(o,()=>v(g).icon,(m,n)=>{n(m,{get class(){return`h-4 w-4 ${v(g).color??""}`}})}),e(R);var c=s(R,2),b=a(c,!0);e(c),e(W);var y=s(W,2),A=a(y);{var X=m=>{var n=Wt(),d=s(a(n),2),M=a(d,!0);e(d),e(n),j(()=>h(M,t.stats.optimal)),r(m,n)};L(A,m=>{t.stats.optimal>0&&m(X)})}var S=s(A,2);{var H=m=>{var n=Xt(),d=s(a(n),2),M=a(d,!0);e(d),e(n),j(()=>h(M,t.stats.warning)),r(m,n)};L(S,m=>{t.stats.warning>0&&m(H)})}var p=s(S,2);{var N=m=>{var n=Yt(),d=s(a(n),2),M=a(d,!0);e(d),e(n),j(()=>h(M,t.stats.critical)),r(m,n)};L(p,m=>{t.stats.critical>0&&m(N)})}var I=s(p,2);{var $=m=>{var n=te(),d=s(a(n),2),M=a(d,!0);e(d),e(n),j(()=>h(M,t.stats.unknown)),r(m,n)};L(I,m=>{t.stats.unknown>0&&m($)})}e(y);var l=s(y,2),u=a(l);At(u,{get value(){return v(f)},max:100,class:"h-1.5 flex-1"});var k=s(u,2),O=a(k);e(k),e(l),j(()=>{jt(R,1,`flex h-8 w-8 items-center justify-center rounded-md ${v(g).bg??""}`),h(b,v(g).label),h(O,`${v(x)??""}/${t.stats.total??""}`)}),r(z,D)},$$slots:{default:!0}})}),r(et,Y)},$$slots:{default:!0}})})}e(i),r(w,i),E()}bt(["click"]);function se(w,t){V(t,!0);/**
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
 */let C=ct(t,["$$slots","$$events","$$legacy"]);const P=[["path",{d:"M16 14v2.2l1.6 1"}],["path",{d:"M16 2v4"}],["path",{d:"M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"}],["path",{d:"M3 10h5"}],["path",{d:"M8 2v4"}],["circle",{cx:"16",cy:"16",r:"6"}]];ut(w,dt({name:"calendar-clock"},()=>C,{get iconNode(){return P},children:(g,x)=>{var f=q(),i=T(f);vt(i,()=>t.children??it),r(g,f)},$$slots:{default:!0}})),E()}var oe=_("<!> Add",1),le=_('<div class="flex items-center gap-2"><!> <!></div>'),ne=_('<button class="flex items-center justify-between w-full p-2 rounded-md hover:bg-muted/50 transition-colors"><div class="flex items-center gap-2.5"><!> <span class="text-sm"> </span></div> <div class="flex items-center gap-1.5"><span class="text-sm font-mono tabular-nums text-muted-foreground"> </span> <!></div></button>'),ie=_("<!> <!>",1),de=_('<div class="flex items-center gap-2"><!> <!></div>'),ce=_("<button><!></button>"),ve=_('<div class="flex flex-wrap gap-1.5"><!> <!></div>'),ue=_("<!> <!>",1),me=_('<div class="flex flex-col items-center justify-center py-12"><!> <p class="text-sm text-muted-foreground">No biomarkers in this category</p></div>'),fe=_('<div class="grid gap-2"></div>'),_e=_('<div class="p-4 space-y-4"><div class="flex items-center justify-between"><div class="flex items-center gap-3"><div class="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10"><!></div> <h1 class="text-2xl font-bold">Lab Results</h1></div> <!></div> <!> <!> <div class="grid grid-cols-2 gap-2"></div> <!> <div class="space-y-3"><h2 class="text-lg font-semibold capitalize"> </h2> <!></div></div>');function Ze(w,t){V(t,!1);const C=["all","cardiovascular","metabolic","inflammatory","cellular_aging","functional","other"];function P(o){F.setCategory(o)}function g(o){Tt(`/biomarkers/${o}`)}Nt();var x=_e();Bt("11jgx8u",o=>{Ct(()=>{Pt.title="Biomarkers | Labs"})});var f=a(x),i=a(f),B=a(i),G=a(B);xt(G,{class:"h-5 w-5 text-cyan-400"}),e(B),Z(2),e(i);var J=s(i,2);Lt(J,{href:"/biomarkers/add",size:"sm",class:"gap-1.5",children:(o,c)=>{var b=oe(),y=T(b);Ht(y,{class:"h-4 w-4"}),Z(),r(o,b)},$$slots:{default:!0}}),e(f);var K=s(f,2);{var et=o=>{pt(o,{class:"border-yellow-500/30",children:(c,b)=>{var y=ie(),A=T(y);yt(A,{class:"pb-2 pt-3 px-4",children:(S,H)=>{var p=le(),N=a(p);wt(N,{class:"h-4 w-4 text-yellow-400"});var I=s(N,2);$t(I,{class:"text-sm font-semibold text-yellow-400",children:($,l)=>{Z();var u=ot("Needs Attention");r($,u)},$$slots:{default:!0}}),e(p),r(S,p)},$$slots:{default:!0}});var X=s(A,2);gt(X,{class:"px-4 pb-3 space-y-1.5",children:(S,H)=>{var p=q(),N=T(p);ft(N,1,()=>F.attentionItems.slice(0,3),_t,(I,$)=>{var l=ne();l.__click=()=>g(v($).id);var u=a(l),k=a(u);kt(k,{get status(){return v($).status},get trend(){return v($).trend},size:"sm"});var O=s(k,2),m=a(O,!0);e(O),e(u);var n=s(u,2),d=a(n),M=a(d);e(d);var st=s(d,2);qt(st,{class:"h-3.5 w-3.5 text-muted-foreground"}),e(n),e(l),j(mt=>{h(m,v($).name),h(M,`${mt??""}
                ${v($).unit??""}`)},[()=>{var mt;return((mt=v($).latestMeasurement)==null?void 0:mt.value.toFixed(1))??"—"}]),r(I,l)}),r(S,p)},$$slots:{default:!0}}),r(c,y)},$$slots:{default:!0}})};L(K,o=>{F.attentionItems.length>0&&o(et)})}var at=s(K,2);{var Y=o=>{pt(o,{class:"border-sky-500/30",children:(c,b)=>{var y=ue(),A=T(y);yt(A,{class:"pb-2 pt-3 px-4",children:(S,H)=>{var p=de(),N=a(p);se(N,{class:"h-4 w-4 text-sky-400"});var I=s(N,2);$t(I,{class:"text-sm font-semibold text-sky-400",children:($,l)=>{Z();var u=ot("Overdue for Testing");r($,u)},$$slots:{default:!0}}),e(p),r(S,p)},$$slots:{default:!0}});var X=s(A,2);gt(X,{class:"px-4 pb-3",children:(S,H)=>{var p=ve(),N=a(p);ft(N,1,()=>F.overdueTests.slice(0,5),_t,(l,u)=>{var k=ce();k.__click=()=>g(v(u).id);var O=a(k);ht(O,{variant:"secondary",class:"cursor-pointer hover:bg-accent transition-colors",children:(m,n)=>{Z();var d=ot();j(()=>h(d,v(u).name)),r(m,d)},$$slots:{default:!0}}),e(k),r(l,k)});var I=s(N,2);{var $=l=>{ht(l,{variant:"outline",class:"text-muted-foreground",children:(u,k)=>{Z();var O=ot();j(()=>h(O,`+${F.overdueTests.length-5} more`)),r(u,O)},$$slots:{default:!0}})};L(I,l=>{F.overdueTests.length>5&&l($)})}e(p),r(S,p)},$$slots:{default:!0}}),r(c,y)},$$slots:{default:!0}})};L(at,o=>{F.overdueTests.length>0&&o(Y)})}var Q=s(at,2);ft(Q,5,()=>C,_t,(o,c)=>{{let b=Mt(()=>F.selectedCategory===v(c));re(o,{get category(){return v(c)},get stats(){return F.categoryStats[v(c)]},get selected(){return v(b)},onclick:()=>P(v(c))})}}),e(Q);var rt=s(Q,2);zt(rt,{});var U=s(rt,2),z=a(U),tt=a(z,!0);e(z);var D=s(z,2);{var W=o=>{var c=me(),b=a(c);xt(b,{class:"h-8 w-8 text-muted-foreground/30 mb-2"}),Z(2),e(c),r(o,c)},R=o=>{var c=fe();ft(c,5,()=>F.filteredBiomarkers,_t,(b,y)=>{Gt(b,{get biomarker(){return v(y)},onclick:()=>g(v(y).id)})}),e(c),r(o,c)};L(D,o=>{F.filteredBiomarkers.length===0?o(W):o(R,!1)})}e(U),e(x),j(o=>h(tt,o),[()=>F.selectedCategory==="all"?"All Markers":F.selectedCategory.replace("_"," ")]),r(w,x),E()}bt(["click"]);export{Ze as component};
