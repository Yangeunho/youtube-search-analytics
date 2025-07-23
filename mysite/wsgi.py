import sys
import os
path = '/var/www/mysite' 
if path not in sys.path:
    sys.path.append(path)
from app import create_app
application = create_app()
app = application
# CORS 설정
@application.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
    response.headers.add('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    return response
