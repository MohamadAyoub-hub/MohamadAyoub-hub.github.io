import * as THREE from '../vendor/three/three.module.js';

const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const ease = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const ramp = (value, start, end) => ease((value - start) / (end - start));
const mix = (a, b, t) => a + (b - a) * t;

const SCENE_RESPONSE_MS = 220;
const MAX_SCENE_STEP_PER_SECOND = .72;
const AMOUNTS = [120, 89, 58];
const READY = [0, 1, 5];
const HELD = [2, 3, 4];
const scatter = [[-4.65,-1.9],[-2.05,1.78],[4.95,-1.14],[1.45,-1.78],[-4.05,2.05],[4.42,1.84]];
const columnX = i => (i % 3 - 1) * 2.62;
const ledger = i => [columnX(i), i < 3 ? -1.03 : 1.03];
const intake = i => [columnX(i) * .79, i < 3 ? -2.37 : -1.63];

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

export function tokenPose(index, t, record) {
  const [gridX,gridZ] = ledger(record);
  const [inputX,inputZ] = intake(record);
  const heldSlot = HELD.indexOf(record);
  const readySlot = READY.indexOf(record);
  const held = heldSlot !== -1;
  const resultX = columnX(held ? heldSlot : readySlot);
  const resultZ = held ? 2.11 : .22;
  let x,y=.36,z,scale=1,turn=0,signal=0;
  if (index === 0) {
    const [sx,sz] = scatter[record];
    const arrival = ramp(t,record * .041,.7 + record * .035);
    x = mix(sx,gridX,arrival); z = mix(sz,gridZ,arrival);
    y += Math.sin(arrival * Math.PI) * .26;
    turn = (1-arrival) * (record % 2 === 0 ? -.64 : .5);
  } else if (index === 1) {
    const start = .11 + record * .028;
    const collect = ramp(t,0,start);
    const through = ramp(t,start,start + .36);
    const stage = ramp(t,start + .29,.94 + record * .009);
    x = mix(mix(mix(gridX,-4.65,collect),0,through),inputX,stage);
    z = mix(mix(mix(gridZ,2.08,collect),.1,through),inputZ,stage);
    y += Math.sin(through * Math.PI) * .51;
  } else if (index === 2) {
    const travel = ramp(t,.11 + record * .022,.69 + record * .018);
    x = mix(inputX,resultX,travel) + Math.sin(travel * Math.PI) * (held ? 1.37 : -.38);
    z = mix(inputZ,resultZ,travel); y += Math.sin(travel * Math.PI) * .28;
    signal = ramp(t,.38,.73);
  } else if (index === 3) {
    const connect = ramp(t,.08,.66);
    x = mix(resultX,(readySlot-1) * .63,connect); z = mix(resultZ,1.45,connect);
    scale = held ? 1 - ramp(t,0,.35) : 1 - connect * .30;
    signal = 1;
  } else {
    const raise = ramp(t,.12 + Math.max(0,readySlot) * .065,.79 + Math.max(0,readySlot) * .065);
    x = mix((readySlot-1) * .63,resultX,ramp(t,0,.43));
    z = mix(1.45,.1,ramp(t,0,.43));
    y = .36 + (held ? 0 : AMOUNTS[readySlot] / 120 * 3.25 * raise);
    scale = held ? 0 : .7;
    signal = 1;
  }
  return {x,y,z,scale,turn,signal,held};
}

function makeWorld(renderer, compact) {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-8,8,5,-5,.1,90);
  const look = new THREE.Vector3();
  const resources = new Set();
  const keep = resource => { resources.add(resource); return resource; };
  const unit = keep(new THREE.BoxGeometry(1,1,1));
  const outline = keep(new THREE.EdgesGeometry(unit));
  const face = (color, options={}) => keep(new THREE.MeshStandardMaterial({color,metalness:.21,roughness:.53,...options}));
  const edge = (color, opacity) => keep(new THREE.LineBasicMaterial({color,opacity,transparent:opacity<1}));
  const glow = color => keep(new THREE.MeshBasicMaterial({color}));
  const graphite = face(0x121e30,{metalness:.38,roughness:.46});
  const slate = face(0x223751);
  const blue = face(0x1c3a65,{emissive:0x1b478c,emissiveIntensity:.21});
  const lit = face(0x3c70b3,{emissive:0x376bd1,emissiveIntensity:.26});
  const amber = face(0x533919,{emissive:0xb8750d,emissiveIntensity:.16});
  const blueLight = glow(0x76a8ff), amberLight = glow(0xf59e0b);
  const trim = edge(0x5886c6,.70), floorEdge = edge(0x33517d,.61), heldEdge = edge(0xb8863f,.70);
  const signal = edge(0x86b5ff,.99), dimSignal = edge(0x557cac,.69);
  const stages = Array.from({length:5},()=>new THREE.Group());
  scene.add(...stages);
  scene.add(new THREE.HemisphereLight(0xb6cbea,0x131e2e,1.48));
  const key = new THREE.DirectionalLight(0xebf3ff,2.72);
  key.position.set(-4,8,6);
  const rim = new THREE.DirectionalLight(0x5f96ff,1.92);
  rim.position.set(4,3,-6);
  scene.add(key,rim);

  function block(group,x,y,z,w,h,d,material,line) {
    const mesh = new THREE.Mesh(unit,material);
    mesh.position.set(x,y,z);
    mesh.scale.set(w,h,d);
    if(line) mesh.add(new THREE.LineSegments(outline,line));
    group.add(mesh);
    return mesh;
  }

  function slab(width,depth,height,radius,bevel) {
    const x=width/2,z=depth/2,r=radius;
    const shape=new THREE.Shape();
    shape.moveTo(-x+r,-z);
    shape.lineTo(x-r,-z); shape.quadraticCurveTo(x,-z,x,-z+r);
    shape.lineTo(x,z-r); shape.quadraticCurveTo(x,z,x-r,z);
    shape.lineTo(-x+r,z); shape.quadraticCurveTo(-x,z,-x,z-r);
    shape.lineTo(-x,-z+r); shape.quadraticCurveTo(-x,-z,-x+r,-z);
    const geometry=keep(new THREE.ExtrudeGeometry(shape,{
      depth:height,steps:1,curveSegments:3,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:1
    }));
    geometry.rotateX(-Math.PI/2);
    geometry.translate(0,-height/2,0);
    return geometry;
  }

  function cable(group,points,material) {
    const path = new THREE.CurvePath();
    for (let i=1;i<points.length;i++) {
      path.add(new THREE.LineCurve3(new THREE.Vector3(...points[i-1]),new THREE.Vector3(...points[i])));
    }
    const geometry = keep(new THREE.BufferGeometry().setFromPoints(path.getSpacedPoints(28)));
    group.add(new THREE.Line(geometry,material));
    return geometry;
  }

  function housing(group,x,z,w,d,material=slate) {
    block(group,x,.025,z,w+.14,.07,d+.14,graphite,floorEdge);
    block(group,x,.09,z,w,.09,d,material,trim);
    block(group,x,.151,z+d*.33,w*.63,.017,.025,blueLight);
  }

  // The two-piece base gives the workbench depth and a shaded edge.
  const lower = new THREE.Mesh(slab(13.06,6.06,.18,.30,.055),graphite);
  const workbench = new THREE.Mesh(slab(12.98,5.98,.18,.33,.048),slate);
  lower.position.y=-.365;
  workbench.position.y=-.14;
  scene.add(lower,workbench);
  [-1,1].forEach(side=>block(scene,side*4.95,-.255,3.052,1.62,.045,.016,blueLight));
  const grid = new THREE.GridHelper(12.7,26,0x4a71a0,0x263f61);
  grid.scale.z=.45;
  grid.position.y=.011;
  grid.material.transparent=true;
  grid.material.opacity=.38;
  keep(grid.geometry);
  keep(grid.material);
  scene.add(grid);
  const points=[];
  for(let i=0;i<(compact?14:38);i++) points.push(-6.05+(i*.865)%12.1,.044,-2.83+(i*.417)%5.66);
  const fasteners=keep(new THREE.BufferGeometry());
  fasteners.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
  scene.add(new THREE.Points(fasteners,keep(new THREE.PointsMaterial({color:0x86a7d2,size:.045,transparent:true,opacity:.6}))));

  // Ledger docks are separated so each of the six cartridges has its own slot.
  for(let i=0;i<6;i++) {
    const [x,z]=ledger(i);
    housing(stages[0],x,z,1.48,1.14,blue);
    [-1,1].forEach(side=>block(stages[0],x+side*.59,.18,z,.045,.065,.67,lit));
  }

  // Four supported inputs converge on a glass funnel. Only the CSV carries sample orders.
  const sourceX=[-4.65,-1.55,1.55,4.65];
  const portNames=['CSV','Excel','API','SQL'];
  const inputCables=[];
  const apiGeometry=keep(new THREE.OctahedronGeometry(.43));
  const sqlGeometry=keep(new THREE.CylinderGeometry(.45,.45,.62,18));
  const sqlBand=keep(new THREE.CylinderGeometry(.476,.476,.045,18));
  const dockZ=2.01;
  sourceX.forEach((x,i)=>{
    housing(stages[1],x,dockZ,1.52,1.28,i===0?lit:slate);
    if(i===0) {
      block(stages[1],x,.45,dockZ,.74,.56,.46,blue,trim);
      [.38,.49,.60].forEach(y=>block(stages[1],x,y,dockZ+.239,.43,.021,.022,blueLight));
    } else if(i===1) {
      [.26,.41,.56].forEach(y=>block(stages[1],x,y,dockZ,.89,.092,.69,blue,trim));
      [-1,0,1].forEach(offset=>block(stages[1],x+offset*.2,.61,dockZ,.014,.014,.52,blueLight));
    } else if(i===2) {
      const body=new THREE.Mesh(apiGeometry,lit);
      body.position.set(x,.59,dockZ);
      stages[1].add(body);
      [-1,1].forEach(side=>block(stages[1],x+side*.49,.21,dockZ,.16,.09,.20,blueLight));
    } else {
      const body=new THREE.Mesh(sqlGeometry,blue);
      body.position.set(x,.49,dockZ);
      stages[1].add(body);
      [.24,.48,.73].forEach(y=>{
        const band=new THREE.Mesh(sqlBand,lit);
        band.position.set(x,y,dockZ);
        stages[1].add(band);
      });
    }
    const path=[[x,.109,1.31],[x,.109,.88],[x*.45,.109,.35],[0,.109,-.05]];
    cable(stages[1],path,floorEdge);
    inputCables.push(cable(stages[1],path,i===0?signal:dimSignal));
  });
  const funnelGeometry=keep(new THREE.CylinderGeometry(1.03,.51,.91,8,1,true));
  const funnelGlass=face(0x5587c8,{metalness:.12,roughness:.28,transparent:true,opacity:.32,side:THREE.DoubleSide,depthWrite:false});
  const funnel=new THREE.Mesh(funnelGeometry,funnelGlass);
  funnel.position.set(0,.56,-.08);
  funnel.add(new THREE.LineSegments(keep(new THREE.EdgesGeometry(funnelGeometry)),trim));
  stages[1].add(funnel);
  housing(stages[1],0,-.07,1.2,.97,blue);
  cable(stages[1],[[0,.126,-.65],[0,.126,-1.38],[-2.06,.126,-2.03]],signal);
  housing(stages[1],0,-1.98,5.8,1.56,blue);

  // Gate, checked lane and a separate amber tray for the three exceptions.
  [-1,1].forEach(side=>{
    housing(stages[2],side*3.61,-.82,.61,.67);
    block(stages[2],side*3.61,.87,-.82,.30,1.49,.38,graphite,trim);
    block(stages[2],side*3.61,.95,-.615,.035,.83,.022,blueLight);
  });
  block(stages[2],0,1.66,-.82,7.47,.24,.43,slate,trim);
  block(stages[2],0,1.58,-.587,7.10,.034,.028,blueLight);
  housing(stages[2],0,.22,7.47,1.03,blue);
  block(stages[2],0,.067,2.11,7.55,.127,1.16,amber,heldEdge);
  [-1,1].forEach(side=>block(stages[2],0,.171,2.11+side*.57,7.55,.112,.048,amber,heldEdge));
  const scanner=block(stages[2],0,.161,-.9,6.91,.013,.050,blueLight);
  [-2.62,0,2.62].forEach(x=>{
    cable(stages[2],[[x,.125,-2.53],[x,.125,-.82],[x,.151,.17]],signal);
    cable(stages[2],[[x,.16,.41],[x+.4,.115,1.31],[x,.148,2.11]],heldEdge);
    block(stages[2],x,.169,2.65,.19,.022,.033,amberLight);
  });

  // Table modules turn the star schema into a physical arrangement of rows and links.
  function tableModule(x,z,width,depth,main) {
    housing(stages[3],x,z,width,depth,main?lit:blue);
    block(stages[3],x,.34,z,width*.88,.42,depth*.87,graphite,trim);
    block(stages[3],x,.57,z,width*.88,.069,depth*.87,main?lit:blue,trim);
    [.23,.35,.45].forEach(y=>block(stages[3],x,y,z+depth*.442,width*.56,.019,.022,blueLight));
  }
  tableModule(0,-.09,3.12,1.49,true);
  const schemaCables=[];
  [-1,1].forEach(side=>{
    tableModule(4.37*side,-1.41,1.94,1.52,false);
    const path=[[1.52*side,.127,-.09],[2.43*side,.127,-.09],[2.43*side,.127,-1.41],[3.38*side,.127,-1.41]];
    cable(stages[3],path,floorEdge);
    schemaCables.push(cable(stages[3],path,signal));
  });

  const barHeights=[0,0,0];
  const bars=AMOUNTS.map((_,i)=>{
    const x=columnX(i);
    housing(stages[4],x,.1,1.81,1.61,blue);
    const body=block(stages[4],x,.15,.1,1.19,.05,1.04,lit,trim);
    const cap=block(stages[4],x,.17,.1,1.22,.065,1.07,blueLight);
    return {body,cap};
  });
  [.68,1.43,2.18,2.93,3.68].forEach(y=>cable(stages[4],[[-4.25,y,-.98],[4.25,y,-.98]],floorEdge));

  // Six beveled cartridges and their inlays remain instanced through all five scenes.
  const tokenMaterial=face(0xffffff,{metalness:.3,roughness:.36,emissive:0x10213d,emissiveIntensity:.23});
  const tokens=new THREE.InstancedMesh(slab(.92,.65,.17,.095,.031),tokenMaterial,6);
  const inlays=new THREE.InstancedMesh(unit,glow(0xffffff),6);
  const pixels=new Uint8Array(32*32*4);
  for(let y=0;y<32;y++) for(let x=0;x<32;x++) {
    const distance=Math.hypot((x-15.5)/15.5,(y-15.5)/15.5);
    pixels[(y*32+x)*4+3]=Math.round(133*Math.max(0,1-distance)**1.9);
  }
  const shadowTexture=keep(new THREE.DataTexture(pixels,32,32,THREE.RGBAFormat));
  shadowTexture.minFilter=shadowTexture.magFilter=THREE.LinearFilter;
  shadowTexture.needsUpdate=true;
  const shadowPlane=keep(new THREE.PlaneGeometry(1,1));
  shadowPlane.rotateX(-Math.PI/2);
  const shadowMaterial=keep(new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false}));
  const shadows=new THREE.InstancedMesh(shadowPlane,shadowMaterial,6);
  [tokens,inlays,shadows].forEach(mesh=>{
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled=false;
    scene.add(mesh);
  });

  const markerGeometry=keep(new THREE.RingGeometry(.55,.596,24));
  markerGeometry.rotateX(-Math.PI/2);
  const traceMarker=new THREE.Mesh(markerGeometry,blueLight);
  traceMarker.visible=false;
  scene.add(traceMarker);
  const transform=new THREE.Object3D();
  const raw=new THREE.Color(0x879fbe), readyColor=new THREE.Color(0x5c8cff), heldColor=new THREE.Color(0xf59e0b);
  const traceBlue=new THREE.Color(0xd9ebff), traceAmber=new THREE.Color(0xffcb70), tint=new THREE.Color();
  const holdPositions=HELD.map(()=>new THREE.Vector3());
  const rigs=[
    [4.6,9.7,15.1,.43],[3.45,9.4,15.2,.52],[.28,10.2,15.0,.44],
    [2.7,9.6,15.3,.5],[2.9,8.65,15.0,.89]
  ];

  function update(index,t,aspect,traced) {
    stages.forEach((group,i)=>{group.visible=i===index;});
    const rig=rigs[index], next=rigs[Math.min(index+1,rigs.length-1)];
    const turn=ramp(t,.28,1);
    camera.position.set(mix(rig[0],next[0],turn),mix(rig[1],next[1],turn),mix(rig[2],next[2],turn));
    const width=Math.max(14.4,aspect*(index===2?6.72:8.72));
    const height=width/aspect;
    camera.left=-width/2; camera.right=width/2; camera.top=height/2; camera.bottom=-height/2;
    look.set(0,mix(rig[3],next[3],turn),0);
    camera.lookAt(look);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    if(index===1) inputCables.forEach((g,i)=>g.setDrawRange(0,Math.round(29*ramp(t,.08+i*.05,.54+i*.065))));
    if(index===2) scanner.position.z=mix(-1.44,.45,ramp(t,.12,.85));
    if(index===3) schemaCables.forEach((g,i)=>g.setDrawRange(0,Math.round(29*ramp(t,.16+i*.12,.74+i*.12))));
    if(index===4) bars.forEach(({body,cap},i)=>{
      const height=AMOUNTS[i]/120*3.25*ramp(t,.12+i*.065,.79+i*.065);
      barHeights[i]=height;
      body.scale.y=Math.max(.025,height);
      body.position.y=.115+height/2;
      cap.position.y=.15+height;
    });
    traceMarker.visible=false;
    for(let i=0;i<6;i++) {
      const state=tokenPose(index,t,i);
      const size=Math.max(.001,state.scale);
      const selected=i===traced;
      const color=state.held&&state.signal>.4?traceAmber:traceBlue;
      tint.copy(raw).lerp(state.held?heldColor:readyColor,state.signal);
      if(selected) tint.lerp(color,.56);
      transform.rotation.set(0,state.turn,0);
      transform.position.set(state.x,state.y,state.z);
      transform.scale.setScalar(size);
      transform.updateMatrix();
      tokens.setMatrixAt(i,transform.matrix);
      tokens.setColorAt(i,tint);
      transform.position.y+=.119*size;
      transform.scale.set(.52*size,.022*size,.080*size);
      transform.updateMatrix();
      inlays.setMatrixAt(i,transform.matrix);
      inlays.setColorAt(i,selected?color:tint);
      transform.position.set(state.x,.151,state.z);
      transform.scale.set(1.67*size,1,1.25*size);
      transform.updateMatrix();
      shadows.setMatrixAt(i,transform.matrix);
      if(state.held) holdPositions[HELD.indexOf(i)].set(state.x,state.y+.25,state.z);
      if(selected&&state.scale>.22) {
        traceMarker.visible=true;
        traceMarker.material=state.held&&state.signal>.4?amberLight:blueLight;
        traceMarker.position.set(state.x,state.y-.09*size,state.z);
        traceMarker.scale.setScalar(size);
      }
    }
    [tokens,inlays,shadows].forEach(mesh=>{mesh.instanceMatrix.needsUpdate=true;});
    tokens.instanceColor.needsUpdate=inlays.instanceColor.needsUpdate=true;
  }

  function draw(index,t,width,height,mode,traced=-1) {
    update(index,t,width/height,traced);
    renderer.setClearColor(mode==='stage'?0x080f1b:0x000000,mode==='stage'?1:0);
    renderer.clear(true,true,true);
    renderer.render(scene,camera);
  }

  const projection=new THREE.Vector3();
  function project(point) {
    projection.copy(point).project(camera);
    return {x:(projection.x+1)*50,y:(1-projection.y)*50};
  }
  function labels(index,t) {
    if(index===1) return sourceX.map((x,i)=>({text:portNames[i],...project(projection.set(x,.13,2.77))}));
    if(index===3&&t>.13) return [
      ['DimDate',-4.37,1.05,-1.41],['FactReadyOrders',0,1.12,-.09],['DimCurrency',4.37,1.05,-1.41]
    ].map(([text,x,y,z])=>({text,...project(projection.set(x,y,z))}));
    if(index===4&&t>=.69) return AMOUNTS.map((amount,i)=>({
      text:'$'+amount,...project(projection.set(columnX(i),barHeights[i]+.62,.1))
    }));
    return [];
  }
  return {draw,labels,heldPoints:()=>holdPositions.map(project),dispose(){
    [tokens,inlays,shadows].forEach(mesh=>mesh.dispose());
    resources.forEach(item=>item.dispose());
    scene.clear();
  }};
}

function validationOverlay(view) {
  const group=view.querySelector('.room-token-controls');
  const caption=view.parentElement.querySelector('.room-display-note');
  const defaultNote='Portfolio project / sample data';
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
    caption.textContent=i===-1?defaultNote:defaultNote+' · '+buttons[i].label+' — '+buttons[i].reason;
    buttons.forEach(({button},index)=>button.setAttribute('aria-pressed',String(index===selected)));
  }
  return {
    show(points,rect) {
      if(points && points.length===buttons.length) {
        buttons.forEach(({button},i)=>{
          button.style.setProperty('--token-x',(points[i].x*rect.width/100).toFixed(1)+'px');
          button.style.setProperty('--token-y',(points[i].y*rect.height/100).toFixed(1)+'px');
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

export function mountRoomScene(canvas,context,{compact,onFailure}) {
  const root=document.documentElement;
  const story=document.querySelector('.room-story');
  const stages=[...document.querySelectorAll('[data-room-scene]')];
  const ledgerPanel=document.querySelector('.room-ledger');
  const shell=story.querySelector('.room-display');
  const display=shell.querySelector('.room-display-view');
  const currentLabel=story.querySelector('#room-current-scene');
  const sceneRail=story.querySelector('.room-stage-rail');
  const overlay=validationOverlay(display);
  const labels=[...display.querySelectorAll('.room-instrument-labels span')];
  function showLabels(entries,rect,index) {
    labels.forEach((label,i)=>{
      const entry=entries[i];
      label.hidden=!entry;
      if(!entry) return;
      const edge=entry.text.length*2.75+5;
      const x=clamp(entry.x*rect.width/100,edge,rect.width-edge);
      const y=clamp(entry.y*rect.height/100+(rect.height<145&&entry.text==='FactReadyOrders'?8:0),9,rect.height-9);
      label.textContent=entry.text;
      label.classList.toggle('report-label',index===4);
      label.style.setProperty('--label-x',x.toFixed(1)+'px');
      label.style.setProperty('--label-y',y.toFixed(1)+'px');
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
    if(mode==='park') {
      const w=Math.min(viewportWidth*.52,760), h=Math.min(viewportHeight*.62,520);
      return {left:viewportWidth-w,top:viewportHeight-h,width:w,height:h};
    }
    const rect=ledgerPanel.getBoundingClientRect();
    const padX=viewportWidth<860?12:64, padY=viewportWidth<860?35:82;
    return {left:rect.left-padX,top:rect.top-padY,width:rect.width+2*padX,height:rect.height+2*padY};
  }
  function clearSurface() {
    root.classList.remove('room-3d','room-stage-open','room-parked','room-hero-live');
    overlay.show(null);
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
    const mode=target.parked?'park':target.value>=1?'stage':'hero';
    const rect=aperture(mode);
    const onScreen=rect.width>32&&rect.height>32&&rect.left+rect.width>0&&rect.left<viewportWidth&&rect.top+rect.height>0&&rect.top<viewportHeight;
    if(!onScreen){
      clearSurface(); renderKey=''; lastFrame=0; previousChain=false;
      return;
    }
    const dt=lastFrame?Math.min(40,Math.max(0,now-lastFrame)):16;
    drawnPose=followScenePose(drawnPose,target.value,dt);
    const settling=Math.abs(target.value-drawnPose)>.002;
    if(!settling) drawnPose=target.value;
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
    const key=[mode,width,height,ratio,drawnPose.toFixed(4),traced].join('|');
    if(renderKey!==key) {
      try {
        if(width!==surfaceWidth||height!==surfaceHeight||ratio!==surfaceRatio){
          renderer.setDrawingBufferSize(width,height,ratio);
          canvas.style.width=width+'px'; canvas.style.height=height+'px';
          surfaceWidth=width; surfaceHeight=height; surfaceRatio=ratio;
        }
        world.draw(index,t,width,height,mode,traced);
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
      root.classList.toggle('room-parked',mode==='park');
      root.classList.toggle('room-hero-live',mode==='hero');
      sceneRail.style.setProperty('--scene-progress',(drawnPose/5).toFixed(4));
      overlay.show(mode==='stage'&&index===2&&t>=.77?world.heldPoints():null,rect);
      showLabels(mode==='stage'?world.labels(index,t):[],rect,index);

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
    if(settling||metricsDirty) queue();
  }
  function scroll() {
    if(renderKey.startsWith('park|')&&!metricsDirty&&window.scrollY+readingOffset>=reportEnd) return;
    queue();
  }
  function stop(){
    if(raf) cancelAnimationFrame(raf);
    raf=0; previousChain=false; lastFrame=0; renderKey='';
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
  addEventListener('scroll',scroll,{passive:true,signal});
  addEventListener('resize',()=>{metricsDirty=true; queue();},{passive:true,signal});
  document.fonts?.ready.then(()=>{if(!ended){metricsDirty=true; queue();}});
  return {setPlaying(play){
    enabled=play;
    if(play){root.classList.add('room-enhanced'); metricsDirty=true; queue();}
    else stop();
  },dispose};
}
