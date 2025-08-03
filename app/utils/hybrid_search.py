"""
하이브리드 검색 시스템
개인 API 키 → 서버 API 키 → 데모 모드 순서로 검색 수행
"""

import logging
from typing import Dict, Any, Optional, Tuple

# Flask import with fallback for testing
try:
    from flask import request
except ImportError:
    # Mock request for testing purposes
    class MockRequest:
        def __init__(self):
            self.remote_addr = '127.0.0.1'
            self.headers = {}
    request = MockRequest()

logger = logging.getLogger(__name__)

class HybridSearchManager:
    """하이브리드 검색 관리자"""
    
    def __init__(self, usage_tracker, api_key_manager):
        """
        초기화
        
        Args:
            usage_tracker: 사용량 추적기 인스턴스
            api_key_manager: API 키 관리자 인스턴스
        """
        self.usage_tracker = usage_tracker
        self.api_key_manager = api_key_manager
    
    def get_client_ip(self) -> str:
        """클라이언트 IP 주소 가져오기"""
        # X-Forwarded-For 헤더 확인 (프록시 환경)
        if request.headers.get('X-Forwarded-For'):
            return request.headers.get('X-Forwarded-For').split(',')[0].strip()
        # X-Real-IP 헤더 확인 (Nginx 환경)
        elif request.headers.get('X-Real-IP'):
            return request.headers.get('X-Real-IP')
        # 직접 연결인 경우
        else:
            return request.remote_addr or '127.0.0.1'
    
    def determine_search_mode(self, personal_api_key: str = None) -> Tuple[str, Optional[str], Dict]:
        """
        검색 모드 결정
        
        Args:
            personal_api_key: 개인 API 키 (선택사항)
            
        Returns:
            Tuple[str, Optional[str], Dict]: (모드, API키, 추가정보)
                - 모드: 'personal', 'server', 'demo'
                - API키: 사용할 API 키 (데모 모드시 None)
                - 추가정보: 사용량 정보 등
        """
        client_ip = self.get_client_ip()
        
        # 1. 개인 API 키가 있으면 우선 사용
        if personal_api_key and personal_api_key.strip():
            logger.info(f"개인 API 키 사용: {client_ip}")
            return 'personal', personal_api_key.strip(), {'mode': 'personal', 'ip': client_ip}
        
        # 2. 서버 API 키 사용 (1일 5회 제한)
        if self.usage_tracker.can_search(client_ip):
            server_api_key = self.api_key_manager.get_next_available_key()
            
            if server_api_key:
                logger.info(f"서버 API 키 사용: {client_ip}, 남은 횟수: {self.usage_tracker.get_remaining_count(client_ip)}")
                return 'server', server_api_key, {
                    'mode': 'server',
                    'ip': client_ip,
                    'remaining_count': self.usage_tracker.get_remaining_count(client_ip)
                }
            else:
                logger.warning(f"서버 API 키 모두 비활성화됨: {client_ip}")
        else:
            logger.info(f"일일 검색 횟수 초과: {client_ip}, 사용량: {self.usage_tracker.get_usage_count(client_ip)}")
        
        # 3. 데모 모드 사용
        logger.info(f"데모 모드 사용: {client_ip}")
        return 'demo', None, {'mode': 'demo', 'ip': client_ip}
    
    def handle_search_success(self, mode: str, api_key: str = None, additional_info: Dict = None):
        """
        검색 성공 처리
        
        Args:
            mode: 검색 모드
            api_key: 사용된 API 키
            additional_info: 추가 정보
        """
        if mode == 'server' and api_key:
            # 서버 API 키 사용 시 사용량 증가
            client_ip = additional_info.get('ip') if additional_info else self.get_client_ip()
            self.usage_tracker.increment_usage(client_ip)
            self.api_key_manager.increment_key_usage(api_key)
            
            logger.info(f"서버 검색 성공: {client_ip}, 남은 횟수: {self.usage_tracker.get_remaining_count(client_ip)}")
        
        elif mode == 'personal':
            logger.info(f"개인 검색 성공: {additional_info.get('ip') if additional_info else self.get_client_ip()}")
        
        elif mode == 'demo':
            logger.info(f"데모 검색 성공: {additional_info.get('ip') if additional_info else self.get_client_ip()}")
    
    def handle_search_failure(self, mode: str, api_key: str = None, error_message: str = None, additional_info: Dict = None):
        """
        검색 실패 처리
        
        Args:
            mode: 검색 모드
            api_key: 사용된 API 키
            error_message: 에러 메시지
            additional_info: 추가 정보
        """
        client_ip = additional_info.get('ip') if additional_info else self.get_client_ip()
        
        if mode == 'server' and api_key:
            # 서버 API 키 실패 시 키 비활성화
            self.api_key_manager.mark_key_as_failed(api_key, error_message)
            logger.warning(f"서버 API 키 실패: {client_ip}, 에러: {error_message}")
        
        elif mode == 'personal':
            logger.warning(f"개인 API 키 실패: {client_ip}, 에러: {error_message}")
        
        elif mode == 'demo':
            logger.warning(f"데모 모드 실패: {client_ip}, 에러: {error_message}")
    
    def get_search_status(self) -> Dict:
        """
        현재 검색 상태 정보 반환
        
        Returns:
            Dict: 검색 상태 정보
        """
        client_ip = self.get_client_ip()
        
        usage_stats = self.usage_tracker.get_daily_stats()
        api_key_stats = self.api_key_manager.get_key_statistics()
        
        return {
            'client_ip': client_ip,
            'user_remaining_searches': self.usage_tracker.get_remaining_count(client_ip),
            'user_usage_count': self.usage_tracker.get_usage_count(client_ip),
            'daily_limit': self.usage_tracker.DAILY_LIMIT,
            'can_use_server_key': self.usage_tracker.can_search(client_ip),
            'has_active_server_keys': self.api_key_manager.has_active_keys(),
            'usage_stats': usage_stats,
            'api_key_stats': api_key_stats
        }

def create_hybrid_search_manager():
    """하이브리드 검색 관리자 인스턴스 생성"""
    try:
        # 현재 파일 기준으로 상대 import 시도
        try:
            from .usage_tracker import usage_tracker
            from .api_key_manager import api_key_manager
            logger.info("상대 import 성공")
        except ImportError:
            # 절대 import 시도
            try:
                from usage_tracker import usage_tracker
                from api_key_manager import api_key_manager
                logger.info("절대 import 성공")
            except ImportError:
                # 경로 추가 후 import 시도
                import sys
                import os
                
                current_dir = os.path.dirname(os.path.abspath(__file__))
                utils_path_server = '/var/www/mysite/app/utils'
                
                if os.path.exists(utils_path_server):
                    if utils_path_server not in sys.path:
                        sys.path.insert(0, utils_path_server)
                    logger.info(f"서버 경로 추가: {utils_path_server}")
                else:
                    if current_dir not in sys.path:
                        sys.path.insert(0, current_dir)
                    logger.info(f"현재 디렉토리 추가: {current_dir}")
                
                from usage_tracker import usage_tracker
                from api_key_manager import api_key_manager
                logger.info("경로 추가 후 import 성공")
        
        logger.info(f"usage_tracker 타입: {type(usage_tracker)}")
        logger.info(f"api_key_manager 타입: {type(api_key_manager)}")
        
        return HybridSearchManager(usage_tracker, api_key_manager)
        
    except Exception as e:
        logger.error(f"하이브리드 검색 관리자 생성 실패: {e}")
        import traceback
        logger.error(f"상세 오류: {traceback.format_exc()}")
        raise

# 전역 인스턴스 생성 (실제 사용 시)
try:
    hybrid_search_manager = create_hybrid_search_manager()
    logger.info("하이브리드 검색 관리자 초기화 완료")
except Exception as e:
    logger.error(f"하이브리드 검색 관리자 초기화 실패: {e}")
    hybrid_search_manager = None