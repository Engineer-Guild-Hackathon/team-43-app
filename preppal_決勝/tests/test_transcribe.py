import io

import backend.main as main_module
import pytest
from backend.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


@pytest.fixture(autouse=True)
def patch_dependencies(monkeypatch):
    """transcribe_file と summarize をテスト用にモックする"""

    def fake_transcribe_file(path, language="ja"):
        # 正常なら transcript 辞書を返す
        return {"text": "これはテストです", "segments": []}

    def fake_summarize(text):
        return "要約: テスト"

    monkeypatch.setattr(main_module, "transcribe_file", fake_transcribe_file)
    monkeypatch.setattr(main_module, "summarize", fake_summarize)
    # rag, add_record など副作用のある処理も必要ならモックしておく
    monkeypatch.setattr(main_module, "rag", type("RagStub", (), {"search_similar": lambda *_: []})())
    monkeypatch.setattr(main_module, "add_record", lambda rec: None)

    yield


def test_transcribe_and_summarize_success():
    # ダミー音声ファイルをアップロード
    file_content = b"dummy audio data"
    files = {"audio": ("test.webm", io.BytesIO(file_content), "audio/webm")}

    response = client.post("/api/transcribe_and_summarize", files=files)

    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    assert data["transcript"] == "これはテストです"
    assert data["summary"] == "要約: テスト"


def test_transcribe_and_summarize_invalid_file(monkeypatch):
    # transcribe_file が失敗するようにモック
    def bad_transcribe_file(path, language="ja"):
        raise ValueError("invalid audio")

    monkeypatch.setattr(main_module, "transcribe_file", bad_transcribe_file)

    file_content = b"not really audio"
    files = {"audio": ("bad.txt", io.BytesIO(file_content), "text/plain")}

    response = client.post("/api/transcribe_and_summarize", files=files)

    # エラー処理で 400 を返す想定
    assert response.status_code == 400
