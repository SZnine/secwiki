@echo off
chcp 65001 >nul
title SecWiki
cd /d "%~dp0"

echo ========================================
echo SecWiki 安全知识库
echo ========================================
echo.

echo [1/2] 检查环境...
python -c "import fastapi, uvicorn" 2>nul || (
    echo 缺少依赖，正在安装...
    pip install -r requirements.txt -q
)

echo [2/2] 启动服务 (http://localhost:8000)...
echo.
echo 首次启动会自动初始化数据库...
echo 按 Ctrl+C 停止服务
echo ========================================
python -m uvicorn backend.app.main:app --reload --port 8000
