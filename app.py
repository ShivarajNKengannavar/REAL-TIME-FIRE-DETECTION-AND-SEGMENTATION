from flask import Flask, render_template, Response, jsonify, request, send_from_directory
from flask_cors import CORS
import cv2
from seaborn import heatmap
import torch
import numpy as np
from model import FireSegmentationModel
import plotly
import plotly.graph_objs as go
import json
from flask_socketio import SocketIO
from datetime import datetime
import folium
from folium import plugins
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut
import pandas as pd
from pathlib import Path
import requests
from PIL import Image
import io
from werkzeug.utils import secure_filename
import os

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Configure upload folder
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Initialize model and geocoder
model = FireSegmentationModel()
geolocator = Nominatim(user_agent="fire_segmentation_system")

# In production, you would load pre-trained weights here
# model.load_state_dict(torch.load('weights.pth'))
model.eval()

# Store latest data
latest_heatmap_data = None
fire_incidents = []

class FireIncident:
    def __init__(self, lat, lon, risk_level, timestamp, location_name, zone_type):
        self.lat = lat
        self.lon = lon
        self.risk_level = risk_level
        self.timestamp = timestamp
        self.location_name = location_name
        self.zone_type = zone_type

def create_base_map(center_lat=12.9716, center_lon=77.5946):  # Default to Bangalore coordinates
    """Create a base map with clustering and heatmap layers"""
    m = folium.Map(location=[center_lat, center_lon], zoom_start=13)
    
    # Add tile layers
    folium.TileLayer('openstreetmap').add_to(m)
    folium.TileLayer('cartodbpositron', name='Light Mode').add_to(m)
    folium.TileLayer('cartodbdark_matter', name='Dark Mode').add_to(m)
    
    # Add marker cluster
    marker_cluster = plugins.MarkerCluster().add_to(m)
    
    # Add incident markers
    for incident in fire_incidents:
        color = 'red' if incident.risk_level > 0.7 else 'orange' if incident.risk_level > 0.3 else 'green'
        folium.Marker(
            [incident.lat, incident.lon],
            popup=f"<b>{incident.location_name}</b><br>Risk Level: {incident.risk_level:.2f}<br>Time: {incident.timestamp}<br>Zone: {incident.zone_type}",
            icon=folium.Icon(color=color, icon='info-sign')
        ).add_to(marker_cluster)
    
    # Add heatmap layer
    if fire_incidents:
        heat_data = [[i.lat, i.lon, i.risk_level] for i in fire_incidents]
        plugins.HeatMap(heat_data).add_to(m)
    
    # Add layer control
    folium.LayerControl().add_to(m)
    
    return m

def get_location_info(address):
    """Get location information from address"""
    try:
        location = geolocator.geocode(address)
        if location:
            return {
                'lat': location.latitude,
                'lon': location.longitude,
                'address': location.address
            }
    except GeocoderTimedOut:
        pass
    return None

def generate_heatmap_data(segmentation):
    """Generate interactive heatmap data from segmentation mask"""
    global latest_heatmap_data
    
    # Create heatmap using plotly
    heatmap = go.Heatmap(
        z=segmentation,
        colorscale='Hot',
        showscale=True,
        hoverongaps=False,
        hovertemplate='X: %{x}<br>Y: %{y}<br>Risk Level: %{z:.2f}<extra></extra>'
    )
    
    layout = go.Layout(
        title='Real-Time Fire Risk Heatmap',
        xaxis=dict(title='X Position'),
        yaxis=dict(title='Y Position', scaleanchor='x'),
        margin=dict(l=50, r=50, t=50, b=50),
        plot_bgcolor='rgba(0,0,0,0.05)'
    )
    
    fig = go.Figure(data=[heatmap], layout=layout)
    latest_heatmap_data = json.loads(json.dumps(fig, cls=plotly.utils.PlotlyJSONEncoder))
    
    return latest_heatmap_data

def process_frame(frame):
    """Process a single frame through the model"""
    frame = cv2.resize(frame, (256, 256))
    input_tensor = torch.from_numpy(frame.transpose(2, 0, 1)).float() / 255.0
    input_tensor = input_tensor.unsqueeze(0)
    
    with torch.no_grad():
        prediction = model(input_tensor)
    
    segmentation = prediction[0, 0].numpy()
    return segmentation

def analyze_zone(frame, zone_type):
    """Analyze frame based on zone type"""
    segmentation = process_frame(frame)
    risk_level = float(np.mean(segmentation))
    
    # Adjust risk threshold based on zone type
    if zone_type == 'commercial':
        risk_level *= 1.2  # Higher sensitivity for commercial zones
    elif zone_type == 'industrial':
        risk_level *= 1.3  # Highest sensitivity for industrial zones
    
    return risk_level, segmentation

def gen_frames():
    """Generate processed frames from webcam"""
    camera = cv2.VideoCapture(0)
    fps_counter = 0
    last_update = datetime.now()
    
    while True:
        success, frame = camera.read()
        if not success:
            break
        
        # Process frame
        segmentation = process_frame(frame)
        
        # Generate heatmap data and emit via WebSocket every 5 frames
        fps_counter += 1
        if fps_counter % 5 == 0:
            heatmap_data = generate_heatmap_data(segmentation)
            current_time = datetime.now()
            fps = fps_counter / (current_time - last_update).total_seconds()
            
            # Calculate risk metrics
            max_risk = float(np.max(segmentation))
            avg_risk = float(np.mean(segmentation))
            risk_zones = np.sum(segmentation > 0.7)  # Count high-risk zones
            
            # Emit updates via WebSocket
            socketio.emit('heatmap_update', {
                'heatmap_data': heatmap_data,
                'fps': round(fps, 1),
                'max_risk': max_risk,
                'avg_risk': avg_risk,
                'risk_zones': int(risk_zones),
                'timestamp': current_time.strftime('%H:%M:%S')
            })
            
            fps_counter = 0
            last_update = current_time
        
        # Combine original frame with segmentation
        segmentation_colored = cv2.applyColorMap(
            (segmentation * 255).astype(np.uint8),
            cv2.COLORMAP_JET
        )
        
        # Resize frame to match segmentation
        frame = cv2.resize(frame, (256, 256))
        
        # Blend
        output = cv2.addWeighted(frame, 0.6, segmentation_colored, 0.4, 0)
        
        # Add risk level indicator
        risk_level = np.mean(segmentation)
        risk_color = (
            (0, 255, 0) if risk_level < 0.3 else
            (0, 165, 255) if risk_level < 0.7 else
            (0, 0, 255)
        )
        cv2.putText(output, f'Risk Level: {risk_level:.2f}',
                    (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, risk_color, 2)
        
        # Encode frame
        ret, buffer = cv2.imencode('.jpg', output)
        frame = buffer.tobytes()
        
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
    
    fig = go.Figure(data=[heatmap], layout=torch.layout)
    latest_heatmap_data = json.loads(json.dumps(fig, cls=plotly.utils.PlotlyJSONEncoder))
    
    return latest_heatmap_data

def process_frame(frame):
    """Process a single frame through the model"""
    # Preprocess
    frame = cv2.resize(frame, (256, 256))
    input_tensor = torch.from_numpy(frame.transpose(2, 0, 1)).float() / 255.0
    input_tensor = input_tensor.unsqueeze(0)
    
    # Get prediction
    with torch.no_grad():
        prediction = model(input_tensor)
    
    # Convert to numpy
    segmentation = prediction[0, 0].numpy()
    return segmentation

def gen_frames():
    """Generate processed frames from webcam"""
    camera = cv2.VideoCapture(0)
    fps_counter = 0
    last_update = datetime.now()
    
    while True:
        success, frame = camera.read()
        if not success:
            break
        
        # Process frame
        segmentation = process_frame(frame)
        
        # Generate heatmap data and emit via WebSocket every 5 frames
        fps_counter += 1
        if fps_counter % 5 == 0:
            heatmap_data = generate_heatmap_data(segmentation)
            current_time = datetime.now()
            fps = fps_counter / (current_time - last_update).total_seconds()
            
            # Emit updates via WebSocket
            socketio.emit('heatmap_update', {
                'heatmap_data': heatmap_data,
                'fps': round(fps, 1),
                'max_risk': float(np.max(segmentation)),
                'avg_risk': float(np.mean(segmentation)),
                'timestamp': current_time.strftime('%H:%M:%S')
            })
            
            fps_counter = 0
            last_update = current_time
        
        # Combine original frame with segmentation
        segmentation_colored = cv2.applyColorMap(
            (segmentation * 255).astype(np.uint8),
            cv2.COLORMAP_JET
        )
        
        # Resize frame to match segmentation
        frame = cv2.resize(frame, (256, 256))
        
        # Blend
        output = cv2.addWeighted(frame, 0.6, segmentation_colored, 0.4, 0)
        
        # Encode frame
        ret, buffer = cv2.imencode('.jpg', output)
        frame = buffer.tobytes()
        
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

@app.route('/')
def index():
    """Render main page"""
    # Create initial map
    m = create_base_map()
    return render_template('index.html', map=m._repr_html_())

@app.route('/video_feed')
def video_feed():
    """Video streaming route"""
    return Response(gen_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/get_latest_heatmap')
def get_latest_heatmap():
    """Get the latest heatmap data"""
    return jsonify(latest_heatmap_data if latest_heatmap_data else {})

@app.route('/search_location')
def search_location():
    """Search for a location and return its information"""
    address = request.args.get('address')
    if not address:
        # Try to get location from IP
        try:
            ip_info = requests.get('https://ipapi.co/json/').json()
            location_info = {
                'lat': float(ip_info['latitude']),
                'lon': float(ip_info['longitude']),
                'address': f"{ip_info['city']}, {ip_info['region']}, {ip_info['country_name']}"
            }
            return jsonify(location_info)
        except:
            return jsonify({'error': 'Could not detect location'}), 400
    
    location_info = get_location_info(address)
    if not location_info:
        return jsonify({'error': 'Location not found'}), 404
    
    return jsonify(location_info)

@app.route('/analyze_image', methods=['POST'])
def analyze_image():
    """Analyze uploaded image for fire detection"""
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400
        
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
        
    if file:
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Read and preprocess image
        image = cv2.imread(filepath)
        if image is None:
            return jsonify({'error': 'Invalid image file'}), 400
            
        # Process image through model
        segmentation = process_frame(image)
        risk_level = float(np.max(segmentation))
        
        # Generate heatmap
        heatmap_data = generate_heatmap_data(segmentation)
        
        # Clean up
        os.remove(filepath)
        
        return jsonify({
            'risk_level': risk_level,
            'heatmap_data': heatmap_data,
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        })

@app.route('/analyze_zone', methods=['POST'])
def analyze_zone_route():
    """Analyze a specific zone for fire risk"""
    data = request.json
    if not data or 'lat' not in data or 'lon' not in data or 'zone_type' not in data:
        return jsonify({'error': 'Invalid request data'}), 400
    
    # Get the current frame
    camera = cv2.VideoCapture(0)
    success, frame = camera.read()
    camera.release()
    
    if not success:
        return jsonify({'error': 'Failed to capture image'}), 500
    
    # Analyze the zone
    risk_level, segmentation = analyze_zone(frame, data['zone_type'])
    
    # Create new incident
    incident = FireIncident(
        lat=float(data['lat']),
        lon=float(data['lon']),
        risk_level=risk_level,
        timestamp=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        location_name=data.get('location_name', 'Unknown Location'),
        zone_type=data['zone_type']
    )
    
    fire_incidents.append(incident)
    
    # Update map
    m = create_base_map(center_lat=incident.lat, center_lon=incident.lon)
    
    return jsonify({
        'risk_level': risk_level,
        'map_html': m._repr_html_(),
        'heatmap_data': generate_heatmap_data(segmentation)
    })

@socketio.on('connect')
def handle_connect():
    """Handle WebSocket connection"""
    print('Client connected')

@socketio.on('disconnect')
def handle_disconnect():
    """Handle WebSocket disconnection"""
    print('Client disconnected')

@socketio.on('update_zone_type')
def handle_zone_update(data):
    """Handle zone type updates"""
    if 'lat' in data and 'lon' in data and 'zone_type' in data:
        for incident in fire_incidents:
            if incident.lat == data['lat'] and incident.lon == data['lon']:
                incident.zone_type = data['zone_type']
                break
        
        # Update map
        m = create_base_map()
        socketio.emit('map_update', {'map_html': m._repr_html_()})

if __name__ == '__main__':
    # Create data directory if it doesn't exist
    data_dir = Path('data')
    data_dir.mkdir(exist_ok=True)
    
    socketio.run(app, debug=True)
