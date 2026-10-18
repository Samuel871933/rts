"""
Builds a block-out of "the Spire" (MacroGod's map) from mapGeometry.generated.json: a raised wall
mass with the lanes, river, tunnel, jungle alcoves and bases carved out of it as corridors, plus a
floor plate, a glowing river channel and a capped tunnel. This is a starting point to detail by hand
in Blender (pipes, rivets, lamps, props) for the retro-futuristic/Piltover look — not finished art.

Usage: blender --background --python packages/shared/scripts/blender/build_map.py
Requires scripts/build-terrain.ts to have been run first (produces mapGeometry.generated.json).
"""
import json
import math
import os

import bmesh
import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
JSON_PATH = os.path.join(HERE, "..", "..", "src", "data", "mapGeometry.generated.json")
OUT_GLB = os.path.join(HERE, "..", "..", "..", "..", "apps", "client", "public", "assets", "map", "piltover_map_blockout.glb")

SCALE = 0.01  # world units (~14800) -> Blender meters (~148m)
WALL_HEIGHT = 9.0  # meters
FLOOR_Z = -0.3
RIVER_GLOW_Z = -0.15
TUNNEL_ROOF_Z = 3.0
BASE_PLATE_Z = 0.3
JUNGLE_CORRIDOR_HALF_WIDTH = 2.6


def p(point):
    return (point["x"] * SCALE, point["y"] * SCALE)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def make_material(name, color, emission=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = 0.6
    bsdf.inputs["Roughness"].default_value = 0.35
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*color, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission
    return mat


def polygon_prism(name, points2d, z0, z1, material=None):
    bm = bmesh.new()
    verts = [bm.verts.new((x, y, z0)) for x, y in points2d]
    bm.verts.ensure_lookup_table()
    face = bm.faces.new(verts)
    ret = bmesh.ops.extrude_face_region(bm, geom=[face])
    top_verts = [v for v in ret["geom"] if isinstance(v, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0, 0, z1 - z0), verts=top_verts)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name + "Mesh")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    if material:
        obj.data.materials.append(material)
    return obj


def add_cylinder(name, center2d, radius, z0, z1, material=None):
    x, y = center2d
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=z1 - z0, location=(x, y, (z0 + z1) / 2), vertices=16)
    obj = bpy.context.active_object
    obj.name = name
    if material:
        obj.data.materials.append(material)
    return obj


def buffer_polyline(path2d, half_width):
    """A single closed, non-self-overlapping outline around a polyline (mitered joins, clamped so
    sharp turns don't spike): far cheaper for booleans than chaining overlapping cylinders."""
    n = len(path2d)

    def seg_dir(i):
        ax, ay = path2d[i]
        bx, by = path2d[i + 1]
        length = math.hypot(bx - ax, by - ay) or 1.0
        return (bx - ax) / length, (by - ay) / length

    def normal_of(i):
        dx, dy = seg_dir(i)
        return -dy, dx

    left, right = [], []
    for i in range(n):
        if i == 0:
            nx, ny = normal_of(0)
        elif i == n - 1:
            nx, ny = normal_of(n - 2)
        else:
            nx0, ny0 = normal_of(i - 1)
            nx1, ny1 = normal_of(i)
            mx, my = nx0 + nx1, ny0 + ny1
            mlen = math.hypot(mx, my)
            if mlen < 1e-6:
                nx, ny = nx0, ny0
            else:
                cos_half = math.sqrt(max(0.0, (1 + nx0 * nx1 + ny0 * ny1) / 2))
                factor = 1 / max(cos_half, 0.4)  # clamp the miter so sharp turns don't spike out
                nx, ny = mx / mlen * factor, my / mlen * factor
        x, y = path2d[i]
        left.append((x + nx * half_width, y + ny * half_width))
        right.append((x - nx * half_width, y - ny * half_width))
    return left + right[::-1]


def union_all(objects):
    """Chains boolean unions so overlapping pieces become one clean, non-self-intersecting solid —
    using overlapping pieces directly as a single boolean-difference cutter confuses the solver and
    can erase the whole target."""
    result = objects[0]
    for piece in objects[1:]:
        mod = result.modifiers.new("Union", "BOOLEAN")
        mod.operation = "UNION"
        mod.object = piece
        bpy.context.view_layer.objects.active = result
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(piece, do_unlink=True)
    return result


def main():
    with open(JSON_PATH) as f:
        geo = json.load(f)

    clear_scene()
    mat_brass = make_material("Brass", (0.55, 0.42, 0.18))
    mat_gunmetal = make_material("Gunmetal", (0.12, 0.11, 0.1))
    mat_ground = make_material("GroundPlate", (0.3, 0.26, 0.19))
    mat_river = make_material("RiverEnergy", (0.12, 0.72, 0.78), emission=3.0)
    mat_tunnel_glow = make_material("TunnelGlow", (0.85, 0.65, 0.25), emission=2.0)
    mat_base_blue = make_material("BaseBlue", (0.14, 0.2, 0.32))
    mat_base_red = make_material("BaseRed", (0.3, 0.16, 0.14))

    map_size = geo["mapSize"] * SCALE

    polygon_prism("Floor", [(0, 0), (map_size, 0), (map_size, map_size), (0, map_size)], FLOOR_Z - 0.3, FLOOR_Z, mat_ground)

    slab = polygon_prism("WallSlab", [(0, 0), (map_size, 0), (map_size, map_size), (0, map_size)], 0, WALL_HEIGHT, mat_brass)
    slab.data.materials.append(mat_gunmetal)

    cut_z0, cut_z1 = -1.0, WALL_HEIGHT + 1.0
    walkable_pieces = []
    for lane_name, path in geo["lanePaths"].items():
        outline = buffer_polyline([p(pt) for pt in path], geo["laneWidth"] * SCALE / 2)
        walkable_pieces.append(polygon_prism(f"cut_lane_{lane_name}", outline, cut_z0, cut_z1))
    river_outline = buffer_polyline([p(pt) for pt in geo["riverPath"]], geo["riverWidth"] * SCALE / 2)
    walkable_pieces.append(polygon_prism("cut_river", river_outline, cut_z0, cut_z1))
    # The tunnel only cuts up to its ceiling height, not the full wall height like the open lanes/river:
    # the untouched wall mass above it is its roof, instead of a separate slab floating over an open trench.
    tunnel_outline = buffer_polyline([p(pt) for pt in geo["tunnelPath"]], geo["tunnelWidth"] * SCALE / 2)
    walkable_pieces.append(polygon_prism("cut_tunnel", tunnel_outline, cut_z0, TUNNEL_ROOF_Z))
    walkable_pieces.append(add_cylinder("cut_baron", p(geo["baronPos"]), geo["riverPitRadius"] * SCALE, cut_z0, cut_z1))
    walkable_pieces.append(add_cylinder("cut_dragon", p(geo["dragonPos"]), geo["riverPitRadius"] * SCALE, cut_z0, cut_z1))
    for i, alcove in enumerate(geo["jungleAlcoves"]):
        walkable_pieces.append(add_cylinder(f"cut_alcove_{i}", p(alcove["center"]), alcove["radius"] * SCALE, cut_z0, cut_z1))
        link_outline = buffer_polyline([p(alcove["center"]), p(alcove["connector"])], JUNGLE_CORRIDOR_HALF_WIDTH)
        walkable_pieces.append(polygon_prism(f"cut_alcove_link_{i}", link_outline, cut_z0, cut_z1))
    for i, link in enumerate(geo["jungleLinks"]):
        link_outline = buffer_polyline([p(link["a"]), p(link["b"])], geo["jungleLinkWidth"] * SCALE / 2)
        walkable_pieces.append(polygon_prism(f"cut_jungle_link_{i}", link_outline, cut_z0, cut_z1))
    for team in ("blue", "red"):
        walkable_pieces.append(polygon_prism(f"cut_base_{team}", [p(pt) for pt in geo["basePolygons"][team]], cut_z0, cut_z1))

    cutter = union_all(walkable_pieces)
    cutter.name = "Cutter"

    mod = slab.modifiers.new("CarveCorridors", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.object = cutter
    bpy.context.view_layer.objects.active = slab
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)

    # River and tunnel glow floors sit inside the corridors just carved; base platforms are raised pads.
    river_glow_outline = buffer_polyline([p(pt) for pt in geo["riverPath"]], geo["riverWidth"] * SCALE / 2 * 0.85)
    polygon_prism("river_glow", river_glow_outline, RIVER_GLOW_Z, RIVER_GLOW_Z + 0.08, mat_river)

    tunnel_glow_outline = buffer_polyline([p(pt) for pt in geo["tunnelPath"]], geo["tunnelWidth"] * SCALE / 2 * 0.85)
    polygon_prism("tunnel_glow", tunnel_glow_outline, RIVER_GLOW_Z, RIVER_GLOW_Z + 0.08, mat_tunnel_glow)

    for team, mat in (("blue", mat_base_blue), ("red", mat_base_red)):
        polygon_prism(f"base_plate_{team}", [p(pt) for pt in geo["basePolygons"][team]], FLOOR_Z, BASE_PLATE_Z, mat)

    # Placeholder buildings: tapered pylons for turrets/inhibitors, a taller spire for each nexus —
    # silhouette-only block-out, for hand detailing (greebles, props) in Blender afterwards.
    mat_turret = make_material("TurretBrass", (0.5, 0.38, 0.2))
    mat_turret_light = make_material("TurretLight", (0.9, 0.7, 0.2), emission=2.5)
    for s in geo["structures"]:
        x, y = p(s["pos"])
        if s["kind"] == "nexus":
            height, radius = 7.0, 1.4
        elif s["tier"] == "inhib":
            height, radius = 5.0, 1.0
        else:
            height, radius = 6.0, 0.9
        add_cylinder(f"bld_{s['id']}", (x, y), radius, FLOOR_Z, FLOOR_Z + height, mat_turret)
        add_cylinder(f"bld_{s['id']}_light", (x, y), radius * 0.4, FLOOR_Z + height, FLOOR_Z + height + 0.5, mat_turret_light)

    os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_format="GLB", use_selection=True)
    print(f"Exported {OUT_GLB}")


main()
