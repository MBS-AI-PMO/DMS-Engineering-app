import os
import tempfile
import subprocess
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

FREECAD_CMD = r"C:\Users\User\AppData\Local\Programs\FreeCAD 1.0\bin\freecadcmd.exe"

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/unfold")
async def unfold_step(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(('.step', '.stp')):
        raise HTTPException(400, "Only STEP/STP files supported")

    with tempfile.TemporaryDirectory() as tmpdir:
        step_path   = os.path.join(tmpdir, "input.step").replace("\\", "/")
        svg_path    = os.path.join(tmpdir, "output.svg").replace("\\", "/")
        log_path    = os.path.join(tmpdir, "script.log").replace("\\", "/")
        script_path = os.path.join(tmpdir, "run.py")

        content = await file.read()
        with open(step_path, 'wb') as f:
            f.write(content)

        script = f"""
import sys, os, math
import numpy as np

_log = open(r"{log_path}", "w", encoding="utf-8")
def log(msg):
    _log.write(str(msg) + "\\n")
    _log.flush()

try:
    import FreeCAD, Import, Part
    log("FreeCAD OK")
    doc = FreeCAD.newDocument("Doc")
    Import.insert(r"{step_path}", "Doc")
    doc.recompute()

    shape = None
    for obj in doc.Objects:
        if hasattr(obj,'Shape') and obj.Shape and not obj.Shape.isNull():
            shape = obj.Shape; break
    if not shape:
        log("ERROR_NO_SHAPE"); _log.close(); sys.exit(1)

    faces = list(shape.Faces)
    log(f"Faces: {{len(faces)}}")

    def nrm(v):
        v = np.asarray(v, dtype=float)
        l = np.linalg.norm(v)
        return v/l if l > 1e-10 else v

    def rodrigues(axis, angle):
        axis = nrm(axis)
        c,s = math.cos(angle), math.sin(angle)
        t = 1.0-c; x,y,z = axis
        return np.array([
            [t*x*x+c,   t*x*y-s*z, t*x*z+s*y],
            [t*x*y+s*z, t*y*y+c,   t*y*z-s*x],
            [t*x*z-s*y, t*y*z+s*x, t*z*z+c  ]
        ])

    def apply_tf(R, t, p):
        return R @ np.asarray(p, dtype=float) + t

    def get_normal(face):
        try:
            ur = face.ParameterRange
            n = face.normalAt((ur[0]+ur[1])/2.0,(ur[2]+ur[3])/2.0)
            return nrm([n.x,n.y,n.z])
        except:
            return np.array([0.0,0.0,1.0])

    def edge_key(edge):
        pts = sorted([(round(v.X,1),round(v.Y,1),round(v.Z,1)) for v in edge.Vertexes])
        return tuple(pts)

    def longest_edge_angle(face, R_zup):
        best_len, best_angle = 0, 0.0
        for e in face.Edges:
            try:
                verts = e.Vertexes
                if len(verts) < 2: continue
                v0 = R_zup @ np.array([verts[0].X, verts[0].Y, verts[0].Z])
                v1 = R_zup @ np.array([verts[-1].X, verts[-1].Y, verts[-1].Z])
                ev = v1-v0
                l = math.sqrt(ev[0]**2+ev[1]**2)
                if l > best_len:
                    best_len=l; best_angle=math.atan2(ev[1],ev[0])
            except: pass
        return best_angle

    def convex_hull_2d(pts):
        pts = sorted(set((round(p[0],0),round(p[1],0)) for p in pts))
        if len(pts) <= 2: return pts
        def cross(o,a,b): return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
        lower = []
        for p in pts:
            while len(lower)>=2 and cross(lower[-2],lower[-1],p)<=0: lower.pop()
            lower.append(p)
        upper = []
        for p in reversed(pts):
            while len(upper)>=2 and cross(upper[-2],upper[-1],p)<=0: upper.pop()
            upper.append(p)
        return lower[:-1]+upper[:-1]

    def pt_in_hull(hull, px, py):
        n=len(hull)
        if n<3: return True
        for i in range(n):
            ax,ay=hull[i]; bx,by=hull[(i+1)%n]
            if (bx-ax)*(py-ay)-(by-ay)*(px-ax) < -1e-3:
                return False
        return True

    # PATCH 1: Check ALL points, not just 3
    def edge_inside_hull(hull, rpts):
        for p in rpts:
            if not pt_in_hull(hull, p[0], p[1]):
                return False
        return True

    # PATCH 2: 2D vs 3D length ratio guard
    def edge_2d_len(rpts):
        total = 0.0
        for i in range(len(rpts) - 1):
            dx = rpts[i+1][0] - rpts[i][0]
            dy = rpts[i+1][1] - rpts[i][1]
            total += math.sqrt(dx*dx + dy*dy)
        return total

    # ── Adjacency ────────────────────────────────────────
    edge_faces = {{}}
    for fi,face in enumerate(faces):
        for e in face.Edges:
            k = edge_key(e)
            if k not in edge_faces: edge_faces[k] = []
            if fi not in edge_faces[k]: edge_faces[k].append(fi)

    # ── Outer faces ──────────────────────────────────────
    bb = shape.BoundBox
    cx=(bb.XMin+bb.XMax)/2; cy=(bb.YMin+bb.YMax)/2; cz=(bb.ZMin+bb.ZMax)/2
    log(f"BBox: W={{bb.XLength:.1f}} D={{bb.YLength:.1f}} H={{bb.ZLength:.1f}}")

    outer = set()
    for fi,face in enumerate(faces):
        if face.Area < 0.5: continue
        try:
            ur = face.ParameterRange
            pt = face.valueAt((ur[0]+ur[1])/2.0,(ur[2]+ur[3])/2.0)
            n  = get_normal(face)
            d  = nrm([pt.x-cx,pt.y-cy,pt.z-cz])
            if float(np.dot(n,d)) > -0.1: outer.add(fi)
        except: outer.add(fi)

    # ── Base face ────────────────────────────────────────
    sorted_outer = sorted(outer, key=lambda i: faces[i].Area, reverse=True)
    best_score, base_idx = -1, sorted_outer[0]
    for fi in sorted_outer[:20]:
        n = get_normal(faces[fi])
        score = faces[fi].Area * abs(n[2])
        if score > best_score:
            best_score=score; base_idx=fi

    base_n = get_normal(faces[base_idx])
    log(f"Base: {{base_idx}}, area={{faces[base_idx].Area:.0f}}, n={{base_n.round(3)}}")

    # ── Align ────────────────────────────────────────────
    Z_UP = np.array([0.0,0.0,1.0])
    if np.allclose(base_n, Z_UP, atol=0.01): R_zup = np.eye(3)
    elif np.allclose(base_n, -Z_UP, atol=0.01): R_zup = np.diag([1.0,-1.0,-1.0])
    else:
        ax = nrm(np.cross(base_n,Z_UP))
        ag = math.acos(float(np.clip(np.dot(base_n,Z_UP),-1,1)))
        R_zup = rodrigues(ax,ag)
    if (R_zup @ base_n)[2] < 0:
        R_zup = np.diag([1.0,-1.0,-1.0]) @ R_zup

    raw_angle = longest_edge_angle(faces[base_idx], R_zup)
    while raw_angle >  math.pi/2: raw_angle -= math.pi
    while raw_angle < -math.pi/2: raw_angle += math.pi
    R0 = rodrigues(Z_UP,-raw_angle) @ R_zup
    t0 = np.zeros(3)
    log(f"Align angle: {{math.degrees(raw_angle):.2f}}deg")

    # ── BFS ──────────────────────────────────────────────
    MAX_HOPS = 3
    transforms = {{base_idx: (R0, t0)}}
    visited    = {{base_idx}}
    queue      = [base_idx]
    hop_count  = {{base_idx: 0}}

    while queue:
        fi = queue.pop(0)
        R_p,t_p = transforms[fi]
        hops = hop_count[fi]
        if hops >= MAX_HOPS: continue

        for e in faces[fi].Edges:
            k = edge_key(e)
            for aj in edge_faces.get(k,[]):
                if aj in visited or aj not in outer: continue

                n0 = get_normal(faces[fi])
                n1 = get_normal(faces[aj])
                dot_f = float(np.clip(np.dot(n0,n1),-1,1))
                angle_faces = math.degrees(math.acos(dot_f))

                # Skip chamfers only (5-85°)
                if 5.0 < angle_faces < 85.0:
                    visited.add(aj); continue

                # Coplanar
                if angle_faces < 5.0:
                    transforms[aj]=(R_p.copy(),t_p.copy())
                    visited.add(aj); hop_count[aj]=hops; queue.append(aj); continue

                # 90° fold
                verts = e.Vertexes
                if len(verts) < 2:
                    transforms[aj]=(R_p.copy(),t_p.copy())
                    visited.add(aj); hop_count[aj]=hops+1; queue.append(aj); continue

                e0=np.array([verts[0].X, verts[0].Y, verts[0].Z])
                e1=np.array([verts[-1].X,verts[-1].Y,verts[-1].Z])
                p0=apply_tf(R_p,t_p,e0); p1=apply_tf(R_p,t_p,e1)
                fa_vec=p1-p0; fa_len=np.linalg.norm(fa_vec)
                if fa_len<1e-6:
                    transforms[aj]=(R_p.copy(),t_p.copy())
                    visited.add(aj); hop_count[aj]=hops+1; queue.append(aj); continue
                fa=fa_vec/fa_len

                n_adj_f=nrm(R_p @ n1)
                pn_raw=n_adj_f-fa*np.dot(n_adj_f,fa)
                pz_raw=Z_UP   -fa*np.dot(Z_UP,   fa)
                pn_l=np.linalg.norm(pn_raw); pz_l=np.linalg.norm(pz_raw)
                if pn_l<1e-6 or pz_l<1e-6:
                    transforms[aj]=(R_p.copy(),t_p.copy())
                    visited.add(aj); hop_count[aj]=hops+1; queue.append(aj); continue
                pn=pn_raw/pn_l; pz=pz_raw/pz_l

                cos_a=float(np.clip(np.dot(pn,pz),-1.0,1.0))
                sin_a=float(np.dot(np.cross(pn,pz),fa))
                angle=math.atan2(sin_a,cos_a)

                best_R,best_t,best_sc=None,None,-999.0
                for try_angle in [angle,-angle,math.pi+angle,math.pi-angle]:
                    R_rot=rodrigues(fa,try_angle)
                    R_try=R_rot @ R_p
                    t_try=R_rot @ (t_p-p0)+p0
                    score=float(nrm(R_try @ n1)[2])
                    if score>best_sc:
                        best_sc=score; best_R=R_try; best_t=t_try

                log(f"  {{fi}}->{{aj}}: {{angle_faces:.1f}}deg score={{best_sc:.3f}} hop={{hops+1}}")

                # PATCH 3: Raised threshold from 0.5 to 0.85 to reject near-vertical side walls
                if best_sc > 0.85:
                    transforms[aj]=(best_R,best_t)
                    visited.add(aj); hop_count[aj]=hops+1; queue.append(aj)
                else:
                    log(f"  SKIP low {{aj}}: {{best_sc:.3f}}")
                    visited.add(aj)

    log(f"BFS: {{len(transforms)}} faces")

    # ── Tessellate ────────────────────────────────────────
    face_tris={{}}; face_bbox_ratio={{}}
    for fi,(R,t) in transforms.items():
        try:
            vl,tl=faces[fi].tessellate(0.6)
            tris=[]; xs=[]; ys=[]
            for tri in tl:
                pts=[]
                for vi in tri:
                    fp=apply_tf(R,t,np.array([vl[vi].x,vl[vi].y,vl[vi].z]))
                    pts.append((fp[0],fp[1]))
                    xs.append(fp[0]); ys.append(fp[1])
                tris.append(pts)
            face_tris[fi]=tris
            if xs:
                bw=max(xs)-min(xs); bh=max(ys)-min(ys)
                face_bbox_ratio[fi]=(bw*bh)/faces[fi].Area if faces[fi].Area>0 else 0
        except: pass

    if not face_tris:
        log("ERROR_NO_2D"); _log.close(); sys.exit(1)

    # ── Filter: bad bbox ratio ────────────────────────────
    clean_tris={{}}
    for fi,tris in face_tris.items():
        ratio=face_bbox_ratio.get(fi,1.0)
        if ratio>2.5 and faces[fi].Area>10000:
            log(f"  FILTER fi={{fi}} ratio={{ratio:.2f}} area={{faces[fi].Area:.0f}}")
            continue
        clean_tris[fi]=tris
    face_tris=clean_tris
    log(f"After filter: {{len(face_tris)}} faces")

    # ── Collect edges ─────────────────────────────────────
    bend_edges_raw=[]; outline_edges_raw=[]; drawn=set()
    for fi,(R,t) in transforms.items():
        if fi not in face_tris: continue
        for e in faces[fi].Edges:
            k=edge_key(e)
            if k in drawn: continue
            drawn.add(k)
            inc_adj=[a for a in edge_faces.get(k,[]) if a!=fi and a in face_tris]
            try:
                pts3d=e.discretize(Number=20)
                pts2d=[]
                for p in pts3d:
                    fp=apply_tf(R,t,np.array([p.x,p.y,p.z]))
                    pts2d.append((fp[0],fp[1]))
                if len(pts2d)<2: continue

                # PATCH 4: Length ratio guard — reject stretched edges early
                len_3d = e.Length
                len_2d_raw = edge_2d_len(pts2d)
                if len_3d > 1e-3 and len_2d_raw > len_3d * 1.4:
                    log(f"  SKIP stretched edge len2d={{len_2d_raw:.1f}} len3d={{len_3d:.1f}}")
                    continue

                if inc_adj:
                    n0=get_normal(faces[fi]); n1_e=get_normal(faces[inc_adj[0]])
                    ang=math.degrees(math.acos(float(np.clip(np.dot(n0,n1_e),-1,1))))
                    if ang>30: bend_edges_raw.append(pts2d)
                    elif ang>4: outline_edges_raw.append(('thin',pts2d))
                else:
                    outline_edges_raw.append(('normal',pts2d))
            except: pass

    # ── Bounds ───────────────────────────────────────────
    all_x=[p[0] for tris in face_tris.values() for pts in tris for p in pts]
    all_y=[p[1] for tris in face_tris.values() for pts in tris for p in pts]
    mn_x,mx_x=min(all_x),max(all_x)
    mn_y,mx_y=min(all_y),max(all_y)
    W=mx_x-mn_x or 1; H=mx_y-mn_y or 1

    # Rotate portrait→landscape if needed
    if H > W:
        def rot2d(x, y): return -y, x
    else:
        def rot2d(x, y): return x, y

    # Apply rotation
    final_tris={{}}
    for fi,tris in face_tris.items():
        final_tris[fi]=[[rot2d(p[0],p[1]) for p in pts] for pts in tris]

    # Re-compute bounds after rotation
    all_rx=[p[0] for tris in final_tris.values() for pts in tris for p in pts]
    all_ry=[p[1] for tris in final_tris.values() for pts in tris for p in pts]
    mn_x,mx_x=min(all_rx),max(all_rx)
    mn_y,mx_y=min(all_ry),max(all_ry)
    W=mx_x-mn_x or 1; H=mx_y-mn_y or 1

    # PATCH 5: Center the entire layout so panels are symmetric
    cx_all = (mn_x + mx_x) / 2.0
    cy_all = (mn_y + mx_y) / 2.0

    def shift(pts_list):
        return [(p[0]-cx_all, p[1]-cy_all) for p in pts_list]

    centered_tris = {{}}
    for fi, tris in final_tris.items():
        centered_tris[fi] = [shift(pts) for pts in tris]
    final_tris = centered_tris

    # Bounds now symmetric around 0
    mn_x, mx_x = -W/2, W/2
    mn_y, mx_y = -H/2, H/2
    log(f"Final (centered): W={{W:.1f}} H={{H:.1f}}")

    # Helper: apply rot2d + center shift to any list of (x,y) pairs
    def to_final(pts2d):
        return shift([rot2d(p[0], p[1]) for p in pts2d])

    # ── Convex hull (rebuilt on centered coords) ──────────
    hull_sample=[]
    for tris in final_tris.values():
        for pts in tris[::2]:
            for p in pts:
                hull_sample.append(p)
    hull = convex_hull_2d(hull_sample)
    log(f"Hull: {{len(hull)}} pts")
    hull_svg = ' '.join([f"{{p[0]:.1f}},{{-p[1]:.1f}}" for p in hull])

    size=max(W,H); pad=size*0.07
    sw=size*0.0020; bsw=size*0.0014
    dash=size*0.018; gap=size*0.007
    vb=f"{{mn_x-pad}} {{-(mx_y+pad)}} {{W+pad*2}} {{H+pad*2}}"

    fills,outlines,bends=[],[],[]

    for fi,tris in final_tris.items():
        for pts in tris:
            coords=' '.join([f"{{p[0]:.2f}},{{-p[1]:.2f}}" for p in pts])
            fills.append(f'<polygon points="{{coords}}" fill="#dde1e7" stroke="#dde1e7" stroke-width="{{sw*0.1}}"/>')

    for kind,pts2d in outline_edges_raw:
        rpts = to_final(pts2d)
        if not edge_inside_hull(hull, rpts):
            log(f"  SKIP outline outside hull")
            continue
        coords=' '.join([f"{{p[0]:.2f}},{{-p[1]:.2f}}" for p in rpts])
        if kind=='normal':
            outlines.append(f'<polyline points="{{coords}}" fill="none" stroke="#1e293b" stroke-width="{{sw}}" stroke-linecap="round" stroke-linejoin="round"/>')
        else:
            outlines.append(f'<polyline points="{{coords}}" fill="none" stroke="#94a3b8" stroke-width="{{sw*0.35}}" stroke-linecap="round"/>')

    for pts2d in bend_edges_raw:
        rpts = to_final(pts2d)
        if not edge_inside_hull(hull, rpts):
            continue
        coords=' '.join([f"{{p[0]:.2f}},{{-p[1]:.2f}}" for p in rpts])
        bends.append(f'<polyline points="{{coords}}" fill="none" stroke="#2563eb" stroke-width="{{bsw}}" stroke-dasharray="{{dash}},{{gap}}" stroke-linecap="round" stroke-linejoin="round"/>')

    log(f"SVG: fills={{len(fills)}} outlines={{len(outlines)}} bends={{len(bends)}}")

    svg=''.join([
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{{vb}}" style="width:100%;height:100%;background:#f8f9fa">',
        f'<defs><clipPath id="mc"><polygon points="{{hull_svg}}"/></clipPath></defs>',
        '<g clip-path="url(#mc)">',
        '<g id="fills">',''.join(fills),'</g>',
        '<g id="outlines">',''.join(outlines),'</g>',
        '<g id="bends">',''.join(bends),'</g>',
        '</g></svg>'
    ])

    with open(r"{svg_path}",'w',encoding='utf-8') as f:
        f.write(svg)
    log("SVG_OK"); _log.close(); sys.exit(0)

except Exception as ex:
    import traceback
    log(f"FATAL: {{ex}}"); log(traceback.format_exc())
    _log.close(); sys.exit(1)
"""
        with open(script_path,'w',encoding='utf-8') as f:
            f.write(script)

        try:
            result = subprocess.run(
                [FREECAD_CMD, script_path],
                capture_output=True, text=True, timeout=120,
                encoding='utf-8', errors='replace'
            )
        except FileNotFoundError:
            raise HTTPException(500, f"FreeCAD not found at: {FREECAD_CMD}")
        except subprocess.TimeoutExpired:
            raise HTTPException(500, "FreeCAD timed out")

        script_log = ""
        if os.path.exists(log_path):
            with open(log_path,'r',encoding='utf-8') as lf:
                script_log = lf.read()

        print(script_log)

        if result.returncode != 0 and not os.path.exists(svg_path):
            raise HTTPException(500, f"FreeCAD exited {result.returncode}.\n{script_log}")

        if not os.path.exists(svg_path):
            raise HTTPException(500, f"SVG not generated.\n{script_log}")

        with open(svg_path,'r',encoding='utf-8') as f:
            svg_content = f.read()

        if not svg_content.strip():
            raise HTTPException(500, "Empty SVG generated")

        # Extract dimensions from viewBox for dimension validation
        dimensions = None
        import re
        vb_match = re.search(r'viewBox="([^"]+)"', svg_content)
        if vb_match:
            try:
                vb_parts = [float(x) for x in vb_match.group(1).split()]
                if len(vb_parts) == 4:
                    # viewBox: min_x min_y width height (in mm)
                    w_mm = float(f"{float(vb_parts[2]):.2f}")
                    h_mm = float(f"{float(vb_parts[3]):.2f}")
                    dimensions = {
                        "width_mm":    w_mm,
                        "height_mm":   h_mm,
                        "width_inch":  float(f"{w_mm / 25.4:.3f}"),
                        "height_inch": float(f"{h_mm / 25.4:.3f}"),
                    }
            except (ValueError, IndexError):
                pass

        return JSONResponse({
            "success":    True,
            "svg":        svg_content,
            "method":     "eid_final",
            "dimensions": dimensions,
            "log":        script_log
        })