import backend.main as main_module
import pytest
from backend.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_recordings():
    resp = client.get("/api/recordings")
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_recording_audio_200(monkeypatch, tmp_path):
    f = tmp_path / "43.webm"
    f.write_bytes(b"\x1a\x45\xdf\xa3")  # 適当なダミーバイト

    # rid=43 のときだけ辞書（record）を返す。それ以外は falsy（=404へ）
    def fake_get_record(rid: str):
        if rid == "43":
            return {"id": "43", "audio_path": str(f)}
        return {}

    monkeypatch.setattr(main_module, "get_record", fake_get_record)

    resp = client.get("/api/recordings/43/audio")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("audio/webm")


def test_get_recording_audio_404(monkeypatch):
    # 常に falsy を返す → recording not found で 404
    monkeypatch.setattr(main_module, "get_record", lambda rid: {})

    resp = client.get("/api/recordings/7/audio")
    assert resp.status_code == 404
    # detail の中身は実装どおり（どちらでもOKにするなら下記のように OR で判定）
    assert resp.json()["detail"] in ("recording not found", "audio not found")
