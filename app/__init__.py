from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

def create_app():
    app = Flask(__name__)
    app.secret_key = "tipmaster-secret-key-2025"
    
    # CORS 설정
    CORS(app, resources={
        r"/*": {
            "origins": "*",
            "supports_credentials": True,
            "methods": ["GET", "POST", "OPTIONS"],
            "allow_headers": ["Content-Type"]
        }
    })
    
    # 환경변수 로드
    load_dotenv()
    
    # 핵심 블루프린트 등록
    from .routes.ohlcv import bp as ohlcv_bp
    from .routes.backtesting import bp as backtesting_bp
    from .routes.image_editor import bp as image_editor_bp
    
    app.register_blueprint(ohlcv_bp, url_prefix='/api/data')
    app.register_blueprint(backtesting_bp, url_prefix='/api/backtesting')
    app.register_blueprint(image_editor_bp, url_prefix='/image_editor')

    # YouTube 서비스 (에러 처리 포함)
    try:
        from .routes.youtube_search import youtube_bp
        app.register_blueprint(youtube_bp, url_prefix='/youtube')
        print("✅ YouTube 검색 서비스가 성공적으로 추가되었습니다.")
        print("📍 접속 경로: /youtube/")
    except ImportError as e:
        print(f"⚠️ YouTube 서비스 로드 실패 (파일 없음): {e}")
        print("💡 youtube_search.py 파일을 확인해주세요.")
    except Exception as e:
        print(f"❌ YouTube 서비스 등록 중 오류: {e}")
        print("🔄 기존 서비스는 정상적으로 작동합니다.")

    return app