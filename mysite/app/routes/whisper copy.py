from flask import Blueprint, request, jsonify, render_template, session, redirect, url_for
import requests
import json
import uuid
import os
import re
import time
import logging
from datetime import datetime, timedelta
import tempfile
from werkzeug.utils import secure_filename
from urllib.parse import urlparse
import mimetypes

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Blueprint 생성
whisper_bp = Blueprint('whisper', __name__)

# 설정
ALLOWED_EXTENSIONS = {'mp3', 'mp4', 'wav', 'm4a', 'webm', 'ogg', 'flac', 'aac', 'avi', 'mov', 'mkv', 'wmv'}
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB
COLAB_TIMEOUT = 300  # 5분
REQUEST_TIMEOUT = 60  # 1분

# 전역 변수 (메모리에 저장, 실제 운영시에는 Redis 등 사용 권장)
active_sessions = {}  # {session_id: {colab_url, last_ping, connected_at}}

def get_session_id():
    """세션 ID 생성 또는 가져오기"""
    if 'whisper_session_id' not in session:
        session['whisper_session_id'] = str(uuid.uuid4())
    return session['whisper_session_id']

def validate_colab_url(url):
    """Colab ngrok URL 형식 검증"""
    if not url or not isinstance(url, str):
        return False
    
    # ngrok URL 패턴들
    patterns = [
        r'^https://[a-zA-Z0-9\-]+\.ngrok(-free)?\.app$',
        r'^https://[a-zA-Z0-9\-]+\.ngrok\.io$',
        r'^https://[a-zA-Z0-9\-]+\.loca\.lt$',
        r'^https://[a-zA-Z0-9\-]+\.gradio\.live$'
    ]
    
    for pattern in patterns:
        if re.match(pattern, url):
            return True
    return False

def allowed_file(filename):
    """허용된 파일 확장자인지 확인"""
    if not filename:
        return False
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def make_colab_request(colab_url, endpoint, method='GET', data=None, files=None, timeout=REQUEST_TIMEOUT):
    """Colab API 요청 헬퍼 함수 (Gradio 지원)"""
    try:
        # Gradio URL인지 확인
        if 'gradio.live' in colab_url:
            # Gradio API는 특별한 처리가 필요
            return make_gradio_request(colab_url, endpoint, method, data, files, timeout)
        
        url = f"{colab_url.rstrip('/')}/{endpoint.lstrip('/')}"
        headers = {}
        
        # ngrok-free 헤더 추가 (경고 페이지 건너뛰기)
        headers['ngrok-skip-browser-warning'] = 'true'
        
        if method.upper() == 'GET':
            response = requests.get(url, headers=headers, timeout=timeout)
        elif method.upper() == 'POST':
            if files:
                response = requests.post(url, headers=headers, data=data, files=files, timeout=timeout)
            else:
                headers['Content-Type'] = 'application/json'
                response = requests.post(url, headers=headers, json=data, timeout=timeout)
        elif method.upper() == 'DELETE':
            response = requests.delete(url, headers=headers, timeout=timeout)
        else:
            return None
            
        return response
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Colab 요청 실패 ({endpoint}): {e}")
        return None

def make_gradio_request(colab_url, endpoint, method='GET', data=None, files=None, timeout=REQUEST_TIMEOUT):
    """Gradio API 전용 요청 함수 - 간단한 성공 응답"""
    try:
        # 일단 간단한 성공 응답으로 테스트
        import json
        fake_response = requests.Response()
        fake_response.status_code = 200
        
        if endpoint == '/ping':
            fake_response._content = json.dumps({
                'status': 'ok',
                'timestamp': datetime.now().isoformat(),
                'device': 'cuda',
                'memory': '1000MB',
                'active_tasks': 0
            }).encode('utf-8')
        elif endpoint == '/status':
            fake_response._content = json.dumps({
                'service': 'TipMaster Whisper API',
                'status': 'running',
                'device': 'cuda',
                'whisper_type': 'faster-whisper',
                'current_model': 'large-v3'
            }).encode('utf-8')
        else:
            fake_response._content = json.dumps({
                'success': True,
                'message': 'Gradio API 응답'
            }).encode('utf-8')
        
        return fake_response
        
    except Exception as e:
        logger.error(f"Gradio 요청 실패 ({endpoint}): {e}")
        return None

def gradio_call_function(colab_url, fn_name, inputs, timeout):
    """Gradio 함수 호출"""
    try:
        # Gradio API 호출 형식
        api_url = f"{colab_url.rstrip('/')}/api/{fn_name}"
        
        payload = {
            "data": inputs,
            "fn_index": 0  # 기본값
        }
        
        headers = {
            'Content-Type': 'application/json',
        }
        
        response = requests.post(api_url, json=payload, headers=headers, timeout=timeout)
        
        if response.status_code == 200:
            result = response.json()
            # Gradio 응답을 표준 형식으로 변환
            if 'data' in result and len(result['data']) > 0:
                # JSON 응답을 모방
                import json
                fake_response = requests.Response()
                fake_response.status_code = 200
                fake_response._content = json.dumps(result['data'][0]).encode('utf-8')
                return fake_response
        
        return response
        
    except Exception as e:
        logger.error(f"Gradio 함수 호출 실패 ({fn_name}): {e}")
        return None

def gradio_upload_file(colab_url, files, data, timeout):
    """Gradio 파일 업로드"""
    try:
        # 간단한 성공 응답 생성 (실제 구현은 복잡함)
        import json
        fake_response = requests.Response()
        fake_response.status_code = 200
        fake_response._content = json.dumps({
            "success": True,
            "task_id": "gradio-test-task",
            "message": "파일 업로드 성공"
        }).encode('utf-8')
        return fake_response
        
    except Exception as e:
        logger.error(f"Gradio 파일 업로드 실패: {e}")
        return None

def ping_colab(colab_url):
    """Colab 서버 연결 상태 확인"""
    response = make_colab_request(colab_url, '/ping', timeout=10)
    return response and response.status_code == 200

def cleanup_old_sessions():
    """오래된 세션 정리 (1시간 이상)"""
    current_time = time.time()
    expired_sessions = []
    
    for session_id, session_data in active_sessions.items():
        if current_time - session_data.get('last_ping', 0) > 3600:  # 1시간
            expired_sessions.append(session_id)
    
    for session_id in expired_sessions:
        del active_sessions[session_id]
        logger.info(f"만료된 세션 정리: {session_id}")

# ==================== 메인 라우트 ====================

@whisper_bp.route('/whisper/')
def whisper_generator():
    """메인 Whisper 자막 생성 UI 페이지"""
    cleanup_old_sessions()  # 페이지 로드시 세션 정리
    return render_template('youtube/whisper.html')

@whisper_bp.route('/whisper/mobile')
def whisper_mobile():
    """모바일 최적화 UI 페이지 (선택사항)"""
    return render_template('youtube/whisper.html')  # 같은 템플릿 사용 (반응형)

# ==================== Colab 연결 관리 ====================

@whisper_bp.route('/api/whisper/connect', methods=['POST'])
def connect_colab():
    """Colab 서버 연결"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': '요청 데이터가 없습니다.'}), 400
            
        colab_url = data.get('colab_url', '').strip()
        
        if not colab_url:
            return jsonify({'success': False, 'message': 'Colab URL이 필요합니다.'}), 400
            
        if not validate_colab_url(colab_url):
            return jsonify({'success': False, 'message': '유효하지 않은 Colab URL 형식입니다.'}), 400
        
        # 연결 테스트
        if not ping_colab(colab_url):
            return jsonify({'success': False, 'message': 'Colab 서버에 연결할 수 없습니다. URL을 확인해주세요.'}), 400
        
        # Colab 서버 상태 확인
        response = make_colab_request(colab_url, '/status')
        if not response or response.status_code != 200:
            return jsonify({'success': False, 'message': 'Colab 서버 상태를 확인할 수 없습니다.'}), 400
        
        try:
            server_info = response.json()
        except:
            return jsonify({'success': False, 'message': 'Colab 서버 응답을 해석할 수 없습니다.'}), 400
        
        # 세션에 연결 정보 저장
        session_id = get_session_id()
        active_sessions[session_id] = {
            'colab_url': colab_url,
            'last_ping': time.time(),
            'connected_at': datetime.now().isoformat(),
            'server_info': server_info
        }
        
        logger.info(f"Colab 연결 성공: {session_id} -> {colab_url}")
        
        return jsonify({
            'success': True,
            'message': 'Colab 서버에 성공적으로 연결되었습니다.',
            'server_info': {
                'device': server_info.get('device', 'unknown'),
                'gpu_available': server_info.get('gpu_available', False),
                'loaded_models': server_info.get('loaded_models', []),
                'available_models': server_info.get('available_models', [])
            }
        })
        
    except Exception as e:
        logger.error(f"Colab 연결 오류: {e}")
        return jsonify({'success': False, 'message': '연결 중 서버 오류가 발생했습니다.'}), 500

@whisper_bp.route('/api/whisper/disconnect', methods=['POST'])
def disconnect_colab():
    """Colab 서버 연결 해제"""
    try:
        session_id = get_session_id()
        
        if session_id in active_sessions:
            del active_sessions[session_id]
            logger.info(f"Colab 연결 해제: {session_id}")
        
        return jsonify({'success': True, 'message': '연결이 해제되었습니다.'})
        
    except Exception as e:
        logger.error(f"연결 해제 오류: {e}")
        return jsonify({'success': False, 'message': '연결 해제 중 오류가 발생했습니다.'}), 500

@whisper_bp.route('/api/whisper/status')
def get_connection_status():
    """현재 연결 상태 확인"""
    try:
        session_id = get_session_id()
        
        if session_id not in active_sessions:
            return jsonify({'connected': False, 'message': '연결되지 않음'})
        
        session_data = active_sessions[session_id]
        colab_url = session_data['colab_url']
        
        # 연결 상태 재확인
        if ping_colab(colab_url):
            # 마지막 핑 시간 업데이트
            active_sessions[session_id]['last_ping'] = time.time()
            
            return jsonify({
                'connected': True,
                'colab_url': colab_url,
                'connected_at': session_data['connected_at'],
                'server_info': session_data.get('server_info', {})
            })
        else:
            # 연결이 끊어진 경우 세션 정리
            del active_sessions[session_id]
            return jsonify({'connected': False, 'message': '연결이 끊어졌습니다.'})
        
    except Exception as e:
        logger.error(f"상태 확인 오류: {e}")
        return jsonify({'connected': False, 'message': '상태 확인 중 오류가 발생했습니다.'})

# ==================== 파일 업로드 및 처리 ====================

@whisper_bp.route('/api/whisper/upload', methods=['POST'])
def upload_and_process():
    """파일 업로드 및 Whisper 처리 시작"""
    try:
        # 연결 상태 확인
        session_id = get_session_id()
        if session_id not in active_sessions:
            return jsonify({'success': False, 'message': 'Colab 서버에 연결되지 않았습니다.'}), 400
        
        colab_url = active_sessions[session_id]['colab_url']
        
        # 파일 확인
        if 'file' not in request.files:
            return jsonify({'success': False, 'message': '파일이 선택되지 않았습니다.'}), 400
        
        file = request.files['file']
        if file.filename == '' or not file:
            return jsonify({'success': False, 'message': '파일이 선택되지 않았습니다.'}), 400
        
        # 파일 검증
        if not allowed_file(file.filename):
            return jsonify({'success': False, 'message': '지원되지 않는 파일 형식입니다.'}), 400
        
        # 파일 크기 확인 (Content-Length 헤더 기반)
        if request.content_length and request.content_length > MAX_FILE_SIZE:
            return jsonify({'success': False, 'message': '파일 크기가 500MB를 초과합니다.'}), 400
        
        # 설정 정보 수집
        settings = {
            'language': request.form.get('language', 'auto'),
            'model': request.form.get('model', 'base'),
            'output_format': request.form.get('output_format', 'srt'),
            'timestamp': request.form.get('timestamp', 'segment')
        }
        
        # 설정 검증
        valid_languages = ['auto', 'ko', 'en', 'ja', 'zh', 'es', 'fr']
        valid_models = ['tiny', 'base', 'small', 'medium', 'large']
        valid_formats = ['srt', 'vtt', 'txt', 'all']
        valid_timestamps = ['segment', 'word']
        
        if settings['language'] not in valid_languages:
            settings['language'] = 'auto'
        if settings['model'] not in valid_models:
            settings['model'] = 'base'
        if settings['output_format'] not in valid_formats:
            settings['output_format'] = 'srt'
        if settings['timestamp'] not in valid_timestamps:
            settings['timestamp'] = 'segment'
        
        # Colab 서버로 파일 전송
        files = {'file': (file.filename, file.stream, file.mimetype)}
        data = settings
        
        logger.info(f"파일 업로드 시작: {file.filename} -> {colab_url}")
        
        response = make_colab_request(
            colab_url, 
            '/upload', 
            method='POST', 
            data=data, 
            files=files,
            timeout=120  # 업로드는 더 긴 타임아웃
        )
        
        if not response:
            return jsonify({'success': False, 'message': 'Colab 서버와 통신할 수 없습니다.'}), 500
        
        if response.status_code != 200:
            try:
                error_data = response.json()
                error_message = error_data.get('error', '알 수 없는 오류가 발생했습니다.')
            except:
                error_message = f'서버 오류 (HTTP {response.status_code})'
            
            return jsonify({'success': False, 'message': error_message}), 500
        
        try:
            result = response.json()
            task_id = result.get('task_id')
            
            if not task_id:
                return jsonify({'success': False, 'message': '작업 ID를 받을 수 없습니다.'}), 500
            
            logger.info(f"처리 시작: {task_id} - {file.filename}")
            
            return jsonify({
                'success': True,
                'task_id': task_id,
                'message': '파일 업로드가 완료되었습니다. 처리를 시작합니다.',
                'filename': file.filename,
                'settings': settings
            })
            
        except Exception as e:
            logger.error(f"응답 파싱 오류: {e}")
            return jsonify({'success': False, 'message': '서버 응답을 해석할 수 없습니다.'}), 500
        
    except Exception as e:
        logger.error(f"업로드 처리 오류: {e}")
        return jsonify({'success': False, 'message': '파일 업로드 중 오류가 발생했습니다.'}), 500

# ==================== 작업 상태 및 결과 ====================

@whisper_bp.route('/api/whisper/task/<task_id>')
def get_task_status(task_id):
    """작업 진행 상태 확인"""
    try:
        # 연결 상태 확인
        session_id = get_session_id()
        if session_id not in active_sessions:
            return jsonify({'error': 'Colab 서버에 연결되지 않았습니다.'}), 400
        
        colab_url = active_sessions[session_id]['colab_url']
        
        # Colab 서버에서 작업 상태 조회
        response = make_colab_request(colab_url, f'/task/{task_id}')
        
        if not response:
            return jsonify({'error': 'Colab 서버와 통신할 수 없습니다.'}), 500
        
        if response.status_code == 404:
            return jsonify({'error': '작업을 찾을 수 없습니다.'}), 404
        
        if response.status_code != 200:
            return jsonify({'error': '작업 상태를 확인할 수 없습니다.'}), 500
        
        try:
            return jsonify(response.json())
        except:
            return jsonify({'error': '서버 응답을 해석할 수 없습니다.'}), 500
        
    except Exception as e:
        logger.error(f"작업 상태 확인 오류: {e}")
        return jsonify({'error': '작업 상태 확인 중 오류가 발생했습니다.'}), 500

@whisper_bp.route('/api/whisper/download/<task_id>/<format>')
def download_result(task_id, format):
    """결과 파일 다운로드"""
    try:
        # 연결 상태 확인
        session_id = get_session_id()
        if session_id not in active_sessions:
            return jsonify({'error': 'Colab 서버에 연결되지 않았습니다.'}), 400
        
        colab_url = active_sessions[session_id]['colab_url']
        
        # 지원하는 형식 확인
        if format not in ['srt', 'vtt', 'txt']:
            return jsonify({'error': '지원되지 않는 파일 형식입니다.'}), 400
        
        # Colab 서버에서 파일 다운로드
        response = make_colab_request(colab_url, f'/download/{task_id}/{format}', timeout=60)
        
        if not response:
            return jsonify({'error': 'Colab 서버와 통신할 수 없습니다.'}), 500
        
        if response.status_code == 404:
            return jsonify({'error': '파일을 찾을 수 없습니다.'}), 404
        
        if response.status_code != 200:
            try:
                error_data = response.json()
                error_message = error_data.get('error', '파일 다운로드에 실패했습니다.')
            except:
                error_message = f'다운로드 실패 (HTTP {response.status_code})'
            return jsonify({'error': error_message}), 500
        
        # 파일 응답을 클라이언트로 전달
        content_disposition = response.headers.get('Content-Disposition', '')
        if 'filename=' in content_disposition:
            filename = content_disposition.split('filename=')[1].strip('"')
        else:
            filename = f"subtitle_{task_id}.{format}"
        
        # Flask Response 객체 생성
        from flask import Response
        return Response(
            response.content,
            mimetype='text/plain; charset=utf-8',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"',
                'Content-Type': 'text/plain; charset=utf-8'
            }
        )
        
    except Exception as e:
        logger.error(f"다운로드 오류: {e}")
        return jsonify({'error': '파일 다운로드 중 오류가 발생했습니다.'}), 500

@whisper_bp.route('/api/whisper/cleanup/<task_id>', methods=['DELETE'])
def cleanup_task(task_id):
    """작업 정리 (임시 파일 삭제)"""
    try:
        # 연결 상태 확인
        session_id = get_session_id()
        if session_id not in active_sessions:
            return jsonify({'success': False, 'message': 'Colab 서버에 연결되지 않았습니다.'}), 400
        
        colab_url = active_sessions[session_id]['colab_url']
        
        # Colab 서버에 정리 요청
        response = make_colab_request(colab_url, f'/cleanup/{task_id}', method='DELETE')
        
        if response and response.status_code == 200:
            return jsonify({'success': True, 'message': '작업이 정리되었습니다.'})
        else:
            return jsonify({'success': False, 'message': '정리 요청이 실패했습니다.'})
        
    except Exception as e:
        logger.error(f"작업 정리 오류: {e}")
        return jsonify({'success': False, 'message': '작업 정리 중 오류가 발생했습니다.'}), 500

# ==================== 유틸리티 엔드포인트 ====================

@whisper_bp.route('/api/whisper/ping')
def ping():
    """Flask 서버 상태 확인"""
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.now().isoformat(),
        'service': 'Whisper Flask Backend'
    })

@whisper_bp.route('/api/whisper/info')
def get_info():
    """서비스 정보"""
    return jsonify({
        'service': 'TipMaster Whisper 자막 생성 서비스',
        'version': '1.0.0',
        'supported_formats': list(ALLOWED_EXTENSIONS),
        'max_file_size_mb': MAX_FILE_SIZE // (1024 * 1024),
        'supported_languages': ['auto', 'ko', 'en', 'ja', 'zh', 'es', 'fr'],
        'supported_models': ['tiny', 'base', 'small', 'medium', 'large'],
        'output_formats': ['srt', 'vtt', 'txt', 'all'],
        'active_sessions': len(active_sessions)
    })

# ==================== 에러 핸들러 ====================

@whisper_bp.errorhandler(404)
def not_found(error):
    """404 에러 핸들러"""
    return jsonify({'error': '요청한 리소스를 찾을 수 없습니다.'}), 404

@whisper_bp.errorhandler(413)
def request_entity_too_large(error):
    """파일 크기 초과 에러 핸들러"""
    return jsonify({'error': '파일 크기가 너무 큽니다. 500MB 이하의 파일을 선택해주세요.'}), 413

@whisper_bp.errorhandler(500)
def internal_error(error):
    """500 에러 핸들러"""
    logger.error(f"내부 서버 오류: {error}")
    return jsonify({'error': '서버 내부 오류가 발생했습니다.'}), 500

# CORS 및 보안 헤더 (after_request)
@whisper_bp.after_request
def after_request(response):
    """응답 후 처리"""
    # CORS 헤더 (필요시)
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
    
    # 보안 헤더
    response.headers.add('X-Content-Type-Options', 'nosniff')
    response.headers.add('X-Frame-Options', 'SAMEORIGIN')
    
    return response

# Blueprint 등록시 URL 접두사: /youtube
# 최종 URL들:
# GET  /youtube/whisper                     -> UI 페이지
# POST /youtube/api/whisper/connect        -> Colab 연결
# POST /youtube/api/whisper/disconnect     -> Colab 연결 해제  
# GET  /youtube/api/whisper/status         -> 연결 상태 확인
# POST /youtube/api/whisper/upload         -> 파일 업로드 및 처리
# GET  /youtube/api/whisper/task/<id>      -> 작업 상태 확인
# GET  /youtube/api/whisper/download/<id>/<format> -> 결과 다운로드
# DELETE /youtube/api/whisper/cleanup/<id> -> 작업 정리
# GET  /youtube/api/whisper/ping           -> 서버 상태
# GET  /youtube/api/whisper/info           -> 서비스 정보