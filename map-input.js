(function(root){'use strict';
 function clampCamera(v,bounds,minWidth=320,minHeight=200){
  const scale=Math.min(Math.max(1,minWidth/v.w,minHeight/v.h),bounds.w/v.w,bounds.h/v.h);
  const w=v.w*scale,h=v.h*scale;
  return {x:Math.max(bounds.x,Math.min(bounds.x+bounds.w-w,v.x)),y:Math.max(bounds.y,Math.min(bounds.y+bounds.h-h,v.y)),w,h};
 }
 function pinchCamera(start,mid,distance,clamp){
  const factor=start.distance/Math.max(1,distance);
  const v=clamp({...start.view,w:start.view.w*factor,h:start.view.h*factor});
  const scale=start.scale*start.view.w/v.w;
  return clamp({...v,x:start.anchor.x-(mid.x-start.origin.x)/scale,y:start.anchor.y-(mid.y-start.origin.y)/scale});
 }
 function attach(svg,{getView,setView,clamp,onTap,onEnd}){
  const pointers=new Map();let start=null,consumed=false;
  const points=()=>[...pointers.values()];
  function rebase(){
   const p=points(),view={...getView()},m=svg.getScreenCTM();
   if(!p.length){start=null;return;}
   const mid=p.length>1?{x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2}:p[0];
   start={view,mid:{x:mid.x,y:mid.y},scale:m.a,origin:{x:m.e+view.x*m.a,y:m.f+view.y*m.d},anchor:{x:(mid.x-m.e)/m.a,y:(mid.y-m.f)/m.d},distance:p.length>1?Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y):0};
  }
  svg.onpointerdown=e=>{
   if(e.button!==0)return;
   if(!pointers.size)consumed=false;
   pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,target:e.target,type:e.pointerType});
   if(e.pointerType!=='mouse')svg.setPointerCapture(e.pointerId);
   if(pointers.size>1)consumed=true;
   rebase();
  };
  svg.onpointermove=e=>{
   const p=pointers.get(e.pointerId);if(!p||!start)return;
   p.x=e.clientX;p.y=e.clientY;
   const all=points();
   if(all.length>1){
    const mid={x:(all[0].x+all[1].x)/2,y:(all[0].y+all[1].y)/2};
    setView(pinchCamera(start,mid,Math.hypot(all[1].x-all[0].x,all[1].y-all[0].y),clamp));
   }else{
    const dx=p.x-start.mid.x,dy=p.y-start.mid.y;
    if(!consumed&&Math.hypot(dx,dy)<=5)return;
    consumed=true;svg.setPointerCapture(e.pointerId);
    setView(clamp({...start.view,x:start.view.x-dx/start.scale,y:start.view.y-dy/start.scale}));
   }
   svg.classList.add('dragging');
  };
  function end(e,cancelled=false){
   const p=pointers.get(e.pointerId);if(!p)return;
   const tapped=!consumed&&!cancelled&&pointers.size===1;
   pointers.delete(e.pointerId);
   if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);
   if(pointers.size){consumed=true;rebase();}
   else{start=null;svg.classList.remove('dragging');}
   onEnd(!tapped||p.type!=='mouse');
   // Captured touch events target the SVG; select the original unit explicitly.
   if(tapped&&p.type!=='mouse')onTap(p.target);
  }
  svg.onpointerup=e=>end(e);
  svg.onpointercancel=e=>end(e,true);
  svg.onlostpointercapture=e=>{if(pointers.has(e.pointerId))end(e,true);};
  svg.onpointerleave=e=>{if(e.pointerType==='mouse'&&!svg.hasPointerCapture(e.pointerId))end(e,true);};
 }
 const api={attach,clampCamera,pinchCamera};
 if(typeof module!=='undefined')module.exports=api;
 root.BARB_MAP_INPUT=api;
})(typeof globalThis!=='undefined'?globalThis:this);
