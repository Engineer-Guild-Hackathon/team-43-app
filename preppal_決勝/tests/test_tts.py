import backend.main as main_module
import pytest
from backend.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_tts_200(monkeypatch, tmp_path):
    f = tmp_path / "43.webm"
    f.write_bytes(b"\x1a\x45\xdf\xa3")  # 適当なダミーバイト

    # rid=43 のときだけ辞書（record）を返す。それ以外は falsy（=404へ）
    def fake_get_record(rid: str):
        if rid == "43":
            return {"id": "43", "audio_path": str(f), "summary": "test"}
        return {}

    monkeypatch.setattr(main_module, "get_record", fake_get_record)

    resp = client.get("/api/tts/43")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("audio/mpeg")


def test_tts_400(monkeypatch):
    monkeypatch.setattr(main_module, "get_record", lambda rid: {})

    resp = client.get("/api/recordings/7/audio")
    assert resp.status_code == 404
