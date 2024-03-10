import numpy as np
import os
import cv2
from tensorflow.keras.models import load_model

from load_pretrained import pretrain_feature_extractor

# Instantiate the pre-trained feature extractor model
feature_extractor = pretrain_feature_extractor()

current_directory = os.path.abspath(os.getcwd())
video_path = os.path.join(current_directory, 'uploads', 'downloaded_video.mp4')
# model_path = os.path.join(current_directory, 'models', 'recompiled_best_model.h5')
# model_path = os.path.join(current_directory, 'models', 'best_model_for_2048.weights.h5')
model_path = os.path.join(current_directory, 'models', 'model_2048.keras')

# Load the model
model = load_model(model_path)

max_seq_length = 20  # Adjust based on the length of your sequences
num_features = 2048  # Adjust based on the complexity of your data and model architecture
img_size = 224

# Function to crop the center square of a frame
def crop_center_square(frame):
    # Get the dimensions (height and width) of the frame
    y, x = frame.shape[0:2]
    
    # Find the minimum dimension (either height or width)
    min_dim = min(y, x)
    
    # Calculate the starting indices to crop a square region from the center
    start_x = (x // 2) - (min_dim // 2)
    start_y = (y // 2) - (min_dim // 2)
    
    # Return the cropped square region
    return frame[start_y : start_y + min_dim, start_x : start_x + min_dim]

# Function to load and preprocess a video
def load_video():
    max_frames = 0
    resize=(img_size, img_size)
    
    # Initialize a VideoCapture object to read frames from the video
    cap = cv2.VideoCapture(video_path)
    
    # List to store processed frames
    frames = []
    
    try:
        # Loop through the frames in the video
        while 1:
            # Read the next frame
            ret, frame = cap.read()
            
            # Check if the frame is not empty
            if not ret:
                break
            
            # Crop the frame to a square from the center
            frame = crop_center_square(frame)
            
            # Resize the frame to the specified dimensions
            frame = cv2.resize(frame, resize)
            
            # Reorder color channels to RGB format
            frame = frame[:, :, [2, 1, 0]]
            
            # Append the processed frame to the list
            frames.append(frame)
            
            # Check if the maximum number of frames is reached
            if max_frames > 0 and len(frames) == max_frames:
                break
    finally:
        # Release the VideoCapture object to free resources
        cap.release()
    
    # Convert the list of frames to a NumPy array and return it
    return np.array(frames)

# Function to prepare features and masks for a single video
def prepare_single_video(frames):
    # Add a batch dimension to the frames
    frames = frames[None, ...]
    
    # Initialize arrays for frame-level features and masks
    frame_mask = np.zeros(shape=(1, max_seq_length,), dtype="bool")
    frame_features = np.zeros(shape=(1, max_seq_length, num_features), dtype="float32")

    # Iterate through frames in the video
    for i, batch in enumerate(frames):
        video_length = batch.shape[0]
        
        # Limit to max_seq_length frames
        length = min(max_seq_length, video_length)
        
        # Extract features for each frame using the feature_extractor
        for j in range(length):
            # Make sure the feature extractor matches the expected number of features
            frame_features[i, j, :] = feature_extractor.predict(batch[None, j, :])
        
        # Set frame_mask to 1 for frames, 0 for padding
        frame_mask[i, :length] = 1  # 1 = not masked, 0 = masked

    return frame_features, frame_mask

# Function to perform sequence prediction on a video
def sequence_prediction():
    # Load video frames
    frames = load_video()
    
    # Prepare frame-level features and masks
    frame_features, frame_mask = prepare_single_video(frames)
    
    # Make a prediction using the model
    return model.predict([frame_features, frame_mask])[0]

def model_predict():
    prediction = "The video might be REAL"
    
    # Perform sequence prediction and print the result
    if sequence_prediction() >= 0.6:
        prediction = "The video might be FAKE"
    
    return prediction
