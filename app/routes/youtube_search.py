from flask import Blueprint, request, jsonify, render_template
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import logging
import re
from datetime import datetime
import random
import sys
import os

try:
    utils_path = '/var/www/mysite/app/utils'
    if not os.path.exists(utils_path):
        current_dir = os.path.dirname(os.path.abspath(__file__))
        utils_path = os.path.join(os.path.dirname(current_dir), 'utils')

    if utils_path not in sys.path:
        sys.path.insert(0, utils_path)

    from api_key_manager import ApiKeyManager
    api_key_manager = ApiKeyManager()
    API_KEY_MANAGER_ENABLED = True
    logging.info("✅ API Key Manager가 활성화되었습니다.")
except Exception as e:
    logging.error(f"API Key Manager 모듈 로드 실패: {e}")
    API_KEY_MANAGER_ENABLED = False
    api_key_manager = None

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

API_SERVICE_NAME = 'youtube'
API_VERSION = 'v3'
youtube_bp = Blueprint('youtube', __name__)

def validate_api_key_format(api_key):
    """YouTube API 키 형식이 유효한지 검증합니다."""
    if not api_key or not isinstance(api_key, str): return False
    return bool(re.match(r'^AIza[0-9A-Za-z\-_]{35}$', api_key))

# --- Main Routes ---
@youtube_bp.route('/', methods=['GET'])
def youtube_home():
    return render_template('youtube/index.html')

@youtube_bp.route('/mobile', methods=['GET'])
def youtube_mobile():
    return render_template('youtube/mobile.html')

@youtube_bp.route('/analyzer', methods=['GET'])
def youtube_ai_analyzer():
    """AI 분석 도구 페이지"""
    return render_template('youtube/analyzer.html')

@youtube_bp.route('/search', methods=['POST'])
def Youtube():
    """메인 검색 API 엔드포인트"""
    try:
        data = request.get_json()
        api_key = data.get('apiKey')
        if not api_key or not validate_api_key_format(api_key):
            return jsonify({'error': '유효하지 않거나 누락된 API 키입니다.'}), 400
        
        youtube = build(API_SERVICE_NAME, API_VERSION, developerKey=api_key)
        
        # 실제 검색 로직 (기존 필터링 및 페이지네이션 로직은 여기에 위치)
        search_response = Youtube().list(part='snippet', q=data.get('query'), type='video', maxResults=10).execute()
        return jsonify(search_response)

    except HttpError as e:
        error_message = str(e)
        if hasattr(e, 'error_details') and e.error_details:
             error_message = e.error_details[0].get('message', str(e))
        logger.error(f"YouTube API 오류: {error_message}")
        if API_KEY_MANAGER_ENABLED and api_key:
            api_key_manager.mark_key_as_failed(api_key, error_message)
        return jsonify({'error': f'YouTube API 오류: {error_message}'}), e.resp.status
    except Exception as e:
        logger.error(f"서버 내부 오류: {e}", exc_info=True)
        return jsonify({'error': '서버 내부 오류가 발생했습니다.'}), 500

@youtube_bp.route('/server-key/get', methods=['POST'])
def get_server_key():
    """서버 API 키 발급 엔드포인트"""
    if not API_KEY_MANAGER_ENABLED: return jsonify({'success': False, 'reason': 'API Key Manager 비활성화'}), 503
    data = request.get_json() or {}
    server_key = api_key_manager.get_next_available_key(data.get('excludeKey'))
    if server_key: return jsonify({'success': True, 'apiKey': server_key})
    return jsonify({'success': False, 'reason': '사용 가능한 서버 키가 없습니다.'})

@youtube_bp.route('/server-key/report-failure', methods=['POST'])
def report_key_failure():
    """서버 API 키 실패 보고 엔드포인트"""
    if not API_KEY_MANAGER_ENABLED: return jsonify({'success': False, 'reason': 'API Key Manager 비활성화'}), 503
    data = request.get_json()
    if data and 'apiKey' in data:
        api_key_manager.mark_key_as_failed(data['apiKey'], data.get('errorMessage', ''))
        return jsonify({'success': True})
    return jsonify({'success': False, 'reason': 'apiKey가 누락되었습니다.'}), 400

# --- Admin Routes ---
@youtube_bp.route('/admin/api-keys')
def admin_api_keys_page():
    return render_template('youtube/api_keys_admin.html')

@youtube_bp.route('/admin/api-keys/status', methods=['GET'])
def get_api_keys_status():
    if not API_KEY_MANAGER_ENABLED: return jsonify({'success': False}), 503
    return jsonify({
        'success': True,
        'key_statistics': api_key_manager.get_key_statistics(),
        'failed_keys_info': api_key_manager.get_failed_keys_info()
    })

@youtube_bp.route('/admin/api-keys/list', methods=['GET'])
def list_api_keys():
    if not API_KEY_MANAGER_ENABLED: return jsonify({'success': False}), 503
    
    try:
        existing_keys = api_key_manager._load_api_keys()
        keys_preview = [{'preview': key[:10] + '...' + key[-5:], 'fullKey': key} for key in existing_keys]
        return jsonify({'success': True, 'keys': keys_preview})
        
    except Exception as e:
        logger.error(f"API 키 목록 조회 실패: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@youtube_bp.route('/admin/api-keys/add', methods=['POST'])
def add_api_key():
    if not API_KEY_MANAGER_ENABLED: return jsonify({'success': False}), 503
    data = request.get_json()
    new_key = data.get('apiKey', '').strip()
    if not validate_api_key_format(new_key):
        return jsonify({'success': False, 'message': '유효하지 않은 API 키 형식입니다.'}), 400
    
    success = api_key_manager.add_key(new_key)
    if success: return jsonify({'success': True, 'message': 'API 키가 추가되었습니다.'})
    return jsonify({'success': False, 'message': '이미 존재하거나 추가 중 오류가 발생했습니다.'}), 400

@youtube_bp.route('/admin/api-keys/delete', methods=['POST'])
def delete_api_key():
    if not API_KEY_MANAGER_ENABLED: return jsonify({'success': False}), 503
    data = request.get_json()
    key_to_delete = data.get('apiKey', '').strip()
    if not key_to_delete: return jsonify({'success': False, 'message': '삭제할 키가 없습니다.'}), 400
    
    success = api_key_manager.delete_key(key_to_delete)
    if success: return jsonify({'success': True, 'message': 'API 키가 삭제되었습니다.'})
    return jsonify({'success': False, 'message': '존재하지 않는 키거나 삭제 중 오류가 발생했습니다.'}), 400

@youtube_bp.route('/admin/api-keys/reset-failed', methods=['POST'])
def reset_failed_keys_route():
    if not API_KEY_MANAGER_ENABLED: return jsonify({'success': False}), 503
    count = api_key_manager.reset_failed_keys()
    return jsonify({'success': True, 'message': f'{count}개의 키가 재활성화되었습니다.'})

def generate_demo_data(query, max_results=10):
    """데모용 가짜 YouTube 데이터 생성"""
    demo_videos = []
    sample_titles = [f"{query} 완전 정복", f"{query} 튜토리얼", f"{query} 꿀팁", f"{query} 리뷰"]
    for i in range(max_results):
        seed = i + 1  # 일관된 랜덤 이미지를 위한 시드
        demo_videos.append({
            "id": {"videoId": f"demo_video_{i+1}"},
            "snippet": { 
                "title": sample_titles[i % len(sample_titles)], 
                "channelTitle": "데모 채널",
                "publishedAt": "2023-01-01T00:00:00Z",
                "thumbnails": {
                    "default": {
                        "url": f"https://picsum.photos/120/90?random={seed}",
                        "width": 120,
                        "height": 90
                    },
                    "medium": {
                        "url": f"https://picsum.photos/320/180?random={seed}",
                        "width": 320,
                        "height": 180
                    },
                    "high": {
                        "url": f"https://picsum.photos/480/360?random={seed}",
                        "width": 480,
                        "height": 360
                    }
                }
            },
            "statistics": {"viewCount": str(random.randint(1000, 1000000))}
        })
    return demo_videos

@youtube_bp.route('/demo-search', methods=['GET'])
def api_demo_search():
    """데모 데이터 생성 엔드포인트"""
    query = request.args.get('q', '데모 검색').strip()
    max_results = min(int(request.args.get('maxResults') or 10), 50)
    return jsonify({'items': generate_demo_data(query, max_results)})

@youtube_bp.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    return response

@youtube_bp.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not Found'}), 404

@youtube_bp.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {error}", exc_info=True)
    return jsonify({'error': 'Internal Server Error'}), 500