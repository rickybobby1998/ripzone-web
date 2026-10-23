/* v0.9.16 launch splash: brand option C (Card Burst), time-scaled to ~2.4 s, drawn at device resolution */
(function(){if(!document.getElementById('rzsC'))return;
// RipZone splash option C. ~2.9s. Fires window event "ripzone:splashdone". ?t=<sec> renders a still.

const W=1080,H=1920,cv=document.getElementById('rzsC'),x=cv.getContext('2d');let BT=[1,0,0,1,0,0];
function fit(){const d=Math.min(devicePixelRatio||1,1.5),w=innerWidth,h=innerHeight;cv.width=Math.round(w*d);cv.height=Math.round(h*d);const k=Math.min(cv.width/W,cv.height/H);BT=[k,0,0,k,(cv.width-W*k)/2,(cv.height-H*k)/2]}fit();
const C='#22E5FF',K='#FF2EA6',G='#FFC83D',COLS=[C,K,G];
const cl=(v,a=0,b=1)=>Math.min(b,Math.max(a,v)),seg=(t,a,b)=>cl((t-a)/(b-a)),lerp=(a,b,k)=>a+(b-a)*k;
const eo=t=>1-Math.pow(1-t,3),eio=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,back=t=>{const s=2.2;t-=1;return t*t*((s+1)*t+s)+1};
let sd=11;const rnd=()=>(sd=(sd*16807)%2147483647)/2147483647;
const IMG={};let pend=0;function ld(k,s){pend++;const i=new Image();i.onload=()=>{if(--pend==0)start()};i.src=s;IMG[k]=i}
const stars=[...Array(70)].map(()=>[rnd()*W,rnd()*H,rnd()*2+.5,rnd()]);
const burstP=[...Array(150)].map(()=>({a:rnd()*6.283,v:300+1000*rnd(),c:COLS[(rnd()*3)|0],s:3+7*rnd(),d:rnd()*.2}));
function reset(){x.setTransform(...BT);x.globalAlpha=1;x.globalCompositeOperation='source-over';x.shadowBlur=0}
function bg(t){x.setTransform(1,0,0,1,0,0);x.fillStyle='#05060D';x.fillRect(0,0,cv.width,cv.height);reset();const g=x.createRadialGradient(W/2,H*.47,50,W/2,H*.47,1150);g.addColorStop(0,'#151935');g.addColorStop(1,'#05060D');x.fillStyle=g;x.fillRect(0,0,W,H);
 for(const[sx,sy,r,ph]of stars){x.globalAlpha=.25+.3*Math.sin(t*4+ph*6);x.fillStyle='#fff';x.fillRect(sx,sy,r,r)}x.globalAlpha=1}
function burst(t,t0,ox,oy,up){const pt=t-t0;if(pt<=0)return;x.save();x.globalCompositeOperation='lighter';
 for(const q of burstP){const k=pt-q.d;if(k<0)continue;const life=1-k/1.1;if(life<=0)continue;const a=up?-Math.PI*(q.a/6.283):q.a;
  x.globalAlpha=life;x.fillStyle=q.c;x.beginPath();x.arc(ox+Math.cos(a)*q.v*k,oy+Math.sin(a)*q.v*k+700*k*k,q.s*life+1,0,7);x.fill()}x.restore()}
function rays(t,ox,oy,amt,spread){if(amt<=0)return;x.save();x.globalCompositeOperation='lighter';
 for(let i=0;i<12;i++){const a=(spread?i/12*6.283+t*.6:-Math.PI/2+(i-5.5)*.13)+Math.sin(t*3+i)*.03;x.globalAlpha=amt*.32;x.fillStyle=COLS[i%3];
  x.beginPath();x.moveTo(ox,oy);x.lineTo(ox+Math.cos(a-.045)*1700,oy+Math.sin(a-.045)*1700);x.lineTo(ox+Math.cos(a+.045)*1700,oy+Math.sin(a+.045)*1700);x.fill()}
 const rg=x.createRadialGradient(ox,oy,0,ox,oy,520);rg.addColorStop(0,'rgba(255,255,255,'+amt+')');rg.addColorStop(1,'rgba(255,46,166,0)');x.globalAlpha=1;x.fillStyle=rg;x.fillRect(ox-520,oy-520,1040,1040);x.restore()}
function logo(t,t0,cy){const lt=seg(t,t0,t0+.5);if(lt<=0)return;const L=IMG.logo,sc=.15+.85*back(lt),lw=1060,lh=lw*500/1700;cy=cy||H/2;
 x.save();x.translate(W/2,cy);x.scale(sc,sc);x.globalAlpha=cl(lt*2);x.shadowColor=G;x.shadowBlur=18;
 const tx=-lw/2+lw*540/1700,ty=-lh/2+lh*330/500;
 x.save();x.beginPath();x.rect(-lw/2,-lh/2,lw,lh);x.rect(tx,ty,lw,lh);x.clip('evenodd');x.drawImage(L,-lw/2,-lh/2,lw,lh);x.restore();
 const tg=seg(t,t0+.4,t0+.8);x.globalAlpha=tg;x.shadowColor=C;x.shadowBlur=20*tg;x.beginPath();x.rect(tx,ty,lw*tg,lh);x.clip();x.drawImage(L,-lw/2,-lh/2,lw,lh);x.restore()}
function flash(t,tc){const f=Math.max(0,1-Math.abs(t-tc)/.17);if(f>0){reset();x.globalAlpha=f*.9;x.fillStyle='#fff';x.fillRect(-W,-H,3*W,3*H);x.globalAlpha=1}}
function rr(X,Y,w,h,r){x.beginPath();x.roundRect(X,Y,w,h,r)}
function cardFace(w,h,front){// drawn centered at origin
 const g=x.createLinearGradient(0,-h/2,0,h/2);g.addColorStop(0,'#1A1F40');g.addColorStop(1,'#07080F');rr(-w/2,-h/2,w,h,28);x.fillStyle=g;x.fill();
 const p=x.createLinearGradient(-w/2,-h/2,w/2,h/2);p.addColorStop(0,C);p.addColorStop(.5,K);p.addColorStop(1,G);x.lineWidth=12;x.strokeStyle=front?G:p;x.stroke();
 x.save();rr(-w/2+24,-h/2+24,w-48,h-48,18);x.clip();x.lineWidth=2;x.globalAlpha*=.35;
 for(let i=-12;i<12;i++){x.strokeStyle=COLS[(i+12)%3];x.beginPath();x.moveTo(i*60-h/2,-h/2);x.lineTo(i*60+h/2,h/2);x.stroke()}x.restore();
 rr(-w/2+24,-h/2+24,w-48,h-48,18);x.lineWidth=3;x.strokeStyle=front?K:C;x.stroke();
 const s=front?w*.8:w*.55;x.drawImage(IMG.icon,-s/2,-s/2-(front?20:0),s,s);
 if(front){x.font='bold 46px "Russo One",sans-serif';x.textAlign='center';x.fillStyle=G;x.fillText('LEGENDARY',0,h/2-70)}}
function drawPackTorn(img,cx,cy,pw,ph,t,tT,tF,alpha){// horizontal top tear
 const TY=122*ph/1024,px=cx-pw/2,py=cy-ph/2,ty=py+TY,n=16,z=[];for(let i=0;i<=n;i++)z.push([px+i*pw/n,ty+(i%2?-10:10)*ph/1024]);
 const tp=seg(t,tT,tF),fly=eo(seg(t,tF,tF+.55));x.save();x.globalAlpha=alpha;
 if(t<tF){x.drawImage(img,px,py,pw,ph)}else{
  x.save();x.beginPath();x.moveTo(px-60,ty+300);z.forEach(p=>x.lineTo(p[0],p[1]));x.lineTo(px+pw+60,py+ph+60);x.lineTo(px-60,py+ph+60);x.closePath();x.clip();x.drawImage(img,px,py,pw,ph);x.restore();
  rays(t,cx,ty,alpha*seg(t,tF-.05,tF+.15)*(1-seg(t,tF+.55,tF+.9)),false);
  x.save();x.globalAlpha=alpha*(1-seg(t,tF+.4,tF+.6));x.translate(px+pw*.8+fly*500,ty-fly*900);x.rotate(fly*1.4);x.translate(-(px+pw*.8),-ty);
  x.beginPath();x.moveTo(px-20,py-40);x.lineTo(px+pw+20,py-40);for(let i=n;i>=0;i--)x.lineTo(z[i][0],z[i][1]);x.closePath();x.clip();x.drawImage(img,px,py,pw,ph);x.restore()}
 if(tp>0&&t<tF+.3){x.shadowBlur=30;x.shadowColor=K;x.strokeStyle='#fff';x.lineWidth=6;x.globalAlpha=alpha*(1-seg(t,tF,tF+.3));x.beginPath();
  for(let i=0;i<=n;i++){x.lineTo(Math.min(z[i][0],px+tp*pw),z[i][1])}x.stroke()}
 x.restore();burst(t,tF,cx,ty,true)}


const CW=560,CH=820,CX=W/2,CY=H/2-40,IP=[CX+40,CY-70];
const rayA=[...Array(10)].map((_,i)=>i/10*6.283+rnd()*.4);
const mid=rayA.map(a=>{const r=150+rnd()*90;return[IP[0]+Math.cos(a)*r,IP[1]+Math.sin(a)*r]}),far=rayA.map(a=>[IP[0]+Math.cos(a)*900,IP[1]+Math.sin(a)*900]);
const crk=rayA.map((a,i)=>{const p=[IP,mid[i]];let r=Math.hypot(mid[i][0]-IP[0],mid[i][1]-IP[1]);while(r<700){r+=80+rnd()*60;const aa=a+(rnd()-.5)*.25;p.push([IP[0]+Math.cos(aa)*r,IP[1]+Math.sin(aa)*r])}return p});
const shards=[];for(let i=0;i<10;i++){const j=(i+1)%10;shards.push([IP,mid[i],mid[j]]);shards.push([mid[i],crk[i][3]||far[i],far[i],far[j],crk[j][3]||far[j],mid[j]])}
shards.forEach(s=>{s.c=[s.reduce((a,p)=>a+p[0],0)/s.length,s.reduce((a,p)=>a+p[1],0)/s.length];s.r=(rnd()-.5)*3;s.v=.6+rnd()*.7});
function card(){x.save();x.translate(CX,CY);cardFace(CW,CH,false);x.restore()}
function render(t){bg(t);
 if(t<1.5){const sp=seg(t,0,1.05),a=(1-eo(sp))*5*Math.PI,s=.35+.65*eo(sp),sh=seg(t,1.05,1.5)*Math.sin(t*90)*8;
  x.save();x.translate(CX+sh,CY+Math.sin(t*3)*10);x.transform(Math.cos(a)*s,.15*Math.sin(a)*s,0,s,0,0);x.translate(-CX,-CY);x.shadowColor=COLS[((t*4)|0)%3];x.shadowBlur=60;card();x.restore();
  const ck=seg(t,1.05,1.45);if(ck>0){x.save();rr(CX-CW/2,CY-CH/2,CW,CH,28);x.clip();x.lineCap='round';x.lineJoin='round';
   for(const p of crk){const n=Math.max(2,Math.ceil(ck*p.length));for(const[w,c]of[[14,K],[5,'#fff']]){x.strokeStyle=c;x.lineWidth=w;x.shadowColor=w>6?K:C;x.shadowBlur=25;x.globalAlpha=w>6?.6:1;x.beginPath();p.slice(0,n).forEach(q=>x.lineTo(q[0],q[1]));x.stroke()}}
   x.globalCompositeOperation='lighter';const g=x.createRadialGradient(IP[0],IP[1],0,IP[0],IP[1],260);g.addColorStop(0,'rgba(255,255,255,'+ck+')');g.addColorStop(1,'rgba(34,229,255,0)');x.fillStyle=g;x.fillRect(0,0,W,H);x.restore()}}
 else{const s=eo(seg(t,1.5,1.95)),r=eio(seg(t,1.95,2.35));
  for(const sh of shards){const dx=sh.c[0]-IP[0],dy=sh.c[1]-IP[1],d=Math.hypot(dx,dy)+1,ox=dx/d*s*650*sh.v,oy=dy/d*s*650*sh.v+s*120;
   const X=lerp(sh.c[0]+ox,W/2,r),Y=lerp(sh.c[1]+oy,H/2,r);if(r>=1)continue;
   x.save();x.globalAlpha=1-r;x.translate(X,Y);x.rotate(sh.r*s*(1-r)+r*sh.r*2);x.scale(1-.85*r,1-.85*r);x.translate(-sh.c[0],-sh.c[1]);
   x.beginPath();sh.forEach(p=>x.lineTo(p[0],p[1]));x.closePath();x.save();x.clip();card();x.globalCompositeOperation='lighter';x.globalAlpha=(1-r)*.35;x.fillStyle=COLS[shards.indexOf(sh)%3];x.fillRect(CX-CW/2,CY-CH/2,CW,CH);x.restore();x.strokeStyle=COLS[shards.indexOf(sh)%3];x.lineWidth=4;x.shadowColor=x.strokeStyle;x.shadowBlur=20;
   x.save();rr(CX-CW/2,CY-CH/2,CW,CH,28);x.clip();x.beginPath();sh.forEach(p=>x.lineTo(p[0],p[1]));x.closePath();x.stroke();x.restore();x.restore()}
  rays(t,IP[0],IP[1],seg(t,1.45,1.6)*(1-seg(t,1.8,2.1)),true);burst(t,1.5,IP[0],IP[1],false)}
 logo(t,2.15);flash(t,2.2)}
const T=2.9,SP=2.9/2.4,q=null;
function start(){if(q!==null){render(+q);document.title='ready';return}const s=performance.now();(function f(n){if(window.__rzsDone)return;const t=(n-s)/1000*SP;render(Math.min(t,T));(window.__rzsF=(window.__rzsF||0)+1);if(t<T)requestAnimationFrame(f);else window.dispatchEvent(new Event('ripzone:splashdone'))})(s)}
ld("logo","splash/c/logo.webp");ld("icon","splash/c/icon.webp");
})();
