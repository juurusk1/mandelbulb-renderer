import pygame
import moderngl
import numpy as np
import config

# Window settings

WIDTH = 1800
HEIGHT =  WIDTH / 4 * 3 

PALETTE = config.PALETTES["forest"]
CONFIG = config.CONFIG
MOUSE_CONFIG = config.MOUSE_CONFIG

pygame.init()

pygame.display.set_mode(
    (WIDTH, HEIGHT),
    pygame.OPENGL | pygame.DOUBLEBUF
)

pygame.display.set_caption("Mandelbulb")

# Helper(s) 

def get_camera_pos(target, radius, yaw, pitch):
    yaw_r = np.radians(yaw)
    pitch_r = np.radians(pitch)

    x = radius * np.cos(pitch_r) * np.cos(yaw_r)
    y = radius * np.sin(pitch_r)
    z = radius * np.cos(pitch_r) * np.sin(yaw_r)

    return target + np.array([x, y, z], dtype=np.float32)
    yaw_r = np.radians(yaw)
    pitch_r = np.radians(pitch)

    x = np.cos(yaw_r) * np.cos(pitch_r)
    y = np.sin(pitch_r)
    z = np.sin(yaw_r) * np.cos(pitch_r)

    v = np.array([x, y, z], dtype=np.float32)
    return v / np.linalg.norm(v)

# ModernGL context & shader setup

with open("shaders/quad.vert") as f:
    vertex_shader = f.read()
with open("shaders/mandelbulb.frag") as f:
    fragment_shader = f.read()

ctx = moderngl.create_context()

prog = ctx.program(
    vertex_shader=vertex_shader,
    fragment_shader=fragment_shader
)

# Fullscreen quad

vertices = np.array([
    -1.0, -1.0,
     1.0, -1.0,
    -1.0,  1.0,

    -1.0,  1.0,
     1.0, -1.0,
     1.0,  1.0,
], dtype='f4')

vbo = ctx.buffer(vertices.tobytes())

vao = ctx.vertex_array(
    prog,
    [(vbo, '2f', 'in_pos')]
)

camera_pos = np.array([0.0, 0.0, 4.0], dtype=np.float32)
target = np.array([0.0, 0.0, 0.0], dtype=np.float32)

time = 0.0
radius = 4.0
yaw = 0.0
pitch = 0.0

pygame.event.set_grab(True)
pygame.mouse.set_visible(False)

last_mouse = pygame.mouse.get_pos()
last_mouse = None
dragging = False

# Setting config uniforms
for key, value in CONFIG.items():
    if key in prog:
        prog[key].value = value
    else:
        print("Missing uniform:", key)

# Setting palette uniforms
for key, value in PALETTE.items():
    if key in prog:
        prog[key].value = value
    else:
        print("Missing uniform:", key)

prog["radius"].value = radius

clock = pygame.time.Clock()

running = True

while running:

    dt = clock.tick(60) / 1000.0
    time += dt

    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False

        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_ESCAPE:
                running = False

        if event.type == pygame.MOUSEBUTTONDOWN:
            if event.button == 1:
                dragging = True
                pygame.mouse.get_rel()

            if event.button == 4:
                radius -= radius * MOUSE_CONFIG["zoom_speed"]

            if event.button == 5:
                radius += radius * MOUSE_CONFIG["zoom_speed"]

        if event.type == pygame.MOUSEBUTTONUP:
            if event.button == 1:
                dragging = False

    # Mouse
    if dragging:
        dx, dy = pygame.mouse.get_rel()

        yaw -= dx * 0.2 * (radius * radius /2) * MOUSE_CONFIG["sensitivity"]
        pitch += dy * 0.2 * (radius * radius /2) * MOUSE_CONFIG["sensitivity"]
        pitch = np.clip(pitch, -89.0, 89.0)

    # Update camera basis
    camera_pos = get_camera_pos(target, radius, yaw, pitch)
    prog["camera_pos"].value = tuple(camera_pos)
    prog["radius"].value = radius
    prog["time"].value = time

    ctx.clear(0.0, 0.0, 0.0)
    vao.render(moderngl.TRIANGLES)

    pygame.display.flip()

pygame.quit()