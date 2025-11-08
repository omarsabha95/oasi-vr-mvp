// --- util: leggi parametri URL ---
const params = new URLSearchParams(location.search);
const TILE_URL  = params.get("tileUrl")  || "https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?w=1024";
const NORMAL_URL= params.get("normalUrl");
const RX = parseFloat(params.get("rx")||"2");
const RY = parseFloat(params.get("ry")||"2");
const ROT= parseFloat(params.get("rot")||"0");

// --- setup babylon ---
const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer:true, stencil:true });

const createScene = async () => {
  const scene = new BABYLON.Scene(engine);
  scene.createDefaultEnvironment({ createSkybox:false, createGround:false });

  // camera “POV” con piccolo percorso
  const camera = new BABYLON.UniversalCamera("pov", new BABYLON.Vector3(-2.2, 1.6, -1.6), scene);
  camera.minZ = 0.01;
  camera.maxZ = 100;
  camera.attachControl(canvas, true);

  // luci leggere
  const hemi = new BABYLON.HemisphericLight("h", new BABYLON.Vector3(0,1,0), scene);
  hemi.intensity = 0.9;

  // stanza bagno semplice
  const room = new BABYLON.TransformNode("room", scene);
  // pavimento
  const floor = BABYLON.MeshBuilder.CreateGround("floor", { width:3.0, height:2.2 }, scene);
  floor.parent = room;

  // pareti (box sottili)
  const wall1 = BABYLON.MeshBuilder.CreateBox("w1", { width:3.0, height:2.6, depth:0.05 }, scene); wall1.position.z = -1.1; wall1.position.y=1.3; wall1.parent=room;
  const wall2 = BABYLON.MeshBuilder.CreateBox("w2", { width:2.2, height:2.6, depth:0.05 }, scene); wall2.rotation.y=Math.PI/2; wall2.position.x = -1.5; wall2.position.y=1.3; wall2.parent=room;
  const wall3 = wall2.clone("w3"); wall3.position.x = 1.5;

  // materiale piastrella PBR sul pavimento
  const tileMat = new BABYLON.PBRMaterial("tileMat", scene);
  tileMat.roughness = 0.8; tileMat.metallic = 0.0;
  tileMat.albedoTexture = new BABYLON.Texture(TILE_URL, scene);
  tileMat.albedoTexture.uScale = RX;
  tileMat.albedoTexture.vScale = RY;
  tileMat.albedoTexture.wAng  = ROT * Math.PI/180;
  if (NORMAL_URL){
    tileMat.bumpTexture = new BABYLON.Texture(NORMAL_URL, scene);
    tileMat.bumpTexture.uScale = RX;
    tileMat.bumpTexture.vScale = RY;
    tileMat.bumpTexture.wAng  = ROT * Math.PI/180;
  }
  floor.material = tileMat;

  // “lavandino” placeholder + rubinetto base
  const sink = BABYLON.MeshBuilder.CreateBox("sink", { width:0.6, height:0.2, depth:0.45 }, scene);
  sink.position.set(0, 0.9, -0.95);
  const faucet = BABYLON.MeshBuilder.CreateCylinder("faucet", { diameter:0.03, height:0.2 }, scene);
  faucet.position.set(0, 1.05, -0.85);

  // “acqua” fake: un piano nascosto che appare
  const water = BABYLON.MeshBuilder.CreatePlane("water", { size:0.22 }, scene);
  water.position.set(0, 1.0, -0.80);
  water.rotation.x = Math.PI/2;
  const waterMat = new BABYLON.StandardMaterial("waterMat", scene);
  waterMat.alpha = 0.7;
  waterMat.diffuseColor = new BABYLON.Color3(0.6,0.7,1.0);
  water.material = waterMat;
  water.isVisible = false;

  // semplice “percorso POV” (3 keyframe)
  const keys = [
    { p: new BABYLON.Vector3(-2.2,1.6,-1.6), t: 0   },
    { p: new BABYLON.Vector3(-1.0,1.6,-1.0), t: 2.5 },
    { p: new BABYLON.Vector3( 0.2,1.6,-1.0), t: 5.0 },
  ];
  let startTime = performance.now()/1000;
  scene.onBeforeRenderObservable.add(() => {
    const now = performance.now()/1000 - startTime;
    const dur = 5.0;
    const tt = Math.min(now, dur);
    const lerp = (a,b,t)=>a.add(b.subtract(a).scale(t));
    const ease = t=>t<0.5 ? 2*t*t : -1+(4-2*t)*t; // easeInOut
    const t01 = ease(tt/dur);
    const p01 = lerp(keys[0].p, keys[2].p, t01);
    camera.position.copyFrom(p01);
    camera.setTarget(new BABYLON.Vector3(0,1.0,-0.9));
  });

  // bottone GUI per ON/OFF acqua (per test rapido)
  const gui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("ui");
  const btn = BABYLON.GUI.Button.CreateSimpleButton("b","Apri/Chiudi acqua");
  btn.width="220px"; btn.height="48px"; btn.color="#111"; btn.background="#fff";
  btn.thickness = 0; btn.cornerRadius = 6; btn.top = "-20px";
  btn.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
  btn.onPointerUpObservable.add(()=> water.isVisible = !water.isVisible);
  gui.addControl(btn);

  // WebXR (VR mode disponibile su Quest)
  await scene.createDefaultXRExperienceAsync({
    floorMeshes: [floor]
  });

  return scene;
};

createScene().then(scene=>{
  engine.runRenderLoop(()=> scene.render());
});
window.addEventListener("resize", ()=> engine.resize());
