from flask import Blueprint, request, jsonify, render_template
import logging

# 로깅 설정
logger = logging.getLogger(__name__)

# 새로운 블루프린트 인스턴스 생성
# url_prefix는 이 블루프린트에 속한 모든 라우트의 기본 경로가 됩니다.
# 예를 들어, /youtube 와 같이 루트 아래에 추가될 경로입니다.
your_new_program_bp = Blueprint(
    'your_new_program', # 블루프린트 이름
    __name__,
    template_folder='templates', # 템플릿 폴더가 필요한 경우 (예: 'templates/your_new_program')
    static_folder='static'       # 정적 파일 폴더가 필요한 경우 (예: 'static/your_new_program')
)

# --- 여기에 새 프로그램의 API 엔드포인트 및 로직을 추가합니다 ---

@your_new_program_bp.route('/')
def new_program_home():
    """
    새 프로그램의 메인 페이지 또는 환영 메시지를 반환합니다.
    이 엔드포인트는 api.tipmaster.co.kr/your_new_program/ 으로 접근됩니다.
    """
    logger.info("새 프로그램 홈 페이지 요청 수신")
    # 템플릿을 렌더링하려면 templates/your_new_program/index.html 파일을 만들어야 합니다.
    # return render_template('your_new_program/index.html') 
    return "<h1>환영합니다! 새로운 프로그램이 성공적으로 실행 중입니다.</h1><p>여기에 프로그램의 기능을 설명하는 HTML을 추가하세요.</p>"

@your_new_program_bp.route('/process_data', methods=['POST'])
def process_data():
    """
    데이터 처리를 위한 예시 API 엔드포인트입니다.
    이 엔드포인트는 api.tipmaster.co.kr/your_new_program/process_data 로 접근됩니다.
    """
    try:
        # JSON 데이터 파싱
        request_data = request.get_json()
        if not request_data:
            return jsonify({'error': 'Request body must be JSON'}), 400
        
        # 여기에 실제 데이터 처리 로직을 구현하세요
        logger.info(f"데이터 처리 요청 수신: {request_data}")
        
        # 예시 응답
        response_data = {
            'status': 'success',
            'message': '데이터가 성공적으로 처리되었습니다.',
            'processed_data': request_data,  # 실제로는 처리된 결과 데이터
            'timestamp': '2024-01-01T00:00:00Z'
        }
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"데이터 처리 중 오류 발생: {e}", exc_info=True)
        return jsonify({'error': f'처리 중 오류가 발생했습니다: {str(e)}'}), 500

@your_new_program_bp.route('/status', methods=['GET'])
def get_status():
    """
    프로그램의 상태를 확인하는 헬스체크 엔드포인트입니다.
    이 엔드포인트는 api.tipmaster.co.kr/your_new_program/status 로 접근됩니다.
    """
    return jsonify({
        'status': 'healthy',
        'service': 'your_new_program',
        'version': '1.0.0',
        'timestamp': '2024-01-01T00:00:00Z'
    })

# 에러 핸들러
@your_new_program_bp.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not Found', 'message': 'The requested resource was not found.'}), 404

@your_new_program_bp.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {error}", exc_info=True)
    return jsonify({'error': 'Internal Server Error', 'message': 'An internal server error has occurred.'}), 500

# CORS 설정 (필요한 경우)
@your_new_program_bp.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    return response