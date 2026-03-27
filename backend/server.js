const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const cookieParser = require('cookie-parser');
const db = require('./db');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const metalsRoutes = require('./routes/metals');
const categoriesRoutes = require('./routes/categories');
const faqsRoutes = require('./routes/faqs');
const quoteRoutes = require('./routes/quote');
const servicesRoutes = require('./routes/services');
const usersRoutes = require('./routes/users');
const emailRoutes = require('./routes/email');
const newsletterRoutes = require('./routes/newsletter');
const settingsRoutes = require('./routes/settings');
const guidelinesRoutes = require('./routes/guidelines');
const configurationsRoutes = require('./routes/configurations');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

// Serve static images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/metals', metalsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/faqs', faqsRoutes);
app.use('/api/quote', quoteRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/guidelines', guidelinesRoutes);
app.use('/api/configurations', configurationsRoutes);

// Setup multer for file uploads
const uploadDir = path.join(__dirname, 'temp_uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '_' + file.originalname)
});

const upload = multer({ storage });

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', engine: 'Node.js' });
});

// Database Connectivity Check
app.get('/api/db-check', async (req, res) => {
    try {
        const start = Date.now();
        const result = await db.query('SELECT NOW()');
        const end = Date.now();
        res.json({
            success: true,
            timestamp: result.rows[0].now,
            latency: `${end - start}ms`,
            message: 'PostgreSQL connection successful'
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message,
            message: 'PostgreSQL connection failed'
        });
    }
});

// Ported Unfold Logic (STEP/STP)
app.post('/api/unfold', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const filename = req.file.filename.toLowerCase();
    if (!filename.endsWith('.step') && !filename.endsWith('.stp')) {
        return res.status(400).json({ success: false, error: 'Only STEP/STP files supported' });
    }

    const stepPath = req.file.path.replace(/\\/g, '/');
    const tempId = Date.now();
    const svgPath = path.join(uploadDir, `output_${tempId}.svg`).replace(/\\/g, '/');
    const logPath = path.join(uploadDir, `script_${tempId}.log`).replace(/\\/g, '/');
    const scriptPath = path.join(uploadDir, `run_${tempId}.py`);

    // The FreeCAD Python Script (Ported from original backend)
    const script = `
import sys, os, math
import numpy as np

_log = open(r"${logPath}", "w", encoding="utf-8")
def log(msg):
    _log.write(str(msg) + "\\n")
    _log.flush()

try:
    import FreeCAD, Import, Part
    log("FreeCAD OK")
    doc = FreeCAD.newDocument("Doc")
    Import.insert(r"${stepPath}", "Doc")
    doc.recompute()

    shape = None
    for obj in doc.Objects:
        if hasattr(obj,'Shape') and obj.Shape and not obj.Shape.isNull():
            shape = obj.Shape; break
    if not shape:
        log("ERROR_NO_SHAPE"); _log.close(); sys.exit(1)

    faces = list(shape.Faces)
    log(f"Faces: {len(faces)}")

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
            if (bx-ax)*(py-ay)-(by-ay)*(px-ax) < -1e-3: return False
        return True

    def edge_inside_hull(hull, rpts):
        for p in rpts:
            if not pt_in_hull(hull, p[0], p[1]): return False
        return True

    def edge_2d_len(rpts):
        total = 0.0
        for i in range(len(rpts) - 1):
            dx = rpts[i+1][0] - rpts[i][0]
            dy = rpts[i+1][1] - rpts[i][1]
            total += math.sqrt(dx*dx + dy*dy)
        return total

    edge_faces = {}
    for fi,face in enumerate(faces):
        for e in face.Edges:
            k = edge_key(e)
            if k not in edge_faces: edge_faces[k] = []
            if fi not in edge_faces[k]: edge_faces[k].append(fi)

    bb = shape.BoundBox
    cx=(bb.XMin+bb.XMax)/2; cy=(bb.YMin+bb.YMax)/2; cz=(bb.ZMin+bb.ZMax)/2
    
    outer = set()
    for fi,face in enumerate(faces):
        if face.Area < 0.5: continue
        try:
            ur = face.ParameterRange
            pt = face.valueAt((ur[0]+ur[1])/2.0,(ur[2]+ur[3])/2.0)
            n = get_normal(face)
            d = nrm([pt.x-cx,pt.y-cy,pt.z-cz])
            if float(np.dot(n,d)) > -0.1: outer.add(fi)
        except: outer.add(fi)

    sorted_outer = sorted(outer, key=lambda i: faces[i].Area, reverse=True)
    base_idx = sorted_outer[0]
    base_n = get_normal(faces[base_idx])

    Z_UP = np.array([0.0,0.0,1.0])
    if np.allclose(base_n, Z_UP, atol=0.01): R_zup = np.eye(3)
    elif np.allclose(base_n, -Z_UP, atol=0.01): R_zup = np.diag([1.0,-1.0,-1.0])
    else:
        ax = nrm(np.cross(base_n,Z_UP))
        ag = math.acos(float(np.clip(np.dot(base_n,Z_UP),-1,1)))
        R_zup = rodrigues(ax,ag)
    if (R_zup @ base_n)[2] < 0: R_zup = np.diag([1.0,-1.0,-1.0]) @ R_zup

    raw_angle = longest_edge_angle(faces[base_idx], R_zup)
    while raw_angle > math.pi/2: raw_angle -= math.pi
    while raw_angle < -math.pi/2: raw_angle += math.pi
    R0 = rodrigues(Z_UP,-raw_angle) @ R_zup
    t0 = np.zeros(3)

    MAX_HOPS = 3
    transforms = {base_idx: (R0, t0)}
    visited = {base_idx}
    queue = [base_idx]
    hop_count = {base_idx: 0}

    while queue:
        fi = queue.pop(0)
        R_p,t_p = transforms[fi]
        hops = hop_count[fi]
        if hops >= MAX_HOPS: continue
        for e in faces[fi].Edges:
            k = edge_key(e)
            for aj in edge_faces.get(k,[]):
                if aj in visited or aj not in outer: continue
                n0 = get_normal(faces[fi]); n1 = get_normal(faces[aj])
                dot_f = float(np.clip(np.dot(n0,n1),-1,1))
                angle_faces = math.degrees(math.acos(dot_f))
                if 5.0 < angle_faces < 85.0: visited.add(aj); continue
                if angle_faces < 5.0:
                    transforms[aj]=(R_p.copy(),t_p.copy())
                    visited.add(aj); hop_count[aj]=hops; queue.append(aj); continue
                verts = e.Vertexes
                if len(verts) < 2:
                    transforms[aj]=(R_p.copy(),t_p.copy())
                    visited.add(aj); hop_count[aj]=hops+1; queue.append(aj); continue
                e0=np.array([verts[0].X,verts[0].Y,verts[0].Z])
                e1=np.array([verts[-1].X,verts[-1].Y,verts[-1].Z])
                p0=apply_tf(R_p,t_p,e0); p1=apply_tf(R_p,t_p,e1)
                fa_vec=p1-p0; fa_len=np.linalg.norm(fa_vec)
                if fa_len<1e-6:
                    transforms[aj]=(R_p.copy(),t_p.copy())
                    visited.add(aj); hop_count[aj]=hops+1; queue.append(aj); continue
                fa=fa_vec/fa_len
                n_adj_f=nrm(R_p @ n1)
                pn=nrm(n_adj_f-fa*np.dot(n_adj_f,fa)); pz=nrm(Z_UP-fa*np.dot(Z_UP,fa))
                angle=math.atan2(float(np.dot(np.cross(pn,pz),fa)), float(np.clip(np.dot(pn,pz),-1,1)))
                best_R,best_t,best_sc=None,None,-999.0
                for try_angle in [angle,-angle,math.pi+angle,math.pi-angle]:
                    R_rot=rodrigues(fa,try_angle)
                    R_try=R_rot @ R_p
                    t_try=R_rot @ (t_p-p0)+p0
                    score=float(nrm(R_try @ n1)[2])
                    if score>best_sc: best_sc=score; best_R=R_try; best_t=t_try
                if best_sc > 0.85:
                    transforms[aj]=(best_R,best_t)
                    visited.add(aj); hop_count[aj]=hops+1; queue.append(aj)
                else: visited.add(aj)

    face_tris={}
    for fi,(R,t) in transforms.items():
        try:
            vl,tl=faces[fi].tessellate(0.6)
            tris=[]
            for tri in tl:
                pts=[]
                for vi in tri:
                    fp=apply_tf(R,t,np.array([vl[vi].x,vl[vi].y,vl[vi].z]))
                    pts.append((fp[0],fp[1]))
                tris.append(pts)
            face_tris[fi]=tris
        except: pass

    if not face_tris: log("ERROR_NO_2D"); _log.close(); sys.exit(1)

    bend_edges_raw=[]; outline_edges_raw=[]; drawn=set()
    for fi,(R,t) in transforms.items():
        if fi not in face_tris: continue
        for e in faces[fi].Edges:
            k=edge_key(e)
            if k in drawn: continue
            drawn.add(k)
            inc_adj=[a for a in edge_faces.get(k,[]) if a!=fi and a in face_tris]
            try:
                pts3d=e.discretize(Number=20); pts2d=[]
                for p in pts3d:
                    fp=apply_tf(R,t,np.array([p.x,p.y,p.z]))
                    pts2d.append((fp[0],fp[1]))
                if len(pts2d)<2: continue
                if inc_adj:
                    n0=get_normal(faces[fi]); n1_e=get_normal(faces[inc_adj[0]])
                    ang=math.degrees(math.acos(float(np.clip(np.dot(n0,n1_e),-1,1))))
                    if ang>30: bend_edges_raw.append(pts2d)
                    elif ang>4: outline_edges_raw.append(('thin',pts2d))
                else: outline_edges_raw.append(('normal',pts2d))
            except: pass

    all_x=[p[0] for tris in face_tris.values() for pts in tris for p in pts]
    all_y=[p[1] for tris in face_tris.values() for pts in tris for p in pts]
    mn_x,mx_x=min(all_x),max(all_x)
    mn_y,mx_y=min(all_y),max(all_y)
    W=mx_x-mn_x or 1; H=mx_y-mn_y or 1

    if H > W:
        def rot2d(x, y): return -y, x
    else:
        def rot2d(x, y): return x, y

    final_tris={}
    for fi,tris in face_tris.items():
        final_tris[fi]=[[rot2d(p[0],p[1]) for p in pts] for pts in tris]

    all_rx=[p[0] for tris in final_tris.values() for pts in tris for p in pts]
    all_ry=[p[1] for tris in final_tris.values() for pts in tris for p in pts]
    mn_x,mx_x=min(all_rx),max(all_rx)
    mn_y,mx_y=min(all_ry),max(all_ry)
    W=mx_x-mn_x or 1; H=mx_y-mn_y or 1

    cx_all = (mn_x + mx_x) / 2.0
    cy_all = (mn_y + mx_y) / 2.0

    def shift(pts_list):
        return [(p[0]-cx_all, p[1]-cy_all) for p in pts_list]

    centered_tris = {}
    for fi, tris in final_tris.items():
        centered_tris[fi] = [shift(pts) for pts in tris]
    final_tris = centered_tris

    mn_x, mx_x = -W/2, W/2
    mn_y, mx_y = -H/2, H/2

    def to_final(pts2d):
        return shift([rot2d(p[0], p[1]) for p in pts2d])

    hull_sample=[]
    for tris in final_tris.values():
        for pts in tris[::2]:
            for p in pts: hull_sample.append(p)
    hull = convex_hull_2d(hull_sample)
    hull_svg = ' '.join([f"{p[0]:.1f},{-p[1]:.1f}" for p in hull])

    size=max(W,H); pad=size*0.07
    sw=size*0.0020; bsw=size*0.0014
    dash=size*0.018; gap=size*0.007
    vb=f"{mn_x-pad} {-(mx_y+pad)} {W+pad*2} {H+pad*2}"

    fills,outlines,bends=[],[],[]
    for fi,tris in final_tris.items():
        for pts in tris:
            coords=' '.join([f"{p[0]:.2f},{-p[1]:.2f}" for p in pts])
            fills.append(f'<polygon points="{coords}" fill="#dde1e7" stroke="#dde1e7" stroke-width="{sw*0.1}"/>')

    for kind,pts2d in outline_edges_raw:
        rpts = to_final(pts2d)
        if not edge_inside_hull(hull, rpts): continue
        coords=' '.join([f"{p[0]:.2f},{-p[1]:.2f}" for p in rpts])
        if kind=='normal':
            outlines.append(f'<polyline points="{coords}" fill="none" stroke="#1e293b" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"/>')
        else:
            outlines.append(f'<polyline points="{coords}" fill="none" stroke="#94a3b8" stroke-width="{sw*0.35}" stroke-linecap="round"/>')

    for pts2d in bend_edges_raw:
        rpts = to_final(pts2d)
        if not edge_inside_hull(hull, rpts): continue
        coords=' '.join([f"{p[0]:.2f},{-p[1]:.2f}" for p in rpts])
        bends.append(f'<polyline points="{coords}" fill="none" stroke="#2563eb" stroke-width="{bsw}" stroke-dasharray="{dash},{gap}" stroke-linecap="round" stroke-linejoin="round"/>')

    svg="".join([
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" style="width:100%;height:100%;background:#f8f9fa">',
        f'<defs><clipPath id="mc"><polygon points="{hull_svg}"/></clipPath></defs>',
        '<g clip-path="url(#mc)">',
        '<g id="fills">', "".join(fills), '</g>',
        '<g id="outlines">', "".join(outlines), '</g>',
        '<g id="bends">', "".join(bends), '</g>',
        '</g></svg>'
    ])
    with open(r"${svgPath}",'w',encoding='utf-8') as f: f.write(svg)
    log("SVG_OK"); _log.close(); sys.exit(0)
except Exception as ex:
    import traceback
    log(f"FATAL: {ex}"); log(traceback.format_exc())
    _log.close(); sys.exit(1)
  `;

    fs.writeFileSync(scriptPath, script);

    const freecad = spawn(process.env.FREECAD_PATH, [scriptPath]);

    let stdout = '', stderr = '';
    freecad.stdout.on('data', d => stdout += d);
    freecad.stderr.on('data', d => stderr += d);

    freecad.on('close', (code) => {
        if (code !== 0) {
            const logContent = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : 'No log generated';
            return res.status(500).json({ success: false, error: 'FreeCAD failed', log: logContent, stderr });
        }

        if (!fs.existsSync(svgPath)) {
            return res.status(500).json({ success: false, error: 'SVG not generated' });
        }

        const svg = fs.readFileSync(svgPath, 'utf8');
        res.json({ success: true, svg });

        // Cleanup
        [scriptPath, stepPath, svgPath, logPath].forEach(p => { if (fs.existsSync(p)) fs.unlinkSync(p); });
    });
});

app.listen(port, async () => {
    console.log(`\x1b[43m\x1b[30m Server running at http://localhost:${port} \x1b[0m`);
    try {
        await db.query('SELECT NOW()');
        console.log(`\x1b[45m\x1b[30m Database Integrated & Connected Successfully \x1b[0m`);
        // Ensure customer profile columns exist
        await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);`);
        await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;`);
        // Ensure configuration tables exist
        await db.query(`
            CREATE TABLE IF NOT EXISTS service_configs (
                id SERIAL PRIMARY KEY,
                service_type VARCHAR(50) UNIQUE NOT NULL
                    CHECK (service_type IN ('cnc_machining', 'sheet_cutting')),
                min_x NUMERIC(12,4) DEFAULT 0, max_x NUMERIC(12,4),
                min_y NUMERIC(12,4) DEFAULT 0, max_y NUMERIC(12,4),
                min_z NUMERIC(12,4) DEFAULT 0, max_z NUMERIC(12,4),
                created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await db.query(`INSERT INTO service_configs (service_type) VALUES ('cnc_machining') ON CONFLICT DO NOTHING;`);
        await db.query(`INSERT INTO service_configs (service_type) VALUES ('sheet_cutting') ON CONFLICT DO NOTHING;`);
        await db.query(`
            CREATE TABLE IF NOT EXISTS metal_configs (
                id SERIAL PRIMARY KEY,
                metal_id INTEGER UNIQUE NOT NULL REFERENCES metals(id) ON DELETE CASCADE,
                min_x NUMERIC(12,4), max_x NUMERIC(12,4),
                min_y NUMERIC(12,4), max_y NUMERIC(12,4),
                min_z NUMERIC(12,4), max_z NUMERIC(12,4),
                available_thicknesses JSONB DEFAULT '[]',
                is_sheet_cuttable BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS service_metal_assignments (
                id SERIAL PRIMARY KEY,
                service_type VARCHAR(50) NOT NULL
                    CHECK (service_type IN ('cnc_machining', 'sheet_cutting')),
                metal_id INTEGER NOT NULL REFERENCES metals(id) ON DELETE CASCADE,
                UNIQUE(service_type, metal_id)
            );
        `);
    } catch (err) {
        console.log(`\x1b[41m\x1b[37m Database Connection Failed: ${err.message} \x1b[0m`);
    }
});
