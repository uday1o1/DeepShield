import os
from flask import Flask, render_template, request, jsonify
import numpy as np
import pandas as pd
from tensorflow.keras.models import load_model

import requests
from werkzeug.utils import secure_filename
import os

current_directory = os.path.abspath(os.getcwd())
model_path = os.path.join(current_directory, 'models', 'recompiled_best_model.h5')

app = Flask(__name__)

# Set the path for uploaded videos
UPLOAD_FOLDER = 'uploads'
UPLOAD_FOLDER = os.path.join(current_directory, 'uploads')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Load the model
model = load_model(model_path)

# Print model summary to verify it's loaded correctly
print(model.summary())


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    if request.method == 'POST':
        # Get the video link from the request
        video_link = request.json['video_link']

        # Download the video
        video_filename = download_video(video_link)

        # prediction_result = detect_deep_fake(video_filename)

        prediction_result = "video downloaded, actual prediction result stored here"  # Replace this with your actual prediction logic

        return jsonify({'prediction': prediction_result})

def download_video(video_link):
    try:
        if not os.path.exists(app.config['UPLOAD_FOLDER']):
            os.makedirs(app.config['UPLOAD_FOLDER'])

        # Get the video filename using the secure_filename utility
        video_filename = secure_filename("downloaded_video.mp4")

        # Define the full path to save the video
        save_path = os.path.join(app.config['UPLOAD_FOLDER'], video_filename)

        # Download the video from the link
        response = requests.get(video_link)
        with open(save_path, 'wb') as video_file:
            video_file.write(response.content)

        return save_path
    except Exception as e:
        print(f"Error downloading video: {e}")
        return None

if __name__ == '__main__':
    app.run(debug=True)