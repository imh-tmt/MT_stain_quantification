const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const resultsArea = document.getElementById('results-area');
const originalImage = document.getElementById('original-image');
const processedImage = document.getElementById('processed-image');
const grayImage = document.getElementById('gray-image');
const maskImage = document.getElementById('mask-image');
const burdenBanner = document.getElementById('burden-banner');
const percentText = document.getElementById('percent-text');
const loadingOverlay = document.getElementById('loading');
const downloadBtn = document.getElementById('download-btn');
const resetZoomBtn = document.getElementById('reset-zoom-btn');
const copyAllBtn = document.getElementById('copy-all-btn');

// Drag & Drop Handling
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
    }
});

dropZone.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        handleFile(e.target.files[0]);
    }
});

let currentFile = null;

async function handleFile(file) {
    if (!file.type.startsWith('image/')) return;

    currentFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        originalImage.src = e.target.result;
        resultsArea.classList.remove('hidden');
        resetZoomState();
        resetROIs();
    };
    reader.readAsDataURL(file);

    // Initial Process without ROIs
    await processImage(file);
}

// Zoom & Pan Variables
let scale = 1;
let translateX = 0;
let translateY = 0;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;

const viewport = document.getElementById('image-viewport');
const imageWrapper = document.getElementById('image-wrapper');

function resetZoomState() {
    scale = 1;
    translateX = 0;
    translateY = 0;
    updateTransform();
}

function updateTransform() {
    imageWrapper.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
}

// Zoom via Mouse Wheel
viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomIntensity = 0.1;
    const rect = viewport.getBoundingClientRect();
    
    // Mouse position relative to viewport
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Element position relative to wrapper before zoom
    const targetX = (mouseX - translateX) / scale;
    const targetY = (mouseY - translateY) / scale;

    if (e.deltaY < 0) {
        scale *= (1 + zoomIntensity); // Zoom in
    } else {
        scale /= (1 + zoomIntensity); // Zoom out
    }
    
    // Limit zoom scale
    scale = Math.max(0.1, Math.min(scale, 50));

    // Element position relative to wrapper after zoom
    translateX = mouseX - (targetX * scale);
    translateY = mouseY - (targetY * scale);

    updateTransform();
});

// Pan via Dragging (when not selecting ROI)
viewport.addEventListener('mousedown', (e) => {
    if (isSelecting) return; // if ROI mode is active, don't pan
    isPanning = true;
    panStartX = e.clientX - translateX;
    panStartY = e.clientY - translateY;
    viewport.style.cursor = 'grabbing';
});

window.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    translateX = e.clientX - panStartX;
    translateY = e.clientY - panStartY;
    updateTransform();
});

window.addEventListener('mouseup', () => {
    if (isPanning) {
        isPanning = false;
        viewport.style.cursor = 'grab';
    }
});

resetZoomBtn.addEventListener('click', () => {
    resetZoomState();
});

// ROI Selection Variables
let isSelecting = false;
let isDrawing = false;
let startX, startY;
const roiBtn = document.getElementById('roi-btn');
const roiControls = document.getElementById('roi-controls');
const processRoiBtn = document.getElementById('process-roi-btn');
const roiCanvas = document.getElementById('roi-canvas');
const ctx = roiCanvas.getContext('2d');

// ROI Data
let rois = {
    collagen: null,
    counter: null,
    background: null
};

const roiColors = {
    collagen: '#3b82f6', // blue
    counter: '#ef4444', // red
    background: '#9ca3af' // gray
};

function resetROIs() {
    rois = { collagen: null, counter: null, background: null };
    drawAllROIs();
    isSelecting = false;
    roiBtn.classList.remove('active');
    roiControls.classList.add('hidden');
    roiCanvas.style.pointerEvents = 'none';
}

function getSelectedMode() {
    return document.querySelector('input[name="roi-mode"]:checked').value;
}

// Resize canvas exactly to viewport
function resizeCanvas() {
    roiCanvas.width = viewport.clientWidth;
    roiCanvas.height = viewport.clientHeight;
}

window.addEventListener('resize', () => {
    if (isSelecting) {
        resizeCanvas();
        drawAllROIs();
    }
});

roiBtn.addEventListener('click', () => {
    isSelecting = !isSelecting;
    roiBtn.classList.toggle('active', isSelecting);
    roiControls.classList.toggle('hidden', !isSelecting);
    roiCanvas.style.pointerEvents = isSelecting ? 'auto' : 'none';

    if (isSelecting) {
        resizeCanvas();
        drawAllROIs();
    }
});

originalImage.addEventListener('load', () => {
    if (isSelecting) {
        resizeCanvas();
        drawAllROIs();
    }
});

roiCanvas.addEventListener('mousedown', (e) => {
    if (!isSelecting) return;
    isDrawing = true;
    const rect = roiCanvas.getBoundingClientRect();
    // Screen coordinates
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
});

roiCanvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    const rect = roiCanvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    drawAllROIs(); 
    
    // Draw current active Rect
    const mode = getSelectedMode();
    ctx.strokeStyle = roiColors[mode];
    ctx.lineWidth = 2; // Fixed thickness!
    ctx.strokeRect(startX, startY, currentX - startX, currentY - startY);
});

roiCanvas.addEventListener('mouseup', (e) => {
    if (!isDrawing) return;
    isDrawing = false;
    const rect = roiCanvas.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;

    // Screen coordinates
    const sx = Math.min(startX, endX);
    const sy = Math.min(startY, endY);
    const sw = Math.abs(endX - startX);
    const sh = Math.abs(endY - startY);

    if (sw > 2 && sh > 2) { 
        // Convert screen coordinates to image-relative unscaled coordinates
        const imgX = (sx - translateX) / scale;
        const imgY = (sy - translateY) / scale;
        const imgW = sw / scale;
        const imgH = sh / scale;

        // Convert unscaled visual coordinates to natural image pixels
        const scaleX = originalImage.naturalWidth / originalImage.clientWidth;
        const scaleY = originalImage.naturalHeight / originalImage.clientHeight;

        const realX = Math.round(imgX * scaleX);
        const realY = Math.round(imgY * scaleY);
        const realW = Math.round(imgW * scaleX);
        const realH = Math.round(imgH * scaleY);

        const mode = getSelectedMode();
        // Save both logical display bounds and natural cropped bounds
        rois[mode] = { x: realX, y: realY, w: realW, h: realH, dispX: imgX, dispY: imgY, dispW: imgW, dispH: imgH };
    }
    
    drawAllROIs();
});

function drawAllROIs() {
    ctx.clearRect(0, 0, roiCanvas.width, roiCanvas.height);
    for (const [mode, roi] of Object.entries(rois)) {
        if (roi) {
            ctx.strokeStyle = roiColors[mode];
            ctx.lineWidth = 2; // Always perfectly crisp and 2 pixels wide
            
            // Map logical display bounds to current screen geometry
            const screenX = (roi.dispX * scale) + translateX;
            const screenY = (roi.dispY * scale) + translateY;
            const screenW = roi.dispW * scale;
            const screenH = roi.dispH * scale;

            ctx.strokeRect(screenX, screenY, screenW, screenH);
            
            ctx.fillStyle = roiColors[mode];
            ctx.font = "12px Inter";
            ctx.fillText(mode, screenX, screenY - 5);
        }
    }
}

// Re-draw when scale changes
const originalUpdateTransform = updateTransform;
updateTransform = function() {
    originalUpdateTransform();
    if (isSelecting) {
        drawAllROIs();
    }
}

processRoiBtn.addEventListener('click', async () => {
    if (!currentFile) return;
    await processImage(currentFile, rois);
});

async function processImage(file, roiData = null) {
    loadingOverlay.classList.remove('hidden');

    const formData = new FormData();
    formData.append('file', file);
    
    if (roiData) {
        if (roiData.collagen) {
            formData.append('roi_collagen_x', roiData.collagen.x);
            formData.append('roi_collagen_y', roiData.collagen.y);
            formData.append('roi_collagen_w', roiData.collagen.w);
            formData.append('roi_collagen_h', roiData.collagen.h);
        }
        if (roiData.counter) {
            formData.append('roi_counter_x', roiData.counter.x);
            formData.append('roi_counter_y', roiData.counter.y);
            formData.append('roi_counter_w', roiData.counter.w);
            formData.append('roi_counter_h', roiData.counter.h);
        }
        if (roiData.background) {
            formData.append('roi_bg_x', roiData.background.x);
            formData.append('roi_bg_y', roiData.background.y);
            formData.append('roi_bg_w', roiData.background.w);
            formData.append('roi_bg_h', roiData.background.h);
        }
    }

    try {
        const response = await fetch('/deconvolve/', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('Processing failed');

        const data = await response.json();

        // Display results
        processedImage.src = 'data:image/png;base64,' + data.rgb_image;
        grayImage.src = 'data:image/png;base64,' + data.gray_image;
        maskImage.src = 'data:image/png;base64,' + data.mask_image;
        
        // Update Fibrotic Burden percentage
        percentText.textContent = data.percent_area + '%';
        burdenBanner.classList.remove('hidden');

        // Populate intermediate values table
        const fmt = (n) => n.toLocaleString();
        document.getElementById('stat-total-img').textContent = fmt(data.total_image_pixels);
        document.getElementById('stat-bg').textContent = fmt(data.background_pixels);
        document.getElementById('stat-tissue').textContent = fmt(data.total_tissue_pixels);
        document.getElementById('stat-collagen').textContent = fmt(data.collagen_pixels);
        document.getElementById('stat-non-collagen').textContent = fmt(data.non_collagen_tissue_pixels);
        document.getElementById('stat-threshold').textContent = data.threshold_range;

        // Optional: Update download button to download the main RGB image
        downloadBtn.href = processedImage.src;
        downloadBtn.download = 'collagen_rgb.png';

    } catch (error) {
        console.error(error);
        alert('Error processing image. Please try again.');
    } finally {
        loadingOverlay.classList.add('hidden');
    }
}

// Copy to Clipboard Logic
const copyValues = document.querySelectorAll('.copy-value');

copyValues.forEach(el => {
    el.addEventListener('click', () => {
        // remove commas for cleaner pasting to excel
        const rawText = el.innerText.replace(/,/g, '');
        navigator.clipboard.writeText(rawText).then(() => {
            const originalColor = el.style.color;
            el.style.color = 'var(--success-color)';
            el.style.transition = 'color 0.2s ease-out';
            setTimeout(() => {
                el.style.color = originalColor || '';
            }, 800);
        }).catch(err => console.error('Failed to copy', err));
    });
});

copyAllBtn.addEventListener('click', () => {
    const percent = document.getElementById('percent-text').innerText;
    const totalImg = document.getElementById('stat-total-img').innerText.replace(/,/g, '');
    const bg = document.getElementById('stat-bg').innerText.replace(/,/g, '');
    const totalTissue = document.getElementById('stat-tissue').innerText.replace(/,/g, '');
    const collagen = document.getElementById('stat-collagen').innerText.replace(/,/g, '');
    const nonCollagen = document.getElementById('stat-non-collagen').innerText.replace(/,/g, '');
    const threshold = document.getElementById('stat-threshold').innerText;

    const tsvData = [
        ['Fibrotic Burden (%)', percent],
        ['Total Image Pixels', totalImg],
        ['Background Pixels (excluded)', bg],
        ['Total Tissue Pixels', totalTissue],
        ['Collagen Pixels', collagen],
        ['Non-Collagen Tissue Pixels', nonCollagen],
        ['Threshold Range', threshold]
    ].map(row => row.join('\t')).join('\n');

    navigator.clipboard.writeText(tsvData).then(() => {
        const originalBg = copyAllBtn.style.backgroundColor;
        const originalColor = copyAllBtn.style.color;
        copyAllBtn.style.backgroundColor = 'var(--success-color)';
        copyAllBtn.style.color = 'white';
        copyAllBtn.style.transition = 'all 0.2s ease-out';
        setTimeout(() => {
            copyAllBtn.style.backgroundColor = originalBg || '';
            copyAllBtn.style.color = originalColor || '';
        }, 800);
    }).catch(err => console.error('Failed to copy', err));
});

