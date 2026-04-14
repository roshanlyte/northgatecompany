import math

def generate_wavy_path(cx, cy, r, amplitude, waves, points_per_wave=10):
    path = []
    total_points = waves * points_per_wave
    for i in range(total_points + 1):
        theta = (i / total_points) * 2 * math.pi
        # Wavy radius
        current_r = r + amplitude * math.sin(waves * theta)
        x = cx + current_r * math.cos(theta)
        y = cy + current_r * math.sin(theta)
        
        if i == 0:
            path.append(f"M {x:.2f} {y:.2f}")
        else:
            path.append(f"L {x:.2f} {y:.2f}")
            
    return " ".join(path)

# 52x52 viewport, cx=26, cy=26, r=23 to allow room for the stroke and amplitude
path_d = generate_wavy_path(26, 26, 23, 1.5, 12)
print("Path string:", path_d)

# Calculate approx length for stroke-dasharray
length = 0
import re
pts = [list(map(float, pt.split(' ')[1:])) for pt in re.findall(r'[ML] ([0-9.-]+ [0-9.-]+)', path_d)]
for i in range(len(pts)-1):
    length += math.hypot(pts[i+1][0] - pts[i][0], pts[i+1][1] - pts[i][1])
print("Path length for stroke-dasharray:", length)
