@echo off
chcp 65001 >nul
echo ========================================
echo SecWiki 安全知识库
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] 初始化数据库...
python -m backend.app.seed
if errorlevel 1 (
    echo 初始化失败，请确保已安装依赖：pip install -r requirements.txt
    pause
    exit /b 1
)

echo.
echo [2/3] 启动后端服务...
start "SecWiki Backend" cmd /k "python -m uvicorn backend.app.main:app --reload --port 8000"

echo [3/3] 等待服务启动...
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo 启动完成！
echo 前端地址: http://localhost:8000
echo.
echo 按任意键打开浏览器...
pause >nul
start http://localhost:8000
