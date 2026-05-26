from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
import numpy as np
import io
from PIL import Image
from skimage.util import img_as_float

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="../frontend"), name="static")

@app.get("/")
async def read_index():
    from fastapi.responses import FileResponse
    return FileResponse('../frontend/index.html')

def get_masson_trichrome_matrix(custom_stain1=None, custom_stain2=None):
    # Standardized Optical Density vectors for Masson's Trichrome
    # Based on Ruifrok and Johnston
    
    if custom_stain1 is not None:
        stain1 = custom_stain1
    else:
        stain1 = np.array([0.7995107, 0.5913521, 0.10528667])
        stain1 /= np.linalg.norm(stain1)
        
    if custom_stain2 is not None:
        stain2 = custom_stain2
    else:
        stain2 = np.array([0.0999715, 0.73738605, 0.6680326])
        stain2 /= np.linalg.norm(stain2)
        
    if custom_stain1 is not None and custom_stain2 is not None:
        # Cross product to create an orthogonal third component
        stain3 = np.cross(stain1, stain2)
        norm3 = np.linalg.norm(stain3)
        if norm3 > 1e-6:
            stain3 /= norm3
        else:
            # Fallback if lines are parallel
            stain3 = np.array([0.63595444, 0.0010000, 0.7717266])
            stain3 /= np.linalg.norm(stain3)
    else:
        # Default Stain 3 (Iron Hematoxylin - Nuclei)
        stain3 = np.array([0.63595444, 0.0010000, 0.7717266])
        stain3 /= np.linalg.norm(stain3)
    
    return np.array([stain1, stain2, stain3])

def separate_stains(image_rgb, I_0, custom_stain1=None, custom_stain2=None):
    # Convert to float and normalize by incident light (background)
    img = img_as_float(image_rgb) / I_0
    
    # Avoid zero and overflow
    img = np.clip(img, 1e-6, 1.0)
    
    # Convert to Optical Density (OD)
    OD = -np.log(img)
    
    # Reshape
    w, h, c = OD.shape
    OD_reshaped = OD.reshape((-1, 3))
    
    # Get deconvolution matrix
    M = get_masson_trichrome_matrix(custom_stain1, custom_stain2)
    
    # Invert matrix to get stain concentrations from OD
    try:
        M_inv = np.linalg.inv(M)
    except np.linalg.LinAlgError:
         # Fallback Identity if singular
        M_inv = np.eye(3)

    # Calculate concentrations
    C = np.dot(OD_reshaped, M_inv)
    
    # Reshape back to image
    C = C.reshape((w, h, 3))
    
    return C

def concentrations_to_rgb(C, I_0, custom_stain1=None, custom_stain2=None):
    M = get_masson_trichrome_matrix(custom_stain1, custom_stain2)
    
    # Reconstruct just the collagen channel (index 0)
    collagen_conc = C[:, :, 0]
    
    # M[0] is the collagen vector
    OD_collagen = np.outer(collagen_conc.ravel(), M[0]).reshape(C.shape)
    
    # RGB = I_0 * exp(-OD)
    rgb_collagen = I_0 * np.exp(-OD_collagen)
    
    return np.clip(rgb_collagen, 0, 1)

import base64

def image_to_base64(img: Image.Image) -> str:
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode('utf-8')

@app.post("/deconvolve/")
async def deconvolve_image(
    file: UploadFile = File(...),
    roi_collagen_x: int = Form(None), roi_collagen_y: int = Form(None), roi_collagen_w: int = Form(None), roi_collagen_h: int = Form(None),
    roi_counter_x: int = Form(None), roi_counter_y: int = Form(None), roi_counter_w: int = Form(None), roi_counter_h: int = Form(None),
    roi_bg_x: int = Form(None), roi_bg_y: int = Form(None), roi_bg_w: int = Form(None), roi_bg_h: int = Form(None)
):
    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert("RGB")
    image_np = np.array(image)
    
    # 1. Determine Background (I_0)
    I_0 = np.array([1.0, 1.0, 1.0])
    if roi_bg_w is not None and roi_bg_w > 0:
        bg_roi = image_np[roi_bg_y:roi_bg_y+roi_bg_h, roi_bg_x:roi_bg_x+roi_bg_w]
        if bg_roi.size > 0:
            I_0 = np.mean(img_as_float(bg_roi), axis=(0, 1))
            I_0 = np.clip(I_0, 1e-6, 1.0)
            
    # Helper to calculate OD vector from ROI
    def get_od_vector(roi_x, roi_y, roi_w, roi_h):
        if roi_w is not None and roi_w > 0:
            roi = image_np[roi_y:roi_y+roi_h, roi_x:roi_x+roi_w]
            if roi.size > 0:
                roi_float = img_as_float(roi)
                roi_float = roi_float / I_0
                roi_float = np.clip(roi_float, 1e-6, 1.0)
                roi_OD = -np.log(roi_float)
                vec = np.mean(roi_OD.reshape((-1, 3)), axis=0)
                norm = np.linalg.norm(vec)
                if norm > 0:
                    return vec / norm
        return None

    stain1 = get_od_vector(roi_collagen_x, roi_collagen_y, roi_collagen_w, roi_collagen_h)
    stain2 = get_od_vector(roi_counter_x, roi_counter_y, roi_counter_w, roi_counter_h)

    # Process separated stains (C is concentrations)
    concentrations = separate_stains(image_np, I_0, custom_stain1=stain1, custom_stain2=stain2)
    collagen_conc = concentrations[:, :, 0]
    
    # 1. Reconstruct ONLY collagen RGB (Visualization)
    collagen_rgb = concentrations_to_rgb(concentrations, I_0, custom_stain1=stain1, custom_stain2=stain2)
    collagen_uint8 = (collagen_rgb * 255).astype(np.uint8)
    img_rgb = Image.fromarray(collagen_uint8)
    
    # 2. 8-bit Grayscale according to ImageJ plugin: 255 * exp(-C)
    gray_float = 255.0 * np.exp(-collagen_conc)
    gray_uint8 = np.clip(gray_float, 0, 255).astype(np.uint8)
    img_gray = Image.fromarray(gray_uint8)
    
    # 3. Segmented Mask: fixed threshold range of 0–180
    mask_bool = gray_uint8 <= 180
    # Create visual mask (Black background, White collagen)
    mask_uint8 = (mask_bool * 255).astype(np.uint8)
    img_mask = Image.fromarray(mask_uint8)
    
    # 4. Fibrotic Burden Quantification
    # Calculate Total Tissue Area by excluding very bright background pixels (Luminance > 230)
    input_gray = np.mean(image_np, axis=2)
    tissue_mask = input_gray < 235  # True where there is actual tissue
    
    total_image_pixels = int(image_np.shape[0] * image_np.shape[1])
    total_tissue_pixels = int(np.sum(tissue_mask))
    background_pixels = total_image_pixels - total_tissue_pixels
    
    # Collagen pixels inside valid tissue
    collagen_pixels = int(np.sum(mask_bool & tissue_mask))
    non_collagen_tissue_pixels = total_tissue_pixels - collagen_pixels
    
    if total_tissue_pixels > 0:
        percent_area = (collagen_pixels / total_tissue_pixels) * 100.0
    else:
        percent_area = 0.0

    return {
        "rgb_image": image_to_base64(img_rgb),
        "gray_image": image_to_base64(img_gray),
        "mask_image": image_to_base64(img_mask),
        "percent_area": round(percent_area, 2),
        "total_image_pixels": total_image_pixels,
        "total_tissue_pixels": total_tissue_pixels,
        "background_pixels": background_pixels,
        "collagen_pixels": collagen_pixels,
        "non_collagen_tissue_pixels": non_collagen_tissue_pixels,
        "threshold_range": "0-180"
    }

