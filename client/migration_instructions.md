# 🛠️ Task: 3D/2D Viewer Migration & Integration

## 1. Project Overview
**Source Project Path:** `C:\Users\User\Desktop\flatfile-viewer`
**Destination Project:** DMS Project
**Context:** The source project is a fully functional 3D/2D viewing tool. The destination (DMS) has a working 3D viewer but a **broken/non-functional 2D model viewer**. You are required to extract the logic from the source and integrate it into DMS, ensuring a seamless replacement of the 2D logic.

---

## 2. Technical Stack (Strict Adherence)
Maintain this exact stack. Do not introduce alternative libraries or different versions unless required for compatibility.

### **Frontend (React + Vite)**
* **3D Core:** `Three.js`
* **Local Parser:** `occt-import-js` (for immediate client-side preview).
* **Framework:** React with Vite build tool.

### **Backend (Python)**
* **Geometry Engine:** `CadQuery` and `OpenCASCADE (OCP)`.
* **Processing:** `NumPy` (for mathematical/geometric operations).
* **Server:** Built-in `http.server` (as utilized in the source project).

---

## 3. Reference Data Flow (Source Logic)
The migration must preserve this exact data flow to ensure the 2D viewer works correctly in the DMS project:

1.  **File Input:** User uploads a `.step` or `.stp` file via the React UI.
2.  **Immediate 3D Preview:** Frontend uses `occt-import-js` to parse the file locally and render it in the 3D viewer immediately.
3.  **Backend Unfolding:** Simultaneously, the frontend sends the file to the Python backend via `POST /api/unfold`.
4.  **Geometric Analysis:** The backend (using **CadQuery/OCP**) identifies:
    * Planar faces.
    * Bend cylinders.
    * Shared edges.
5.  **Unfolding Result:** Backend unfolds the connected sheet and returns the flat geometry (2D line data).
6.  **UI Update:** The Frontend replaces the initial "fallback" 2D view with the high-fidelity geometry returned by the backend.

---

## 4. Execution Instructions for Claude

### **Step 1: Architecture Analysis**
* Read the `architecture.md` file located at `C:\Users\User\Desktop\flatfile-viewer`.
* Map out the components responsible for the 2D flat pattern and the 3D viewer logic.

### **Step 2: Dependency & Version Check**
* **Node.js/React:** Compare `package.json` in both projects. Identify missing dependencies (e.g., `occt-import-js`, `three`) and ensure versions are compatible with the DMS project's current React version.
* **Python:** Compare the environments. Ensure `CadQuery` and `OCP` are properly specified for the DMS backend. Avoid version mismatches that could break the OpenCASCADE bindings.

### **Step 3: Extraction & Porting**
* **Backend:** Extract the unfolding logic and the API handler for `/api/unfold`. Move these to the appropriate directory in the DMS project.
* **Frontend:** Extract the `3DModelViewer` and `2DFlatPatternViewer` components. 
* **Integration:** Replace the existing, broken 2D viewer in the DMS project with the extracted code.

### **Step 4: Refactoring**
* Update all relative imports in the migrated files to match the DMS directory structure.
* Ensure the frontend state correctly handles the transition from the `occt-import-js` preview to the backend-generated 2D data.

---

## 5. Required Output
Please provide:
1.  **File-by-file code changes** for the DMS project.
2.  **Specific shell commands** to install any missing `npm` or `pip` dependencies.
3.  **Confirmation** that the logic follows the 8-step Data Flow mentioned above.