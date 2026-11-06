import * as THREE from '../vendor/three/three.module.js';
import {orders,readyOrders} from './journey.js';

const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const ease = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const ramp = (value, start, end) => ease((value - start) / (end - start));
const mix = (a, b, t) => a + (b - a) * t;

const SCENE_RESPONSE_MS = 260;
const STAGE_TRANSITION_MS = 300;
const MAX_SCENE_STEP_PER_SECOND = .72;
const HELD = orders.flatMap((row,i)=>row.reason?[i]:[]);

export function roomProgress(scroll, height, anchors, end, offset = height * .46) {
  const line = scroll + offset;
  if (line >= end) return {value:5, parked:true};
  if (line < anchors[1]) return {value:clamp(scroll / Math.max(1, anchors[1] - offset),0,.999),parked:false};
  for (let i = 1; i < anchors.length; i++) {
    const next = anchors[i+1] ?? end;
    if (line < next) return {value:i + clamp((line - anchors[i]) / Math.max(1,next - anchors[i]),0,.999),parked:false};
  }
  return {value:5,parked:true};
}

export function scenePose(value) {
  return {index:Math.min(4,Math.floor(value)), t:value >= 5 ? 1 : value % 1};
}

function followScenePose(current, target, deltaMs) {
  if (!Number.isFinite(current) || target >= 5) return target;

  const destination = scenePose(target).index;
  if (scenePose(current).index !== destination) {
    // An anchor jump begins inside the requested chapter.
    current = destination + (target < current ? .999 : 0);
  }
  const distance = target - current;
  const easing = 1 - Math.exp(-deltaMs / SCENE_RESPONSE_MS);
  const maximumStep = MAX_SCENE_STEP_PER_SECOND * deltaMs / 1000;
  return current + Math.sign(distance) * Math.min(Math.abs(distance) * easing, maximumStep);
}

function makeWorld(renderer, compact) {
  const scene=new THREE.Scene();
  const camera=new THREE.OrthographicCamera(-8,8,5,-5,.1,70);
  const resources=new Set();
  function keep(resource) {
    resources.add(resource);
    return resource;
  }

  const atmosphere=keep(new THREE.DataTexture(
    new Uint8Array([8,18,31,255,15,29,44,255,11,23,39,255,19,43,53,255]),
    2,2,THREE.RGBAFormat
  ));
  atmosphere.colorSpace=THREE.SRGBColorSpace;
  atmosphere.minFilter=atmosphere.magFilter=THREE.LinearFilter;
  atmosphere.needsUpdate=true;
  const key=new THREE.DirectionalLight(0xd7eaff,2.65);
  const rim=new THREE.DirectionalLight(0x78bdcb,1.22);
  key.position.set(-4,8,5);
  rim.position.set(6,3,-5);
  scene.add(key,rim,new THREE.HemisphereLight(0xd3e9ff,0x293b56,1.53));

  const standard=(color,metalness=.22,roughness=.52)=>keep(new THREE.MeshStandardMaterial({color,metalness,roughness}));
  const flat=color=>keep(new THREE.MeshBasicMaterial({color}));
  const base=standard(0x111b2c,.43,.55);
  const edge=standard(0x2b4059,.46,.40);
  const dark=standard(0x192b41,.35,.48);
  const satin=standard(0x36536e,.36,.37);
  const tealMetal=standard(0x187d81,.30,.36);
  const warmMetal=standard(0x8b5d31,.22,.50);
  const raw=standard(0x486680,.32,.40);
  const teal=flat(0x5ce1d4);
  const blue=flat(0x7fa7f5);
  const amber=flat(0xf8b76a);
  const dim=flat(0x355471);
  const silver=standard(0x9ce2ef,.25,.32);
  const quiet=standard(0x273d51);
  const cube=keep(new THREE.BoxGeometry(1,1,1));
  const pin=keep(new THREE.CylinderGeometry(.071,.071,.023,12));
  const sphere=keep(new THREE.SphereGeometry(.09,12,8));
  const bracket=keep(new THREE.TorusGeometry(.43,.018,6,32));
  const groups=Array.from({length:5},()=>new THREE.Group());
  scene.add(...groups);

  function box(group,material,x,y,z,w,h,d,geometry=cube) {
    const mesh=new THREE.Mesh(geometry,material);
    mesh.position.set(x,y,z);
    mesh.scale.set(w,h,d);
    group.add(mesh);
    return mesh;
  }
  function rounded(w,d,h,r) {
    const x=w/2,z=d/2;
    const shape=new THREE.Shape();
    shape.moveTo(-x+r,-z);
    shape.lineTo(x-r,-z); shape.quadraticCurveTo(x,-z,x,-z+r);
    shape.lineTo(x,z-r); shape.quadraticCurveTo(x,z,x-r,z);
    shape.lineTo(-x+r,z); shape.quadraticCurveTo(-x,z,-x,z-r);
    shape.lineTo(-x,-z+r); shape.quadraticCurveTo(-x,-z,-x+r,-z);
    const mesh=keep(new THREE.ExtrudeGeometry(shape,{depth:h,bevelEnabled:true,bevelThickness:.033,bevelSize:.026,bevelSegments:1,curveSegments:3}));
    mesh.rotateX(-Math.PI/2);
    mesh.translate(0,-h/2,0);
    return mesh;
  }
  function pinAt(group,x,z) {
    const item=new THREE.Mesh(pin,satin);
    item.position.set(x,.018,z);
    group.add(item);
  }

  const chassis=new THREE.Group();
  scene.add(chassis);
  box(chassis,base,0,-.28,0,1,1,1,rounded(11.65,6.00,.36,.26));
  box(chassis,edge,0,-.075,0,1,1,1,rounded(11.45,5.81,.067,.24));
  box(chassis,base,0,-.027,0,1,1,1,rounded(11.21,5.57,.036,.22));
  const calibration=new THREE.GridHelper(11,22,0x2b4057,0x263952);
  calibration.scale.z=.48;
  calibration.position.y=.030;
  calibration.material.transparent=true;
  calibration.material.opacity=.45;
  keep(calibration.geometry);
  keep(calibration.material);
  chassis.add(calibration);
  for (const x of [-5.38,5.38]) for (const z of [-2.58,2.58]) pinAt(chassis,x,z);
  for (const x of [-3.87,0,3.87]) box(chassis,dim,x,-.177,2.999,.77,.026,.018);

  function path(group,points,color) {
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    const conduit=keep(new THREE.TubeGeometry(curve,compact?20:32,.025,5,false));
    group.add(new THREE.Mesh(conduit,color));
    return curve;
  }
  const samplePoint=new THREE.Vector3();
  function send(group,curve,color) {
    const packet=new THREE.Mesh(sphere,color);
    packet.scale.set(1.4,.57,1);
    group.add(packet);
    return progress=>{
      packet.visible=progress>0 && progress<1;
      if (packet.visible) {
        curve.getPoint(progress,samplePoint);
        packet.position.copy(samplePoint);
        packet.position.y+=.033;
      }
    };
  }

  function dock(group,x,z,w,d,light=blue) {
    box(group,dark,x,.047,z,w,.10,d);
    box(group,edge,x,.116,z,w-.12,.034,d-.12);
    box(group,light,x,.14,z+d/2-.09,Math.min(.53,w*.42),.023,.025);
  }
  const layout=[-.95,.72];
  const ledgerX=[-3.55,0,3.55];
  for (const x of ledgerX) for (const z of layout) dock(groups[0],x,z,2.05,1.18);
  for (let i=0;i<3;i++) path(groups[0],[[ledgerX[i],.02,-2.23],[ledgerX[i],.02,1.63]],dim);

  // Intake hardware: source trays, processor and a staging rack.
  const intake=groups[1];
  dock(intake,-4.24,.09,1.76,3.52);
  for (const z of [-.91,.09,1.09]) {
    box(intake,satin,-4.24,.215,z,1.32,.15,.71);
    box(intake,blue,-4.24,.30,z-.25,.63,.019,.023);
  }
  dock(intake,-.54,0,2.16,2.04);
  box(intake,dark,-.54,.40,0,1.91,.61,1.75);
  box(intake,satin,-.54,.744,0,1.58,.068,1.45);
  box(intake,tealMetal,-.54,.805,0,1.08,.078,1.01);
  box(intake,teal,-.54,.854,0,.71,.019,.65);
  for (const side of [-1,1]) {
    for (const z of [-.52,-.19,.19,.52]) box(intake,edge,-.54+.92*side,.26,z,.31,.08,.055);
  }
  dock(intake,3.71,0,2.34,3.58,teal);
  for (const z of [-.99,0,.99]) {
    box(intake,dark,3.71,.225,z,1.98,.13,.78);
    box(intake,dim,3.71,.301,z-.27,1.64,.018,.025);
  }
  const intakeRoute=path(intake,[[-4.07,.25,-.21],[-2.36,.24,-.21],[-1.63,.34,0],[-.55,.87,0],[.67,.31,0],[2.15,.24,-.19],[3.72,.24,-.19]],dim);
  const intakeSignal=send(intake,intakeRoute,teal);

  // The gate exposes separate ready and review destinations.
  const verify=groups[2];
  dock(verify,-4.10,0,1.63,2.28);
  for (const z of [-1.25,1.25]) {
    dock(verify,-1.6,z,.77,.58);
    box(verify,dark,-1.6,.79,z,.48,1.30,.47);
    box(verify,blue,-1.34,.84,z,.019,.72,.045);
  }
  box(verify,edge,-1.60,1.48,0,.57,.20,2.78);
  box(verify,blue,-1.29,1.45,0,.019,.039,2.24);
  const beam=keep(new THREE.MeshBasicMaterial({color:0x8bb6ff,transparent:true,opacity:.15,depthWrite:false}));
  const scan=box(verify,beam,-1.48,.74,0,.049,1.23,2.28);
  const checkReady=path(verify,[[-4.03,.21,0],[-2.2,.21,0],[-1.55,.21,0],[-.42,.21,-1.02],[1.09,.21,-1.10],[4.97,.21,-1.10]],dim);
  const checkHeld=path(verify,[[-1.55,.21,0],[-.44,.21,1.17],[1.08,.21,1.27],[4.97,.21,1.27]],dim);
  const readySignal=send(verify,checkReady,teal);
  const heldSignal=send(verify,checkHeld,amber);
  const laneX=[.23,2.53,4.83];
  for (const x of laneX) {
    dock(verify,x,-1.10,1.65,.87,teal);
    dock(verify,x,1.27,1.65,.87,amber);
  }

  // The two lookup modules link to the approved-order model and a measure.
  const model=groups[3];
  for (const z of [-1.52,1.29]) {
    dock(model,-4.13,z,1.96,1.23);
    box(model,satin,-4.13,.38,z,1.61,.49,.95);
    box(model,dark,-4.13,.66,z,1.44,.064,.81);
    for (const offset of [-.36,0,.36]) box(model,z<0?blue:teal,-4.13+offset,.708,z,.19,.024,.51);
  }
  dock(model,-.13,-.12,3.44,2.32,teal);
  box(model,tealMetal,-.13,.36,-.31,2.98,.45,1.29);
  box(model,dark,-.13,.613,-.31,2.76,.07,1.08);
  for (const x of [-1.08,-.13,.82]) box(model,teal,x,.662,-.31,.49,.021,.70);
  dock(model,4.04,.03,2.12,1.55,teal);
  box(model,dark,4.04,.435,.03,1.87,.57,1.26);
  box(model,satin,4.04,.758,.03,1.68,.057,1.09);
  box(model,teal,4.04,.797,.03,1.26,.019,.74);
  const joins=[-1.52,1.29].map((z,i)=>{
    const curve=path(model,[[-3.12,.15,z],[-2.41,.15,z],[-1.81,.15,z*.58],[-.99,.15,0]],dim);
    return send(model,curve,i===0?blue:teal);
  });
  const measure=send(model,path(model,[[1.62,.18,-.24],[2.32,.18,-.24],[2.77,.18,.07],[3.52,.18,.07]],dim),teal);

  // Report stage: real geometry for the columns and their selected values.
  const report=groups[4];
  dock(report,-1.82,.22,7.40,2.86,blue);
  const plotX=[-4.02,-1.81,.40];
  const columns=readyOrders.map((row,i)=>{
    const x=plotX[i];
    dock(report,x,.35,1.50,1.12,teal);
    const column=box(report,tealMetal,x,.18,.35,1.05,1,1.05);
    const cap=box(report,teal,x,.23,.35,1.09,.04,1.09);
    return {row,x,column,cap};
  });
  for (const y of [.28,1.14,2,2.86]) {
    path(report,[[-5.26,y,-.53],[1.66,y,-.53]],dim);
  }
  dock(report,4.04,.10,2.19,2.65,teal);
  box(report,dark,4.04,.35,.10,1.91,.41,2.31);
  box(report,edge,4.04,.59,.10,1.75,.045,2.17);
  for (const z of [-.64,.08,.8]) box(report,dim,4.04,.624,z,1.20,.023,.16);
  const reportSignal=send(report,path(report,[[1.19,.18,1.23],[2.11,.18,1.23],[2.67,.18,.22],[3.67,.18,.22]],dim),teal);

  const packetShape=rounded(.86,.57,.12,.083);
  const packets=orders.map((_,i)=>{
    const group=new THREE.Group();
    scene.add(group);
    const shell=box(group,raw,0,0,0,1,1,1,packetShape);
    const strip=box(group,blue,0,.104,0,.51,.016,.059);
    return {group,shell,strip,index:i};
  });
  const traceRing=new THREE.Mesh(bracket,blue);
  traceRing.rotation.x=-Math.PI/2;
  scene.add(traceRing);

  const heldIndices=orders.flatMap((row,i)=>row.reason?[i]:[]);
  const readyIndices=readyOrders.map(row=>row.sourceIndex);
  function flight(i,index,t) {
    const row=orders[i];
    const c=i%3;
    if (index===0) {
      const u=ramp(t,.03+i*.04,.76+i*.028);
      return {x:mix((c-1)*4.9,ledgerX[c],u),y:.27+.83*(1-u)+Math.sin(u*Math.PI)*.34,z:mix(i<3?-2.27:2.27,layout[Math.floor(i/3)],u),turn:(1-u)*(c-1)*.76};
    }
    if (index===1) {
      const u=ramp(t,.06+i*.043,.68+i*.053);
      return {x:mix(-4.24,3.65,u),y:.39+Math.sin(Math.PI*u)*.74,z:mix((c-1)*1.09,(c-1)*.98,u)+(i>=3?.25:-.25),turn:Math.sin(u*Math.PI)*.42};
    }
    if (index===2) {
      const u=ramp(t,.06+i*.048,.66+i*.044);
      const slot=row.ready?readyIndices.indexOf(i):heldIndices.indexOf(i);
      const exit=ramp(u,.32,.90);
      return {x:mix(-4.2,laneX[slot],u),y:.31+Math.sin(Math.PI*u)*.39,z:mix((c-1)*.54,row.ready?-1.1:1.27,exit),turn:Math.sin(u*Math.PI)*.32};
    }
    const slot=readyIndices.indexOf(i);
    const u=ramp(t,.13+slot*.08,.72+slot*.075);
    return {x:mix(-1.3,-1.13+slot,u),y:.34+Math.sin(Math.PI*u)*.37,z:mix(1.85,.76,u),turn:(1-u)*.63};
  }

  let activeIndex=0, activeTrace=-1, activeDate='', activeT=0;
  const totals=()=>readyOrders.filter(row=>!activeDate||row.date===activeDate);
  const positions=new THREE.Vector3();
  function project(x,y,z) {
    positions.set(x,y,z).project(camera);
    return {x:(positions.x+1)*50,y:(1-positions.y)*50};
  }
  function labels() {
    const tag=(text,x,y,z,kind='')=>({text,...project(x,y,z),kind});
    if (activeIndex===1) return [
      tag('CSV SOURCE',-4.24,.88,-.38),
      tag('PYTHON',-.54,1.38,-.03,'accent'),
      tag('6 STAGED ROWS',3.72,.89,-.59,'accent')
    ];
    if (activeIndex===2) return [
      tag('VALIDATION',-1.61,1.99,-.33),
      tag('3 READY',3.29,.93,-1.33,'accent'),
      tag('3 HELD',3.49,.39,2.16,'review')
    ];
    if (activeIndex===3) {
      const selected=readyOrders.find(row=>row.sourceIndex===activeTrace);
      const current=selected||totals()[0]||readyOrders[0];
      const total=totals().reduce((sum,row)=>sum+row.amount,0);
      return [
        tag(current.date,-4.15,1.15,-1.62,'date'),
        tag('USD',-4.15,1.15,1.30,'accent'),
        tag('APPROVED ORDERS',-.14,1.31,-.43),
        tag('$'+total.toFixed(2),4.05,1.33,-.01,'value'),
        tag(activeDate||'ALL DATES',4.04,.47,1.05)
      ];
    }
    if (activeIndex===4) return [
      ...columns.map(({row,x,cap})=>tag(activeT>.68?'$'+row.amount:row.date,x,cap.position.y+.37,.37,'accent')),
      tag('$'+readyOrders.reduce((sum,row)=>sum+row.amount,0).toFixed(2),4.04,1.31,.05,'value'),
      tag('APPROVED TOTAL',4.04,.50,1.52),
      ...(activeT>.68?columns.map(({row,x})=>tag(row.date,x,.24,1.75,'date')):[])
    ];
    return [];
  }
  function heldPoints() {
    return heldIndices.map(i=>{
      const {group}=packets[i];
      return project(group.position.x,group.position.y+.16,group.position.z);
    });
  }

  function draw(index,t,width,height,mode,traced=-1,date='') {
    activeIndex=index;
    activeTrace=traced;
    activeDate=date;
    activeT=t;
    groups.forEach((group,i)=>{group.visible=i===index;});
    if (index===1) intakeSignal(ramp(t,.08,.94));
    if (index===2) {
      scan.position.x=mix(-2.22,-.92,ramp(t,.13,.80));
      scan.visible=t>.08 && t<.92;
      readySignal(ramp(t,.23,.76));
      heldSignal(ramp(t,.34,.90));
    }
    if (index===3) {
      joins.forEach((move,i)=>move(ramp(t,.07+i*.12,.69+i*.13)));
      measure(ramp(t,.36,.91));
    }
    if (index===4) {
      for (const [i,{row,column,cap}] of columns.entries()) {
        const height=.045+row.amount/120*2.73*ramp(t,.11+i*.065,.80+i*.046);
        column.scale.y=height;
        column.position.y=.18+height/2;
        column.material=row.sourceIndex===traced?silver:tealMetal;
        cap.position.y=.18+height;
      }
      reportSignal(ramp(t,.40,.95));
    }

    traceRing.visible=false;
    for (const {group,shell,strip,index:i} of packets) {
      const row=orders[i];
      const selected=i===traced;
      group.visible=index<3 || (index===3 && row.ready===true);
      if (!group.visible) continue;
      const move=flight(i,index,t);
      const held=index===2&&!row.ready;
      const filtered=index===3&&date&&row.date!==date;
      group.position.set(move.x,move.y-(filtered?.18:0),move.z);
      group.rotation.y=move.turn;
      group.scale.setScalar(filtered?.72:1);
      shell.material=filtered?quiet:held?warmMetal:selected?silver:index>=2?tealMetal:raw;
      strip.material=filtered?dim:held?amber:selected||index<2?blue:teal;
      if (selected && !filtered) {
        traceRing.visible=true;
        traceRing.material=held?amber:blue;
        traceRing.position.set(move.x,move.y-.065,move.z);
      }
    }

    const aspect=width/height;
    const w=Math.max(13.55,aspect*7.47);
    const h=w/aspect;
    camera.left=-w/2; camera.right=w/2;
    camera.top=h/2; camera.bottom=-h/2;
    const cameraX=mode==='hero'?-5.1:mix(-1.9,1.28,ramp(t,0,1));
    camera.position.set(cameraX,index===4?8.3:8.9,14.6);
    camera.lookAt(0,index===4?.91:.36,0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    scene.background=mode==='stage'?atmosphere:null;
    renderer.setClearColor(0x0b1422,mode==='stage'?1:0);
    renderer.clear(true,true,true);
    renderer.render(scene,camera);
  }
  return {draw,heldPoints,labels,dispose(){
    resources.forEach(resource=>resource.dispose());
    scene.clear();
  }};
}




function validationOverlay(view) {
  const group=view.querySelector('.room-token-controls');
  const caption=view.parentElement.querySelector('#room-display-message');
  const initialNote='Follow a source row through checks, modelling and reporting.';
  let stageNote=initialNote;
  const source=[...document.querySelectorAll('#scene-validate .room-held details')];
  let hovered=-1, focused=-1, selected=-1;
  const buttons=source.map((detail,i)=>{
    const label=detail.querySelector('summary').firstChild.textContent.trim();
    const reason=detail.querySelector('p').textContent.trim();
    const button=document.createElement('button');
    button.type='button'; button.className='room-token-button'; button.textContent=label;
    button.setAttribute('aria-label',label + ', ' + reason);
    button.setAttribute('aria-pressed','false');
    button.setAttribute('aria-controls','room-display-note');
    button.addEventListener('pointerenter',()=>{hovered=i; explain();});
    button.addEventListener('pointerleave',()=>{hovered=-1; explain();});
    button.addEventListener('focus',()=>{focused=i; explain();});
    button.addEventListener('blur',()=>{focused=-1; explain();});
    button.addEventListener('click',()=>{
      selected=selected===i?-1:i;
      explain();
    });
    button.addEventListener('keydown',event=>{
      if(event.key==='Escape'){
        event.preventDefault(); hovered=focused=selected=-1; explain();
      }
    });
    group.append(button);
    return {button,label,reason,detail};
  });
  function explain() {
    const i=hovered!==-1?hovered:focused!==-1?focused:selected;
    const message=i===-1?stageNote:buttons[i].label+' · '+buttons[i].reason;
    if (caption.textContent!==message) caption.textContent=message;
    buttons.forEach(({button},index)=>button.setAttribute('aria-pressed',String(index===selected)));
  }
  return {
    setNote(note=initialNote) {
      if (note===stageNote) return;
      stageNote=note;
      explain();
    },
    show(points,rect) {
      if(points && points.length===buttons.length) {
        buttons.forEach(({button},i)=>{
          const x=clamp(points[i].x*rect.width/100,22,rect.width-22);
          const y=clamp(points[i].y*rect.height/100,22,rect.height-22);
          button.style.setProperty('--token-x',x.toFixed(1)+'px');
          button.style.setProperty('--token-y',y.toFixed(1)+'px');
        });
        group.hidden=false;
      } else if(!group.hidden) {
        const previous=buttons.find(({button})=>document.activeElement===button);
        group.hidden=true;
        hovered=focused=selected=-1;
        explain();
        previous?.detail.querySelector('summary').focus({preventScroll:true});
      }
    }
  };
}

const STAGE_NAMES=['Ledger','Ingest','Validate','Model','Report'];
const STAGE_NOTES=[
  '',
  'Python stages six CSV rows and keeps a link to the original file.',
  'Checks on IDs, dates and amounts separate ready rows from exceptions.',
  'Date and currency keys let clients filter the same approved orders in Power BI.',
  'Power BI reports the approved total of USD 267.00.'
];

function workflowNote(index, traced, date) {
  const selected=orders[traced];
  if (index===3 && date && selected?.ready && selected.date!==date) {
    return selected.id+' is outside the '+date+' filter. The total reflects approved orders on that date.';
  }
  if (traced === 0) return [
    '',
    'A-101 enters from orders_sample.csv with its USD 120.00 amount.',
    'A-101 passes the ID, date and amount checks.',
    'A-101 joins the date and currency tables as one row in FactReadyOrders.',
    'A-101 contributes USD 120.00 to the Power BI total of USD 267.00.'
  ][index];
  if (index>=3 && HELD.includes(traced)) {
    return 'The selected row is held for review and stays out of the approved total.';
  }
  return STAGE_NOTES[index];
}

export function mountRoomScene(canvas,context,{compact,onFailure}) {
  const root=document.documentElement;
  const story=document.querySelector('.room-story');
  const stages=[...document.querySelectorAll('[data-room-scene]')];
  const ledgerPanel=document.querySelector('.room-ledger');
  const shell=story.querySelector('.room-display');
  const display=shell.querySelector('.room-display-view');
  const currentLabel=story.querySelector('#room-current-scene');
  const sceneRail=story.querySelector('.room-stage-rail');
  const veil=display.querySelector('.room-scene-veil');
  const overlay=validationOverlay(display);
  const liveLabels=[...display.querySelectorAll('.room-live-labels span')];
  function showLabels(entries,rect) {
    liveLabels.forEach((label,i)=>{
      const entry=entries[i];
      label.hidden=!entry;
      if (!entry) return;
      if (label.textContent!==entry.text) label.textContent=entry.text;
      if (label.className!==entry.kind) label.className=entry.kind;
      const edge=entry.kind==='value'?41:5+entry.text.length*2.65;
      const x=clamp(entry.x*rect.width/100,edge,rect.width-edge);
      const y=clamp(entry.y*rect.height/100,13,rect.height-13);
      label.style.setProperty('--live-x',x.toFixed(1)+'px');
      label.style.setProperty('--live-y',y.toFixed(1)+'px');
    });
  }
  const renderer=new THREE.WebGLRenderer({canvas,context});
  renderer.autoClear=false;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.12;
  if(renderer.debug) renderer.debug.onShaderError=()=>{throw new Error('Data Room shader unavailable');};
  let world;
  try {
    world=makeWorld(renderer,compact);
  } catch(error) {
    renderer.dispose();
    throw error;
  }
  const subscriptions=new AbortController(), signal=subscriptions.signal;
  let raf=0, enabled=false, ended=false, metricsDirty=true, viewportWidth=0, viewportHeight=0;
  let anchors=[], reportEnd=0, readingOffset=0, drawnPose=NaN, lastIndex=-1, renderKey='', lastFrame=0;
  let stageTransition=null, veilOpacity=0;
  let previousChain=false, slow=0, quality=1, surfaceWidth=0, surfaceHeight=0, surfaceRatio=0, surfacePosition="";

  const resize=new ResizeObserver(()=>{metricsDirty=true; queue();});
  [story,...stages,shell].forEach(item=>resize.observe(item));

  function readLayout() {
    const y=window.scrollY;
    anchors=stages.map(stage=>stage.getBoundingClientRect().top+y);
    reportEnd=stages.at(-1).getBoundingClientRect().bottom+y;
    const width=window.innerWidth, height=window.innerHeight;
    readingOffset=height*.46;
    if(width<860) {
      const stickyTop=Number.parseFloat(getComputedStyle(shell).top)||80;
      readingOffset=Math.max(readingOffset,stickyTop+shell.offsetHeight+9);
    }
    viewportWidth=width;
    viewportHeight=height;
    metricsDirty=false;
    renderKey='';
  }
  function aperture(mode) {
    if(mode==='stage') return display.getBoundingClientRect();
    const rect=ledgerPanel.getBoundingClientRect();
    const padX=viewportWidth<860?12:64, padY=viewportWidth<860?35:82;
    return {left:rect.left-padX,top:rect.top-padY,width:rect.width+2*padX,height:rect.height+2*padY};
  }
  function paintVeil(opacity) {
    const rounded=Math.round(opacity*100)/100;
    if (rounded===veilOpacity) return;
    veilOpacity=rounded;
    veil.style.opacity=String(rounded);
  }
  function stageTarget(value,mode,now) {
    const current=scenePose(drawnPose).index;
    const destination=scenePose(value).index;
    if (mode!=='stage' || !Number.isFinite(current) || current===0) {
      stageTransition=null;
      paintVeil(0);
      return value;
    }
    if (stageTransition && now-stageTransition.start>=STAGE_TRANSITION_MS) {
      stageTransition=null;
      paintVeil(0);
    }
    if (!stageTransition && current!==destination) {
      stageTransition={start:now,switched:false};
    }
    if (!stageTransition) return value;
    const phase=(now-stageTransition.start)/STAGE_TRANSITION_MS;
    paintVeil(ramp(phase,0,.42)*(1-ramp(phase,.55,1)));
    if (phase<.46) return drawnPose;
    if (!stageTransition.switched) {
      stageTransition.switched=true;
      return value;
    }
    return current===destination?value:drawnPose;
  }
  function clearSurface() {
    stageTransition=null;
    paintVeil(0);
    root.classList.remove('room-3d','room-stage-open','room-hero-live');
    overlay.show(null);
    overlay.setNote();
    showLabels([]);
    if(lastIndex!==-1){currentLabel.textContent='SCENE PREVIEW';lastIndex=-1;}
  }
  function queue() {
    if(enabled&&!ended&&!raf) raf=requestAnimationFrame(frame);
  }
  function frame(now) {
    raf=0;
    if(!enabled||ended) return;
    if(metricsDirty||window.innerWidth!==viewportWidth||window.innerHeight!==viewportHeight) readLayout();
    const target=roomProgress(window.scrollY,viewportHeight,anchors,reportEnd,readingOffset);
    const mode=target.value>=1?'stage':'hero';
    const rect=aperture(mode);
    const onScreen=rect.width>32&&rect.height>32&&rect.left+rect.width>0&&rect.left<viewportWidth&&rect.top+rect.height>0&&rect.top<viewportHeight;
    if(!onScreen){
      clearSurface(); renderKey=''; drawnPose=NaN; lastFrame=0; previousChain=false;
      return;
    }
    const dt=lastFrame?Math.min(40,Math.max(0,now-lastFrame)):16;
    const desired=stageTarget(target.value,mode,now);
    drawnPose=followScenePose(drawnPose,desired,dt);
    const settling=Math.abs(desired-drawnPose)>.002;
    if(!settling) drawnPose=desired;
    const {index,t}=scenePose(drawnPose);
    const width=Math.ceil(rect.width), height=Math.ceil(rect.height);
    const density=Math.min(window.devicePixelRatio||1,compact?1.35:1.85)*quality;
    const pixelBudget=compact?540000:1700000;
    const ratio=Math.min(density,Math.sqrt(pixelBudget/(width*height)));
    const position=`translate3d(${rect.left.toFixed(1)}px,${rect.top.toFixed(1)}px,0)`;
    if(surfacePosition!==position){
      canvas.style.transform=position;
      surfacePosition=position;
    }
    const traced=root.dataset.roomTrace===undefined?-1:Number(root.dataset.roomTrace);
    const date=index===3?(root.dataset.roomDate||''):'';
    const key=[mode,width,height,ratio,drawnPose.toFixed(4),traced,date].join('|');
    if(renderKey!==key) {
      try {
        if(width!==surfaceWidth||height!==surfaceHeight||ratio!==surfaceRatio){
          renderer.setDrawingBufferSize(width,height,ratio);
          canvas.style.width=width+'px'; canvas.style.height=height+'px';
          surfaceWidth=width; surfaceHeight=height; surfaceRatio=ratio;
        }
        world.draw(index,t,width,height,mode,traced,date);
        renderKey=key;
      } catch {
        fail();
        return;
      }
      if(index!==lastIndex){
        currentLabel.textContent='0'+index+' / '+STAGE_NAMES[index];
        lastIndex=index;
      }
      if(!root.classList.contains('room-3d')) root.classList.add('room-3d');
      root.classList.toggle('room-stage-open',mode==='stage');
      root.classList.toggle('room-hero-live',mode==='hero');
      sceneRail.style.setProperty('--scene-progress',(drawnPose/5).toFixed(4));
      overlay.show(mode==='stage'&&index===2&&t>=.84?world.heldPoints():null,rect);
      showLabels(mode==='stage'?world.labels():[],rect);
      overlay.setNote(mode==='stage'?workflowNote(index,traced,date):undefined);

      if(previousChain && lastFrame) {
        const elapsed=now-lastFrame;
        slow=elapsed>(compact?34:29)?slow+1:Math.max(0,slow-2);
        if(slow>=14 && quality===1) {
          quality=.69; slow=0; metricsDirty=true;
        } else if(slow>=21 && quality<1) {
          fail();
          return;
        }
      }
    }
    lastFrame=now;
    previousChain=settling;
    if(settling||stageTransition||metricsDirty) queue();
  }
  function scroll() {
    if(!renderKey&&!metricsDirty&&window.scrollY>=reportEnd) return;
    queue();
  }
  function stop(){
    if(raf) cancelAnimationFrame(raf);
    raf=0; previousChain=false; lastFrame=0; renderKey=''; drawnPose=NaN;
    clearSurface();
    root.classList.remove('room-enhanced');
  }
  function dispose(){
    if(ended) return;
    ended=true;
    stop();
    subscriptions.abort();
    resize.disconnect();
    world.dispose();
    renderer.dispose();
  }
  function fail(){
    dispose();
    onFailure();
  }
  canvas.addEventListener('webglcontextlost',fail,{signal});
  document.addEventListener('room-trace-change',queue,{signal});
  document.addEventListener('room-model-filter',queue,{signal});
  addEventListener('scroll',scroll,{passive:true,signal});
  addEventListener('resize',()=>{metricsDirty=true; queue();},{passive:true,signal});
  document.fonts?.ready.then(()=>{if(!ended){metricsDirty=true; queue();}});
  return {setPlaying(play){
    enabled=play;
    if(play){root.classList.add('room-enhanced'); metricsDirty=true; queue();}
    else stop();
  },dispose};
}
