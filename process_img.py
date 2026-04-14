from PIL import Image, ImageOps

try:
    # Open image
    img = Image.open('north_gate_logo_minimal_hd.png').convert("RGBA")
    
    # Create grayscale and invert it so lines are white (255) and bg is black (0)
    # The original is black lines on white bg.
    r, g, b, a = img.split()
    gray = ImageOps.grayscale(img.convert("RGB"))
    inverted = ImageOps.invert(gray)
    
    # Threshold the inverted image slightly to remove compression artifacts in the white background
    # This ensures "almost white" becomes perfectly transparent
    threshold = 10
    inverted = inverted.point(lambda p: p if p > threshold else 0)
    
    # Get bounding box of non-zero regions (the logo itself)
    bbox = inverted.getbbox()
    
    if bbox:
        # Add a tiny bit of padding to the bbox
        pad = 20
        bbox = (max(0, bbox[0]-pad), max(0, bbox[1]-pad), 
                min(img.width, bbox[2]+pad), min(img.height, bbox[3]+pad))
        
        img = img.crop(bbox)
        inverted = inverted.crop(bbox)
    
    # Create new completely black image
    new_img = Image.new("RGBA", img.size, (0, 0, 0, 0))
    # Apply the inverted grayscale as the alpha channel!
    # Where original was black, inverted is 255 (opaque). Where original was white, inverted is 0 (transparent).
    new_img.putalpha(inverted)
    
    new_img.save('north_gate_logo_transparent.png')
    print("Successfully processed and saved north_gate_logo_transparent.png")
except Exception as e:
    print(f"Error: {e}")
