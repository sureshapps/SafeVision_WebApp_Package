# SafeVision — Web Prototype (AI + WebAR demo)

This is a lightweight web prototype that demonstrates an in-browser AI-based detection + AR-style overlays using TensorFlow.js (COCO-SSD).

## What it does
- Uses the webcam to detect common objects (person, car, bicycle, etc.)
- Draws detection boxes and shows AR-style hazard warnings when objects appear 'close'
- Runs fully in-browser (no server required)

## How to run
1. Unzip the project folder.
2. Open `index.html` in a modern browser (Chrome/Edge) that allows camera access.
   - For local file camera access, serve via a local static server (recommended):
     - Python 3: `python -m http.server 8000` then open `http://localhost:8000`
3. Click **Start Camera & Detect** and allow camera permission.

## Notes
- This is a prototype. Replace the COCO-SSD model with a domain-specific hazard model for production.
- AR overlays are simulated using canvas; for production consider WebXR / ARCore/ARKit integrations.

## Deliverables included
- index.html, app.js, style.css
- PPT: SafeVision_Pitch.pptx
- Devpost submission draft: devpost.md
- Demo recording script: demo_script.txt
