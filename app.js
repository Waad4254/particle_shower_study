import * as RC from "./RenderCore/src/RenderCore.js";
import { _Math } from "./RenderCore/src/math/Math.js";
import { Vector3 } from "./RenderCore/src/math/Vector3.js";
import { Pane } from "./common/lib/tweakpane-4.0.3.min.js"
import * as tree from "./common/lib/TreeModel-min.js"
import * as jq from "https://ajax.googleapis.com/ajax/libs/jquery/1.11.0/jquery.min.js";
import {initVega} from "./vega.js"

//TreeModel-min.js

import * as TweakpaneEssentialsPlugin from "./common/lib/plugin-essentials/dist/tweakpane-plugin-essentials.js";
import * as TweakpaneFileInputPlugin from "./common/lib/tweakpane-plugin-file-import/dist/tweakpane-plugin-file-import.js";


class App {

    constructor(canvas) {
        window.RC = RC;
        window.App = this;

        // Timestamp calculation
        this.prevTime = -1;
        this.currTime;
        this.dt;
        this.count = 0;


        // GUI attributes
        this.GUIActive = false;
        this.lineStrip;
        this.lineStrip_low;
        this.lineStrip_meduim;
        this.lineStrip_high;
        this.limitT = 0.0;
        this.limitT_Max = 0.0;
        this.limitT_Min = 0.0;
        this.limitE_Max = 0.0;
        this.limitE_Min = 0.0;
        this.animationDuration = 0.1;
        this.max_T = 30;
        this.min_T = 0;
        this.max_E = 30;
        this.min_E = 0;
        this.animate = false;
        this.colors = true;
        this.animationSpeed = 50;
        this.levels = 0;
        this.transparent = false
        this.opacity = 1.0;
        this.outline = false;
        this.scale = 12;
        this.trackWidth = 0.04;
        this.data = 'SingleProton-200GeV.json';
        this.geometry = [];
        this.masked = false;
        this.colorTex;
        this.finalColorTex;
        this.samplePerTrack = 100;

        this.center = new RC.Vector3(this.scale * 0.7230665205316739,
            this.scale * 0.505777827526679,
            this.scale * 0.8558831681623251);



        //util
        this.stopwatch = { currTime: 0, prevTime: 0, deltaTime: 0 };

        this.canvas = new RC.Canvas(document.body);
        this.isUpdatingVega = false;

        this.renderer = new RC.MeshRenderer(this.canvas, RC.WEBGL2, { antialias: true });
        this.renderer.clearColor = "#000000";

        this.renderer.addShaderLoaderUrls('./RenderCore/src/shaders');

        this.initInputControls();

        this.initScenes();
        [this.renderQueue, this.renderQueue_IOR] = this.initRenderQueue();

        this.preprocessData("./data/t1a_ready.json");

        // --- WHOLE-TRACK HIGHLIGHT LISTENERS ---
        this.currentParentTrackId = null;
        this.currentSelectedTracks = [];

        window.addEventListener("clearHighlights", () => {
            app.studyHighlightedIds = [];
            if (window.hgcalStudy) {
                // Study mode handles colors dynamically, so just clear the selection array
                app.currentSelectedTracks = [];
            } else {
                // Sandbox mode: reset to original rainbow colors
                app.currentParentTrackId = null;
                app.currentSelectedTracks = [];
                if(app.lineStrip) app.lineStrip.highlightTracks(null, []);
                if(app.lineStrip_high) app.lineStrip_high.highlightTracks(null, []);
                if(app.lineStrip_meduim) app.lineStrip_meduim.highlightTracks(null, []);
                if(app.lineStrip_low) app.lineStrip_low.highlightTracks(null, []);
            }
        });

        window.addEventListener("loadTrialDataset", (e) => {
            const fileName = e.detail;
            console.log(`[Study Mode] Requesting python preprocess for: ${fileName}`);
            
            // Clear the screen while python thinks
            if (app.lineStrip) {
                app.scene.remove(app.lineStrip);
                app.scene.remove(app.lineStrip_low);
                app.scene.remove(app.lineStrip_meduim);
                app.scene.remove(app.lineStrip_high);
            }
            
            app.preprocessData(fileName);
        });

        window.addEventListener("applyTrialColors", (e) => {
            const trial = e.detail;

            app.currentTrialState = trial;

            if (app.lineStrip) app.lineStrip.applyTrialColors(trial);
            if (app.lineStrip_high) app.lineStrip_high.applyTrialColors(trial);
            if (app.lineStrip_meduim) app.lineStrip_meduim.applyTrialColors(trial);
            if (app.lineStrip_low) app.lineStrip_low.applyTrialColors(trial);
        });

        window.addEventListener("applyTrialConditions", (e) => {
            const trial = e.detail;

            // --- FIX: UI FACTORY RESET ---
            // Wipe out the aggressive filters from the previous task so the new dataset 
            // is fully visible, and reset the highlighting memory!
            app.studyHighlightedIds = []; 
            app.finalColorTex = "showerColor";
            
            if (app.PARAMS) {
                // Reset the main UI sliders to wide-open bounds
                app.PARAMS.energyMin = 0;
                app.PARAMS.energyMax = 100000; // Use a massive number to ensure it covers the whole dataset
                app.PARAMS.timeMin = 0;
                app.PARAMS.timeMax = 100000;

                // Reset the IOR Bracket sliders
                app.PARAMS.energy_cut_low_l = 0;
                app.PARAMS.energy_cut_high_h = 100000;
                
                // Explicitly reset the global engine limits just in case the UI is slow to sync
                app.limitE_Min = 0;
                app.limitE_Max = 100000;
                app.limitT_Min = 0;
                app.limitT_Max = 100000;
            }

            // Force Tweakpane to visually snap the sliders back to these fresh defaults
            if (app.pane) {
                app.pane.refresh();
            }
            // -----------------------------

            // Default baseline: Cyl/SSAO ON, IOR OFF, Schematic OFF for all non-targeted trials
            let useSSAO = true;
            let useIOR = false;
            let useSchematic = false;

            // Apply condition logic strictly based on the Study Guide
            if (trial.task === 'T1') {
                useSSAO = (trial.condition === 'B'); // T1 tests SSAO
                app.cameraLocked = true;             // Lock the camera!

                // --- PASTE YOUR CONSOLE COORDINATES HERE ---
                app.camera.position.set(7.652635591151645, 5.818133861351701, 9.183671189188123); 
                app.center = new RC.Vector3(7.50899618682718, 5.584869186883315, 7.253133116368531);
                // -------------------------------------------

                app.camera.lookAt(app.center, new RC.Vector3(0, 1, 0));
                if (app.cameraManager) {
                    app.cameraManager.addFullOrbitCamera(app.camera, app.center);
                    app.cameraManager.activeCamera = app.camera;
                }

            } else {
                app.cameraLocked = false; // Unlock camera for T2 and T3
            } 
            
            if (trial.task === 'T2') {
                useIOR = (trial.condition === 'B');  // T2 tests IOR
            } else if (trial.task === 'T3') {
                useSchematic = (trial.condition === 'B'); // T3 tests Schematic
            }

            // 1. Toggle SSAO & Cylinder Shading (Diffuse/Specular)
            if (app.lightingMaterial) {
                app.lightingMaterial.setUniform("ambientOcc", useSSAO);
                app.lightingMaterial.setUniform("light_diffuse", useSSAO);
                app.lightingMaterial.setUniform("light_specular", useSSAO);
            }

            // 2. Toggle Importance-Ordered Rendering (IOR)
            app.masked = useIOR;
            if (app.masked) {
                // Point shaders to the Masked IOR textures
                app.color_masked = "color_masked";
                app.position_masked = "position_masked";
                app.normal_masked = "normal_masked";
                app.depth_masked = "depth_masked";
                app.normalTheta_masked = "normalTheta_masked";
                app.binormal_masked = "binormal_masked";        
            } else {
                // Point shaders to the Standard textures
                app.color_masked = "color";
                app.position_masked = "position";
                app.normal_masked = "normal";
                app.depth_masked = "depthDefaultDefaultMaterials";
                app.normalTheta_masked = "normalTheta";
                app.binormal_masked = "binormal";
            }

            // 3. Toggle the 2D Schematic View (D3/Vega window)
            const schematicView = document.getElementById('widnow');
            if (schematicView) {
                schematicView.style.display = useSchematic ? 'block' : 'none';
            }
            
            // --- 4. STRICT UI LOCKOUT LOGIC ---
            let showUI = false;
            let showOnlyIOR = false;

            // Task 2.2 (IOR Intervention) is the ONLY trial that gets a UI
            // Assuming T2 Condition 'B' is the Intervention (T2.2)
            if (trial.task === 'T2' && trial.condition === 'B') {
                showUI = true;
                showOnlyIOR = true;
            } else if (trial.task === 'Sandbox') {
                showUI = true;
                showOnlyIOR = false; // Sandbox gets everything
            } else {
                // T1, T2.1 (T2 Cond A), and T3 all hide the UI completely
                showUI = false;
            }

            if (app.pane && app.pane.element) {
                app.pane.element.style.display = showUI ? 'block' : 'none';

                if (showUI && showOnlyIOR) {
                    // 1. Hide EVERY root element (Lighting, Geometry, Tabs, Outline, Track Width slider)
                    app.pane.children.forEach(child => {
                        child.hidden = true;
                    });
                    
                    // 2. Turn ONLY the IOR folder back on!
                    if (app.masksFolder) app.masksFolder.hidden = false;
                } 
                else if (showUI && !showOnlyIOR) {
                    // Reset to Sandbox: Unhide all standard root elements
                    app.pane.children.forEach(child => { 
                        child.hidden = false; 
                    });
                    
                    // Re-hide the specific folders that are controlled by checkboxes
                    if (app.masksFolder) app.masksFolder.hidden = !app.PARAMS.masked;
                    if (app.outlineFolder) app.outlineFolder.hidden = !app.PARAMS.outline;
                }
            }
            // ----------------------------------

            console.log(`[Study Condition] Task: ${trial.task} | Cond: ${trial.condition} -> SSAO: ${useSSAO}, IOR: ${useIOR}, Schematic: ${useSchematic}`);
        });

        window.addEventListener("highlightSelection", (e) => {

            app.studyHighlightedIds = e.detail;

            if (window.hgcalStudy) {
                // --- STUDY MODE: Use the Gray Base + Cyan Highlights ---
                const selectedIds = e.detail;
                if (app.lineStrip) app.lineStrip.updateStudyTexture(selectedIds);
                if (app.lineStrip_high) app.lineStrip_high.updateStudyTexture(selectedIds);
                if (app.lineStrip_meduim) app.lineStrip_meduim.updateStudyTexture(selectedIds);
                if (app.lineStrip_low) app.lineStrip_low.updateStudyTexture(selectedIds);
            } else {
                // --- SANDBOX MODE: Use the Rainbow Base + Cyan Highlights ---
                app.currentSelectedTracks = e.detail;
                if(app.lineStrip) app.lineStrip.highlightTracks(app.currentParentTrackId, app.currentSelectedTracks);
                if(app.lineStrip_high) app.lineStrip_high.highlightTracks(app.currentParentTrackId, app.currentSelectedTracks);
                if(app.lineStrip_meduim) app.lineStrip_meduim.highlightTracks(app.currentParentTrackId, app.currentSelectedTracks);
                if(app.lineStrip_low) app.lineStrip_low.highlightTracks(app.currentParentTrackId, app.currentSelectedTracks);
            }
        });

        window.addEventListener("resetCamera", () => {
            if (app.camera && app.root && app.root.children.length > 0) {
                // 1. Re-calculate the exact starting positions from the data
                const rootPos = app.root.children[0].model.position_beg;
                
                app.center = new RC.Vector3(
                    app.scale * rootPos[0], 
                    app.scale * rootPos[1], 
                    app.scale * rootPos[2]
                );

                // 2. Snap the camera physically
                app.camera.position.set(rootPos[0], rootPos[1], rootPos[2]);
                app.camera.lookAt(app.center, new RC.Vector3(0, 1, 0));
                
                // 3. Reset the RenderCore CameraManager so mouse interactions don't jump
                if (app.cameraManager) {
                    app.cameraManager.addFullOrbitCamera(app.camera, app.center);
                    app.cameraManager.activeCamera = app.camera;
                }
                
                console.log("[Camera Reset] Viewpoint snapped to dataset default.");
            } else {
                console.log("[Camera Reset] Ignored - Data not fully loaded yet.");
            }
        });

        window.addEventListener("resize", () => { this.resize(); }, false);

        window.addEventListener("mouseup", function (event) {

            app.GUIActive = false;
        }, false);

        window.addEventListener("mousedown", function (event) {
            if (event.target.id != "rc-canvas") {
                app.GUIActive = true;
            } else {
                // Ensure camera matrices are perfectly up to date before calculating
                app.camera.updateMatrixWorld();

                const rect = app.canvas.canvasDOM.getBoundingClientRect();
                const mouseX = event.clientX - rect.left;
                const mouseY = event.clientY - rect.top;

                const ndcX = (mouseX / rect.width) * 2 - 1;
                const ndcY = -(mouseY / rect.height) * 2 + 1;

                function projectToScreen(x, y, z, camera) {
                    let view = camera.matrixWorldInverse.elements;
                    let proj = camera.projectionMatrix.elements;
                    
                    let vx = view[0]*x + view[4]*y + view[8]*z + view[12];
                    let vy = view[1]*x + view[5]*y + view[9]*z + view[13];
                    let vz = view[2]*x + view[6]*y + view[10]*z + view[14];
                    let vw = view[3]*x + view[7]*y + view[11]*z + view[15];
                    
                    let px = proj[0]*vx + proj[4]*vy + proj[8]*vz + proj[12]*vw;
                    let py = proj[1]*vx + proj[5]*vy + proj[9]*vz + proj[13]*vw;
                    let pz = proj[2]*vx + proj[6]*vy + proj[10]*vz + proj[14]*vw;
                    let pw = proj[3]*vx + proj[7]*vy + proj[11]*vz + proj[15]*vw;

                    // NEW: Return the 'w' (depth) and 'proj[5]' (vertical fov scale) for dynamic hitbox sizing
                    return { x: px/pw, y: py/pw, z: pz/pw, w: pw, projScale: proj[5] };
                }

                let closestTrackId = null;
                let minDistance = Infinity; 
                let closestZ = Infinity;
                let highestImportance = Infinity;    
                
                let aspect = window.innerWidth / window.innerHeight;

                // --- SAFE PARSING: Force UI variables to be strict numbers ---
                let safeScale = parseFloat(app.scale) || 1.0;
                let safeWidth = parseFloat(app.trackWidth) || 0.04;
                
                // --- THE FIX: Unscaled View-Space Radius ---
                // The vertex shader calculates distanceToMove_viewspace = width / 2.0;
                // It does NOT multiply by the model scale. We must match that exactly.
                // We add a 25% generous buffer (1.25) so users don't have to be pixel-perfect.
                let viewSpaceRadius = (safeWidth / 2.0) * 1.25;

                // Dynamically calculate ~4 pixels in NDC space as the absolute minimum clickable area
                let minClickRadiusNDC = 4.0 / (window.innerHeight * 0.5);

                if (app.root) {
                    app.root.walk({ strategy: 'pre' }, function (node) {
                        
                        if (!node.model || node.model.position_beg === undefined) return;

                        // --- 3. ADD THIS: Ignore structurally filtered "ghost" tracks ---
                        if (app.activeRenderedIds && !app.activeRenderedIds.has(node.model.id)) return;

                        let s = safeScale; 
                        
                        let pA = [node.model.position_beg[0]*s, node.model.position_beg[1]*s, node.model.position_beg[2]*s];
                        let tA = [node.model.tangent_beg[0], node.model.tangent_beg[1], node.model.tangent_beg[2]];
                        let pB = [node.model.position_end[0]*s, node.model.position_end[1]*s, node.model.position_end[2]*s];
                        let tB = [node.model.tangent_end[0], node.model.tangent_end[1], node.model.tangent_end[2]];

                        let d = Math.sqrt(Math.pow(pA[0]-pB[0],2) + Math.pow(pA[1]-pB[1],2) + Math.pow(pA[2]-pB[2],2));
                        let Q = [d * tA[0], d * tA[1], d * tA[2]];
                        let P_vec = [pB[0]-pA[0], pB[1]-pA[1], pB[2]-pA[2]];
                        let R = [d * tB[0] - 2*P_vec[0] + Q[0], d * tB[1] - 2*P_vec[1] + Q[1], d * tB[2] - 2*P_vec[2] + Q[2]];
                        let P_Q_R = [P_vec[0] - Q[0] - R[0], P_vec[1] - Q[1] - R[1], P_vec[2] - Q[2] - R[2]];

                        let prevPoint2D = projectToScreen(pA[0], pA[1], pA[2], app.camera);

                        // --- FIX 1: Increase steps to match the GPU smoothness ---
                        // Prevents straight-line "shortcuts" from cutting across curved tracks
                        let steps = 50; 
                        for(let j=1; j<=steps; j++) {
                            let t = j / steps;
                            let t2 = t*t;
                            let t3 = t2*t;
                            
                            let cx = pA[0] + Q[0]*t + P_Q_R[0]*t2 + R[0]*t3;
                            let cy = pA[1] + Q[1]*t + P_Q_R[1]*t2 + R[1]*t3;
                            let cz = pA[2] + Q[2]*t + P_Q_R[2]*t2 + R[2]*t3;
                            
                            let currPoint2D = projectToScreen(cx, cy, cz, app.camera);

                            // --- FIX 2: Check Time & Energy limits ---
                            // If the shader hid this part of the track, the mouse MUST ignore it too!
                            let currentT = node.model.time_beg + t * (node.model.time_end - node.model.time_beg);
                            let currentE = node.model.energy_beg + t * (node.model.energy_end - node.model.energy_beg);
                            
                            let isVisible = (currentT >= app.limitT_Min && currentT <= app.limitT_Max) &&
                                            (currentE >= app.limitE_Min && currentE <= app.limitE_Max);

                            if (isVisible && prevPoint2D.z <= 1 && currPoint2D.z <= 1 && currPoint2D.w > 0.0001 && prevPoint2D.w > 0.0001) {
                                
                                let segDx = (currPoint2D.x - prevPoint2D.x) * aspect;
                                let segDy = (currPoint2D.y - prevPoint2D.y);
                                let l2 = segDx * segDx + segDy * segDy;
                                
                                let distT = 0;
                                if (l2 > 0.000001) {
                                    let mouseDx = (ndcX - prevPoint2D.x) * aspect;
                                    let mouseDy = (ndcY - prevPoint2D.y);
                                    distT = Math.max(0, Math.min(1, (mouseDx * segDx + mouseDy * segDy) / l2));
                                }
                                
                                let projX = prevPoint2D.x + distT * (currPoint2D.x - prevPoint2D.x);
                                let projY = prevPoint2D.y + distT * (currPoint2D.y - prevPoint2D.y);
                                
                                let distX = (ndcX - projX) * aspect;
                                let distY = (ndcY - projY);
                                let dist = Math.sqrt(distX * distX + distY * distY);

                                let interpolatedW = prevPoint2D.w + distT * (currPoint2D.w - prevPoint2D.w);
                                let pScale = currPoint2D.projScale !== undefined ? currPoint2D.projScale : app.camera.projectionMatrix.elements[5];
                                
                                let dynamicHitRadius = minClickRadiusNDC; 
                                
                                if (interpolatedW > 0.0001 && pScale) {
                                    dynamicHitRadius = Math.abs((viewSpaceRadius * pScale) / interpolatedW);
                                }
                                
                                dynamicHitRadius = Math.max(minClickRadiusNDC, Math.min(dynamicHitRadius, 0.15));

                                if (dist < dynamicHitRadius) {
                                    let projZ = prevPoint2D.z + distT * (currPoint2D.z - prevPoint2D.z);
                                    
                                    let importance = 3.0; 
                                    if (node.model.energy_beg >= app.energy_cut_low_l && node.model.energy_beg < (app.energy_cut_low_h + 1)) importance = 2.0;
                                    else if (node.model.energy_beg >= app.energy_cut_med_l && node.model.energy_beg < (app.energy_cut_med_h + 1)) importance = 1.0;
                                    else if (node.model.energy_beg >= app.energy_cut_high_l && node.model.energy_beg < (app.energy_cut_high_h + 1)) importance = 0.0;

                                    let isBetterHit = false;

                                    if (app.masked) {
                                        if (importance < highestImportance) {
                                            isBetterHit = true; 
                                        } else if (importance === highestImportance && projZ < closestZ) {
                                            isBetterHit = true; 
                                        }
                                    } else {
                                        if (projZ < closestZ) {
                                            isBetterHit = true;
                                        }
                                    }

                                    if (isBetterHit) {
                                        closestZ = projZ;
                                        minDistance = dist; 
                                        closestTrackId = node.model.id;
                                        highestImportance = importance; 
                                    }
                                }
                            }
                            prevPoint2D = currPoint2D;
                        }
                    });
                }

                console.log(`[Pick Math] Closest Track: ${closestTrackId} | Distance: ${minDistance.toFixed(4)}`);

                if (minDistance <= 0.15 && closestTrackId !== null) {
                    console.log(`>>> SUCCESS! Clicked Track ID: ${closestTrackId}`);

                    // --- NEW: T1 SCOUTING & STEALTH INTERCEPT ---
                    let activeTask = (window.hgcalStudy && window.hgcalStudy.currentTrial) ? window.hgcalStudy.currentTrial.task : 'Sandbox';
                    
                    if (activeTask === 'T1') {
                        // Print the ID clearly to the console so you can copy it for your questions!
                        console.warn(`%c[T1] Track Picked: ${closestTrackId}`, 'color: #00FFFF; font-size: 16px; font-weight: bold;');
                        
                        // If a participant is taking the actual study, let the manager record their answer quietly
                        if (window.hgcalStudy && window.hgcalStudy.onTrackPicked) {
                            window.hgcalStudy.onTrackPicked(closestTrackId);
                        }
                        
                        // STOP HERE. Do not trigger Vega, do not trigger any highlights!
                        return; 
                    }
                    // --------------------------------------------

                    // Defer to the Study Manager if we are running the user study
                    if (window.hgcalStudy && window.hgcalStudy.onTrackPicked) {
                        window.hgcalStudy.onTrackPicked(closestTrackId); 
                    } else {
                        // Regular Sandbox Mode
                        if (app.lineStrip) app.lineStrip.highlightTracks(null, [closestTrackId]);
                        if (app.lineStrip_high) app.lineStrip_high.highlightTracks(null, [closestTrackId]);
                        if (app.lineStrip_meduim) app.lineStrip_meduim.highlightTracks(null, [closestTrackId]);
                        if (app.lineStrip_low) app.lineStrip_low.highlightTracks(null, [closestTrackId]);

                        // Force update the global ID array so Vega knows what to highlight in Sandbox mode
                        app.studyHighlightedIds = [closestTrackId];
                    }

                    // --- NEW: Direct Vega Memory Injection! ---
                    if (window.vegaView) {
                        (async function() {
                            try {
                                app.isUpdatingVega = true; // Shield up

                                // 1. Access Vega's raw internal data to guarantee perfect structural matching
                                let allNodes = window.vegaView.data('treeCalcs') || window.vegaView.data('tree');
                                let currentVisible = window.vegaView.data('treeClickStorePerm');
                                
                                if (!allNodes || !currentVisible) {
                                    app.isUpdatingVega = false;
                                    return;
                                }

                                // 2. Trace the path using VEGA'S data, NOT the 3D data!
                                let targetIdNum = Number(closestTrackId);
                                let vegaTarget = allNodes.find(n => Number(n.id) === targetIdNum);
                                
                                if (vegaTarget) {
                                    let pathToExpand = [];
                                    let curr = vegaTarget;
                                    
                                    while (curr) {
                                        pathToExpand.unshift(Number(curr.id));
                                        if (curr.parent === null || curr.parent === undefined) break;
                                        curr = allNodes.find(n => Number(n.id) === Number(curr.parent));
                                    }

                                    let visibleIds = new Set(currentVisible.map(n => Number(n.id)));
                                    let nodesToInsert = [];

                                    // --- THE FIX: Recursive Auto-Healing Insert ---
                                    function safeInsert(nodeObj) {
                                        if (!nodeObj) return;
                                        let nid = Number(nodeObj.id);
                                        
                                        if (!visibleIds.has(nid)) {
                                            let pid = (nodeObj.parent !== null && nodeObj.parent !== undefined) ? Number(nodeObj.parent) : null;
                                            
                                            // If the parent is missing, recursively fetch and insert the parent FIRST!
                                            // This makes the "missing: X" crash mathematically impossible.
                                            if (pid !== null && !visibleIds.has(pid)) {
                                                let pNode = allNodes.find(n => Number(n.id) === pid);
                                                if (pNode) {
                                                    safeInsert(pNode);
                                                } else {
                                                    // If parent is a ghost not found in data, sever it to prevent crash
                                                    pid = null;
                                                }
                                            }
                                            
                                            // Clone and sanitize the node
                                            let cleanNode = JSON.parse(JSON.stringify(nodeObj));
                                            cleanNode.id = nid;
                                            cleanNode.parent = pid;
                                            
                                            nodesToInsert.push(cleanNode);
                                            visibleIds.add(nid);
                                        }
                                    }

                                    // 3. Inject the path and open the folders (immediate children)
                                    for (let i = 0; i < pathToExpand.length; i++) {
                                        let pid = pathToExpand[i];
                                        
                                        let pNode = allNodes.find(n => Number(n.id) === pid);
                                        if (pNode) safeInsert(pNode);
                                        
                                        let childrenToAdd = allNodes.filter(n => Number(n.parent) === pid);
                                        for (let c of childrenToAdd) safeInsert(c);
                                    }

                                    // 4. Apply the changeset safely
                                    if (nodesToInsert.length > 0) {
                                        let changeset = vega.changeset().insert(nodesToInsert);
                                        await window.vegaView.change('treeClickStorePerm', changeset).runAsync();
                                        // WAIT 200ms FOR VEGA'S LAYOUT TO PHYSICALLY PUSH THE NODES
                                        await new Promise(resolve => setTimeout(resolve, 50)); 
                                    }
                                    
                                    // 5. Apply the visual highlight (Trust the array completely, even if it is empty)
                                    let highlightPayload = Array.isArray(app.studyHighlightedIds) ? app.studyHighlightedIds : [closestTrackId];
                                    await window.vegaView.signal('nodeHighlight', highlightPayload).runAsync();
                                }         
                                app.isUpdatingVega = false; // Shield down
                                
                            } catch (e) { 
                                console.warn("Vega Direct Injection failed:", e); 
                                app.isUpdatingVega = false; 
                            }
                        })();
                    }
                    // -------------------------------------------------------------

                    

                } else {
                    console.log("Clicked background or too far from a track.");
                }
            }
        }, false);

        this.resize();

        window.requestAnimationFrame(() => { this.render() });
    }

    initScenes() {
        this.scene = new RC.Scene();

        this.light = new RC.DirectionalLight(new RC.Color(0.9, 0.6, 0.3), 1.0);
        this.light.position = new RC.Vector3(1, 0, 0);
        this.scene.add(this.light);


        const pLight1 = new RC.PointLight(new RC.Color("#FFFFFF"), 0.1);
        pLight1.position.set(0, 0, 4);
        this.scene.add(pLight1);

        const pLight2 = new RC.PointLight(new RC.Color("#FFFFFF"), 0.1);
        pLight2.position.set(0, 0, -4);
        this.scene.add(pLight2);

        const pLight3 = new RC.PointLight(new RC.Color("#FFFFFF"), 0.9);
        pLight3.position.set(7, 5, 4);
        this.scene.add(pLight3);



        let a_light = new RC.AmbientLight(new RC.Color("#ccffff"), 0.5);
        this.scene.add(a_light);

//{x: 46.73737376615962, y: -23.95106735366048, z: 0.1912401823604001
        this.camera = new RC.PerspectiveCamera(75, this.canvas.width / this.canvas.height, 0, 2000.0);
        this.camera.position = new RC.Vector3(-10.0, 10, 15.0);


        //this.camera.position = new RC.Vector3(0, 0, 10);


        this.cameraManager = new RC.CameraManager();


    }

    initRenderQueue() {

        function iterateSceneR(object, callback) {
            if (object === null || object === undefined) {
                return;
            }
        
            if(object.children.length > 0){
                for (let i = 0; i < object.children.length; i++) {
                    iterateSceneR(object.children[i], callback);
                }
            }
        
            callback(object);
        }

        if (this.masked) {
            this.color_masked = "color_masked";
            this.position_masked = "position_masked";
            this.normal_masked = "normal_masked";
            this.depth_masked = "depth_masked";
            this.normalTheta_masked = "normalTheta_masked";
            this.binormal_masked = "binormal_masked";
        }
        else {
            this.color_masked = "color";
            this.position_masked = "position";
            this.normal_masked = "normal";
            this.depth_masked = "depthDefaultDefaultMaterials";
            this.normalTheta_masked = "normalTheta";
            this.binormal_masked = "binormal";
        }


        this.firstPass = new RC.RenderPass(
			RC.RenderPass.BASIC,
			(textureMap, additionalData) => {},
			(textureMap, additionalData) => {
                
                iterateSceneR(this.scene, function(object){
                    if (object instanceof RC.ZSplines ){
                        object.visible = false;
                    }
                });

				return {scene: this.scene, camera: this.camera};
			},
			(textureMap, additionalData) => {
                iterateSceneR(this.scene, function(object){
                    if (object instanceof RC.ZSplines){
                        object.visible = true;
                    }
                });
            },
			RC.RenderPass.TEXTURE,
			{width: this.canvas.width, height: this.canvas.height},
			"depthTexture",
			[{
				id: "color_geo",
				textureConfig: RC.RenderPass.DEFAULT_RGBA_TEXTURE_CONFIG
			}]
		);

        this.RenderPass_Geometry = new RC.RenderPass(
            RC.RenderPass.BASIC,
            (textureMap, additionalData) => { },
            (textureMap, additionalData) => {

                iterateSceneR(this.scene, function(object){
                    if (object instanceof RC.ZSplines ){
                        object.material.setUniform("imp_check", false);
                        object.material.setUniform("imp_id", 2.0);
                    }
                });
                
                for(let i= 0; i<13; i++)
                {
                    if(this.geometry[i]!= null)
                        this.geometry[i].visible = false;
                }

                return { scene: this.scene, camera: this.camera };
            },
            (textureMap, additionalData) => {
                for(let i= 0; i<13; i++)
                {
                    if(this.geometry[i]!= null)
                        this.geometry[i].visible = this.boolVis[i];
                }
            },
            RC.RenderPass.TEXTURE,
            { width: this.canvas.width, height: this.canvas.height },
            // Bind depth texture to this ID
            "depthDefaultDefaultMaterials",

            [
                { id: "position", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG },
                { id: "normal", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG },
                { id: "normalTheta", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG },
                { id: "binormal", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG },
                { id: "color", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG },
                { id: "viewDir", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG },
                { id: "imp_tex", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG},

            ]
        );

        this.RenderPass_imp_0 = new RC.RenderPass(
            RC.RenderPass.BASIC,
            (textureMap, additionalData) => { },
            (textureMap, additionalData) => {

                
                iterateSceneR(this.scene, function (object) {
                    if (object instanceof RC.ZSplines) {
                        if (object.masked && object.importance == 0)
                            {
                                object.visible = true;
                                object.material.setUniform("imp_check", true);
                                object.material.setUniform("imp_id", 0.0);
                            }
                        else
                            object.visible = false;
                    }
                });

                
                for(let i= 0; i<13; i++)
                {
                    if(this.geometry[i]!= null)
                        this.geometry[i].visible = false;
                }

                return { scene: this.scene, camera: this.camera };
            },
            (textureMap, additionalData) => {

                for(let i= 0; i<13; i++)
                {
                    if(this.geometry[i]!= null)
                        this.geometry[i].visible = this.boolVis[i];
                }
            },
            RC.RenderPass.TEXTURE,
            { width: this.canvas.width, height: this.canvas.height },
            // Bind depth texture to this ID
            "depthDefaultDefaultMaterials0",

            [
                { id: "position0", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG },
                { id: "normal0", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG },
                { id: "normalTheta0", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG },
                { id: "binormal0", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG },
                { id: "color0", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG },
                { id: "viewDir0", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG },
                { id: "imp_tex0", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG},

            ]
        );

        this.gb = new RC.CustomShaderMaterial("gaussBlur", {horizontal: true, power: 1.0}); 
        this.gb_2 = new RC.CustomShaderMaterial("gaussBlur", {horizontal: false, power: 1.0}); 

        this.gb.addSBValue("RADIUS", 4);
        this.gb_2.addSBValue("RADIUS", 4);

        const [offset_gaussian, weight_gaussian] = gaussianKernel(3, 1);
        this.gb.setUniform("offset[0]", offset_gaussian);
        this.gb.setUniform("weight[0]", weight_gaussian);

        this.gb_2.setUniform("offset[0]", offset_gaussian);
        this.gb_2.setUniform("weight[0]", weight_gaussian);


        this.RenderPass_GaussBlur_imp_0 = new RC.RenderPass(
            // Rendering pass type
            RC.RenderPass.POSTPROCESS,

            // Initialize function
            (textureMap, additionalData) => {
            },

            // Preprocess function
            (textureMap, additionalData) => {
                return {
                    material: this.gb ,
                    textures: [
                        textureMap["imp_tex0"]
                    ]
                };
            },

            (textureMap, additionalData) => {
            },

            // Target
            RC.RenderPass.TEXTURE,

            // Viewport
            { width: this.canvas.width, height: this.canvas.height },

            // Bind depth texture to this ID
            null,

            [
                { id: "imp0_blur0", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG }
            ]
        );

        this.RenderPass_GaussBlur_imp_0_VERTICAL = new RC.RenderPass(
            // Rendering pass type
            RC.RenderPass.POSTPROCESS,

            // Initialize function
            (textureMap, additionalData) => {
            },

            // Preprocess function
            (textureMap, additionalData) => {
                return {
                    material: this.gb_2,
                    textures: [
                        textureMap["imp0_blur0"]
                    ]
                };
            },

            (textureMap, additionalData) => {
            },

            // Target
            RC.RenderPass.TEXTURE,

            // Viewport
            { width: this.canvas.width, height: this.canvas.height },

            // Bind depth texture to this ID
            null,

            [
                { id: "imp0_blur", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG }
            ]
        );

  
        this.RenderPass_imp_1 = new RC.RenderPass(
            RC.RenderPass.BASIC,
            (textureMap, additionalData) => { },
            (textureMap, additionalData) => {
                
                iterateSceneR(this.scene, function (object) {
                    if (object instanceof RC.ZSplines) {
                        if (object.masked && object.importance == 1)
                            {
                                object.visible = true;
                                object.material.setUniform("imp_check", true);
                                object.material.setUniform("imp_id", 1.0);
                            }
                        else
                            object.visible = false;
                    }
                });
                
                for(let i= 0; i<13; i++)
                {
                    if(this.geometry[i]!= null)
                        this.geometry[i].visible = false;
                }

                return { scene: this.scene, camera: this.camera };
            },
            (textureMap, additionalData) => {
                
                for(let i= 0; i<13; i++)
                {
                    if(this.geometry[i]!= null)
                        this.geometry[i].visible = this.boolVis[i];
                }
            },
            RC.RenderPass.TEXTURE,
            { width: this.canvas.width, height: this.canvas.height },
            // Bind depth texture to this ID
            "depthDefaultDefaultMaterials1",

            [
                { id: "position1", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG },
                { id: "normal1", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG },
                { id: "normalTheta1", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG },
                { id: "binormal1", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG },
                { id: "color1", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG },
                { id: "viewDir1", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG },
                { id: "imp_tex1", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG},

            ]
        );

        this.RenderPass_GaussBlur_imp_1 = new RC.RenderPass(
            // Rendering pass type
            RC.RenderPass.POSTPROCESS,

            // Initialize function
            (textureMap, additionalData) => {
            },

            // Preprocess function
            (textureMap, additionalData) => {
                return {
                    material: this.gb,
                    textures: [
                        textureMap["imp_tex1"]
                    ]
                };
            },

            (textureMap, additionalData) => {
            },

            // Target
            RC.RenderPass.TEXTURE,

            // Viewport
            { width: this.canvas.width, height: this.canvas.height },

            // Bind depth texture to this ID
            null,

            [
                { id: "imp1_blur0", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG }
            ]
        );

        this.RenderPass_GaussBlur_imp_1_VERTICAL = new RC.RenderPass(
            // Rendering pass type
            RC.RenderPass.POSTPROCESS,

            // Initialize function
            (textureMap, additionalData) => {
            },

            // Preprocess function
            (textureMap, additionalData) => {
                return {
                    material: this.gb_2,
                    textures: [
                        textureMap["imp1_blur0"]
                    ]
                };
            },

            (textureMap, additionalData) => {
            },

            // Target
            RC.RenderPass.TEXTURE,

            // Viewport
            { width: this.canvas.width, height: this.canvas.height },

            // Bind depth texture to this ID
            null,

            [
                { id: "imp1_blur", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG }
            ]
        );


        this.RenderPass_imp_2 = new RC.RenderPass(
            RC.RenderPass.BASIC,
            (textureMap, additionalData) => { },
            (textureMap, additionalData) => {


                iterateSceneR(this.scene, function (object) {
                    if (object instanceof RC.ZSplines) {
                        if (object.masked && object.importance == 2)
                            {
                                object.visible = true;
                                object.material.setUniform("imp_check", true);
                                object.material.setUniform("imp_id", 2.0);
                            }
                        else
                            object.visible = false;
                    }
                });
                
                for(let i= 0; i<13; i++)
                {
                    if(this.geometry[i]!= null)
                        this.geometry[i].visible = false;
                }

                return { scene: this.scene, camera: this.camera };
            },
            (textureMap, additionalData) => {

                iterateSceneR(this.scene, function (object) {
                    if (object instanceof RC.ZSplines) {
                        if (!object.masked)
                            {
                                object.visible = true;
                            }
                        else
                            object.visible = false;
                    }
                });

                for(let i= 0; i<13; i++)
                {
                    if(this.geometry[i]!= null)
                        this.geometry[i].visible = this.boolVis[i];
                }
            },
            RC.RenderPass.TEXTURE,
            { width: this.canvas.width, height: this.canvas.height},
            // Bind depth texture to this ID
            "depthDefaultDefaultMaterials2",

            [
                { id: "position2", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG },
                { id: "normal2", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG },
                { id: "normalTheta2", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG },
                { id: "binormal2", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG },
                { id: "color2", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG },
                { id: "viewDir2", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG },
                { id: "imp_tex2", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG},

            ]
        );
  
        this.RenderPass_GaussBlur_imp_2 = new RC.RenderPass(
            // Rendering pass type
            RC.RenderPass.POSTPROCESS,

            // Initialize function
            (textureMap, additionalData) =>{
            },

            // Preprocess function
            (textureMap, additionalData) => {

                //console.log("maptest", textureMap["imp_tex2"]);
                return {
                    material: this.gb,
                    textures: [
                        textureMap["imp_tex2"]
                    ]
                };
            },

            (textureMap, additionalData) => {
            },

            // Target
            RC.RenderPass.TEXTURE,

            // Viewport
            { width: this.canvas.width, height: this.canvas.height },

            // Bind depth texture to this ID
            null,

            [
                { id: "imp2_blur0", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG }
            ]
        );

        this.RenderPass_GaussBlur_imp_2_VERTICAL = new RC.RenderPass(
            // Rendering pass type
            RC.RenderPass.POSTPROCESS,

            // Initialize function
            (textureMap, additionalData) => {
            },

            // Preprocess function
            (textureMap, additionalData) => {

                //console.log("maptest", textureMap["imp_tex2"]);
                return {
                    material: this.gb_2,
                    textures: [
                        textureMap["imp2_blur0"]
                    ]
                };
            },

            (textureMap, additionalData) => {
            },

            // Target
            RC.RenderPass.TEXTURE,

            // Viewport
            { width: this.canvas.width, height: this.canvas.height },

            // Bind depth texture to this ID
            null,

            [
                { id: "imp2_blur", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG }
            ]
        );


        const cm = new RC.CustomShaderMaterial("colorMasking"); 

        const nm = new RC.CustomShaderMaterial("normalMasking"); 

        this.RenderPass_Color_Masking = new RC.RenderPass(
            // Rendering pass type
            RC.RenderPass.POSTPROCESS,

            // Initialize function
            function (textureMap, additionalData) {
            },

            // Preprocess function
            function (textureMap, additionalData) {
                return {
                    material: cm,
                    textures: [
                        textureMap["imp0_blur"],
                        textureMap["imp1_blur"],
                        textureMap["imp2_blur"],

                        textureMap["color0"],
                        textureMap["color1"],
                        textureMap["color2"],

                        textureMap["position0"],
                        textureMap["position1"],
                        textureMap["position2"],

                        textureMap["depthDefaultDefaultMaterials0"],
                        textureMap["depthDefaultDefaultMaterials1"],
                        textureMap["depthDefaultDefaultMaterials2"],


                    ]
                };
            },

            function (textureMap, additionalData) {
            },

            // Target
            RC.RenderPass.TEXTURE,

            // Viewport
            { width: this.canvas.width, height: this.canvas.height },

            // Bind depth texture to this ID
            null,

            [
                { id: "color_masked", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG },
                { id: "position_masked", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG },
                { id: "depth_masked", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG },

            ]
        );

        
        this.RenderPass_Normal_Masking = new RC.RenderPass(
            // Rendering pass type
            RC.RenderPass.POSTPROCESS,

            // Initialize function
            function (textureMap, additionalData) {
            },

            // Preprocess function
            function (textureMap, additionalData) {
                return {
                    material: nm,
                    textures: [
                        textureMap["imp0_blur"],
                        textureMap["imp1_blur"],
                        textureMap["imp2_blur"],

                        textureMap["normal0"],
                        textureMap["normal1"],
                        textureMap["normal2"],

                        textureMap["normalTheta0"],
                        textureMap["normalTheta1"],
                        textureMap["normalTheta2"],

                        textureMap["binormal0"],
                        textureMap["binormal1"],
                        textureMap["binormal2"],

                    ]
                };
            },

            function (textureMap, additionalData) {
            },

            // Target
            RC.RenderPass.TEXTURE,

            // Viewport
            { width: this.canvas.width, height: this.canvas.height },

            // Bind depth texture to this ID
            null,

            [
                { id: "normal_masked", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG },
                { id: "normalTheta_masked", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG },
                { id: "binormal_masked", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG }

            ]
        );


        this.ssaoMaterial = new RC.CustomShaderMaterial("SSAO",
            {
                radius: 0.6,
                bias: 0.005,
                magnitude: 1.0,
                contrast: 1.2,
                "samples[0]": this.generateSamples(8),
                "noise[0]": this.generateNoise(4),
                PMat_o: this.camera.projectionMatrix.elements
            });

            this.ssaoMaterial.addSBValue("NUM_SAMPLES", 8);
            this.ssaoMaterial.addSBValue("NUM_NOISE", 4);

            this.ssaoMaterial.lights = false;
            this.ssaoMaterial.depthTest = true;
        this.RenderPass_SSAO = new RC.RenderPass(
            // Rendering pass type
            RC.RenderPass.POSTPROCESS,

            // Initialize function
            (textureMap, additionalData) => {

            },

            // Preprocess function
            (textureMap, additionalData) => {
                return {
                    material: this.ssaoMaterial,
                    textures: [
                        textureMap[this.position_masked],
                        textureMap[this.normal_masked],
                        textureMap[this.depth_masked]
                    ]
                };
            },

            (textureMap, additionalData) => { },

            // Target
            RC.RenderPass.TEXTURE,

            // Viewport
            { width: this.canvas.width, height: this.canvas.height },

            // Bind depth texture to this ID
            null,

            [ // clearColorArray: this.clear_zero_f32arr 
                { id: "SSAO_out", textureConfig: RC.RenderPass.DEFAULT_R8_TEXTURE_CONFIG }
            ]
        );


        const sb = new RC.CustomShaderMaterial("simpleBlur");

        this.RenderPass_SimpleBlur = new RC.RenderPass(
            // Rendering pass type
            RC.RenderPass.POSTPROCESS,

            // Initialize function
            function (textureMap, additionalData) {
            },

            // Preprocess function
            function (textureMap, additionalData) {
                return {
                    material: sb,
                    textures: [
                        textureMap["SSAO_out"]
                    ]
                };
            },

            function (textureMap, additionalData) {
            },

            // Target
            RC.RenderPass.TEXTURE,

            // Viewport
            { width: this.canvas.width, height: this.canvas.height },

            // Bind depth texture to this ID
            null,

            [
                { id: "SSAO_blur", textureConfig: RC.RenderPass.DEFAULT_R8_TEXTURE_CONFIG }
            ]
        );

     
        this.outlineMaterial = new RC.CustomShaderMaterial("outline", { scale: 1.0, edgeColor: [0.7, 0.1, 0.5, 1.0], _DepthThreshold: 6.0, _NormalThreshold: 0.4, _DepthNormalThreshold: 0.5, _DepthNormalThresholdScale: 7.0 });
        this.outlineMaterial.lights = false;
        this.outlineMaterial.setUniform("outline", this.outline);

        const RenderPass_Outline = new RC.RenderPass(
            // Rendering pass type
            RC.RenderPass.POSTPROCESS,

            // Initialize function
            (textureMap, additionalData) => {
            },

            // Preprocess function
            (textureMap, additionalData) => {
                return { material: this.outlineMaterial, textures: [textureMap[this.depth_masked], textureMap[this.normal_masked], textureMap["viewDir"], textureMap[this.color_masked]] };
            },

            (textureMap, additionalData) => {
            },

            // Target
            RC.RenderPass.TEXTURE,

            // Viewport
            { width: this.canvas.width, height: this.canvas.height },

            // Bind depth texture to this ID
            null,

            [
                { id: "color_outline", textureConfig: RC.RenderPass.DEFAULT_RGBA16F_TEXTURE_CONFIG }
            ]
        );

        const blendingMaterial = new RC.CustomShaderMaterial("blendingAdditive");
        blendingMaterial.lights = false;
        const RenderPass_Blend = new RC.RenderPass(
            // Rendering pass type
            RC.RenderPass.POSTPROCESS,

            // Initialize function
            (textureMap, additionalData) => { },

            // Preprocess function
            (textureMap, additionalData) => {
                return {
                    material: blendingMaterial,
                    textures: [
                        textureMap["color_outline"],
                        textureMap[this.color_masked]
                    ]
                };
            },

            (textureMap, additionalData) => { },

            // Target
            RC.RenderPass.TEXTURE,

            // Viewport
            { width: this.canvas.width, height: this.canvas.height },

            // Bind depth texture to this ID
            null,

            [
                { id: "color_final", textureConfig: RC.RenderPass.DEFAULT_RGBA_TEXTURE_CONFIG }
            ]
        );


        this.lightingMaterial = new RC.CustomShaderMaterial("ZSplinesLighting");
        this.lightingMaterial.lights = false;
        this.lightingMaterial.setUniform("light_ambient", true);
        this.lightingMaterial.setUniform("light_diffuse", true);
        this.lightingMaterial.setUniform("light_specular", true);
        this.lightingMaterial.setUniform("ambientOcc", true);



        this.RenderPass_Lighting = new RC.RenderPass(
            // Rendering pass type
            RC.RenderPass.POSTPROCESS,

            // Initialize function
            (textureMap, additionalData) => { },

            // Preprocess function
            (textureMap, additionalData) => {
                return {
                    material: this.lightingMaterial,
                    textures: [
                        textureMap[this.position_masked],
                        textureMap[this.normalTheta_masked],
                        textureMap[this.binormal_masked],
                        textureMap["color_final"],
                        textureMap["SSAO_blur"],
                    ]
                };
            },

            (textureMap, additionalData) => { },

            // Target
            RC.RenderPass.TEXTURE,

            // Viewport
            { width: this.canvas.width, height: this.canvas.height },

            // Bind depth texture to this ID
            'depthDefaultMaterials',

            [ // clearColorArray: this.clear_zero_f32arr 
                { id: "showerColor", textureConfig: RC.RenderPass.DEFAULT_RGBA_TEXTURE_CONFIG },
            ]
        );

     
        this.finalColorTex =  "showerColor";

        const blendingMaterial2 = new RC.CustomShaderMaterial("blendingAdditive");
        blendingMaterial2.lights = false;
        const RenderPass_Blend2 = new RC.RenderPass(
            // Rendering pass type
            RC.RenderPass.POSTPROCESS,

            // Initialize function
            (textureMap, additionalData) => { },

            // Preprocess function
            (textureMap, additionalData) => {
                return {
                    material: blendingMaterial,
                    textures: [
						
                        textureMap[this.finalColorTex],
                        textureMap["color_geo"]
                        
                    ]
                };
            },

            (textureMap, additionalData) => { },

            // Target
            RC.RenderPass.SCREEN,

            // Viewport
            { width: this.canvas.width, height: this.canvas.height },

            // Bind depth texture to this ID
            null,

            [
                { id: "null", textureConfig: RC.RenderPass.DEFAULT_RGBA_TEXTURE_CONFIG }
            ]
        );


        let renderQueue_IOR = new RC.RenderQueue(this.renderer);

        renderQueue_IOR.pushRenderPass(this.firstPass);
        renderQueue_IOR.pushRenderPass(this.RenderPass_Geometry);

        renderQueue_IOR.pushRenderPass(this.RenderPass_imp_0);
        renderQueue_IOR.pushRenderPass(this.RenderPass_GaussBlur_imp_0);
        renderQueue_IOR.pushRenderPass(this.RenderPass_GaussBlur_imp_0_VERTICAL);

        renderQueue_IOR.pushRenderPass(this.RenderPass_imp_1);
        renderQueue_IOR.pushRenderPass(this.RenderPass_GaussBlur_imp_1);
        renderQueue_IOR.pushRenderPass(this.RenderPass_GaussBlur_imp_1_VERTICAL);

        renderQueue_IOR.pushRenderPass(this.RenderPass_imp_2);
        renderQueue_IOR.pushRenderPass(this.RenderPass_GaussBlur_imp_2);
        renderQueue_IOR.pushRenderPass(this.RenderPass_GaussBlur_imp_2_VERTICAL);

        
        renderQueue_IOR.pushRenderPass(this.RenderPass_Color_Masking);
        renderQueue_IOR.pushRenderPass(this.RenderPass_Normal_Masking);     

        renderQueue_IOR.pushRenderPass(this.RenderPass_SSAO);
        renderQueue_IOR.pushRenderPass(this.RenderPass_SimpleBlur);
        renderQueue_IOR.pushRenderPass(RenderPass_Outline); //computes outline based on multi render pass
        renderQueue_IOR.pushRenderPass(RenderPass_Blend);
        renderQueue_IOR.pushRenderPass(this.RenderPass_Lighting);
        renderQueue_IOR.pushRenderPass(RenderPass_Blend2);

// ***************************************************************
        let renderQueue = new RC.RenderQueue(this.renderer); 

        renderQueue.pushRenderPass(this.firstPass);
        renderQueue.pushRenderPass(this.RenderPass_Geometry);
        renderQueue.pushRenderPass(this.RenderPass_SSAO);
        renderQueue.pushRenderPass(this.RenderPass_SimpleBlur);
        renderQueue.pushRenderPass(RenderPass_Outline); //computes outline based on multi render pass
        renderQueue.pushRenderPass(RenderPass_Blend);
        renderQueue.pushRenderPass(this.RenderPass_Lighting);
        renderQueue.pushRenderPass(RenderPass_Blend2);        

        return [renderQueue, renderQueue_IOR];
    }

    updateOpacity() {
        // calling python function for opacity optimization

        //$.getJSON()


        $.ajax({
            type: "POST",
            url: 'http://127.0.0.1:5500/opacity',
            contentType: "application/json",
            dataType: 'json',
            data: JSON.stringify({
                D: this.mat_D,
                H: this.mat_H,
                G: this.mat_G
            }),
            success: function (data) {
                //console.log("ajax success", data)
            },
            error: function (err) {
                //console.log("ajax fail", err)
            }
        }).done(function (o) {
            // do something
            //console.log("ajax done", o);
        });
    }

    calculateD() {

        // Backward difference operator applied on matrix A
        this.mat_D = [];

        for (let i = 0; i < this.totalSegments; i++) {
            this.mat_D.push([]);
            for (let j = 0; j < this.totalSegments; j++) {
                //console.log("matrix test", i/this.segPerTrack);
                if (j == 0) {
                    this.mat_D[i].push(this.mat_A[i][j]);
                }
                else {
                    this.mat_D[i].push(this.mat_A[i][j] - this.mat_A[i][j - 1]);
                }

            }
        }

        //console.log("this.mat_D", this.mat_D);

    }

    initOpacityOptimization() {

        // initilize H, A, G, O
        this.segPerTrack = 4;
        this.totalTracks = 1000;
        this.totalSegments = this.segPerTrack * this.totalTracks;

        this.mat_G = [];
        this.mat_O = [];
        this.mat_H = [];
        this.mat_A = [];

        // G is the importance matrix | 1D | g[i]
        // constant importance for now
        for (let i = 0; i < this.totalSegments; i++) {
            this.mat_G.push(0.5);
        }
        //console.log("matrix G", this.mat_G.length, this.mat_G);

        // O is the per-segment calculated opacity | 1D | O[i]
        // initilize as all opaque
        for (let i = 0; i < this.totalSegments; i++) {
            this.mat_O.push(1.0);
        }
        //console.log("matrix O", this.mat_O.length, this.mat_O);

        // A is the per-segment adjacency matrix | 2D | A[i][j]

        for (let i = 0; i < this.totalSegments; i++) {
            this.mat_A.push([]);
            for (let j = 0; j < this.totalSegments; j++) {
                //console.log("matrix test", i/this.segPerTrack);
                if (((i - j) == 1 || (j - i) == 1)
                    && (Math.floor(i / this.segPerTrack) == Math.floor(j / this.segPerTrack)))
                    this.mat_A[i].push(1.0);
                else
                    this.mat_A[i].push(0.0);
            }
        }

        //console.log("matrix A", this.mat_A.length, this.mat_A);

        this.calculateD();

        // H is the per-viewpoint occlusion matrix | 2D | H[i][j]

        for (let i = 0; i < this.totalSegments; i++) {
            this.mat_H.push([]);
            for (let j = 0; j < this.totalSegments; j++) {
                this.mat_H[i].push(0.0);
            }
        }
        //console.log("matrix H", this.mat_H.length, this.mat_H);
    }


    loadData(datasetUrl = './data/output.json') {

        let timeUrl = './data/output-time.json'; // Default for sandbox mode
        
        // If we are in the study, swap "_ready.json" for "_time.json"
        if (datasetUrl !== './data/output.json') {
            timeUrl = datasetUrl.replace('ready.json', 'time.json');
        }

        console.log(`[Data Manager] Fetching Tracks: ${datasetUrl}`);
        console.log(`[Data Manager] Fetching Time: ${timeUrl}`);

        this.scene.remove(this.lineStrip);
        this.scene.remove(this.lineStrip_low);
        this.scene.remove(this.lineStrip_meduim);
        this.scene.remove(this.lineStrip_high);

        this.tree = new TreeModel();
        this.root = null;

            let jsonFileNames = [
                './data/Geometry/caloBase_CALOEC_1.json',
                './data/Geometry/caloBase_CALOEC_2.json',
                './data/Geometry/caloBase_CALOECTSFront_1.json',
                './data/Geometry/caloBase_CALOECTSFront_2.json',
                './data/Geometry/caloBase_CALOECTSRear_1.json',
                './data/Geometry/caloBase_CALOECTSRear_2.json',
                './data/Geometry/ectkcable_ETCA_1.json',
                './data/Geometry/ectkcable_ETCA_2.json',
                './data/Geometry/eregalgo_EBAR_1.json',
                './data/Geometry/eregalgo_ECAL_1.json',
                './data/Geometry/hcalalgo_HCal_1.json',
                './data/Geometry/hcalbarrelalgo_HB_1.json',
                './data/Geometry/hcalcablealgo_HRCF_1.json',
                './data/Geometry/hcalcablealgo_HRCF_2.json'
            ]
            this.boolVis = [
                false,
                false,
                false,
                false,
                false,
                false,
                false,
                false,
                false,
                false,
                false,
                false,
                false,
                false,
            ]

        if(this.geometry.length == 0)
        {

            for (let i = 0; i < 14; i++) {
                fetch(jsonFileNames[i])
                    .then((response) => response.json())
                    .then(data => {
    
                        let name = data.name;
                        let matrix = data.matrix;
                        let vertices = data.vert;
                        let indices = data.idx;
    
                        //console.log("geometry", name, matrix);
    
                        let geometry = new RC.Geometry();
                        geometry.vertices = new RC.Float32Attribute(vertices, 3);
                        geometry.vertices.divisor = 0;
                        geometry.indices = new RC.Uint32Attribute(indices, 1);
                        geometry.indices.divisor = 0;
                        geometry.computeVertexNormals();
                        geometry.normals.divisor = 0;
    
                        geometry.MMat = new RC.Float32Attribute(matrix, 16);
                        geometry.MMat.divisor = 1;
                        geometry.MMat.drawType = RC.BufferAttribute.DRAW_TYPE.DYNAMIC;
    
    
                        let material = new RC.MeshPhongMaterial();
    
                        material.side = RC.FRONT_AND_BACK_SIDE;
                        material.transparent = true;
                        material.opacity = 0.15;
                        material.color = new RC.Color(0.4, 1.0, 1.0);
                        material.specular = new RC.Color(0.4, 1.0, 1.0);
                        material.emissive = new RC.Color(1.0, 1.0, 1.0);
                        material.normalFlat = true;
                        material.depthWrite = false;
                                                    
    
    
                        let object = new RC.Mesh(geometry, material);
                        object.position.set(7, 5, 4);
                        object.scale.set(0.1, 0.1, 0.1);
                        object.visible = this.boolVis[i];
                                                         
    
                        object.instanced = true;
                        object.instanceCount = 1;
                        //object.frustumCulled = false;
    
    
                        this.geometry.push(object);
                        this.scene.add(object);
    
                    });
    
                    
            }
        }


        

        // Load json file that contains time information [min/max] per level
        fetch(timeUrl)
            .then((response) => response.json())
            .then(data => {

                this.levels = data.levels;
                this.max_T = data.max;
                this.min_T = data.min;

                this.max_E = data.maxE + 1;
                this.min_E = data.minE;

                this.minTimePerLevel = [];
                this.maxTimePerLevel = [];

                for (let l = 0; l < this.levels; l++) {
                    this.minTimePerLevel.push(data.levelsList[l].minTime);
                    this.maxTimePerLevel.push(data.levelsList[l].maxTime);
                }


            });
        
        fetch(datasetUrl)
            .then((response) => response.json())
            .then(data => {
               

                // creating the tree data structure 
                var r = this.recursiveTree(data);
                //console.log("r[0]", r[0]);
                this.root = this.tree.parse(r[0]);

                // settting orbit center at the root of the tree
                const rootPos = this.root.children[0].model.position_beg;

                this.center = new RC.Vector3(this.scale * rootPos[0],
                    this.scale * rootPos[1],
                    this.scale * rootPos[2]);

                this.camera.position = new RC.Vector3(rootPos[0], rootPos[1], rootPos[2]);


                this.camera.lookAt(this.center, new RC.Vector3(0, 1, 0));

                this.cameraManager.addFullOrbitCamera(this.camera, this.center);

                this.cameraManager.camerasControls[this.camera._uuid].keyMap = this.keyMap;
                this.cameraManager.activeCamera = this.camera;

                this.distanceToCamera = this.center.clone().sub(this.camera.position);


                this.energy_interval = (this.max_E - this.min_E) / 3.0;
/*
                this.energy_cut_low_l = this.min_E;
                this.energy_cut_low_h = this.energy_cut_low_l + this.energy_interval;
        
                this.energy_cut_med_l = this.energy_cut_low_h + 1;
                this.energy_cut_med_h = this.energy_cut_med_l + this.energy_interval;
        
                this.energy_cut_high_l = this.energy_cut_med_h + 1;
                this.energy_cut_high_h = this.max_E + 1;
*/

                this.energy_cut_low_l = 0.0;
                this.energy_cut_low_h = 0.1;

                this.energy_cut_med_l = 0.1;
                this.energy_cut_med_h = 1.0;

                this.energy_cut_high_l = 1.0;
                this.energy_cut_high_h = this.max_E + 1;
                this.initGUI();

                this.limitT_Max = this.max_T;
                this.limitT_Min = this.min_T;

                this.limitE_Max = this.max_E;
                this.limitE_Min = this.min_E;

                this.getSubTreeAtNode(1);

                if (window.hgcalStudy) {
                    window.dispatchEvent(new Event("datasetReady"));
                }

            });
    }

    getSubTreeAtNode(id, pdgFilter = false, pdg = 0) {
        
        console.log("testing pdg", )
        var node = this.root.first(function (node) {
            return node.model.id === id;
        });

        if (node != null) {
            let tracksData = [];
            let tracksTime = [];
            let trackEnergy = [];
            let trackColor = [];
            let trackImportance = [];

            // --- NEW: Track ID Arrays ---
            let trackIds = [];
            let trackIds_masked = []; trackIds_masked[0] = []; trackIds_masked[1] = []; trackIds_masked[2] = []; trackIds_masked[3] = [];

            let tracksData_masked = []; tracksData_masked[0] = []; tracksData_masked[1] = []; tracksData_masked[2] = []; tracksData_masked[3] = [];
            let tracksTime_masked = []; tracksTime_masked[0] = []; tracksTime_masked[1] = []; tracksTime_masked[2] = []; tracksTime_masked[3] = []; 
            let trackEnergy_masked = []; trackEnergy_masked[0] = []; trackEnergy_masked[1] = []; trackEnergy_masked[2] = []; trackEnergy_masked[3] = [];
            let trackColor_masked = []; trackColor_masked[0] = []; trackColor_masked[1] = []; trackColor_masked[2] = []; trackColor_masked[3] = [];
            let trackImportance_masked = []; trackImportance_masked[0] = []; trackImportance_masked[1] = []; trackImportance_masked[2] = []; trackImportance_masked[3] = [];

            
            this.scene.remove(this.lineStrip);
            this.scene.remove(this.lineStrip_low);
            this.scene.remove(this.lineStrip_meduim);
            this.scene.remove(this.lineStrip_high);

            let testCount = 0;

            // --- 1. ADD THIS: Initialize the pickable memory cache ---
            app.activeRenderedIds = new Set();

            node.walk({ strategy: 'pre' }, function (node) {
                // Halt the traversal by returning false

                if ((!pdgFilter || (pdgFilter && pdg == node.model.pdg)))
                    {
                    app.activeRenderedIds.add(node.model.id);
                    testCount++;
                    //console.log("node.model.level", node.model.level);
                    trackIds.push(node.model.id);

                    tracksData.push(node.model.position_beg[0]);
                    tracksData.push(node.model.position_beg[1]);
                    tracksData.push(node.model.position_beg[2]);

                    tracksData.push(node.model.tangent_beg[0]);
                    tracksData.push(node.model.tangent_beg[1]);
                    tracksData.push(node.model.tangent_beg[2]);

                    tracksData.push(node.model.position_end[0]);
                    tracksData.push(node.model.position_end[1]);
                    tracksData.push(node.model.position_end[2]);

                    tracksData.push(node.model.tangent_end[0]);
                    tracksData.push(node.model.tangent_end[1]);
                    tracksData.push(node.model.tangent_end[2]);

                    tracksTime.push(node.model.time_beg);
                    tracksTime.push(node.model.time_end);
                    tracksTime.push(0.0);

                    trackEnergy.push(node.model.energy_beg);
                    trackEnergy.push(node.model.energy_end);
                    trackEnergy.push(0.0);

                    let importance = 3.0;

                    if(node.model.energy_beg >= app.energy_cut_low_l && node.model.energy_beg < (app.energy_cut_low_h + 1))
                        {importance = 2.0;
                        //console.log("track id high", node.model.id);
                    }
                    else if(node.model.energy_beg >= app.energy_cut_med_l && node.model.energy_beg < (app.energy_cut_med_h + 1))
                        {importance = 1.0;
                        //console.log("track id", node.model.id);
                    }
                    else if(node.model.energy_beg >= app.energy_cut_high_l && node.model.energy_beg < (app.energy_cut_high_h + 1))
                        {importance = 0.0;
                        //console.log("track id", node.model.id);
                        }
                    else 
                        {importance = 3.0;
                        console.log("energytest", node.model.energy_beg);}

                    trackImportance.push(importance);

                    let colorRGB = app.hexToRgb(node.model.color);
                    trackColor.push(colorRGB.r / 255.0);
                    trackColor.push(colorRGB.g / 255.0);
                    trackColor.push(colorRGB.b / 255.0);
                    trackColor.push(1.0);

                    tracksData_masked[importance].push(node.model.position_beg[0]);
                    tracksData_masked[importance].push(node.model.position_beg[1]);
                    tracksData_masked[importance].push(node.model.position_beg[2]);

                    tracksData_masked[importance].push(node.model.tangent_beg[0]);
                    tracksData_masked[importance].push(node.model.tangent_beg[1]);
                    tracksData_masked[importance].push(node.model.tangent_beg[2]);

                    tracksData_masked[importance].push(node.model.position_end[0]);
                    tracksData_masked[importance].push(node.model.position_end[1]);
                    tracksData_masked[importance].push(node.model.position_end[2]);

                    tracksData_masked[importance].push(node.model.tangent_end[0]);
                    tracksData_masked[importance].push(node.model.tangent_end[1]);
                    tracksData_masked[importance].push(node.model.tangent_end[2]);

                    tracksTime_masked[importance].push(node.model.time_beg);
                    tracksTime_masked[importance].push(node.model.time_end);
                    tracksTime_masked[importance].push(0.0);

                    trackEnergy_masked[importance].push(node.model.energy_beg);
                    trackEnergy_masked[importance].push(node.model.energy_end);
                    trackEnergy_masked[importance].push(0.0);

                    trackImportance_masked[importance].push(importance);

                    trackIds_masked[importance].push(node.model.id);

                    trackColor_masked[importance].push(colorRGB.r / 255.0);
                    trackColor_masked[importance].push(colorRGB.g / 255.0);
                    trackColor_masked[importance].push(colorRGB.b / 255.0);
                    trackColor_masked[importance].push(1.0);
                }
                        
            });

            //console.log("testCount", testCount);

            this.limitT_Min = this.min_T;
            this.limitT_Max = this.max_T;

            this.limitT_Min_Animation = this.min_T;
            this.limitT_Max_Animation = this.max_T;

            //console.log("trackImportance", trackImportance, trackImportance_masked[0], trackImportance_masked[1], trackImportance_masked[2], trackImportance_masked[3]);

            this.lineStrip = new RC.ZSplines(
                tracksData,
                tracksTime,
                trackEnergy,
                this.samplePerTrack,
                this.trackWidth,
                this.limitT_Min,
                this.limitT_Max,
                trackColor,
                trackImportance, 
                false,
                true,
                trackIds);

                //((points.length / 6)) / 2;
            //console.log("testCount", tracksData.length/12, tracksData_masked[2].length/12,
            //tracksData_masked[1].length/12, tracksData_masked[0].length/12, tracksData_masked[3].length/12);

            this.lineStrip.position.set(0, 0, 0);
																							
            this.lineStrip.scale.set(this.scale, this.scale, this.scale);
            this.lineStrip.setAnimationPattern(0.0);
            this.lineStrip.setColors(this.colors);
            this.lineStrip.drawOutline = false;
            this.lineStrip.material.transparent = this.transparent;
            this.lineStrip.material.opacity = this.opacity;	
            this.lineStrip.pickable = true;  // <--- SET BACK TO TRUE
            this.lineStrip.UINT_ID = 99;     // <--- GIVE IT ID 99									
            this.scene.add(this.lineStrip);

            this.lineStrip_low = new RC.ZSplines(
                tracksData_masked[2],
                tracksTime_masked[2],
                trackEnergy_masked[2],
                this.samplePerTrack,
                this.trackWidth,
                this.limitT_Min,
                this.limitT_Max,
                trackColor_masked[2],
                trackImportance_masked[2], true, false, trackIds_masked[2]);

            console.log(`Resuilts: GPUMemory [${RC.Texture.gpuMemory} MB]`);

            console.log("Resuilts: Number of tracks", tracksData.length/12, "Number of total vertices", ((this.samplePerTrack * 2) + 2) * tracksData.length/12);
   


            this.lineStrip_low.position.set(0, 0, 0);
																							
            this.lineStrip_low.scale.set(this.scale, this.scale, this.scale);
            this.lineStrip_low.setAnimationPattern(0.0);
            this.lineStrip_low.setColors(this.colors);
            this.lineStrip_low.drawOutline = false;
            this.lineStrip_low.material.transparent = this.transparent;
            this.lineStrip_low.material.opacity = this.opacity;		
            this.lineStrip_low.visible = false;
            this.lineStrip_low.pickable = true;  
            this.lineStrip_low.UINT_ID = 100;     								
            this.scene.add(this.lineStrip_low);

            //console.log("lineStrip_meduim", tracksData_masked[2], tracksData_masked[0]);


            this.lineStrip_meduim = new RC.ZSplines(
                tracksData_masked[1],
                tracksTime_masked[1],
                trackEnergy_masked[1],
                this.samplePerTrack,
                this.trackWidth,
                this.limitT_Min,
                this.limitT_Max,
                trackColor_masked[1],
                trackImportance_masked[1], true, false, trackIds_masked[1]);

            this.lineStrip_meduim.position.set(0, 0, 0);
																							
            this.lineStrip_meduim.scale.set(this.scale, this.scale, this.scale);
            this.lineStrip_meduim.setAnimationPattern(0.0);
            this.lineStrip_meduim.setColors(this.colors);
            this.lineStrip_meduim.drawOutline = false;
            this.lineStrip_meduim.material.transparent = this.transparent;
            this.lineStrip_meduim.material.opacity = this.opacity;	
            this.lineStrip_meduim.visible = false;	
            this.lineStrip_meduim.pickable = true;  
            this.lineStrip_meduim.UINT_ID = 101; 									
            this.scene.add(this.lineStrip_meduim);

																	
            this.lineStrip_high = new RC.ZSplines(
                tracksData_masked[0],
                tracksTime_masked[0],
                trackEnergy_masked[0],
                this.samplePerTrack,
                this.trackWidth,
                this.limitT_Min,
                this.limitT_Max,
                trackColor_masked[0],
                trackImportance_masked[0], true, false, trackIds_masked[0]);

            this.lineStrip_high.position.set(0, 0, 0);
																							
            this.lineStrip_high.scale.set(this.scale, this.scale, this.scale);
            this.lineStrip_high.setAnimationPattern(0.0);
            this.lineStrip_high.setColors(this.colors);
            this.lineStrip_high.drawOutline = false;
            this.lineStrip_high.material.transparent = this.transparent;
            this.lineStrip_high.material.opacity = this.opacity;	
            this.lineStrip_high.visible = false;	
            this.lineStrip_high.pickable = true;  
            this.lineStrip_high.UINT_ID = 102; 								
            this.scene.add(this.lineStrip_high);
																	
        }

        // ... (Your existing app.scene.add lines are right above here) ...

        // --- FIX 2: THE TRUE AMNESIA CURE ---
        // Apply the exact memorized trial state to the newly rebuilt tracks.
        // This keeps T2 rainbow, T3 gray, and perfectly activates the highlight shader!
        if (app.currentTrialState) {
            let trialState = app.currentTrialState;
            if (app.lineStrip) app.lineStrip.applyTrialColors(trialState);
            if (app.lineStrip_high) app.lineStrip_high.applyTrialColors(trialState);
            if (app.lineStrip_meduim) app.lineStrip_meduim.applyTrialColors(trialState);
            if (app.lineStrip_low) app.lineStrip_low.applyTrialColors(trialState);
        }

        let idsToHighlight = [];
        if (app.studyHighlightedIds && app.studyHighlightedIds.length > 0) {
            idsToHighlight = app.studyHighlightedIds;
        }

        if (app.lineStrip) app.lineStrip.updateStudyTexture(idsToHighlight);
        if (app.lineStrip_high) app.lineStrip_high.updateStudyTexture(idsToHighlight);
        if (app.lineStrip_meduim) app.lineStrip_meduim.updateStudyTexture(idsToHighlight);
        if (app.lineStrip_low) app.lineStrip_low.updateStudyTexture(idsToHighlight);
        // ----------------------------------------------------               
    }
    recursiveTree(array) {
        function getChildren(parents, input) {
            return parents.map(parent => {
                const children = input.filter(x => x.parent === parent.id);
                parent.children = children;
                if (children.length === 0) {
                    return parent;
                } else {
                    parent.children = getChildren(children, input);
                    return parent;
                }
            })
        }

        const roots = array.filter(x => x.parent == null);

        return getChildren(roots, array);
    }

    hexToRgb(hex) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    initGUI() {

        if(this.pane != null)
            this.pane.dispose();

        this.pane = new Pane();
        this.pane.registerPlugin(TweakpaneFileInputPlugin);
        this.pane.registerPlugin(TweakpaneEssentialsPlugin);

        this.pane.element.style.overflow = "visible";  // Allow overflow so buttons are visible


            // Set a background color for debugging visibility
        //this.pane.element.style.backgroundColor = 'red'; // Test: Set background to red for visibility

        // Explicitly set the visibility and display properties
        this.pane.element.style.display = 'block';  // Ensure the pane is being displayed
        this.pane.element.style.visibility = 'visible'; // Ensure the pane is visible



        this.pane.on('change', (ev) => {
            this.GUIActive = true;
        });

        this.PARAMS = {
            energyInterval: { min: this.min_E, max: this.max_E },
            interval: { min: this.min_T, max: this.max_T },
            animation: false,
            timeAnimation: false,
            timeAnimationInterval: { min: this.min_T, max: this.max_T },
            gap: 1,
            fill: 2,
            speed: 50,
            level: 0,
            byLevel: false,
            bySubTree: false,
            byPDG: false,
            colors: true,
            light_ambient: true,
            light_diffuse: true,
            light_specular: true,
            ambientOcc: true,
            transparent: false,
            opacity: 1.0,
            subTree: 1,
            pdg: 0,
            outline: false,
            outlineWidth: 1.0,
            trackWidth: this.trackWidth,
            file: '',
            currentFile: this.data,
            timeCrop: this.max_T,
            energyCrop: this.max_E,
            geo_1: this.boolVis[0],
            geo_2: this.boolVis[1],
            geo_3: this.boolVis[2],
            geo_4: this.boolVis[3],
            geo_5: this.boolVis[4],
            geo_6: this.boolVis[5],
            geo_7: this.boolVis[6],
            geo_8: this.boolVis[7],
            geo_9: this.boolVis[8],
            geo_10: this.boolVis[9],
            geo_11: this.boolVis[10],
            geo_12: this.boolVis[11],
            geo_13: this.boolVis[12],
            geo_14: this.boolVis[13],
            masked: false,

            energyLowInterval: { min: this.energy_cut_low_l, max: this.energy_cut_low_h },
            energyMedInterval: { min: this.energy_cut_med_l, max: this.energy_cut_med_h },
            energyHighInterval: { min: this.energy_cut_high_l, max: this.energy_cut_high_h },
            radius: 3,
            sigma: 1,
        };

        const geometryFolder = this.pane.addFolder({
            title: 'Geometry Settings',
            expanded: false,
            hidden: false,
        });

        geometryFolder.addBinding(this.PARAMS, 'geo_1',
            { label: 'caloBase_CALOEC_1' })
            .on('change', (ev) => {
                this.geometry[0].visible = ev.value;
                this.boolVis[0] = ev.value;

            });

            geometryFolder.addBinding(this.PARAMS, 'geo_2',
            { label: 'caloBase_CALOEC_2' })
            .on('change', (ev) => {
                
                this.geometry[1].visible = ev.value;
                this.boolVis[1] = ev.value;

            });
            geometryFolder.addBinding(this.PARAMS, 'geo_3',
            { label: 'caloBase_CALOECTSFront_1' })
            .on('change', (ev) => {
                
                this.geometry[2].visible = ev.value;
                this.boolVis[2] = ev.value;

            });
            geometryFolder.addBinding(this.PARAMS, 'geo_4',
            { label: 'caloBase_CALOECTSFront_2' })
            .on('change', (ev) => {
                
                this.geometry[3].visible = ev.value;
                this.boolVis[3] = ev.value;

            });
            geometryFolder.addBinding(this.PARAMS, 'geo_5',
            { label: 'caloBase_CALOECTSRear_1' })
            .on('change', (ev) => {
                
                this.geometry[4].visible = ev.value;
                this.boolVis[4] = ev.value;

            });
            geometryFolder.addBinding(this.PARAMS, 'geo_6',
            { label: 'caloBase_CALOECTSRear_2' })
            .on('change', (ev) => {
                
                this.geometry[5].visible = ev.value;
                this.boolVis[5] = ev.value;

            });
            geometryFolder.addBinding(this.PARAMS, 'geo_7',
            { label: 'ectkcable_ETCA_1' })
            .on('change', (ev) => {
                
                this.geometry[6].visible = ev.value;
                this.boolVis[6] = ev.value;

            });
            geometryFolder.addBinding(this.PARAMS, 'geo_8',
            { label: 'ectkcable_ETCA_2' })
            .on('change', (ev) => {
                
                this.geometry[7].visible = ev.value;
                this.boolVis[7] = ev.value;

            });
            geometryFolder.addBinding(this.PARAMS, 'geo_9',
            { label: 'eregalgo_EBAR_1' })
            .on('change', (ev) => {
                
                this.geometry[8].visible = ev.value;
                this.boolVis[8] = ev.value;

            });

            geometryFolder.addBinding(this.PARAMS, 'geo_10',
            { label: 'eregalgo_ECAL_1' })
            .on('change', (ev) => {
                
                this.geometry[9].visible = ev.value;
                this.boolVis[9] = ev.value;

            });
            geometryFolder.addBinding(this.PARAMS, 'geo_11',
            { label: 'hcalalgo_HCal_1' })
            .on('change', (ev) => {
                
                this.geometry[10].visible = ev.value;
                this.boolVis[10] = ev.value;

            });
            geometryFolder.addBinding(this.PARAMS, 'geo_12',
            { label: 'hcalbarrelalgo_HB_1' })
            .on('change', (ev) => {
                
                this.geometry[11].visible = ev.value;
                this.boolVis[11] = ev.value;

            });
            geometryFolder.addBinding(this.PARAMS, 'geo_13',
            { label: 'hcalcablealgo_HRCF_1' })
            .on('change', (ev) => {
                
                this.geometry[12].visible = ev.value;
                this.boolVis[12] = ev.value;

            });
            geometryFolder.addBinding(this.PARAMS, 'geo_14',
            { label: 'hcalcablealgo_HRCF_2' })
            .on('change', (ev) => {
                
                this.geometry[13].visible = ev.value;
                this.boolVis[13] = ev.value;

            });

        const performanceFolder = this.pane.addFolder({
            title: 'Performance Settings',
            expanded: false,
            hidden: false,
        });

        // FPS graph
        this.fpsGraph = performanceFolder.addBlade({
            view: 'fpsgraph',
            label: 'FPS',
            rows: 4,
            min: 30,
            max: 130,
        });

        const dataFolder = this.pane.addFolder({
            title: 'Data Settings',
            expanded: false,
            hidden: false,
        });

        dataFolder.addBinding(this.PARAMS, 'currentFile',
            {
                label: 'current file',
                disabled: true
            });


        dataFolder.addBinding(this.PARAMS, 'file', {
            label: 'Load new',
            view: 'file-input',
            invalidFiletypeMessage: "We can't accept those filetypes!",
            lineCount: 3,
            filetypes: ['.json',],

        })
            .on('change', (ev) => {
                //console.log("file", ev.value.name);

                // Preprocess input file
                this.data = ev.value.name;
                this.PARAMS.currentFile = this.data;
                this.preprocessData(ev.value.name);

            });

        const filteringFolder = this.pane.addFolder({
            title: 'Filtering Settings',
            expanded: false,
            hidden: false,
        });


        const lightingFolder = this.pane.addFolder({
            title: 'Lighting Settings',
            expanded: false,
            hidden: false,
        });

        lightingFolder.addBinding(this.PARAMS, 'masked',
            { label: 'IOR' })
            .on('change', (ev) => {
                masksFolder.hidden = !masksFolder.hidden;
                this.masked = ev.value;
                if (this.masked) {
                    this.color_masked = "color_masked";
                    this.position_masked = "position_masked";
                    this.normal_masked = "normal_masked";
                    this.depth_masked = "depth_masked";
                    this.normalTheta_masked = "normalTheta_masked";
                    this.binormal_masked = "binormal_masked";        
                }
                else {
                    this.color_masked = "color";
                    this.position_masked = "position";
                    this.normal_masked = "normal";
                    this.depth_masked = "depthDefaultDefaultMaterials";
                    this.normalTheta_masked = "normalTheta";
                    this.binormal_masked = "binormal";
                }

               console.log("Gaussian Test: 3, 1", gaussianKernel(3, 1));
        

            });

            const masksFolder = this.pane.addFolder({
                title: 'IOR Settings',
                expanded: true,
                hidden: true,
            });

            masksFolder.addBlade({
                view: 'list',
                label: 'Masks',
                options: [
                  {text: 'low', value: 'mask_low'},
                  {text: 'medium', value: 'mask_medium'},
                  {text: 'high', value: 'mask_high'},
                  {text: 'scene', value: 'scene'},
                ],
                value: 'scene',
              }).on('change', (ev) => {

                  if (ev.value == 'mask_low') {
                      
                      this.finalColorTex = "color2";
                  }
                  else if (ev.value == 'mask_medium') {
                      
                      this.finalColorTex = "color1"
                  }
              else if (ev.value == 'mask_high') {
                     
                      this.finalColorTex = "color0";
                  }
                  else
                      this.finalColorTex = "showerColor";


            });

            filteringFolder.addButton({
                title: 'Increment',
                label: 'counter',   // optional
              });

              this.pane.addTab({
                pages: [
                  {title: 'Parameters'},
                  {title: 'Advanced'},
                ],
              });


            masksFolder.addBinding(this.PARAMS, 'energyLowInterval', {
                min: -1.0,
                max: this.max_E,
                step: 0.001,
                label: 'Low Filter'
            }).on('change', (ev) => {
                this.energy_cut_low_l = ev.value.min;
                this.energy_cut_low_h = ev.value.max;

                this.scene.remove(this.lineStrip);
                this.scene.remove(this.lineStrip_low);
                this.scene.remove(this.lineStrip_meduim);
                this.scene.remove(this.lineStrip_high);

                if(this.PARAMS.bySubTree && this.PARAMS.byPDG)
                    this.getSubTreeAtNode(this.PARAMS.subTree, true, this.PARAMS.pdg);
                else if(this.PARAMS.bySubTree)
                    this.getSubTreeAtNode(this.PARAMS.subTree);
                else if(this.PARAMS.byPDG)
                    this.getSubTreeAtNode(1, true, this.PARAMS.pdg);
                else
                    this.getSubTreeAtNode(1);
            });

            masksFolder.addBinding(this.PARAMS, 'energyMedInterval', {
                min: -1.0,
                max: this.max_E,
                step: 0.001,
                label: 'Medium Filter'
            }).on('change', (ev) => {
                this.energy_cut_med_l = ev.value.min;
                this.energy_cut_med_h = ev.value.max;

                this.scene.remove(this.lineStrip);
                this.scene.remove(this.lineStrip_low);
                this.scene.remove(this.lineStrip_meduim);
                this.scene.remove(this.lineStrip_high);

                if(this.PARAMS.bySubTree && this.PARAMS.byPDG)
                    this.getSubTreeAtNode(this.PARAMS.subTree, true, this.PARAMS.pdg);
                else if(this.PARAMS.bySubTree)
                    this.getSubTreeAtNode(this.PARAMS.subTree);
                else if(this.PARAMS.byPDG)
                    this.getSubTreeAtNode(1, true, this.PARAMS.pdg);
                else
                    this.getSubTreeAtNode(1);
            });

            masksFolder.addBinding(this.PARAMS, 'energyHighInterval', {
                min: -1.0,
                max: this.max_E,
                step: 0.001,
                label: 'High Filter'
            }).on('change', (ev) => {
                this.energy_cut_high_l = ev.value.min;
                this.energy_cut_high_h = ev.value.max;

                this.scene.remove(this.lineStrip);
                this.scene.remove(this.lineStrip_low);
                this.scene.remove(this.lineStrip_meduim);
                this.scene.remove(this.lineStrip_high);

                if(this.PARAMS.bySubTree && this.PARAMS.byPDG)
                    this.getSubTreeAtNode(this.PARAMS.subTree, true, this.PARAMS.pdg);
                else if(this.PARAMS.bySubTree)
                    this.getSubTreeAtNode(this.PARAMS.subTree);
                else if(this.PARAMS.byPDG)
                    this.getSubTreeAtNode(1, true, this.PARAMS.pdg);
                else
                    this.getSubTreeAtNode(1);
            });

            masksFolder.addBinding(this.PARAMS, 'radius', {
                min: 1.0,
                max: 20,
                step: 1,
                label: 'Gaussian Kernel Radius'
            }).on('change', (ev) => {
                this.gb.addSBValue("RADIUS", ev.value + 1.0);
                this.gb_2.addSBValue("RADIUS", ev.value + 1.0);

                const [offset_gaussian, weight_gaussian] = gaussianKernel(ev.value, this.PARAMS.sigma);

                console.log("Gaussian Test: ", ev.value, this.PARAMS.sigma);
                console.log("Gaussian Test: ", offset_gaussian, weight_gaussian);

                this.gb.setUniform("offset[0]", offset_gaussian);
                this.gb.setUniform("weight[0]", weight_gaussian);

                this.gb_2.setUniform("offset[0]", offset_gaussian);
                this.gb_2.setUniform("weight[0]", weight_gaussian);
            });

            masksFolder.addBinding(this.PARAMS, 'sigma', {
                min: 0.0,
                max: 20,
                step: 0.1,
                label: 'Gaussian Kernel Sigma'
            }).on('change', (ev) => {
                const [offset_gaussian, weight_gaussian] = gaussianKernel(this.PARAMS.radius, ev.value);

                console.log("Gaussian Test: ", this.PARAMS.radius, ev.value);
                console.log("Gaussian Test: ", offset_gaussian, weight_gaussian);

                this.gb.setUniform("offset[0]", offset_gaussian);
                this.gb.setUniform("weight[0]", weight_gaussian);

                this.gb_2.setUniform("offset[0]", offset_gaussian);
                this.gb_2.setUniform("weight[0]", weight_gaussian);
            });

        lightingFolder.addBinding(this.PARAMS, 'transparent',
            { label: 'transparent' })
            .on('change', (ev) => {
                opacityFolder.hidden = !opacityFolder.hidden;
                this.transparent = ev.value;

                
                this.lineStrip.material.transparent = this.transparent;

            });

        const opacityFolder = lightingFolder.addFolder({
            title: 'Opacity Settings',
            expanded: true,
            hidden: true,
        });

        opacityFolder.addBinding(this.PARAMS, 'opacity',
            { label: 'Opacity', min: 0, max: 1, step: 0.01 })
            .on('change', (ev) => {
                this.opacity = ev.value;
                
                this.lineStrip.material.opacity = this.opacity;
                this.lineStrip.material.setUniform("manualOpacity", true);

                
            });

        lightingFolder.addBinding(this.PARAMS, 'light_ambient',
            { label: 'light_ambient' })
            .on('change', (ev) => {
                this.lightingMaterial.setUniform("light_ambient", ev.value);
            });

        lightingFolder.addBinding(this.PARAMS, 'light_diffuse',
            { label: 'light_diffuse' })
            .on('change', (ev) => {
                this.lightingMaterial.setUniform("light_diffuse", ev.value);
            });

        lightingFolder.addBinding(this.PARAMS, 'light_specular',
            { label: 'light_specular' })
            .on('change', (ev) => {
                this.lightingMaterial.setUniform("light_specular", ev.value);
            });

        lightingFolder.addBinding(this.PARAMS, 'ambientOcc',
            { label: 'ambientOcc' })
            .on('change', (ev) => {
                this.lightingMaterial.setUniform("ambientOcc", ev.value);
            });



        const animationFolder = this.pane.addFolder({
            title: 'Animation Settings',
            expanded: false,
            hidden: false,
        });


        animationFolder.addBinding(this.PARAMS, 'animation',
            {
                label: 'Dashed-line Animation',
            }).on('change', (ev) => {
                animationSubFolder.hidden = !animationSubFolder.hidden;
                this.animate = ev.value;
                if (!ev.value) {
                    
                    this.lineStrip.setAnimationPattern(0.0);
                    this.lineStrip_high.setAnimationPattern(0.0);
                    this.lineStrip_meduim.setAnimationPattern(0.0);
                    this.lineStrip_low.setAnimationPattern(0.0);



                }
            });

        animationFolder.addBinding(this.PARAMS, 'timeAnimation',
            {
                label: 'Time Animation',
            }).on('change', (ev) => {
                timeAnimationSubFolder.hidden = !timeAnimationSubFolder.hidden;
                this.timeAnimate = ev.value;
            });

        const animationSubFolder = animationFolder.addFolder({
            title: 'Dashed-line Animation Settings',
            expanded: true,
            hidden: true,
        });

        const timeAnimationSubFolder = animationFolder.addFolder({
            title: 'Time Animation Settings',
            expanded: true,
            hidden: true,
        });

        timeAnimationSubFolder.addBinding(this.PARAMS, 'timeAnimationInterval', {
            min: this.min_T,
            max: this.max_T,
            step: 0.001,
            label: 'Time Animation Interval'
        }).on('change', (ev) => {
            this.limitT_Min_Animation = ev.value.min;
            this.limitT_Max_Animation = ev.value.max;
        });

        animationSubFolder.addBinding(this.PARAMS, 'gap',
            { label: 'Gap Size', min: 1, max: 5, step: 1 })
            .on('change', (ev) => {
                
                this.lineStrip.setGapSize(ev.value);
                this.lineStrip_high.setGapSize(ev.value);
                this.lineStrip_meduim.setGapSize(ev.value);
                this.lineStrip_low.setGapSize(ev.value);

                

            });
        animationSubFolder.addBinding(this.PARAMS, 'fill',
            { label: 'Segment Size', min: 1, max: 5, step: 1 })
            .on('change', (ev) => {
                
                this.lineStrip.setFillSize(ev.value);
                this.lineStrip_high.setFillSize(ev.value);
                this.lineStrip_meduim.setFillSize(ev.value);
                this.lineStrip_low.setFillSize(ev.value);


            });
        animationSubFolder.addBinding(this.PARAMS, 'speed',
            { label: 'Speed', min: 1, max: 99, step: 1, row: 6 })
            .on('change', (ev) => {
                this.animationSpeed = 101 - ev.value;

            });


        const debuggingFolder = this.pane.addFolder({
            title: 'Debugging Settings',
            expanded: false,
            hidden: false,
        });

        debuggingFolder.addBinding(this.PARAMS, 'colors',
            {
                label: 'Colors',
            }).on('change', (ev) => {
                this.colors = ev.value;
                if (!ev.value) {
                    
                    this.lineStrip.setColors(this.colors);
                    this.lineStrip_high.setColors(this.colors);
                    this.lineStrip_meduim.setColors(this.colors);
                    this.lineStrip_low.setColors(this.colors);


                }
            });

        filteringFolder.addBinding(this.PARAMS, 'byPDG',
            {
                label: 'Display By pdg id',
            }).on('change', (ev) => {
                pdgFolder.hidden = !pdgFolder.hidden;
                this.byPDG = ev.value;

                if (!ev.value) {

                    
                    this.scene.remove(this.lineStrip);
                    this.scene.remove(this.lineStrip_low);
                    this.scene.remove(this.lineStrip_meduim);
                    this.scene.remove(this.lineStrip_high);

                    if(this.PARAMS.bySubTree)
                        this.getSubTreeAtNode(this.PARAMS.subTree);
                    else 
                        this.getSubTreeAtNode(1);
                    

                    this.PARAMS.interval.min = this.min_T;
                    this.PARAMS.interval.max = this.max_T;
                    this.PARAMS.gap = 1;
                    this.PARAMS.fill = 2;
                    this.PARAMS.speed = 50;
                    this.limitT_Min = this.PARAMS.interval.min;
                    this.limitT_Max = this.PARAMS.interval.max;

                    this.timeFolder.remove(this.intervalBiding);


                    this.intervalBiding = this.timeFolder.addBinding(this.PARAMS, 'interval', {
                        min: this.min_T,
                        max: this.max_T,
                        step: 0.001,
                        label: 'Time Interval'
                    }).on('change', (ev) => {
                        this.limitT_Min = ev.value.min;
                        this.limitT_Max = ev.value.max;
                    });
                }

            });


        const pdgFolder = filteringFolder.addFolder({
            title: 'pdg Settings',
            expanded: true,
            hidden: true,
        });

        pdgFolder.addBinding(this.PARAMS, 'pdg', {
            min: -1000000000,
            max: 1000000000,
            step: 1,
        }).on('change', (ev) => {
            
            this.scene.remove(this.lineStrip);
            this.scene.remove(this.lineStrip_low);
            this.scene.remove(this.lineStrip_meduim);
            this.scene.remove(this.lineStrip_high);

            if(this.PARAMS.bySubTree)
                this.getSubTreeAtNode(this.PARAMS.subTree, true, ev.value);
            else 
                this.getSubTreeAtNode(1, true, ev.value);


            this.PARAMS.interval.min = this.min_T;
            this.PARAMS.interval.max = this.max_T;
            this.PARAMS.byLevel = false;

            this.timeFolder.remove(this.intervalBiding);

            this.intervalBiding = this.timeFolder.addBinding(this.PARAMS, 'interval', {
                min: this.PARAMS.interval.min,
                max: this.PARAMS.interval.max,
                step: 0.001,
                label: 'Time Interval'
            }).on('change', (ev) => {
                this.limitT_Min = ev.value.min;
                this.limitT_Max = ev.value.max;
            });

            this.pane.refresh();

        });


        filteringFolder.addBinding(this.PARAMS, 'bySubTree',
            {
                label: 'Display By SubTree',
            }).on('change', (ev) => {
                subTreeFolder.hidden = !subTreeFolder.hidden;
                this.bySubTree = ev.value;

                if (!ev.value) {

                    
                    this.scene.remove(this.lineStrip);
                    this.scene.remove(this.lineStrip_low);
                    this.scene.remove(this.lineStrip_meduim);
                    this.scene.remove(this.lineStrip_high);

                    if(this.PARAMS.byPDG)
                        this.getSubTreeAtNode(1, true, this.PARAMS.pdg);
                    else
                        this.getSubTreeAtNode(1);

                    this.PARAMS.interval.min = this.min_T;
                    this.PARAMS.interval.max = this.max_T;
                    this.PARAMS.gap = 1;
                    this.PARAMS.fill = 2;
                    this.PARAMS.speed = 50;
                    this.limitT_Min = this.PARAMS.interval.min;
                    this.limitT_Max = this.PARAMS.interval.max;

                    this.timeFolder.remove(this.intervalBiding);


                    this.intervalBiding = this.timeFolder.addBinding(this.PARAMS, 'interval', {
                        min: this.min_T,
                        max: this.max_T,
                        step: 0.001,
                        label: 'Time Interval'
                    }).on('change', (ev) => {
                        this.limitT_Min = ev.value.min;
                        this.limitT_Max = ev.value.max;
                    });
                }

            });


        const subTreeFolder = filteringFolder.addFolder({
            title: 'SubTree Settings',
            expanded: true,
            hidden: true,
        });

        const energyFolder = filteringFolder.addFolder({
            title: 'Energy Settings',
            expanded: true,
            hidden: false,
        });

        this.timeFolder = filteringFolder.addFolder({
            title: 'Time Settings',
            expanded: true,
            hidden: false,
        });

        subTreeFolder.addBinding(this.PARAMS, 'subTree', {
            min: 1,
            max: 12507,
            step: 1,
        }).on('change', (ev) => {
            
            this.scene.remove(this.lineStrip);
            this.scene.remove(this.lineStrip_low);
            this.scene.remove(this.lineStrip_meduim);
            this.scene.remove(this.lineStrip_high);

            if(this.PARAMS.byPDG)
                this.getSubTreeAtNode(ev.value, true, this.PARAMS.pdg);
            else
                this.getSubTreeAtNode(ev.value);

            this.PARAMS.interval.min = this.min_T;
            this.PARAMS.interval.max = this.max_T;
            this.PARAMS.byLevel = false;

            this.timeFolder.remove(this.intervalBiding);

            this.intervalBiding = this.timeFolder.addBinding(this.PARAMS, 'interval', {
                min: this.PARAMS.interval.min,
                max: this.PARAMS.interval.max,
                step: 0.001,
                label: 'Time Interval'
            }).on('change', (ev) => {
                this.limitT_Min = ev.value.min;
                this.limitT_Max = ev.value.max;
            });

            this.pane.refresh();

        });

        energyFolder.addBinding(this.PARAMS, 'energyCrop', {
            min: this.min_E,
            max: this.max_E,
            step: 0.001,
            label: 'Energy Max Crop'
        }).on('change', (ev) => {
            
            energyFolder.remove(this.energyIntervalBiding);

            this.energyIntervalBiding = energyFolder.addBinding(this.PARAMS, 'energyInterval', {
                min: this.min_E,
                max: ev.value,
                step: 0.001,
                label: 'Energy Interval'
            }).on('change', (ev) => {
                this.limitE_Min = ev.value.min;
                this.limitE_Max = ev.value.max;
            });

            this.pane.refresh();
        });

        // Interval
        this.energyIntervalBiding = energyFolder.addBinding(this.PARAMS, 'energyInterval', {
            min: 0,
            max: this.max_E,
            step: 0.001,
            label: 'Energy Interval'
        }).on('change', (ev) => {
            this.limitE_Min = ev.value.min;
            this.limitE_Max = ev.value.max;
        });

        // Interval
        this.timeFolder.addBinding(this.PARAMS, 'timeCrop', {
            min: this.min_T,
            max: this.max_T,
            step: 0.001,
            label: 'Time Max Crop'
        }).on('change', (ev) => {
            
            this.timeFolder.remove(this.intervalBiding);

            this.intervalBiding = this.timeFolder.addBinding(this.PARAMS, 'interval', {
                min: this.PARAMS.interval.min,
                max: ev.value,
                step: 0.001,
                label: 'Time Interval'
            }).on('change', (ev) => {
                this.limitT_Min = ev.value.min;
                this.limitT_Max = ev.value.max;
            });

            this.pane.refresh();
        });

        // Interval
        this.intervalBiding = this.timeFolder.addBinding(this.PARAMS, 'interval', {
            min: this.min_T,
            max: this.max_T,
            step: 0.001,
            label: 'Time Interval'
        }).on('change', (ev) => {
            this.limitT_Min = ev.value.min;
            this.limitT_Max = ev.value.max;
        });


        this.pane.addBinding(this.PARAMS, 'outline',
            {
                label: 'Outline',
            }).on('change', (ev) => {
                outlineFolder.hidden = !outlineFolder.hidden;
                this.outline = ev.value;
                this.outlineMaterial.setUniform("outline", this.outline);

            });

        const outlineFolder = this.pane.addFolder({
            title: 'Outline Settings',
            expanded: true,
            hidden: true,
        });


        outlineFolder.addBinding(this.PARAMS, 'outlineWidth',
            { label: 'Outline Width', min: 0, max: 10, step: 0.1 })
            .on('change', (ev) => {
                this.outlineMaterial.setUniform("scale", ev.value);
            });

        this.pane.addBinding(this.PARAMS, 'trackWidth',
            { label: 'Tracks Width', min: 0, max: 0.1, step: 0.00001 })
            .on('change', (ev) => {
                this.trackWidth = ev.value;
            });

        // Ensure buttons inside the pane are visible
        const buttons = this.pane.element.querySelectorAll('button');
        buttons.forEach(button => {

            button.style.opacity = '1';  // Set the opacity to 1 for full visibility (previously 0)
            button.style.position = 'relative';  // Fixed position for the container

        });

        // --- NEW: EXPOSE FOLDERS FOR THE STUDY MANAGER ---
        this.geometryFolder = geometryFolder;
        this.performanceFolder = performanceFolder;
        this.dataFolder = dataFolder;
        this.filteringFolder = filteringFolder;
        this.lightingFolder = lightingFolder;
        this.masksFolder = masksFolder;
        this.animationFolder = animationFolder;
        this.debuggingFolder = debuggingFolder;
        this.outlineFolder = outlineFolder;
        // -------------------------------------------------
    }

    // preprocessData(file) {

    //     $.ajax({
    //         type: "POST",
    //         url: 'http://127.0.0.1:5500/preprocess',
    //         contentType: "application/json",
    //         dataType: 'json',
    //         data: JSON.stringify({
    //             fileName: file
    //         }),
    //         success: function (data) {
    //             //console.log("preprocess ajax success", data)
    //             app.loadData();
    //         },
    //         error: function (err) {
    //             //console.log("preprocess ajax fail", err)
    //         }
    //     }).done(function (o) {
    //         // do something
    //         //console.log("preprocess ajax done", o);
    //         document.getElementById("vis").innerHTML = "";
    //         initVega();
            
    //     });
        
    // }

    preprocessData(file) {
        console.log(`[Data Manager] Bypassing Python, directly loading: ${file}`);
        
        // 1. Clear the 2D View
        const visElement = document.getElementById("vis");
        if (visElement) visElement.innerHTML = "";
        
        try {
            if(typeof initVega === 'function') initVega(file);
        } catch(e) {
            console.warn("Vega init failed or not present", e);
        }

        // 2. Load the file directly into WebGL
        this.loadData(file);
    }

    generateSamples(numberOfSamples) {
        const ssaoSamples = [];

        for (let i = 0; i < numberOfSamples; ++i) {
            const sample = new Vector3(
                Math.random() * 2.0 - 1.0,
                Math.random() * 2.0 - 1.0,
                Math.random()
            ).normalize();

            const rand = Math.random();
            sample.multiplyScalar(rand);


            let scale = i / numberOfSamples;
            scale = _Math.lerp(0.1, 1.0, scale * scale);
            sample.multiplyScalar(scale);

            ssaoSamples.push(sample.x, sample.y, sample.z);
        }

        return ssaoSamples;
    }

    generateNoise(numberOfNoise) {
        const ssaoNoise = [];

        for (let i = 0; i < numberOfNoise; ++i) {
            const noise = new Vector3(
                Math.random() * 2.0 - 1.0,
                Math.random() * 2.0 - 1.0,
                0.0
            ).normalize();

            ssaoNoise.push(noise.x, noise.y, noise.z);
        }

        return ssaoNoise;
    }

    render() {
        if (this.fpsGraph != null)
            this.fpsGraph.begin();

        //this.renderer.clearColor = "#ffffff";

        //console.log("scene", this.scene);
            

        this.stopwatch.currTime = performance.now();
        this.stopwatch.deltaTime = (this.stopwatch.currTime - this.stopwatch.prevTime);
        this.stopwatch.prevTime = this.stopwatch.currTime;

        this.keyboard.keyboardTranslation.reset();
        this.keyboard.keyboardRotation.reset();

        //CAMERA TRANSFORM ANIMATION
        const input = {
            keyboard: this.keyboard.keyboardInput.update(),
            navigators: {
                rotation: this.keyboard.keyboardRotation,
                translation: this.keyboard.keyboardTranslation
            },
            mouse: this.mouse.mouseInput.update(),
            gamepads: undefined,
            multiplier: 1
        };

        this.camera.translateX(this.keyboard.keyboardTranslation.x * this.stopwatch.deltaTime * 0.001);
        this.camera.translateY(this.keyboard.keyboardTranslation.y * this.stopwatch.deltaTime * 0.001);
        this.camera.translateZ(this.keyboard.keyboardTranslation.z * this.stopwatch.deltaTime * 0.001);

        //console.log("cam pos", this.camera.position);
        if (this.keyboard.keyboardRotation.x != 0 || this.keyboard.keyboardRotation.y != 0 || this.keyboard.keyboardRotation.z != 0) {

            //let centerToCamera = this.center.clone().sub(this.camera.position);

            //this.camera.position.add(centerToCamera);

            //this.camera.translateX(this.keyboard.keyboardRotation.x * this.stopwatch.deltaTime * 0.001);
            //this.camera.translateY(this.keyboard.keyboardRotation.y * this.stopwatch.deltaTime * 0.001);
            //this.camera.translateZ(this.keyboard.keyboardRotation.z * this.stopwatch.deltaTime * 0.001);

            //this.camera.rotateX(this.keyboard.keyboardRotation.x * this.stopwatch.deltaTime * 0.001);
            //this.camera.rotateY(this.keyboard.keyboardRotation.y * this.stopwatch.deltaTime * 0.001);
            //this.camera.rotateZ(this.keyboard.keyboardRotation.z * this.stopwatch.deltaTime * 0.001);

            // this.camera.position.sub(centerToCamera);

            //this.camera.lookAt(this.center, new RC.Vector3(0, 1, 0));



        }


        if (this.lineStrip) {


            this.lineStrip.setTimeLimitMin(this.limitT_Min);
            this.lineStrip.setTimeLimitMax(this.limitT_Max);
            this.lineStrip.setEnergyLimitMin(this.limitE_Min);
            this.lineStrip.setEnergyLimitMax(this.limitE_Max);
            this.lineStrip.setTEnergyMax(this.PARAMS.energyCrop);

            this.lineStrip.setWidth(this.trackWidth);

            this.lineStrip_high.setTimeLimitMin(this.limitT_Min);
            this.lineStrip_high.setTimeLimitMax(this.limitT_Max);
            this.lineStrip_high.setEnergyLimitMin(this.limitE_Min);
            this.lineStrip_high.setEnergyLimitMax(this.limitE_Max);
            this.lineStrip_high.setTEnergyMax(this.PARAMS.energyCrop);

            this.lineStrip_high.setWidth(this.trackWidth);

            this.lineStrip_meduim.setTimeLimitMin(this.limitT_Min);
            this.lineStrip_meduim.setTimeLimitMax(this.limitT_Max);
            this.lineStrip_meduim.setEnergyLimitMin(this.limitE_Min);
            this.lineStrip_meduim.setEnergyLimitMax(this.limitE_Max);
            this.lineStrip_meduim.setTEnergyMax(this.PARAMS.energyCrop);

            this.lineStrip_meduim.setWidth(this.trackWidth);
            
            this.lineStrip_low.setTimeLimitMin(this.limitT_Min);
            this.lineStrip_low.setTimeLimitMax(this.limitT_Max);
            this.lineStrip_low.setEnergyLimitMin(this.limitE_Min);
            this.lineStrip_low.setEnergyLimitMax(this.limitE_Max);
            this.lineStrip_low.setTEnergyMax(this.PARAMS.energyCrop);

            this.lineStrip_low.setWidth(this.trackWidth);

            

            if(this.timeAnimate)
            {
                if(this.count % (1) == 0)
                    {
                        this.timeAnimationCount = 0.01;
                        //console.log("here", (this.limitT_Min_Animation + this.timeAnimationCount),  (this.limitT_Min_Animation + this.timeAnimationCount) % this.max_T);
                        this.limitT_Min_Animation = this.limitT_Min_Animation + this.timeAnimationCount;
                        this.limitT_Max_Animation = this.limitT_Max_Animation + this.timeAnimationCount;

                        if(this.limitT_Max_Animation > this.max_T)
                            {
                                this.limitT_Max_Animation = this.min_T + (this.limitT_Max_Animation - this.limitT_Min_Animation);
                                this.limitT_Min_Animation = this.min_T;
                            }
                    }
                


                this.lineStrip.setTimeLimitMin(this.limitT_Min_Animation);
                this.lineStrip.setTimeLimitMax(this.limitT_Max_Animation);
                this.lineStrip_high.setTimeLimitMin(this.limitT_Min_Animation);
                this.lineStrip_high.setTimeLimitMax(this.limitT_Max_Animation);
                this.lineStrip_meduim.setTimeLimitMin(this.limitT_Min_Animation);
                this.lineStrip_meduim.setTimeLimitMax(this.limitT_Max_Animation);
                this.lineStrip_low.setTimeLimitMin(this.limitT_Min_Animation);
                this.lineStrip_low.setTimeLimitMax(this.limitT_Max_Animation);
            }



            if (this.count % (this.animationSpeed) == 0 && this.animate) {
                this.patternCount = this.patternCount + 0.001;
                this.lineStrip.setAnimationPattern(this.patternCount);

                this.lineStrip_high.setAnimationPattern(this.patternCount);
                this.lineStrip_meduim.setAnimationPattern(this.patternCount);
                this.lineStrip_low.setAnimationPattern(this.patternCount);

            }

            if (this.colors) {
                this.lineStrip.setColors(this.colors);
                this.lineStrip_high.setColors(this.colors);
                this.lineStrip_meduim.setColors(this.colors);
                this.lineStrip_low.setColors(this.colors);

            }

            this.count++
        }

        //camera manager
        if (!this.GUIActive && !this.cameraLocked) {
            this.cameraManager.update(input, this.stopwatch.deltaTime);
        }

        let currDistanceToCamera = this.center.clone().sub(this.camera.position);

    

        if(!this.masked)
            this.renderQueue.render();
        else
            this.renderQueue_IOR.render();


        if (this.fpsGraph != null)
            this.fpsGraph.end();

        window.requestAnimationFrame(() => { this.render() });

    }


    initInputControls() {

        this.keyboard = { keyboardInput: undefined, keyboardTranslation: { x: 0, y: 0, z: 0, reset: function () { this.x = 0; this.y = 0; this.z = 0; } }, keyboardRotation: { x: 0, y: 0, z: 0, reset: function () { this.x = 0; this.y = 0; this.z = 0; } } };
        this.mouse = { mouseInput: undefined };
        this.cameraControl = { regularCameraControl: undefined, orbitalCameraControl: undefined, activeCameraControl: true };
        this.keyMap = {
            ROT_X_NEG: 40,
            ROT_X_POS: 38,
            ROT_Y_NEG: 39,
            ROT_Y_POS: 37,
            //ROT_Z_NEG: 69,
            ROT_Z_NEG: undefined,
            //ROT_Z_POS: 81,
            ROT_Z_POS: undefined,

            MV_X_NEG: 65,
            MV_X_POS: 68,
            //MV_Y_NEG: 17,
            MV_Y_NEG: 81,
            //MV_Y_POS: 32,
            MV_Y_POS: 69,
            MV_Z_NEG: 87,
            MV_Z_POS: 83,
        };

        //input object
        this.input = {
            keyboard: undefined,
            navigators: {
                rotation: undefined,
                translation: undefined
            },
            mouse: undefined,
            gamepads: undefined,
            multiplier: 1
        };

        this.patternCount = 0;
        this.timeAnimationCount = 0;

        this.keyboard.keyboardInput = RC.KeyboardInput.instance;
        this.mouse.mouseInput = RC.MouseInput.instance;
        this.mouse.mouseInput.setSourceObject(window);

        this.keyboard.keyboardInput.addListener(function (pressedKeys) {
            // ROTATIONS

            if (pressedKeys.has(65)) {  // A
                app.keyboard.keyboardRotation.y = 1;
            }

            if (pressedKeys.has(68)) {  // D
                app.keyboard.keyboardRotation.y = -1;
            }

            if (pressedKeys.has(87)) {  // W
                app.keyboard.keyboardRotation.x = 1;
            }

            if (pressedKeys.has(83)) {  // S
                app.keyboard.keyboardRotation.x = -1;
            }

            if (pressedKeys.has(81)) {  // Q
                app.keyboard.keyboardRotation.z = 1;
            }

            if (pressedKeys.has(82)) {  // R
                app.keyboard.keyboardRotation.z = -1;
            }


            // TRANSLATIONS
            if (pressedKeys.has(39)) {  // RIGHT - Right
                app.keyboard.keyboardTranslation.x = 1;
            }

            if (pressedKeys.has(37)) {  // LEFT - Left
                app.keyboard.keyboardTranslation.x = -1;
            }

            if (pressedKeys.has(40)) {  // DOWN - Backward
                app.keyboard.keyboardTranslation.z = 1;
            }

            if (pressedKeys.has(38)) {  // UP - Forward
                app.keyboard.keyboardTranslation.z = -1;
            }

            if (pressedKeys.has(85)) {  // U - Upward
                app.keyboard.keyboardTranslation.y = 1;
            }

            if (pressedKeys.has(70)) {  // F - Downward
                app.keyboard.keyboardTranslation.y = -1;
            }

        });
        // endregion

    }

    resize() {
        // Make the canvas the same size
        this.canvas.width = window.innerWidth * window.devicePixelRatio;
        this.canvas.height = window.innerHeight * window.devicePixelRatio;

        // Update camera aspect ratio and renderer viewport
        this.camera.aspect = this.canvas.width / this.canvas.height;
        this.renderer.updateViewport(this.canvas.width, this.canvas.height);
    }
}

// add a function to the dataflow to update pre with the hovered value
export function getNodeId(evt, val) {
    //d3.select("#pre-hovered").text(JSON.stringify(val));

    // --- KEEP THIS: Stop the infinite echo loop if 3D triggered this! ---
    if (window.app && window.app.isUpdatingVega) return;

    if (val != 0) {


        app.scene.remove(app.lineStrip);
        app.scene.remove(app.lineStrip_low);
        app.scene.remove(app.lineStrip_meduim);
        app.scene.remove(app.lineStrip_high);

        app.getSubTreeAtNode(val);


        // --- NEW: SNAP CAMERA TO THE NEW SUBTREE ---
        // Don't move the camera if it's locked for a specific study trial (like T1)
        if (!app.cameraLocked) {
            let targetNode = app.root.first(function (n) { return n.model.id === val; });
            
            if (targetNode && targetNode.model && targetNode.model.position_beg) {
                const pos = targetNode.model.position_beg;

                // 1. Calculate the scaled center of the newly selected track
                app.center = new RC.Vector3(
                    app.scale * pos[0],
                    app.scale * pos[1],
                    app.scale * pos[2]
                );

                // 2. Snap the camera physically (using the same offset logic as loadData)
                app.camera.position.set(pos[0], pos[1], pos[2]);
                app.camera.lookAt(app.center, new RC.Vector3(0, 1, 0));

                // 3. Reset the RenderCore CameraManager so it pivots around the new track
                if (app.cameraManager) {
                    app.cameraManager.addFullOrbitCamera(app.camera, app.center);
                    app.cameraManager.activeCamera = app.camera;
                }
            }
        }
        // -------------------------------------------

        app.PARAMS.interval.min = app.min_T;
        app.PARAMS.interval.max = app.max_T;

        app.PARAMS.bySubTree = true;
        app.PARAMS.subTree = val;

        app.PARAMS.byLevel = false;

        app.timeFolder.remove(app.intervalBiding);

        app.intervalBiding = app.timeFolder.addBinding(app.PARAMS, 'interval', {
            min: app.PARAMS.interval.min,
            max: app.PARAMS.interval.max,
            step: 0.001,
            label: 'Time Interval'
        }).on('change', (ev) => {
            app.limitT_Min = ev.value.min;
            app.limitT_Max = ev.value.max;
        });

        app.pane.refresh();

        // --- CLEAN SLATE: 2D HIGHLIGHT ONLY ---
        if (window.vegaView) {
            (async function() {
                try {
                    app.isUpdatingVega = true;

                    // 1. Force the node to highlight (SYNCED WITH MULTI-SELECT)
                    let highlightPayload = [Number(val)];
                    if (app.studyHighlightedIds && app.studyHighlightedIds.length > 0) {
                        highlightPayload = app.studyHighlightedIds;
                    }
                    await window.vegaView.signal('nodeHighlight', highlightPayload).runAsync();

                    app.isUpdatingVega = false;
                } catch (e) {
                    console.warn("Vega 2D Highlight failed:", e);
                    app.isUpdatingVega = false;
                }
            })();
        }
        // ---------------------------------------------
    }
};





export function updateRange(evt, val) {
    const rangeBeg = document.getElementsByName("xbegin");
    const rangeEnd = document.getElementsByName("xend");

    if (!rangeBeg || !rangeBeg[0] || !rangeEnd || !rangeEnd[0]) return;

    if (val == "time") {
        rangeBeg[0].min = app.min_T - 1;
        rangeEnd[0].min = app.min_T - 1;

        rangeBeg[0].max = app.max_T + 1;
        rangeEnd[0].max = app.max_T + 1;
    }
    else { 
        // --- FIX: Give Depth and Z massive safe bounds so they never clamp! ---
        rangeBeg[0].min = -10000;
        rangeEnd[0].min = -10000;

        rangeBeg[0].max = 10000;
        rangeEnd[0].max = 10000;
    }
}

function erf(x) {
    // constants
    var a1 =  0.254829592;
    var a2 = -0.284496736;
    var a3 =  1.421413741;
    var a4 = -1.453152027;
    var a5 =  1.061405429;
    var p  =  0.3275911;

    // Save the sign of x
    var sign = 1;
    if (x < 0) {
        sign = -1;
    }
    x = Math.abs(x);

    // A&S formula 7.1.26
    var t = 1.0/(1.0 + p*x);
    var y = 1.0 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t*Math.exp(-x*x);

    return sign*y;
}

function gaussianKernel(radius, sigma)
{
    //const radius = parseInt(radiusInput.value);
    //const sigma = parseFloat(sigmaInput.value);
    const linear = false;
    const correction = true;

    if (sigma == 0.0) return;

    var weights = [];
    let sumWeights = 0.0;
    for (let i = -radius; i <= radius; i++)
    {
        let w = 0;
        if (correction)
        {  
            w = (erf((i + 0.5) / sigma / Math.sqrt(2)) - erf((i - 0.5) / sigma / Math.sqrt(2))) / 2;
        }
        else
        {
            w = Math.exp(- i * i / sigma / sigma);
        }
        sumWeights += w;
        weights.push(w);
    }

    for (let i in weights)
        weights[i] /= sumWeights;

    var offsets = [];
    var newWeights = [];

    let hasZeros = false;

    if (linear)
    {
        for (let i = -radius; i <= radius; i += 2)
        {
            if (i == radius)
            {
                offsets.push(i);
                newWeights.push(weights[i + radius]);
            }
            else
            {
                const w0 = weights[i + radius + 0];
                const w1 = weights[i + radius + 1];

                const w = w0 + w1;
                if (w > 0)
                {
                    offsets.push(i + w1 / w);
                }
                else
                {
                    hasZeros = true;
                    offsets.push(i);
                }
                newWeights.push(w);
            }
        }
    }
    else
    {
        for (let i = -radius; i <= radius; i++)
        {
            offsets.push(i);
        }

        for (let w of weights)
            if (w == 0.0)
                hasZeros = true;

        newWeights = weights;
    }

    return [offsets.slice(radius,offsets.length), newWeights.slice(radius,offsets.length)];
/*
    if (hasZeros)
        warningDiv.innerHTML = "Some weights are equal to zero; try using a smaller radius or a bigger sigma";
    else
        warningDiv.innerHTML = "<br>";
*/

}

document.addEventListener('DOMContentLoaded', () => {
    // --- SECURITY GATE: Abort the 3D Engine if not in study mode ---
    const params = new URLSearchParams(window.location.search);
    if (!params.has('study')) {
        console.warn("Direct access blocked. 3D Engine aborted.");
        return; // This completely stops WebGL and Tweakpane from loading!
    }
    // ---------------------------------------------------------------

    const canvas = document.querySelector('canvas');
    const app = window.app = new App(canvas);
});

// --- NEW: RESEARCHER SCOUTING SHORTCUT ---
// Press Shift + S to forcefully toggle the 2D Schematic Window on/off in ANY trial
window.addEventListener('keydown', (e) => {
    if (e.shiftKey && e.key.toLowerCase() === 's') {
        const schematicView = document.getElementById('widnow');
        if (schematicView) {
            // Check current state and toggle
            const isHidden = schematicView.style.display === 'none' || schematicView.style.display === '';
            schematicView.style.display = isHidden ? 'block' : 'none';
            
            // Print a bright pink warning to the console so you know the override fired
            console.warn(`%c[Researcher Mode] 2D Schematic forced ${isHidden ? 'ON' : 'OFF'}`, 'color: #FF00FF; font-size: 14px; font-weight: bold;');
        }
    }
});
// -----------------------------------------