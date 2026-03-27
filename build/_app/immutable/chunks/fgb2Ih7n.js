import{c as l,a as u}from"./DOnliuDU.js";import{p as d,f as m,n as f,a as p}from"./CFgyhC0k.js";import{s as _}from"./79oYwjcn.js";import{s as v,r as y}from"./DKbCckBp.js";import{I as h}from"./Dj-WRzyk.js";import{a as r}from"./j5ZRskja.js";function R(e,t){d(t,!0);/**
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
 */let a=y(t,["$$slots","$$events","$$legacy"]);const n=[["path",{d:"M12 2v4"}],["path",{d:"m16.2 7.8 2.9-2.9"}],["path",{d:"M18 12h4"}],["path",{d:"m16.2 16.2 2.9 2.9"}],["path",{d:"M12 18v4"}],["path",{d:"m4.9 19.1 2.9-2.9"}],["path",{d:"M2 12h4"}],["path",{d:"m4.9 4.9 2.9 2.9"}]];h(e,v({name:"loader"},()=>a,{get iconNode(){return n},children:(s,b)=>{var i=l(),o=m(i);_(o,()=>t.children??f),u(s,i)},$$slots:{default:!0}})),p()}function M(e,t){d(t,!0);/**
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
 */let a=y(t,["$$slots","$$events","$$legacy"]);const n=[["circle",{cx:"18.5",cy:"17.5",r:"3.5"}],["circle",{cx:"5.5",cy:"17.5",r:"3.5"}],["circle",{cx:"15",cy:"5",r:"1"}],["path",{d:"M12 17.5V14l-3-3 4-3 2 3h2"}]];h(e,v({name:"bike"},()=>a,{get iconNode(){return n},children:(s,b)=>{var i=l(),o=m(i);_(o,()=>t.children??f),u(s,i)},$$slots:{default:!0}})),p()}const k="26365",x="http://stronglifts-tracker-app.s3-website-ap-southeast-1.amazonaws.com/settings?strava_callback=1";function C(){return`https://www.strava.com/oauth/authorize?${new URLSearchParams({client_id:k,redirect_uri:x,response_type:"code",scope:"activity:read_all",approval_prompt:"auto"})}`}async function D(){if(!r)return!1;const{data:e}=await r.from("strava_tokens").select("user_id").maybeSingle();return!!e}async function c(e,t){if(!r)return{data:null,error:!0};const{data:a,error:n}=await r.functions.invoke("strava-auth",{body:{action:e,...t??{}}});return n?{data:null,error:!0}:{data:a,error:!1}}async function L(e){const{error:t}=await c("exchange",{code:e});return!t}async function j(e){const t={},{data:a,error:n}=await c("sync",t);return n||!a?[]:(a.activities??[]).map(g)}async function P(e,t){if(!r)return[];const{data:a,error:n}=await r.from("strava_activities").select("*").gte("start_date",e).lte("start_date",t+"T23:59:59").order("start_date");return n?(console.error("fetchStravaActivities:",n),[]):(a??[]).map(g)}async function U(){const{error:e}=await c("disconnect");return!e}function g(e){return{id:Number(e.id),name:e.name,type:e.type,start_date:e.start_date,elapsed_time_sec:Number(e.elapsed_time_sec),moving_time_sec:Number(e.moving_time_sec),distance_m:Number(e.distance_m),average_speed:Number(e.average_speed),max_speed:e.max_speed!=null?Number(e.max_speed):null,total_elevation_gain:e.total_elevation_gain!=null?Number(e.total_elevation_gain):null,average_heartrate:e.average_heartrate!=null?Number(e.average_heartrate):null,average_watts:e.average_watts!=null?Number(e.average_watts):null,kilojoules:e.kilojoules!=null?Number(e.kilojoules):null}}async function z(){if(!r)return[];const{data:e,error:t}=await r.from("test_equipment").select("*").order("created_at",{ascending:!1});return t?(console.error("fetchEquipment:",t),[]):(e??[]).map(q)}async function B(e){if(!r)return null;const{data:t,error:a}=await r.from("test_equipment").insert(N(e)).select().single();return a?(console.error("addEquipment:",a),null):q(t)}async function V(e,t){if(!r)return!1;const a={};t.type!==void 0&&(a.type=t.type),t.maker!==void 0&&(a.maker=t.maker),t.model!==void 0&&(a.model=t.model),t.quantity!==void 0&&(a.quantity=t.quantity),t.expiry_date!==void 0&&(a.expiry_date=t.expiry_date),t.notes!==void 0&&(a.notes=t.notes),t.is_favorite!==void 0&&(a.is_favorite=t.is_favorite),a.updated_at=new Date().toISOString();const{error:n}=await r.from("test_equipment").update(a).eq("id",e);return n?(console.error("updateEquipment:",n),!1):!0}async function O(e){if(!r)return!1;const{error:t}=await r.from("test_equipment").delete().eq("id",e);return t?(console.error("deleteEquipment:",t),!1):!0}function q(e){return{id:e.id,type:e.type,maker:e.maker,model:e.model,quantity:e.quantity??1,expiry_date:e.expiry_date,notes:e.notes,is_favorite:e.is_favorite??!1}}function N(e){return{type:e.type,maker:e.maker??null,model:e.model??null,quantity:e.quantity,expiry_date:e.expiry_date??null,notes:e.notes??null,is_favorite:e.is_favorite??!1}}export{M as B,R as L,B as a,O as b,P as c,U as d,L as e,z as f,C as g,D as i,j as s,V as u};
