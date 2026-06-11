import { updateRange } from './app.js'

export function initVega(datasetUrl = '/data/output.json') {
    fetch('./data/tree-layout-edits.json')
        .then((response) => response.json())
        .then(spec => {

            let treeData = spec.data.find(d => d.name === 'tree');
            if (treeData) treeData.url = datasetUrl.startsWith('/') ? datasetUrl.substring(1) : datasetUrl; 

            let timeData = spec.data.find(d => d.name === 'timeInfo');
            if (timeData && datasetUrl.includes('ready.json')) {
                let timeUrl = datasetUrl.replace('ready.json', 'time.json');
                timeData.url = timeUrl.startsWith('/') ? timeUrl.substring(1) : timeUrl;
            }

            const runtime = vega.parse(spec);
            window.vegaView = new vega.View(runtime)
                .logLevel(vega.Warn) 
                .initialize(document.querySelector("#vis")) 
                .renderer("svg") 
                .hover() 
                .run(); 

            // Axis Zooming Radio Listener
            document.querySelectorAll('input[name="vzoom"]').forEach(radio => {
                radio.addEventListener('change', (e) => {
                    if (window.vegaView) window.vegaView.signal('zoomAxis', e.target.value).runAsync();
                });
            });

            // Handle UI Sliders
            window.vegaView.addSignalListener('xField', updateRange);

            // --- NEW: NATIVE LEFT CLICK (HIGHLIGHT & TOGGLE) ---
            window.vegaView.addEventListener('click', function(event, item) {
                if (item && item.datum && item.datum.id) {
                    let id = Number(item.datum.id);
                    
                    // Route to Study Manager if active (it handles its own toggling)
                    if (window.hgcalStudy && window.hgcalStudy.onTrackPicked) {
                        window.hgcalStudy.onTrackPicked(id);
                    } 
                    // Otherwise Sandbox Mode Toggle
                    else if (window.app) {
                        let current = window.app.studyHighlightedIds || [];
                        if (current.includes(id)) {
                            // If already selected, clear it
                            window.dispatchEvent(new CustomEvent("highlightSelection", { detail: [] }));
                        } else {
                            // Select it
                            window.dispatchEvent(new CustomEvent("highlightSelection", { detail: [id] }));
                        }
                    }
                }
            });

            // --- NEW: NATIVE RIGHT CLICK (FILTER SUBTREE) ---
            window.vegaView.addEventListener('contextmenu', function(event, item) {
                event.preventDefault(); // Stop browser context menu
                if (item && item.datum && item.datum.id) {
                    let id = Number(item.datum.id);
                    if (window.app) window.app.applySubtreeFilter(id);
                }
            });
        });
}