@echo off
echo =========================================
echo  AIEyes YOLO Server - Firewall Setup
echo =========================================
echo.
echo Adding inbound rule for port 8000...
netsh advfirewall firewall add rule name="AIEyes YOLO Server" protocol=TCP dir=in localport=8000 action=allow
if %errorlevel% == 0 (
    echo.
    echo SUCCESS! Your phone can now reach the YOLO server.
    echo Make sure both phone and PC are on the same Wi-Fi.
    echo Server address: http://192.168.100.4:8000
) else (
    echo.
    echo FAILED. Right-click this file and choose "Run as administrator".
)
echo.
pause
