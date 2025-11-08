// ------------------------------------------------------
// OasiVR - Player Cinema (legge project.json)
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

// Libreria asset sanitari/mobili (per ora solo CUBE)
const ASSET_LIBRARY = {
  "CUBE": { type: "box" }
};

const LOOP_DURATION = 120; // secondi per il loop completo

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
    // fallback semplice
    const mat = new BABYLON.PBRMaterial("fallback-" + code, scene);
    mat.albedoColor = new BABYLON.Color3(0.8, 0.8, 0.8);
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
  if (def.normal) {
    const n = new BABYLON.Texture(def.normal, scene);
    n.uScale = def.rx;
    n.vScale = def.ry;
    n.wAng = (def.rot || 0) * Math.PI / 180;
    mat.bumpTexture = n;
  }
  return mat;
}

// Converte "wall" + offset in posizione 3D (stanza centrata in 0,0,0)
function wallPosition(room, wall, offset, y) {
  const L = room.length;
  const W = room.width;
  const h = y || 0;
  let x = 0, z = 0;
  const halfL = L / 2;
  const halfW = W / 2;

  switch (wall) {
    case "north": // z = -halfW
      z = -halfW;
      x = -halfL + offset;
      break;
    case "south": // z = +halfW
      z = halfW;
      x = -halfL + offset;
      break;
    case "west": // x = -halfL
      x = -halfL;
      z = -halfW + offset;
      break;
    case "east": // x = +halfL
      x = halfL;
      z = -halfW + offset;
      break;
    default:
      x = 0; z = 0;
  }
  return new BABYLON.Vector3(x, h, z);
}

// Direzione verso l'interno per una parete
function inwardDirection(wall) {
  switch (wall) {
    case "north": return new BABYLON.Vector3(0, 0, 1);
    case "south": return new BABYLON.Vector3(0, 0, -1);
    case "west":  return new BABYLON.Vector3(1, 0, 0);
    case "east":  return new BABYLON.Vector3(-1,0, 0);
    default:      return new BABYLON.Vector3(0, 0, 1);
  }
}

async function createScene() {
  const cfg = await loadProjectConfig();

  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.02, 0.02, 0.02, 1);

  const camera = new BABYLON.UniversalCamera("pov", new BABYLON.Vector3(0, 1.6, -2), scene);
  camera.minZ = 0.01;
  camera.maxZ = 100;
  camera.attachControl(canvas, true);

  const hemi = new BABYLON.HemisphericLight("h", new BABYLON.Vector3(0, 1, 0), scene);
  hemi.intensity = 0.9;

  const roomNode = new BABYLON.TransformNode("room", scene);

  const L = cfg.room.length;
  const W = cfg.room.width;
  const H = cfg.room.height;

  // Pavimento
  const floor = BABYLON.MeshBuilder.CreateGround("floor", { width: L, height: W }, scene);
  floor.parent = roomNode;

  // Pareti
  const wallNorth = BABYLON.MeshBuilder.CreatePlane("wallNorth", { width: L, height: H }, scene);
  wallNorth.position = new BABYLON.Vector3(0, H / 2, -W / 2);
  wallNorth.rotation.y = Math.PI;
  wallNorth.parent = roomNode;

  const wallSouth = BABYLON.MeshBuilder.CreatePlane("wallSouth", { width: L, height: H }, scene);
  wallSouth.position = new BABYLON.Vector3(0, H / 2, W / 2);
  wallSouth.parent = roomNode;

  const wallWest = BABYLON.MeshBuilder.CreatePlane("wallWest", { width: W, height: H }, scene);
  wallWest.position = new BABYLON.Vector3(-L / 2, H / 2, 0);
  wallWest.rotation.y = -Math.PI / 2;
  wallWest.parent = roomNode;

  const wallEast = BABYLON.MeshBuilder.CreatePlane("wallEast", { width: W, height: H }, scene);
  wallEast.position = new BABYLON.Vector3(L / 2, H / 2, 0);
  wallEast.rotation.y = Math.PI / 2;
  wallEast.parent = roomNode;

  // Materiali: pavimento, pareti, parete doccia
  const floorMat = getTileMaterial(scene, cfg.materials.floor);
  floor.material = floorMat;

  const wallsMat = getTileMaterial(scene, cfg.materials.walls);
  wallNorth.material = wallsMat;
  wallSouth.material = wallsMat;
  wallWest.material = wallsMat;
  wallEast.material = wallsMat;

  // TODO: parete doccia: per ora usiamo stessa mat walls
  // In seguito potremo identificare una porzione come "showerWall"
  // basandoci su cfg.room.shower

  // Lavabo + acqua fake (per ora come box + plane)
  let lavaboFixture = cfg.fixtures.find(f => f.type === "lavabo");
  if (!lavaboFixture && cfg.fixtures.length > 0) {
    lavaboFixture = cfg.fixtures[0]; // fallback
  }

  let lavaboPos = new BABYLON.Vector3(0, 0.9, -W / 2 + 0.3);
  if (lavaboFixture) {
    const basePos = wallPosition(cfg.room, lavaboFixture.wall, lavaboFixture.offset, 0.9);
    const inward = inwardDirection(lavaboFixture.wall).scale(0.35);
    lavaboPos = basePos.add(inward);
  }

  const sink = BABYLON.MeshBuilder.CreateBox("sink", { width: 0.6, height: 0.2, depth: 0.45 }, scene);
  sink.position = lavaboPos;

  const faucet = BABYLON.MeshBuilder.CreateCylinder("faucet", { diameter: 0.03, height: 0.2 }, scene);
  faucet.position = lavaboPos.add(new BABYLON.Vector3(0, 0.25, 0.1));

  const water = BABYLON.MeshBuilder.CreatePlane("water", { size: 0.22 }, scene);
  water.position = lavaboPos.add(new BABYLON.Vector3(0, -0.05, 0.15));
  water.rotation.x = Math.PI / 2;
  const waterMat = new BABYLON.StandardMaterial("waterMat", scene);
  waterMat.alpha = 0.7;
  waterMat.diffuseColor = new BABYLON.Color3(0.6, 0.7, 1.0);
  water.material = waterMat;
  water.isVisible = false;

  // Sanitari/mobili placeholder (CUBE)
  cfg.fixtures.forEach(f => {
    const basePos = wallPosition(cfg.room, f.wall, f.offset, 0);
    const inward = inwardDirection(f.wall).scale(0.3);
    const pos = basePos.add(inward);
    const mesh = BABYLON.MeshBuilder.CreateBox("fixture-" + f.id, { size: 0.4 }, scene);
    mesh.position = new BABYLON.Vector3(pos.x, 0.2, pos.z);
  });

  // Logo/claim overlay (GUI)
  const ui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
  const overlay = new BABYLON.GUI.Rectangle("overlay");
  overlay.width = 1;
  overlay.height = 1;
  overlay.background = "black";
  overlay.alpha = 0;
  overlay.thickness = 0;
  ui.addControl(overlay);

  const logoImg = new BABYLON.GUI.Image("logo", cfg.brand.logoUrl || "");
  logoImg.width = "200px";
  logoImg.height = "200px";
  logoImg.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
  logoImg.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
  overlay.addControl(logoImg);

  const claimText = new BABYLON.GUI.TextBlock("claim", cfg.brand.claim || "");
  claimText.color = "white";
  claimText.fontSize = 24;
  claimText.top = "140px";
  claimText.textWrapping = true;
  claimText.width = "80%";
  claimText.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
  claimText.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
  overlay.addControl(claimText);

  // Posizioni chiave del percorso
  const cameraHeight = 1.6;

  // Porta: centro + piccolo offset verso interno
  let doorPos = new BABYLON.Vector3(0, cameraHeight, W / 2 - 0.3);
  let doorInDir = inwardDirection(cfg.room.door.wall);
  let doorCenter = wallPosition(cfg.room, cfg.room.door.wall, cfg.room.door.offset, 0);
  doorPos = doorCenter.add(doorInDir.scale(0.4));
  doorPos.y = cameraHeight;

  const centerPos = new BABYLON.Vector3(0, cameraHeight, 0);
  const lavaboCamPos = lavaboPos.clone();
  lavaboCamPos.y = cameraHeight;

  let startTime = performance.now() / 1000;

  scene.onBeforeRenderObservable.add(() => {
    const now = performance.now() / 1000;
    let t = (now - startTime) % LOOP_DURATION; // [0, LOOP_DURATION)

    // gestione logo iniziale/finale (primi 3s e ultimi 3s)
    const FADE_TIME = 1.0;
    const SHOW_TIME = 2.0;
    let overlayAlpha = 0;

    if (t < (FADE_TIME + SHOW_TIME)) {
      // inizio loop: fade-in + show
      if (t < FADE_TIME) {
        overlayAlpha = t / FADE_TIME;
      } else {
        overlayAlpha = 1.0;
      }
    } else if (t > LOOP_DURATION - (FADE_TIME + SHOW_TIME)) {
      // fine loop: show + fade-out
      const t2 = LOOP_DURATION - t;
      if (t2 < FADE_TIME) {
        overlayAlpha = t2 / FADE_TIME;
      } else {
        overlayAlpha = 1.0;
      }
    } else {
      overlayAlpha = 0;
    }
    overlay.alpha = overlayAlpha;

    // timeline semplice per il movimento:
    // 0-10s: fermo vicino porta
    // 10-30s: porta -> centro
    // 30-50s: centro -> lavabo (acqua ON all'arrivo)
    // 50-90s: giro morbido attorno al centro con acqua ON
    // 90-110s: ritorno al lavabo (acqua OFF a 95s)
    // 110-117s: lavabo -> porta
    // 117-120s: stacco/logo (camera ferma)

    let camPos = doorPos.clone();
    let target = new BABYLON.Vector3(0, cameraHeight, -W / 2 + 0.3);

    // acqua ON/OFF
    if (t >= 30 && t <= 95) {
      water.isVisible = true;
    } else {
      water.isVisible = false;
    }

    const lerp = (a, b, k) => a.add(b.subtract(a).scale(k));
    const ease = (x) => (x < 0.5 ? 2 * x * x : -1 + (4 - 2 * x) * x);

    if (t < 10) {
      camPos = doorPos;
      target = centerPos;
    } else if (t < 30) {
      const tt = (t - 10) / 20;
      const k = ease(tt);
      camPos = lerp(doorPos, centerPos, k);
      target = centerPos;
    } else if (t < 50) {
      const tt = (t - 30) / 20;
      const k = ease(tt);
      camPos = lerp(centerPos, lavaboCamPos, k);
      target = new BABYLON.Vector3(lavaboCamPos.x, cameraHeight, lavaboCamPos.z - 0.5);
    } else if (t < 90) {
      const tt = (t - 50) / 40; // 0..1
      const angle = tt * Math.PI * 2 * 0.75; // quasi un giro completo
      const radius = Math.min(L, W) * 0.35;
      const cx = 0, cz = 0;
      camPos.x = cx + Math.cos(angle) * radius;
      camPos.y = cameraHeight;
      camPos.z = cz + Math.sin(angle) * radius;
      target = centerPos;
    } else if (t < 110) {
      const tt = (t - 90) / 20;
      const k = ease(tt);
      camPos = lerp(centerPos, lavaboCamPos, k);
      target = lavaboCamPos;
    } else if (t < 117) {
      const tt = (t - 110) / 7;
      const k = ease(tt);
      camPos = lerp(lavaboCamPos, doorPos, k);
      target = centerPos;
    } else {
      camPos = doorPos;
      target = centerPos;
    }

    camera.position.copyFrom(camPos);
    camera.setTarget(target);
  });

  // WebXR (VR mode)
  await scene.createDefaultXRExperienceAsync({
    floorMeshes: [floor]
  });

  return scene;
}

createScene().then(scene => {
  engine.runRenderLoop(() => {
    scene.render();
  });
});

window.addEventListener("resize", function () {
  engine.resize();
});
