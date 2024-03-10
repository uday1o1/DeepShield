import os
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import requests
from werkzeug.utils import secure_filename

from utils import model_predict

app = Flask(__name__)
CORS(app)

current_directory = os.path.abspath(os.getcwd())

# Set the path for uploaded videos
app.config['UPLOAD_FOLDER'] = os.path.join(current_directory, 'uploads')

@app.route('/')
def index():
    return render_template('popup.html')

@app.route('/predict', methods=['POST'])
def predict():
    if request.method == 'POST':
        data = request.get_json()
        
        # Get the video link from the request
        video_link = data.get('video_link', '')
        print(video_link)
        
        # Download the video
        download_video(video_link)

        # Perform deep fake detection
        prediction = model_predict()
        # prediction = "test"

        # Return the prediction as JSON
        return jsonify({'prediction': prediction})

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