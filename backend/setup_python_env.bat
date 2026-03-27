@echo off
REM ============================================================
REM  Setup script for the CadQuery/OCP Python environment
REM  CadQuery requires Python 3.10 or 3.11 (not 3.14)
REM ============================================================

echo.
echo === CadQuery Python Environment Setup ===
echo.

REM Check if conda is available
where conda >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [!] conda not found on PATH.
    echo.
    echo Please install Miniconda first:
    echo   https://docs.anaconda.com/miniconda/install/#quick-command-line-install
    echo.
    echo Quick install (run in PowerShell as Admin^):
    echo   winget install Anaconda.Miniconda3
    echo.
    echo After installing, close and reopen your terminal, then run this script again.
    pause
    exit /b 1
)

echo [1/3] Creating conda environment 'cadquery-env' with Python 3.10...
conda create -n cadquery-env python=3.10 -y

echo.
echo [2/3] Installing CadQuery and dependencies...
conda run -n cadquery-env pip install cadquery==2.4.0 numpy

echo.
echo [3/3] Verifying installation...
conda run -n cadquery-env python -c "import cadquery as cq; from OCP.gp import gp_Pnt; print('[OK] CadQuery + OCP verified successfully!')"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [!] Verification failed. Trying conda-forge install...
    conda install -n cadquery-env -c conda-forge -c cadquery cadquery=2.4.0 -y
    conda run -n cadquery-env python -c "import cadquery as cq; from OCP.gp import gp_Pnt; print('[OK] CadQuery + OCP verified successfully!')"
)

echo.
echo === Setup complete! ===
echo Run the backend with: npm run dev
echo.
pause
