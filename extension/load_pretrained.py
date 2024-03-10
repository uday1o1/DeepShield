from tensorflow import keras

img_size = 224

def pretrain_feature_extractor():
    # Load the InceptionV3 model pre-trained on ImageNet
    feature_extractor = keras.applications.InceptionV3(
        weights="imagenet",     # Load pre-trained weights
        include_top=False,      # Exclude the fully connected layers
        pooling="avg",          # Global average pooling layer as the final layer
        input_shape=(img_size, img_size, 3)  # Input shape of images (height, width, channels)
    )
    
    # Get the preprocess_input function specific to InceptionV3
    preprocess_input = keras.applications.inception_v3.preprocess_input
    
    # Define the input layer for the model
    inputs = keras.Input((img_size, img_size, 3))
    
    # Apply the pre-processing function to the input
    preprocessed = preprocess_input(inputs)
    
    # Connect the input to the feature extractor
    outputs = feature_extractor(preprocessed)
    
    # Create and return the Keras Model
    return keras.Model(inputs, outputs, name="feature_extractor")