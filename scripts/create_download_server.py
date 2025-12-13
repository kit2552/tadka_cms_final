#!/usr/bin/env python3
"""
Create a simple download server for the project archive
"""

import os
from http.server import HTTPServer, SimpleHTTPRequestHandler
import threading
import time

class DownloadHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/download':
            # Serve the tar.gz file
            try:
                with open('/app/tadka_complete_project.tar.gz', 'rb') as f:
                    content = f.read()
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/gzip')
                self.send_header('Content-Disposition', 'attachment; filename="tadka_complete_project.tar.gz"')
                self.send_header('Content-Length', str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(f"Error: {str(e)}".encode())
                return
        
        elif self.path == '/' or self.path == '/index.html':
            # Serve download page
            html_content = f"""<!DOCTYPE html>
<html>
<head>
    <title>Tadka Project Download</title>
    <style>
        body {{ font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }}
        .download-card {{ background: #f8f9fa; padding: 30px; border-radius: 10px; border: 1px solid #dee2e6; text-align: center; }}
        .btn {{ background: #007bff; color: white; padding: 15px 30px; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; text-decoration: none; display: inline-block; }}
        .btn:hover {{ background: #0056b3; }}
        .stats {{ background: #e9ecef; padding: 20px; border-radius: 8px; margin: 20px 0; }}
        .file-info {{ margin: 10px 0; }}
    </style>
</head>
<body>
    <div class="download-card">
        <h1>🔥 Tadka News Platform</h1>
        <h2>Complete Project Download</h2>
        
        <div class="stats">
            <div class="file-info"><strong>📦 Archive Size:</strong> {os.path.getsize('/app/tadka_complete_project.tar.gz') / (1024*1024):.1f} MB</div>
            <div class="file-info"><strong>💻 Technology:</strong> FastAPI + React + SQLite</div>
            <div class="file-info"><strong>📁 Includes:</strong> All code + uploaded images + configs</div>
            <div class="file-info"><strong>🗜️ Format:</strong> TAR.GZ (compressed archive)</div>
        </div>
        
        <p>This archive contains your complete Tadka News Platform:</p>
        <ul style="text-align: left; display: inline-block;">
            <li>✅ Complete backend (FastAPI, Python)</li>
            <li>✅ Complete frontend (React, components, pages)</li>
            <li>✅ All uploaded images ({len([f for f in os.listdir('/app/backend/uploads/theater_releases') if f.endswith('.png')])} theater + {len([f for f in os.listdir('/app/backend/uploads/ott_releases') if f.endswith('.png')])} OTT images)</li>
            <li>✅ Database models and schemas</li>
            <li>✅ Configuration files</li>
            <li>✅ Documentation</li>
        </ul>
        
        <br><br>
        <a href="/download" class="btn">📥 Download Complete Project</a>
        
        <div style="margin-top: 30px; font-size: 14px; color: #666;">
            <p><strong>Instructions after download:</strong></p>
            <p>1. Extract: <code>tar -xzf tadka_complete_project.tar.gz</code></p>
            <p>2. Upload to GitHub or use locally</p>
            <p>3. All files and uploads are preserved</p>
        </div>
    </div>
</body>
</html>"""
            
            self.send_response(200)
            self.send_header('Content-Type', 'text/html')
            self.end_headers()
            self.wfile.write(html_content.encode())
            return
        
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not Found")

def start_download_server():
    """Start the download server"""
    server = HTTPServer(('0.0.0.0', 8080), DownloadHandler)
    print(f"""
🌐 Download Server Started!

📥 Direct Download Links:
   • Download Page: http://localhost:8080/
   • Direct Archive: http://localhost:8080/download

📦 Archive Details:
   • File: tadka_complete_project.tar.gz
   • Size: {os.path.getsize('/app/tadka_complete_project.tar.gz') / (1024*1024):.1f} MB
   • Contains: Complete Tadka project with uploads

🔗 Access via browser or wget/curl:
   wget http://localhost:8080/download
   curl -O http://localhost:8080/download

Press Ctrl+C to stop the server
""")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Download server stopped")
        server.shutdown()

if __name__ == "__main__":
    start_download_server()