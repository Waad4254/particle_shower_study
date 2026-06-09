// study.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. Parse URL Parameters
    const params = new URLSearchParams(window.location.search);
    const isStudyMode = params.has('study'); // Checks if ?study exists anywhere in URL
    
    // --- SECURITY GATE 1: Block non-study access ---
    if (!isStudyMode) {
        document.body.innerHTML = `
            <div style="text-align:center; margin-top:100px; font-family:sans-serif;">
                <h1>Access Denied</h1>
            </div>`;
        return;
    }

    // --- SECURITY GATE 2: Password Protection ---
    const STUDY_PASSWORD = "kaust_01"; // CHANGE THIS to your desired password
    const sessionAuth = sessionStorage.getItem('study_authenticated');

    if (sessionAuth !== 'true') {
        const userInput = prompt("Please enter the access code to begin the study:");
        if (userInput !== STUDY_PASSWORD) {
            alert("Incorrect password.");
            window.location.href = "https://google.com"; // Boot them out
            return;
        }
        sessionStorage.setItem('study_authenticated', 'true');
    }

    // 2. Setup Participant ID (Auto-generate if missing)
    let pid = params.get('pid');
    if (!pid) {
        pid = "USER_" + Math.random().toString(36).substr(2, 5).toUpperCase();
        console.log(`[Study] No PID found. Auto-generated: ${pid}`);
    }

    console.log(`[Study Mode] Initialized for: ${pid}`);

    // 2. Define the Trial Sequence
    const trialSequence = [
        { task: 'T1', condition: 'A', dataset: './data/t1a_ready.json', desc: "Of the two highlighted trajectories, which one is closer to the camera?", trackRed: 9025, trackBlue: 9018 },
        { task: 'T1', condition: 'B', dataset: './data/t1b_ready.json', desc: "Of the two highlighted trajectories, which one is closer to the camera?", trackRed: 9025, trackBlue: 9018 },
        { task: 'T2', condition: 'A', dataset: './data/t2a_ready.json', desc: "Click on the highest-energy trajectory in this shower." },
        { task: 'T2', condition: 'B', dataset: './data/t2b_ready.json', desc: "Click on the highest-energy trajectory in this shower." },
        { task: 'T3', condition: 'A', dataset: './data/t3b_ready.json', desc: "Find all direct daughter trajectories of the highlighted parent track.", parentTrack: 574 },
        { task: 'T3', condition: 'B', dataset: './data/t3b_ready.json', desc: "Find all direct daughter trajectories of the highlighted parent track.", parentTrack: 574 }
    ];
// blue blue, 1, 1, 575, 575
    let currentTrialIndex = 0;
    let candidateTracks = [];   // For T3 multi-select
    let selectedTrackT2 = null; // For T2 single-select
    let isWaitingForDataset = false;
    
    let trialStartTime = 0;     // The silent stopwatch
    let trialStartISO = "";
    let allStudyResults = [];   // Array to hold all 6 telemetry payloads

    // The correct answers for your specific trials.
    // YOU WILL NEED TO UPDATE THESE IDs TO MATCH YOUR ACTUAL DATASET!
    const groundTruth = {
        "T1_A": "BLUE",
        "T1_B": "BLUE",
        "T2_A": 1,           // Replace with actual highest-energy track ID for condition A
        "T2_B": 1,            // Replace with actual highest-energy track ID for condition B
        "T3_A": [575],   // Replace with actual daughter track IDs for condition A
        "T3_B": [575]      // Replace with actual daughter track IDs for condition B
    };

    // 3. Core Answer Submission and Telemetry Logic
    function submitAnswer(actionData) {
        // Stop the clock
        const endTime = performance.now();
        const submitISO = new Date().toISOString();
        const elapsedSeconds = parseFloat(((endTime - trialStartTime) / 1000).toFixed(2));
        const trial = trialSequence[currentTrialIndex];
        
        let finalAnswer = actionData;
        // ONLY override the answer with the track selections if they DID NOT click "I don't know"
        if (actionData !== 'IDK') {
            if (trial.task === 'T2') finalAnswer = selectedTrackT2;
            if (trial.task === 'T3') finalAnswer = [...candidateTracks];
        }

        // Grading
        let isCorrect = false;
        const trialKey = `${trial.task}_${trial.condition}`;
        const truth = groundTruth[trialKey];
        // if (trial.task === 'T1' || trial.task === 'T2') isCorrect = (finalAnswer === truth);
        // if (trial.task === 'T3') isCorrect = JSON.stringify([...finalAnswer].sort()) === JSON.stringify([...truth].sort());

        if (finalAnswer !== 'IDK') { // If they don't know, it's automatically false
            if (trial.task === 'T1' || trial.task === 'T2') isCorrect = (finalAnswer === truth);
            if (trial.task === 'T3') isCorrect = JSON.stringify([...finalAnswer].sort()) === JSON.stringify([...truth].sort());
        }

        // Construct Telemetry with EXACT Timestamps
        const trialRecord = {
            participant_id: pid,
            started_iso: trialStartISO,
            submitted_iso: submitISO,
            elapsed_s: elapsedSeconds,
            trial_index: currentTrialIndex + 1,
            task_id: trial.task,
            condition: trial.condition,
            answer: finalAnswer,
            correct: isCorrect,
            viewport: [window.innerWidth, window.innerHeight]
        };
        
        allStudyResults.push(trialRecord);
        loadTrial(currentTrialIndex + 1);
    }
    // 4. Expose functions globally so HTML buttons & app.js can trigger them
    window.hgcalStudy = {
        submitAnswer: submitAnswer,
        

    // The bridge function your 3D picking logic will call
    onTrackPicked: function(trackId) {
        // --- FIX 1: Force the JSON string into a strict Number ---
        trackId = Number(trackId); 

        const trial = trialSequence[currentTrialIndex];
        if (!trial) return;
        
        if (trial.task === 'T2') {
            selectedTrackT2 = trackId;
            
            const confirmBtn = document.getElementById('t2-confirm-btn');
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.style.background = '#28a745';
                confirmBtn.style.cursor = 'pointer';
            }
            console.log(`[T2] Track selected: ${trackId}`);
            
            // Highlight the clicked track in Cyan
            window.dispatchEvent(new CustomEvent("highlightSelection", { detail: [trackId] }));
            
        } else if (trial.task === 'T3') {
            // Toggle selection array
            const index = candidateTracks.indexOf(trackId);
            if (index > -1) {
                candidateTracks.splice(index, 1);
            } else {
                candidateTracks.push(trackId);
            }
            
            const countSpan = document.getElementById('t3-count');
            if (countSpan) {
                countSpan.innerText = candidateTracks.length;
            }

            // --- FIX 2: Force a brand new Array in memory using [...] ---
            window.dispatchEvent(new CustomEvent("highlightSelection", { detail: [...candidateTracks] }));
        }
    }
    
    };

    // 5. State Machine Functions
    function showBlock(blockId) {
        // Hide all blocks safely
        document.querySelectorAll('.study-block').forEach(el => {
            el.classList.remove('active-block');
            el.style.display = 'none'; 
        });
        
        if (blockId === 'trials') {
            // Drop the white overlay
            document.getElementById('study-overlay').style.display = 'none';
            document.getElementById('study-overlay').style.pointerEvents = 'none';
            
            // Show the 3D prompt panel and activate its pointer events
            const promptPanel = document.getElementById('study-prompt-panel');
            promptPanel.style.display = 'block';
            promptPanel.style.pointerEvents = 'auto';
            promptPanel.style.height = 'auto'; // Prevent floating bugs
            promptPanel.style.paddingBottom = '20px';
            
        } else {
            // Show the white overlay and activate its pointer events
            document.getElementById('study-overlay').style.display = 'block';
            document.getElementById('study-overlay').style.pointerEvents = 'auto';
            
            // Hide the 3D prompt panel
            document.getElementById('study-prompt-panel').style.display = 'none';
            document.getElementById('study-prompt-panel').style.pointerEvents = 'none';
            
            const targetBlock = document.getElementById(blockId);
            if(targetBlock) {
                targetBlock.classList.add('active-block');
                targetBlock.style.display = 'block';
            }
        }
    }

    function loadTrial(index) {
        if (index >= trialSequence.length) {
            showBlock('block-questionnaire');
            return;
        }

        currentTrialIndex = index;
        const trial = trialSequence[index];
        candidateTracks = [];
        selectedTrackT2 = null;

        // 1. Show loading state in the prompt panel
        showBlock('trials');
        document.getElementById('task-prompt-text').innerText = "Loading 3D Environment...";
        document.getElementById('task-controls').innerHTML = ""; 
        document.getElementById('study-overlay').style.display = 'block'; // Keep overlay up while loading

        // --- NEW: Tell the listener to wait for the signal ---
        isWaitingForDataset = true;

        // 2. Tell app.js to run the Python preprocess on this specific file
        window.dispatchEvent(new CustomEvent("loadTrialDataset", { detail: trial.dataset }));
    }

    // 3. WAIT for app.js to finish the Python pipeline and render the 3D scene!
    window.addEventListener("datasetReady", () => {
        // --- NEW: Ignore the signal if we didn't ask for a dataset! ---
        if (!isWaitingForDataset) return; 
        isWaitingForDataset = false; 
        // ---------------------------------------------------------------

        const trial = trialSequence[currentTrialIndex];
        
        window.dispatchEvent(new CustomEvent("clearHighlights"));
        window.dispatchEvent(new CustomEvent("resetCamera"));

        if (currentTrialIndex === 0) {
            showBlock('block-countdown');
            const btn = document.getElementById('btn-begin-trial');
            btn.innerText = "Start Trial";
            btn.disabled = false;
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            newBtn.addEventListener('click', function() {
                let count = 3;
                newBtn.disabled = true;
                newBtn.innerText = `Get ready... ${count}`;
                let countdownInterval = setInterval(() => {
                    count--;
                    if (count > 0) {
                        newBtn.innerText = `Get ready... ${count}`;
                    } else {
                        clearInterval(countdownInterval);
                        activateTrialInteractions(trial); 
                    }
                }, 1000);
            });
        } else {
            // For trials 2 through 6, skip the countdown entirely!
            activateTrialInteractions(trial);
        }
    });

    function activateTrialInteractions(trial) {
        // Drop the white overlay to reveal the 3D scene!
        showBlock('trials');

        // Start the Timers EXACTLY when the tracks become visible
        trialStartTime = performance.now();
        trialStartISO = new Date().toISOString();

        window.dispatchEvent(new CustomEvent("applyTrialColors", { detail: trial }));

        // --- NEW: Apply the A/B graphical conditions ---
        window.dispatchEvent(new CustomEvent("applyTrialConditions", { detail: trial }));
        // -----------------------------------------------

        // --- NEW: UPDATE STEPPER PROGRESS BAR ---
        // Calculate the line width (0% at first trial, 100% at last trial)
        const progressPct = (currentTrialIndex / (trialSequence.length - 1)) * 100;
        const progressLine = document.getElementById('trial-progress-line');
        if (progressLine) progressLine.style.width = `${progressPct}%`;

        // Light up the bubbles!
        for (let i = 0; i < trialSequence.length; i++) {
            const node = document.getElementById(`node-${i}`);
            if (node) {
                if (i === currentTrialIndex) {
                    node.className = 'progress-node active'; // Current trial glows
                } else if (i < currentTrialIndex) {
                    node.className = 'progress-node completed'; // Past trials are solid green
                } else {
                    node.className = 'progress-node'; // Future trials stay grey
                }
            }
        }
        // ----------------------------------------

        // Set the text
        document.getElementById('task-prompt-text').innerText = trial.desc;
        // // Highlight parent for T3
        // if (trial.task === 'T3' && trial.parentTrack) {
        //     window.dispatchEvent(new CustomEvent("highlightParent", { detail: trial.parentTrack }));
        // }

        // Inject the actual task controls using robust Flexbox
        // const controlsDiv = document.getElementById('task-controls');
        // if (trial.task === 'T1') {
        //     controlsDiv.innerHTML = `<div style="display: flex; justify-content: space-between; width: 320px; margin: 15px auto 0 auto;"><button onclick="window.hgcalStudy.submitAnswer('RED')" style="width: 145px; height: 48px; background: #dc3545; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;">RED Track</button><button onclick="window.hgcalStudy.submitAnswer('BLUE')" style="width: 145px; height: 48px; background: #007bff; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;">BLUE Track</button></div>`;
        // } else if (trial.task === 'T2') {
        //     controlsDiv.innerHTML = `<div style="text-align: center; margin-top: 15px;"><button id="t2-confirm-btn" onclick="window.hgcalStudy.submitAnswer('SUBMIT')" disabled style="width: 180px; height: 48px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: not-allowed; font-weight: bold; font-size: 14px;">Confirm</button></div>`;
        // } else if (trial.task === 'T3') {
        //     controlsDiv.innerHTML = `<div style="text-align: center;"><p style="margin: 5px 0 10px 0; font-size: 14px; color: #ccc;">Tracks selected: <span id="t3-count" style="font-weight:bold; color:white;">0</span></p><button onclick="window.hgcalStudy.submitAnswer('SUBMIT')" style="width: 180px; height: 48px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;">Confirm</button></div>`;
        // }

        // Inject the actual task controls using robust Flexbox
        const controlsDiv = document.getElementById('task-controls');
        if (trial.task === 'T1') {
            controlsDiv.innerHTML = `
                <div style="display: flex; justify-content: center; gap: 8px; margin-top: 15px;">
                    <button onclick="window.hgcalStudy.submitAnswer('RED')" style="width: 100px; height: 48px; background: #dc3545; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 13px;">RED</button>
                    <button onclick="window.hgcalStudy.submitAnswer('BLUE')" style="width: 100px; height: 48px; background: #007bff; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 13px;">BLUE</button>
                    <button onclick="window.hgcalStudy.submitAnswer('IDK')" style="width: 100px; height: 48px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 13px;">IDK</button>
                </div>`;
        } else if (trial.task === 'T2') {
            controlsDiv.innerHTML = `
                <div style="display: flex; justify-content: center; gap: 10px; margin-top: 15px;">
                    <button id="t2-confirm-btn" onclick="window.hgcalStudy.submitAnswer('SUBMIT')" disabled style="width: 140px; height: 48px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: not-allowed; font-weight: bold; font-size: 14px;">Confirm</button>
                    <button onclick="window.hgcalStudy.submitAnswer('IDK')" style="width: 140px; height: 48px; background: #343a40; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;">IDK</button>
                </div>`;
        } else if (trial.task === 'T3') {
            controlsDiv.innerHTML = `
                <div style="text-align: center;">
                    <p style="margin: 5px 0 10px 0; font-size: 14px; color: #ccc;">Tracks selected: <span id="t3-count" style="font-weight:bold; color:white;">0</span></p>
                    <div style="display: flex; justify-content: center; gap: 10px;">
                        <button onclick="window.hgcalStudy.submitAnswer('SUBMIT')" style="width: 140px; height: 48px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;">Confirm</button>
                        <button onclick="window.hgcalStudy.submitAnswer('IDK')" style="width: 140px; height: 48px; background: #343a40; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;">IDK</button>
                    </div>
                </div>`;
        }
    }


    // 6. Bind Static UI Events & Form Validation

    // --- DEMOGRAPHICS VALIDATOR ---
    function validateDemographics() {
        const consent = document.getElementById('consent-check').checked;
        const age = document.getElementById('demo-age').value;
        const gender = document.getElementById('demo-gender').value;
        const role = document.getElementById('demo-role').value;
        const phys = document.querySelector('input[name="demo-phys"]:checked');
        const d3 = document.querySelector('input[name="demo-3d"]:checked');
        
        // Button only unlocks if EVERY variable has a value
        const isValid = consent && age !== "" && gender !== "" && role !== "" && phys && d3;
        document.getElementById('btn-start-tutorial').disabled = !isValid;
    }

    // Attach to the whole block so any click or change triggers the check
    document.getElementById('block-consent').addEventListener('change', validateDemographics);


    // --- QUESTIONNAIRE VALIDATOR ---
    function validateQuestionnaire() {
        const q1 = document.querySelector('input[name="q1"]:checked');
        const q2 = document.querySelector('input[name="q2"]:checked');
        const q3 = document.querySelector('input[name="q3"]:checked');
        
        // Q4 is optional, so we only check Q1, Q2, and Q3
        const isValid = q1 && q2 && q3;
        document.getElementById('btn-submit-study').disabled = !isValid;
    }

    // Attach to the questionnaire form
    document.getElementById('questionnaire-form').addEventListener('change', validateQuestionnaire);


    // --- STANDARD BUTTON ACTIONS ---
    document.getElementById('btn-start-tutorial').addEventListener('click', () => {
        showBlock('block-tutorial');
    });

    document.getElementById('btn-start-trials').addEventListener('click', () => {
        loadTrial(0);
    });

    document.getElementById('btn-submit-study').addEventListener('click', () => {
        showBlock('block-thanks');
        document.getElementById('completion-code').innerText = `${pid}-DONE`;

        // Safe extraction of radio buttons
        const getRadioVal = (name) => {
            const el = document.querySelector(`input[name="${name}"]:checked`);
            return el ? parseInt(el.value) : null;
        };

        const finalExport = {
            participant_id: pid,
            demographics: {
                age: document.getElementById('demo-age')?.value || "Unknown",
                gender: document.getElementById('demo-gender')?.value || "Unknown",
                role: document.getElementById('demo-role')?.value || "Unknown",
                physics_familiarity: getRadioVal('demo-phys'),
                graphics_familiarity: getRadioVal('demo-3d')
            },
            trials: allStudyResults,
            subjective_feedback: {
                q1_spatial: getRadioVal('q1'),
                q2_features: getRadioVal('q2'),
                q3_confidence: getRadioVal('q3'),
                q4_comments: document.getElementById('q4-text')?.value || ""
            }
        };

        // --- NEW: GOOGLE SHEETS WEBHOOK ---
        // REPLACE THIS URL with the one Google gives you after deploying the Apps Script!
        const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxgnkWWSExozOU4UJIOw3Bkp7c-4--DjnHHvoLWxQNbVh-koCDW35leUFdN0gHmpq6VLg/exec"; 

        fetch(WEB_APP_URL, {
            method: "POST",
            mode: "no-cors", // Crucial: Prevents CORS preflight errors from blocking the request
            headers: {
                "Content-Type": "text/plain" // Using text/plain avoids strict CORS checks
            },
            body: JSON.stringify(finalExport)
        }).then(() => {
            console.log(`[Telemetry] Data successfully dispatched to Google Sheets for participant ${pid}`);
        }).catch((err) => {
            console.error("[Telemetry Error] Could not send data:", err);
            // Optional: You could trigger the old file download here as a fallback if the fetch fails!
        });
        // ----------------------------------
    });

    // Boot to the first screen
    showBlock('block-consent');
});