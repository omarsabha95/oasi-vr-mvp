// ------------------------------------------------------
// OasiVR - Player Cinema (DEBUG VISIVO)
// Pavimento piastrellato, pareti colorate, loop semplice
// ------------------------------------------------------

// Libreria di piastrelle di test (codice -> texture)
const TILE_LIBRARY = {
  "G12345": {
    albedo: "https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?w=1024",
    normal: null,
    rx: 3,
    ry: 3,
    rot: 0
  },
  "M23001": {
    albedo: "https://images.pexels.com/photos/271743/pexels-photo-271743.jpeg?w=1024",
    normal: null,
    rx: 3,
    ry: 3,
    rot: 0
  }
};

const LOOP_DURATION = 40; // per ora loop corto per test

const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });

// Carica il file project.json
async function loadProjectConfig() {
  const res = await fetch("./project.json?_=" + Date.now());
  if (!res.ok) {
    throw new Error("Impossibile caricare project.json");
  }
  return await res.json();
}

function getTileMaterial(scene, code) {
  const def = TILE_LIBRARY[code];
  if (!def) {
    const mat = new BABYLON.PBRMaterial("fallback-" + code, scene);
    mat.albedoColor = new BABYLColor3(0.8, 0.8, 0.8);
    mat.roughness = 0.8;
    return mat;
  }
  const mat = new BABYLON.PBRMaterial("tile-" + code, scene);
  mat.roughness = 0.8;
  mat.metallic = 0.0;
  const tex = new BABYLON.Texture(def.albedo, scene);
  tex.uScale = def.rx;
  tex.vScale = def.ry;
  tex.wAng = (def.rot || 0) * Math.PI / 180;
  mat.albedoTexture = tex;
  return mat;
}

async function createScene() {
  const cfg = await loadProjectConfig();

  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.02, 0.02, 0.02, 1);

  const camera = new BABYLON.UniversalCamera("pov", new BABYLON.Vector3(0, 1.6, -4), scene);
  camera.minZ = 0.01;
  camera.maxZ = 100;

  const hemi = new BABYLON.HemisphericLight("h", new BABYLON.Vector3(0, 1, 0), scene);
  hemi.intensity = 0.9;

  const roomNode = new BABYLON.TransformNode("room", scene);

  const L = cfg.room.length;
  const W = cfg.room.width;
  const H = cfg.room.height;

  // PAVIMENTO (piastrella)
  const floor = BABYLON.MeshBuilder.CreateGround("floor", { width: L, height: W }, scene);
  floor.parent = roomNode;
  const floorMat = getTileMaterial(scene, cfg.materials.floor);
  floor.material = floorMat;

  // PARETI (solo colori, per capire il volume)
  const wallNorth = BABYLON.MeshBuilder.CreatePlane("wallNorth", { width: L, height: H }, scene);
  wallNorth.position = new BABYLON.Vector3(0, H / 2, -W / 2);
  wallNorth.rotation.y = Math.PI;
  wallNorth.parent = roomNode;
  const matNorth = new BABYLON.StandardMaterial("matNorth", scene);
  matNorth.diffuseColor = new BABYLON.Color3(0.9, 0.2, 0.2); // rosso
  wallNorth.material = matNorth;

  const wallSouth = BABYLON.MeshBuilder.CreatePlane("wallSouth", { width: L, height: H }, scene);
  wallSouth.position = new BABYLON.Vector3(0, H / 2, W / 2);
  wallSouth.parent = roomNode;
  const matSouth = new BABYLON.StandardMaterial("matSouth", scene);
  matSouth.diffuseColor = new BABYLON.Color3(0.2, 0.9, 0.2); // verde
  wallSouth.material = matSouth;

  const wallWest = BABYLON.MeshBuilder.CreatePlane("wallWest", { width: W, height: H }, scene);
  wallWest.position = new BABYLON.Vector3(-L / 2, H / 2, 0);
  wallWest.rotation.y = -Math.PI / 2;
  wallWest.parent = roomNode;
  const matWest = new BABYLON.StandardMaterial("matWest", scene);
  matWest.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.9); // blu
  wallWest.material = matWest;

  const wallEast = BABYLON.MeshBuilder.CreatePlane("wallEast", { width: W, height: H }, scene);
  wallEast.position = new BABYLON.Vector3(L / 2, H / 2, 0);
  wallEast.rotation.y = Math.PI / 2;
  wallEast.parent = roomNode;
  const matEast = new BABYLON.StandardMaterial("matEast", scene);
  matEast.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.2); // giallo
  wallEast.material = matEast;

  // Lavabo semplificato come box
  const sink = BABYLON.MeshBuilder.CreateBox("sink", { width: 0.6, height: 0.2, depth: 0.45 }, scene);
  sink.position = new BABYLON.Vector3(0, 0.9, -W / 2 + 0.4);

  // Acqua fake (plane sopra il lavandino)
  const water = BABYLON.MeshBuilder.CreatePlane("water", { size: 0.22 }, scene);
  water.position = sink.position.add(new BABYLON.Vector3(0, -0.05, 0.2));
  water.rotation.x = Math.PI / 2;
  const waterMat = new BABYLON.StandardMaterial("waterMat", scene);
  waterMat.alpha = 0.7;
  waterMat.diffuseColor = new BABYLON.Color3(0.6, 0.7, 1.0);
  water.material = waterMat;
  water.isVisible = false;

  // LOGO overlay semplice
  const ui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
  const logo = new BABYLON.GUI.TextBlock();
  logo.text = cfg.brand.claim || "Oasi Bagni";
  logo.color = "white";
  logo.fontSize = 32;
  logo.alpha = 0; // parte invisibile
  ui.addControl(logo);

  // ANIMAZIONE POV SEMPLICE (debug)
  let startTime = performance.now() / 1000;

  scene.onBeforeRenderObservable.add(() => {
    const now = performance.now() / 1000;
    let t = (now - startTime) % LOOP_DURATION; // [0, LOOP_DURATION)

    // acqua ON tra 10 e 25 secondi
    water.isVisible = (t >= 10 && t <= 25);

    // logo visibile solo tra 0-2s (inizio) e 38-40s (fine)
    if (t < 2 || t > 38) {
      logo.alpha = 1;
    } else {
      logo.alpha = 0;
    }

    // percorso molto semplice:
    // 0-10s: fermo vicino alla porta (lontano)
    // 10-20s: si avvicina al centro
    // 20-30s: si avvicina al lavandino
    // 30-40s: torna indietro

    const doorPos = new BABYLON.Vector3(0, 1.6, W / 2 + 1.5);
    const centerPos = new BABYLON.Vector3(0, 1.6, 0);
    const lavaboPos = sink.position.add(new BABYLON.Vector3(0, 0.7, 0.8));

    const lerp = (a, b, k) => a.add(b.subtract(a).scale(k));
    const ease = (x) => (x < 0.5 ? 2 * x * x : -1 + (4 - 2 * x) * x);

    let camPos, target;

    if (t < 10) {
      camPos = doorPos;
      target = centerPos;
    } else if (t < 20) {
      const tt = (t - 10) / 10;
      camPos = lerp(doorPos, centerPos, ease(tt));
      target = centerPos;
    } else if (t < 30) {
      const tt = (t - 20) / 10;
      camPos = lerp(centerPos, lavaboPos, ease(tt));
      target = sink.position;
    } else {
      const tt = (t - 30) / 10;
      camPos = lerp(lavaboPos, doorPos, ease(tt));
      target = centerPos;
    }

    camera.position.copyFrom(camPos);
    camera.setTarget(target);
  });

  // WebXR (VR)
  await scene.createDefaultXRExperienceAsync({
    floorMeshes: [floor]
  });

  return scene;
}

createScene().then(scene => {
  engine.runRenderLoop(() => scene.render());
});

window.addEventListener("resize", () => engine.resize());
