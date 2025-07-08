# 🔥 Real-Time Fire Segmentation

A deep learning-based application for detecting and segmenting fire in real-time video streams. This project uses image processing and semantic segmentation techniques to isolate fire regions, ideal for early warning systems and surveillance. 

## 🚀 Features

- Real-time fire detection and segmentation
- Live video feed with overlay visualization
- Emergency response status panel
- Performance metrics monitoring

## 🧰 Tech Stack

- Python
- OpenCV
- TensorFlow / PyTorch (based on your code)
- NumPy

## Installation

1. Clone this repository
2. Install dependencies:
```bash
pip install -r requirements.txt
```

## Usage

1. Start the application:
```bash
python app.py
```

2. Open a web browser and navigate to:
```
http://localhost:5000
```

## System Requirements

- Python 3.7+
- Webcam or video input device
- CUDA-capable GPU (recommended for real-time performance)

## Model Architecture

The system uses a custom U-Net-like architecture for fire segmentation, implemented in PyTorch. The model consists of:
- Encoder: 2 blocks with conv layers, batch normalization, and max pooling
- Decoder: Upsampling and conv layers with skip connections
- Final layer: Sigmoid activation for binary segmentation

## Notes

- The system is designed for real-time monitoring and should be used as part of a comprehensive emergency response system
- For production use, you should train the model on a large dataset of fire images
- The heatmap shows areas of high fire risk based on the model's predictions
