# Masson's Trichrome Stain Quantification Tool

A web-based application designed for the color deconvolution and quantitative analysis of Masson's Trichrome stained histological images. This tool enables researchers to accurately measure fibrotic burden by calculating the percentage of collagen-positive areas within valid tissue regions.

## Features

- **Color Deconvolution**: Separates RGB images into optical density concentrations for Collagen, Counterstain (Cytoplasm/Muscle), and Background using customized or default Ruifrok and Johnston vectors.
- **Fibrotic Burden Quantification**: Automatically calculates the percentage of collagen relative to the total tissue area (excluding empty background slides).
- **Interactive ROI Selection**: Users can draw Regions of Interest (ROIs) on the image to dynamically adjust the stain vectors (Collagen, Counterstain, and Background) for slide-specific calibration.
- **Output Visualization**: 
  - Separated Collagen RGB image
  - 8-bit Grayscale mapping (ImageJ style)
  - Segmented Mask (Threshold 0-180 for positive collagen detection)
- **Data Export**: Easy copy-to-clipboard functionality for quantitative results to streamline data entry into Excel or statistical software.

## Project Structure

- `backend/`: FastAPI Python server handling image processing and mathematical deconvolution algorithms (NumPy, scikit-image, PIL).
- `frontend/`: HTML, CSS, and Vanilla JavaScript UI for image uploading, ROI cropping, and result visualization.
- `MassonDeconv.command`: A Mac-friendly executable script to easily launch the application.

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/imh-tmt/MT_stain_quantification.git
   cd MT_stain_quantification
   ```

2. **Install Dependencies**:
   It is recommended to use a virtual environment.
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

## Usage (macOS)

1. Simply double-click the `MassonDeconv.command` file on your Mac.
   - *Note: If it's your first time running it, you may need to grant execution permissions by running `chmod +x MassonDeconv.command` in the terminal.*
2. The script will automatically start the local FastAPI server and open your default web browser to the application interface.
3. **Upload an image**: Select your Masson's Trichrome stained `.tif` or `.png` image.
4. **Select ROIs (Optional)**: Click and drag to define specific regions for Collagen, Counterstain, and Background to fine-tune the deconvolution matrix.
5. **Analyze**: View the extracted collagen images and quantified fibrotic burden metrics.

## Methodology

The application normalizes incident light ($I_0$) and converts image pixels into Optical Density (OD). The OD values are separated using an inverted deconvolution matrix. The resulting collagen concentration ($C$) is used to generate an 8-bit grayscale image (`255 * exp(-C)`), which is then segmented using a fixed threshold (0–180) to mask the collagen-positive pixels. The total tissue area is dynamically calculated by excluding very bright regions (Luminance > 235), ensuring accurate proportional analysis.

## License
MIT License
